import { createHash, timingSafeEqual } from 'node:crypto'
import { runMarketPriceIngestion } from '@/lib/scraper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

let running = false
let lastStartedAt = 0

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false
  const expected = createHash('sha256').update(secret).digest()
  const received = createHash('sha256').update(authorization.slice(7)).digest()
  return timingSafeEqual(expected, received)
}

export async function GET(request: Request) {
  return trigger(request)
}

export async function POST(request: Request) {
  return trigger(request)
}

async function trigger(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (running) return Response.json({ error: 'A scrape is already running.' }, { status: 409 })
  if (Date.now() - lastStartedAt < 60_000) return Response.json({ error: 'Scrape rate limit exceeded.' }, { status: 429 })
  running = true
  lastStartedAt = Date.now()
  try {
    const summary = await runMarketPriceIngestion()
    const status = summary.status === 'failed' ? 502 : summary.status === 'partial' ? 207 : 200
    return Response.json(summary, { status })
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Market price ingestion failed',
    }, { status: 500 })
  } finally {
    running = false
  }
}
