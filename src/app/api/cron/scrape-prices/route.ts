import { runMarketPriceIngestion } from '@/lib/scraper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authorization = request.headers.get('authorization')
  return authorization === `Bearer ${secret}`
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
  try {
    const summary = await runMarketPriceIngestion()
    const status = summary.status === 'failed' ? 502 : summary.status === 'partial' ? 207 : 200
    return Response.json(summary, { status })
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Market price ingestion failed',
    }, { status: 500 })
  }
}
