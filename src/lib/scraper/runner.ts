import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../supabase'
import { GenericHtmlJsonAdapter } from './adapters/generic'
import { SerpApiAdapter } from './adapters/serpapi'
import { normalizeRawItem } from './normalize'
import { MaterialPriceRecordSchema, PriceSourceRecordSchema, type MaterialPriceRecord, type PriceSourceAdapter, type PriceSourceRecord } from './types'

const noProductsMessage = 'No products were extracted. Check the source URL and confirm it exposes supported product data.'

async function collectRecords(source: PriceSourceRecord, adapters: Map<string, PriceSourceAdapter>, scrapedAt: string) {
  const adapter = adapters.get(source.adapter_type.toLowerCase())
  if (!adapter) throw new Error(`Unknown adapter_type: ${source.adapter_type}`)
  const rawItems = await adapter.scrape(source)
  if (!rawItems.length) throw new Error(noProductsMessage)
  const records = rawItems.map(raw =>
    MaterialPriceRecordSchema.parse(normalizeRawItem(raw, source, scrapedAt)))
  if (!records.length) throw new Error(noProductsMessage)
  return records
}

async function updateRun(supabase: SupabaseClient, runId: string, values: Record<string, unknown>) {
  const { error } = await supabase.from('scrape_runs').update(values).eq('id', runId)
  if (error) throw new Error(`Could not update scrape run: ${error.message}`)
}

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
      const scrapedAt = new Date().toISOString()
      const records = await collectRecords(source, adapters, scrapedAt)
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
    sources = PriceSourceRecordSchema.array().parse(data ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await updateRun(supabase, run.id, {
        finished_at: new Date().toISOString(), status: 'failed', items_collected: 0, error_log: [message],
      })
    } catch (updateError) {
      throw new Error(`${message}; could not record failed run: ${updateError instanceof Error ? updateError.message : String(updateError)}`)
    }
    return { runId: run.id, status: 'failed', itemsCollected: 0, sources: [], errors: [message] }
  }

  const adapters = options.adapters ?? buildAdapterRegistry()
  const sourceResults: SourceResult[] = []
  const errors: string[] = []
  let itemsCollected = 0
  if (!sources.length) errors.push('No enabled price sources are configured.')

  for (const [index, source] of sources.entries()) {
    try {
      const scrapedAt = new Date().toISOString()
      const records: MaterialPriceRecord[] = await collectRecords(source, adapters, scrapedAt)
      const scraped = new Date(scrapedAt)
      const utcDay = scraped.getUTCDay()
      scraped.setUTCDate(scraped.getUTCDate() - (utcDay === 0 ? 6 : utcDay - 1))
      const snapshotDate = scraped.toISOString().slice(0, 10)
      const payload = records.map(record => ({ ...record, snapshot_date: snapshotDate }))
      const { error } = await supabase
        .from('material_prices')
        .upsert(payload, { onConflict: 'source_id,sku,product_url,snapshot_date', ignoreDuplicates: false })
      if (error) throw error
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

  const status = itemsCollected === 0 ? 'failed' : errors.length ? 'partial' : 'success'
  if (itemsCollected === 0 && sources.length) errors.push('No price records were collected from any enabled source.')
  await updateRun(supabase, run.id, {
    finished_at: new Date().toISOString(),
    status,
    items_collected: itemsCollected,
    error_log: errors,
  })

  return { runId: run.id, status, itemsCollected, sources: sourceResults, errors }
}
