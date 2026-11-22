import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import https from 'node:https'
import type { IncomingHttpHeaders } from 'node:http'
import { canonicalHost } from './domain'

const requestTimeoutMs = 8000
const maxPageBytes = 1_500_000
const maxRedirects = 2

type PageResponse = { status: number; headers: IncomingHttpHeaders; body: string; location?: string }

function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const octets = address.split('.').map(Number)
    const [a, b, c] = octets
    if (octets.length !== 4 || octets.some(value => value < 0 || value > 255)) return false
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && ((b === 0 && (c === 0 || c === 2)) || b === 168 || b === 88 && c === 99)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
      (a === 203 && b === 0 && c === 113)
    )
  }
  if (family !== 6) return false
  const normalized = address.toLowerCase()
  const groups = normalized.split(':')
  return /^[23]/.test(normalized) && !(groups[0] === '2001' && ['db8', '0db8'].includes(groups[1]))
}

async function publicAddresses(hostname: string) {
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error('Private or reserved IP addresses are not fetched.')
    return [{ address: hostname, family: isIP(hostname) }]
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Local hostnames are not fetched.')
  }
  const addresses = await dnsLookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) {
    throw new Error('The hostname resolves to a private or reserved address.')
  }
  return addresses
}

function requestPage(url: URL, addresses: Awaited<ReturnType<typeof publicAddresses>>): Promise<PageResponse> {
  const selected = addresses[0]
  return new Promise((resolve, reject) => {
    let finished = false
    const finishError = (error: Error) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      reject(error)
    }
    const finishResponse = (value: PageResponse) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve(value)
    }
    const request = https.request(url, {
      method: 'GET',
      maxHeaderSize: 16_384,
      headers: {
        'User-Agent': 'BautonMarketIngestion/1.0 (+public product metadata reader)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
      },
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
    }, response => {
      const location = response.headers.location
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400 && location) {
        response.resume()
        response.once('end', () => finishResponse({ status, headers: response.headers, body: '', location }))
        return
      }
      const chunks: Buffer[] = []
      let total = 0
      response.on('data', (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        total += bytes.length
        if (total > maxPageBytes) {
          request.destroy(new Error(`Page exceeds the ${maxPageBytes}-byte extraction limit.`))
          return
        }
        chunks.push(bytes)
      })
      response.once('end', () => finishResponse({
        status, headers: response.headers, body: Buffer.concat(chunks).toString('utf8'),
      }))
      response.once('error', finishError)
    })
    const timer = setTimeout(() => request.destroy(new Error('Page request timed out.')), requestTimeoutMs)
    request.once('error', finishError)
    request.end()
  })
}

export async function fetchPublicHtml(input: string): Promise<{ url: string; html: string }> {
  let url: URL
  try { url = new URL(input) } catch { throw new Error('Search result is not a valid URL.') }
  const originalHost = url.hostname.toLowerCase()
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password) {
      throw new Error('Only credential-free HTTPS pages can be fetched.')
    }
    if (canonicalHost(url.hostname) !== canonicalHost(originalHost)) {
      throw new Error('Cross-domain redirects are not followed.')
    }
    const response = await requestPage(url, await publicAddresses(url.hostname))
    if (response.location) {
      if (redirects === maxRedirects) throw new Error('Page exceeded the redirect limit.')
      url = new URL(response.location, url)
      continue
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`Page request failed (HTTP ${response.status}).`)
    const contentType = response.headers['content-type'] ?? ''
    if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType)) {
      throw new Error(`Unsupported page content type: ${contentType || 'missing'}.`)
    }
    return { url: url.href, html: response.body }
  }
  throw new Error('Page could not be fetched.')
}
