import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { errorResponse } from '@/lib/http'
import { workspaceId } from '@/lib/workspace'
import { originalFile, requireProject } from '@/lib/store'

export const runtime = 'nodejs'
const exec = promisify(execFile)
const numberAttr = (attrs: string, name: string) => Number(new RegExp(`\\b${name}="([\\d.]+)"`).exec(attrs)?.[1])

function decodeEntities(value: string) {
  return value.replace(/&#(?:x([0-9a-f]+)|(\d+));|&(amp|lt|gt|quot|apos);/gi, (entity, hex: string | undefined, decimal: string | undefined, named: string | undefined) => {
    if (named) return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[named.toLowerCase()] || entity
    const cp = Number.parseInt(hex || decimal, hex ? 16 : 10)
    return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : entity
  })
}

// Poppler's -bbox output gives coordinates in PDF-page points. We return percentages,
// so the browser can accurately highlight at any responsive image width or zoom.
function extractWords(xhtml: string) {
  const page = /<page\s+([^>]+)>/.exec(xhtml)
  const width = numberAttr(page?.[1] || '', 'width')
  const height = numberAttr(page?.[1] || '', 'height')
  if (!(width > 0 && height > 0)) return []
  return [...xhtml.matchAll(/<word\s+([^>]+)>([\s\S]*?)<\/word>/g)].flatMap(match => {
    const attrs = match[1]
    const x1 = numberAttr(attrs, 'xMin'), x2 = numberAttr(attrs, 'xMax')
    const y1 = numberAttr(attrs, 'yMin'), y2 = numberAttr(attrs, 'yMax')
    if (![x1,x2,y1,y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) return []
    return [{ text: decodeEntities(match[2].replace(/<[^>]*>/g, '')),
      x: Math.max(0, 100 * x1 / width), y: Math.max(0, 100 * y1 / height),
      w: Math.min(100, 100 * (x2 - x1) / width), h: Math.min(100, 100 * (y2 - y1) / height) }]
  })
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let dir: string | undefined
  try {
    const { id } = await context.params
    const workspace = await workspaceId()
    const project = requireProject(workspace, id)
    if (!project.hasOriginal || project.format !== 'PDF') {
      return Response.json({ error: 'PDF-Vorschau nur für importierte PDF-Dateien verfügbar.' }, { status: 400 })
    }
    const url = new URL(request.url)
    const rawPage = url.searchParams.get('page') || '1'
    const pageNumber = Number(rawPage)
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > (project.pages || 1000) || pageNumber > 1000) {
      return Response.json({ error: 'Ungültige PDF-Seite.' }, { status: 400 })
    }
    const bytes = originalFile(workspace, id)
    if (!Buffer.from(bytes).subarray(0,5).equals(Buffer.from('%PDF-'))) {
      return Response.json({ error: 'Die Originaldatei ist kein PDF.' }, { status: 415 })
    }
    dir = await mkdtemp(join(tmpdir(), 'baumind-pdf-'))
    const sourcePath = join(dir, 'source.pdf')
    const imagePrefix = join(dir, 'page')
    await writeFile(sourcePath, bytes)
    const common = { timeout: 25000, maxBuffer: 20 * 1024 * 1024 }
    const [_, bbox] = await Promise.all([
      exec('pdftoppm', ['-f', String(pageNumber), '-l', String(pageNumber), '-singlefile', '-scale-to', '1400', '-png', sourcePath, imagePrefix], common),
      exec('pdftotext', ['-f', String(pageNumber), '-l', String(pageNumber), '-bbox', '-enc', 'UTF-8', sourcePath, '-'], common),
    ])
    const png = await readFile(`${imagePrefix}.png`)
    return Response.json({ page: pageNumber, count: project.pages || null,
      image: `data:image/png;base64,${png.toString('base64')}`, words: extractWords(bbox.stdout) },
      { headers: { 'Cache-Control':'private, no-store' } })
  } catch (error) {
    const message = (error as Error).message || ''
    if (message.includes('ENOENT')) {
      return Response.json({ error: 'PDF-Vorschau benötigt Poppler. Bitte npm run setup:pdf ausführen.' }, { status: 503 })
    }
    return errorResponse(error)
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
