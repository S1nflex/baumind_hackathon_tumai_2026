import { workspaceId } from '@/lib/workspace'
import { errorResponse } from '@/lib/http'
import { configuredAiModel } from '@/lib/ai-provider'
import { integrationReadiness } from '@/lib/integration-readiness'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await workspaceId()
    const configured = configuredAiModel('review')
    const readiness = integrationReadiness()
    const supabase = Boolean(process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
    let ready: boolean | null = null
    let marketCatalogCount:number|null = null
    let marketCatalogError:string|null = null
    if(supabase && new URL(request.url).searchParams.get('check') === '1') {
      try {
        const outcome = await Promise.race([
          getSupabaseAdmin().from('material_prices').select('id',{count:'exact',head:true}),
          new Promise<never>((_resolve,reject)=>setTimeout(()=>reject(new Error('timeout')),6000)),
        ])
        ready = !outcome.error
        marketCatalogCount = outcome.count ?? null
        if(outcome.error)marketCatalogError='Supabase-Tabelle material_prices nicht verfügbar oder Zugriff verweigert.'
      } catch {ready=false;marketCatalogError='Supabase nicht erreichbar (Timeout / Konfiguration).'}
    }
    return Response.json({
      ai: { configured: Boolean(configured), provider: configured?.provider ?? null },
      fullImport: { configured: readiness.readyForFullImport, missing: readiness.missing, marketSources: readiness.marketSources },
      supabase: { configured: supabase, ready, marketCatalogCount, marketCatalogError },
      shopping: { configured: Boolean(process.env.SERPAPI_API_KEY), cron: Boolean(process.env.CRON_SECRET) },
      // Do not return key fragments, db credentials, or saved secret values.
      projectStorage: 'local-sqlite',
      aiDataSharing: 'only-with-explicit-import-opt-in',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return errorResponse(error) }
}
