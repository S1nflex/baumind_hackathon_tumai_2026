import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../supabase'
import { GenericHtmlJsonAdapter } from './adapters/generic'
import { SerpApiAdapter } from './adapters/serpapi'
import { normalizeRawItem } from './normalize'
import { MaterialPriceRecordSchema, type MaterialPriceRecord, type PriceSourceAdapter, type PriceSourceRecord } from './types'

export type SourceResult = {
  sourceId: string
  sourceName: string
  itemsCollected: number
  error: string | null
}

export type ScrapeSummary = {
  runId: string
  status: 'success' | 'partial' | 'failed'
  itemsCollected: number
  sources: SourceResult[]
  errors: string[]
}

export function buildAdapterRegistry(): Map<string, PriceSourceAdapter> {
  const generic = new GenericHtmlJsonAdapter()
  const serp = new SerpApiAdapter()
  return new Map<string, PriceSourceAdapter>([
    ['generic', generic],
    ['generic-html', generic],
    ['generic-json', generic],
    ['html', generic],
    ['json', generic],
    ['serpapi', serp],
    ['google-shopping', serp],
  ])
}

export async function executeAdapters(
  sources: PriceSourceRecord[],
  adapters: Map<string, PriceSourceAdapter>,
  delayMs = 750,
): Promise<SourceResult[]> {
  const results: SourceResult[] = []
  for (const [index, source] of sources.entries()) {
    try {
      const adapter = adapters.get(source.adapter_type.toLowerCase())
      if (!adapter) throw new Error(`Unknown adapter_type: ${source.adapter_type}`)
      const scrapedAt = new Date().toISOString()
      const rawItems = await adapter.scrape(source)
      const records = rawItems.map(raw => MaterialPriceRecordSchema.parse(normalizeRawItem(raw, source, scrapedAt)))
      results.push({ sourceId: source.id, sourceName: source.name, itemsCollected: records.length, error: null })
      if (index < sources.length - 1 && delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs))
    } catch (error) {
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        itemsCollected: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return results
}

export async function runMarketPriceIngestion(options: {
  supabase?: SupabaseClient
  adapters?: Map<string, PriceSourceAdapter>
  delayMs?: number
} = {}): Promise<ScrapeSummary> {
  const supabase = options.supabase ?? getSupabaseAdmin()
  const startedAt = new Date().toISOString()
  const { data: run, error: runError } = await supabase
    .from('scrape_runs')
    .insert({ started_at: startedAt, status: 'running', items_collected: 0, error_log: [] })
    .select('id')
    .single()
  if (runError || !run) throw new Error(`Could not create scrape run: ${runError?.message ?? 'missing run id'}`)

  let sources: PriceSourceRecord[]
  try {
    const { data, error } = await supabase
      .from('price_sources')
      .select('id,name,base_url,adapter_type,enabled,created_at')
      .eq('enabled', true)
      .order('name')
    if (error) throw error
    sources = (data ?? []) as PriceSourceRecord[]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await supabase.from('scrape_runs').update({
      finished_at: new Date().toISOString(), status: 'failed', items_collected: 0, error_log: [message],
    }).eq('id', run.id)
    return { runId: run.id, status: 'failed', itemsCollected: 0, sources: [], errors: [message] }
  }

  const adapters = options.adapters ?? buildAdapterRegistry()
  const sourceResults: SourceResult[] = []
  const errors: string[] = []
  let itemsCollected = 0

  for (const [index, source] of sources.entries()) {
    try {
      const adapter = adapters.get(source.adapter_type.toLowerCase())
      if (!adapter) throw new Error(`Unknown adapter_type: ${source.adapter_type}`)
      const scrapedAt = new Date().toISOString()
      const rawItems = await adapter.scrape(source)
      const records: MaterialPriceRecord[] = rawItems.map(raw =>
        MaterialPriceRecordSchema.parse(normalizeRawItem(raw, source, scrapedAt)))
      if (records.length) {
        const scraped = new Date(scrapedAt)
        const utcDay = scraped.getUTCDay()
        scraped.setUTCDate(scraped.getUTCDate() - (utcDay === 0 ? 6 : utcDay - 1))
        const snapshotDate = scraped.toISOString().slice(0, 10)
        const payload = records.map(record => ({ ...record, snapshot_date: snapshotDate }))
        const { error } = await supabase
          .from('material_prices')
          .upsert(payload, { onConflict: 'source_id,sku,product_url,snapshot_date', ignoreDuplicates: false })
        if (error) throw error
      }
      itemsCollected += records.length
      sourceResults.push({ sourceId: source.id, sourceName: source.name, itemsCollected: records.length, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${source.name}: ${message}`)
      sourceResults.push({ sourceId: source.id, sourceName: source.name, itemsCollected: 0, error: message })
    }
    if (index < sources.length - 1) {
      const delayMs = options.delayMs ?? 750
      if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  const status = errors.length === 0 ? 'success' : sourceResults.length > 0 ? 'partial' : 'failed'
  await supabase.from('scrape_runs').update({
    finished_at: new Date().toISOString(),
    status,
    items_collected: itemsCollected,
    error_log: errors,
  }).eq('id', run.id)

  return { runId: run.id, status, itemsCollected, sources: sourceResults, errors }
}
