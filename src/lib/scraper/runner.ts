import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../supabase'
import { GenericHtmlJsonAdapter } from './adapters/generic'
import { SerpApiAdapter } from './adapters/serpapi'
import { normalizeRawItem } from './normalize'
import { constructionQueryCatalog, type DiscoveryQuery } from './discovery/catalog'
import { discoverConstructionProducts, type DiscoveredCandidate, type DiscoveredSource } from './discovery/run'
import { SerpApiSearchProvider, type SearchProvider } from './discovery/provider'
import type { PageFetcher } from './discovery/run'
import { isConstructionRelevant } from './discovery/relevance'
import { canonicalHost } from './discovery/domain'
import { MaterialPriceRecordSchema, PriceSourceRecordSchema, type MaterialPriceRecord, type PriceSourceAdapter, type PriceSourceRecord } from './types'

const noProductsMessage = 'No products were extracted. Check the source URL and confirm it exposes supported product data.'
const batchSize = 200

type PendingRecord = { source: PriceSourceRecord; record: MaterialPriceRecord }

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

function sourceHost(source: PriceSourceRecord): string | null {
  try { return canonicalHost(new URL(source.base_url).hostname) } catch { return null }
}

async function registerDiscoveredSources(
  supabase: SupabaseClient,
  candidates: DiscoveredSource[],
  existing: PriceSourceRecord[],
): Promise<{ sourceByHost: Map<string, PriceSourceRecord>; errors: string[] }> {
  const sourceByHost = new Map<string, PriceSourceRecord>()
  for (const source of existing) {
    if (source.adapter_type !== 'discovered') continue
    const host = sourceHost(source)
    if (host) sourceByHost.set(host, source)
  }
  const errors: string[] = []
  for (const candidate of candidates) {
    const url = new URL(candidate.baseUrl)
    const host = canonicalHost(url.hostname)
    const previous = sourceByHost.get(host)
    if (previous) {
      const { error } = await supabase.from('price_sources')
        .update({ enabled: true, base_url: url.origin, name: candidate.supplierName })
        .eq('id', previous.id)
      if (error) errors.push(`${host}: could not refresh discovered source: ${error.message}`)
      else sourceByHost.set(host, { ...previous, enabled: true, base_url: url.origin, name: candidate.supplierName })
      continue
    }

    const { data, error } = await supabase.from('price_sources')
      .insert({
        name: candidate.supplierName,
        base_url: url.origin,
        adapter_type: 'discovered',
        enabled: true,
      })
      .select('id,name,base_url,adapter_type,enabled,created_at')
      .single()
    if (error || !data) {
      errors.push(`${host}: could not register discovered source: ${error?.message ?? 'missing source id'}`)
      continue
    }
    const parsed = PriceSourceRecordSchema.safeParse(data)
    if (!parsed.success) {
      errors.push(`${host}: registered source returned invalid data: ${parsed.error.message}`)
      continue
    }
    sourceByHost.set(host, parsed.data)
  }
  return { sourceByHost, errors }
}

function deduplicateWeeklyRecords(records: PendingRecord[], snapshotDate: string): PendingRecord[] {
  const sorted = [...records].sort((a, b) => a.record.net_price - b.record.net_price)
  const unique: PendingRecord[] = []
  const storageKeys = new Set<string>()
  for (const pending of sorted) {
    const storageKey = [
      pending.record.source_id,
      pending.record.sku,
      pending.record.product_url,
      pending.record.unit,
      pending.record.pack_size ?? 'unknown-pack',
      snapshotDate,
    ].join('\0')
    if (storageKeys.has(storageKey)) continue
    storageKeys.add(storageKey)
    unique.push(pending)
  }
  return unique
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
  searchProvider?: SearchProvider
  queryCatalog?: DiscoveryQuery[]
  fetchPage?: PageFetcher
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

  let allSources: PriceSourceRecord[]
  try {
    const { data, error } = await supabase
      .from('price_sources')
      .select('id,name,base_url,adapter_type,enabled,created_at')
      .order('name')
    if (error) throw error
    allSources = PriceSourceRecordSchema.array().parse(data ?? [])
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
  const pending: PendingRecord[] = []
  const sources = allSources.filter(source => source.enabled && source.adapter_type !== 'discovered').slice(0, 25)
  if (!sources.length && !process.env.SERPAPI_API_KEY && !options.searchProvider) {
    errors.push('No enabled price sources are configured and SERPAPI_API_KEY is not set.')
  }

  for (const [index, source] of sources.entries()) {
    try {
      const scrapedAt = new Date().toISOString()
      const adapter = adapters.get(source.adapter_type.toLowerCase())
      if (!adapter) throw new Error(`Unknown adapter_type: ${source.adapter_type}`)
      const rawItems = await adapter.scrape(source)
      if (!rawItems.length) throw new Error(noProductsMessage)
      let accepted = 0
      for (const raw of rawItems) {
        try {
          if (!constructionQueryCatalog.some(query => isConstructionRelevant(raw.materialName, null, query))) continue
          if (!raw.currency?.trim() || !raw.unit?.trim()) {
            throw new Error('Extracted price is missing currency or unit metadata.')
          }
          const record = MaterialPriceRecordSchema.parse(normalizeRawItem(raw, source, scrapedAt))
          pending.push({ source, record })
          accepted++
        } catch (error) {
          errors.push(`${source.name} (${raw.materialName}): ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      sourceResults.push({
        sourceId: source.id,
        sourceName: source.name,
        itemsCollected: accepted,
        error: accepted ? null : 'No relevant, valid construction prices were extracted.',
      })
      if (!accepted) errors.push(`${source.name}: no relevant, valid construction prices were extracted.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${source.name}: ${message}`)
      sourceResults.push({ sourceId: source.id, sourceName: source.name, itemsCollected: 0, error: message })
    }
    if (index < sources.length - 1 && (options.delayMs ?? 750) > 0)
      await new Promise(resolve => setTimeout(resolve, options.delayMs ?? 750))
  }

  if (process.env.SERPAPI_API_KEY || options.searchProvider) {
    const discovery = await discoverConstructionProducts(
      options.searchProvider ?? new SerpApiSearchProvider(),
      (options.queryCatalog ?? constructionQueryCatalog).slice(0, 20),
      { delayMs: options.delayMs, fetchPage: options.fetchPage },
    )
    errors.push(...discovery.errors)
    const registration = await registerDiscoveredSources(supabase, discovery.sources, allSources)
    errors.push(...registration.errors)
    const discoveredCounts = new Map<string, { source: PriceSourceRecord; count: number }>()
    for (const candidate of discovery.candidates) {
      const host = canonicalHost(new URL(candidate.baseUrl).hostname)
      const source = registration.sourceByHost.get(host)
      if (!source) continue
      try {
        const scrapedAt = new Date().toISOString()
        if (!candidate.raw.currency || !candidate.raw.unit) {
          throw new Error('Discovered offer is missing currency or unit metadata.')
        }
        const record = MaterialPriceRecordSchema.parse(normalizeRawItem(candidate.raw, source, scrapedAt))
        pending.push({ source, record })
        const count = discoveredCounts.get(source.id) ?? { source, count: 0 }
        count.count++
        discoveredCounts.set(source.id, count)
      } catch (error) {
        errors.push(`${host} (${candidate.raw.materialName}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    for (const { source, count } of discoveredCounts.values()) {
      sourceResults.push({ sourceId: source.id, sourceName: source.name, itemsCollected: count, error: null })
    }
  } else {
    errors.push('Web discovery skipped because SERPAPI_API_KEY is not configured.')
  }

  const started = new Date(startedAt)
  const day = started.getUTCDay()
  started.setUTCDate(started.getUTCDate() - (day === 0 ? 6 : day - 1))
  const snapshotDate = started.toISOString().slice(0, 10)
  const deduplicated = deduplicateWeeklyRecords(pending, snapshotDate)
  let itemsCollected = 0
  for (let offset = 0; offset < deduplicated.length; offset += batchSize) {
    const chunk = deduplicated.slice(offset, offset + batchSize)
    const payload = chunk.map(({ record }) => ({ ...record, snapshot_date: snapshotDate }))
    const { error } = await supabase.from('material_prices').upsert(payload, {
      onConflict: 'source_id,sku,product_url,unit,pack_size,snapshot_date',
      ignoreDuplicates: false,
    })
    if (error) {
      errors.push(`Could not save price batch ${Math.floor(offset / batchSize) + 1}: ${error.message}`)
      continue
    }
    itemsCollected += chunk.length
  }

  const savedCounts = new Map<string, number>()
  for (let offset = 0; offset < deduplicated.length; offset += batchSize) {
    const chunk = deduplicated.slice(offset, offset + batchSize)
    if (errors.some(error => error.startsWith(`Could not save price batch ${Math.floor(offset / batchSize) + 1}:`))) continue
    for (const pendingRecord of chunk) {
      savedCounts.set(pendingRecord.source.id, (savedCounts.get(pendingRecord.source.id) ?? 0) + 1)
    }
  }
  const mergedResults = new Map<string, SourceResult>()
  for (const result of sourceResults) {
    const current = mergedResults.get(result.sourceId)
    if (!current) mergedResults.set(result.sourceId, { ...result })
    else {
      current.itemsCollected += result.itemsCollected
      if (result.error) current.error = current.error ? `${current.error}; ${result.error}` : result.error
    }
  }
  sourceResults.splice(0, sourceResults.length, ...[...mergedResults.values()].map(result => ({
    ...result,
    itemsCollected: savedCounts.get(result.sourceId) ?? 0,
    error: savedCounts.has(result.sourceId) ? null : result.error ?? 'No unique, valid prices were saved.',
  })))
  if (itemsCollected === 0) errors.push('No price records were collected from any enabled source or discovery query.')
  const status = itemsCollected === 0 ? 'failed' : errors.length ? 'partial' : 'success'
  await updateRun(supabase, run.id, {
    finished_at: new Date().toISOString(),
    status,
    items_collected: itemsCollected,
    error_log: errors,
  })

  return { runId: run.id, status, itemsCollected, sources: sourceResults, errors }
}
