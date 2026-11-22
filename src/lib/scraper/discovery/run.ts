import { parseShoppingResults, type ShoppingItem } from '../../suppliers'
import type { RawScrapedItem } from '../types'
import { extractUniversalProducts } from './extractor'
import type { DiscoveryQuery } from './catalog'
import type { SearchProvider, WebSearchResult } from './provider'
import { isConstructionRelevant } from './relevance'
import { fetchPublicHtml } from './safe-fetch'
import { canonicalHost } from './domain'

export type DiscoveredCandidate = {
  baseUrl: string
  supplierName: string
  raw: RawScrapedItem
}

export type DiscoveredSource = { baseUrl: string; supplierName: string }

export type DiscoveryResult = {
  candidates: DiscoveredCandidate[]
  sources: DiscoveredSource[]
  errors: string[]
}

export type PageFetcher = (url: string) => Promise<{ url: string; html: string }>

const maxWebResultsPerQuery = 5
const maxProductResultsPerQuery = 25
const maxDomainsPerRun = 40
const maxPagesPerRun = 12

function sourceUrl(value: string | undefined): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password) return null
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'google.com' || hostname.endsWith('.google.com') ||
      hostname === 'google.de' || hostname.endsWith('.google.de') ||
      hostname === 'serpapi.com' || hostname.endsWith('.serpapi.com')) return null
    return url
  } catch {
    return null
  }
}

function shoppingCandidate(item: ShoppingItem, query: DiscoveryQuery): DiscoveredCandidate | null {
  if (!item.title || !isConstructionRelevant(item.title, null, query)) return null
  const parsed = parseShoppingResults([item], query.query, new Date().toISOString())[0]
  if (!parsed) return null
  const url = sourceUrl(item.product_link ?? item.link ?? parsed.url)
  if (!url) return null
  const product = item.title.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|qm|m³|m3|cbm|kg|g|lfm|laufmeter|meter|m|liter|litre|ltr|l|stk|stück|pcs?|st)(?![a-zäöü])/i)
  if (!product) return null
  const raw: RawScrapedItem = {
    sku: null,
    materialName: item.title,
    netPrice: parsed.net,
    grossPrice: null,
    shippingCost: parsed.delivery,
    currency: 'EUR',
    unit: product[2],
    packSize: Number(product[1].replace(',', '.')),
    category: query.category,
    supplierName: parsed.merchant,
    productUrl: url.href,
  }
  return { baseUrl: url.origin, supplierName: parsed.merchant, raw }
}

function supplierFrom(result: WebSearchResult, url: URL): string {
  return result.source?.trim().slice(0, 160) || url.hostname.replace(/^www\./i, '').slice(0, 160)
}

function wait(delayMs: number) {
  return delayMs > 0 ? new Promise(resolve => setTimeout(resolve, delayMs)) : Promise.resolve()
}

export async function discoverConstructionProducts(
  provider: SearchProvider,
  catalog: DiscoveryQuery[],
  options: { delayMs?: number; fetchPage?: PageFetcher } = {},
): Promise<DiscoveryResult> {
  const candidates: DiscoveredCandidate[] = []
  const sources: DiscoveredSource[] = []
  const errors: string[] = []
  const hosts = new Set<string>()
  const fetchedHosts = new Set<string>()
  const pageFetcher = options.fetchPage ?? fetchPublicHtml
  const delayMs = options.delayMs ?? 750

  for (const query of catalog.slice(0, 20)) {
    let shopping: ShoppingItem[] = []
    try { shopping = await provider.searchShopping(query.query) }
    catch (error) {
      errors.push(`${query.query} (shopping): ${error instanceof Error ? error.message : String(error)}`)
    }
    for (const item of shopping.slice(0, maxProductResultsPerQuery)) {
      const candidate = shoppingCandidate(item, query)
      if (!candidate) continue
      const host = canonicalHost(new URL(candidate.baseUrl).hostname)
      if (!hosts.has(host) && hosts.size >= maxDomainsPerRun) continue
      hosts.add(host)
      sources.push({ baseUrl: candidate.baseUrl, supplierName: candidate.supplierName })
      candidates.push(candidate)
    }
    await wait(delayMs)

    let webResults: WebSearchResult[] = []
    try { webResults = await provider.searchWeb(query.query) }
    catch (error) {
      errors.push(`${query.query} (web): ${error instanceof Error ? error.message : String(error)}`)
    }
    for (const result of webResults.slice(0, maxWebResultsPerQuery)) {
      if (!isConstructionRelevant(`${result.title} ${result.snippet ?? ''}`, null, query)) continue
      const target = sourceUrl(result.link)
      if (!target) continue
      const host = canonicalHost(target.hostname)
      if (fetchedHosts.has(host) || !hosts.has(host) && hosts.size >= maxDomainsPerRun ||
        fetchedHosts.size >= maxPagesPerRun) continue
      hosts.add(host)
      fetchedHosts.add(host)
      sources.push({ baseUrl: target.origin, supplierName: supplierFrom(result, target) })
      try {
        const page = await pageFetcher(target.href)
        const finalUrl = sourceUrl(page.url)
        if (!finalUrl || canonicalHost(finalUrl.hostname) !== host) {
          throw new Error('Fetched page changed to an unsupported domain.')
        }
        const supplierName = supplierFrom(result, finalUrl)
        const products = extractUniversalProducts(page.html, finalUrl.href, supplierName)
        for (const raw of products) {
          if (!isConstructionRelevant(raw.materialName, raw.category, query)) continue
          raw.category = query.category
          candidates.push({ baseUrl: finalUrl.origin, supplierName, raw })
        }
      } catch (error) {
        errors.push(`${target.hostname}: ${error instanceof Error ? error.message : String(error)}`)
      }
      await wait(delayMs)
    }
  }

  return { candidates, sources, errors }
}
