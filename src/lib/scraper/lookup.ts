import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUnit, normalizeName } from './normalize'
import type { Offer, Position } from '../model'
import { getSupabaseAdmin } from '../supabase'

const maxAgeMs = 30 * 24 * 60 * 60 * 1000
const priceColumns = 'source_id,sku,material_name,unit,pack_size,net_price,shipping_cost,supplier_name,product_url,scraped_at'
export type StoredPrice = {
  source_id: string
  sku: string
  material_name: string
  unit: string
  pack_size: number | null
  net_price: number
  shipping_cost: number | null
  supplier_name: string
  product_url: string
  scraped_at: string
}

function offerId(price: StoredPrice) {
  const hash = createHash('sha256')
    .update([price.source_id, price.sku, price.product_url].join('\0'))
    .digest('hex')
    .slice(0, 20)
  return `scraped-${hash}`
}

export function storedPricesToOffers(prices: StoredPrice[], query: string, row: Position): Offer[] {
  const normalizedQuery = normalizeName(query)
  if (!normalizedQuery) return []
  const queryTerms = normalizedQuery.split(' ').filter(term => term.length > 1)
  const normalizedUnit = normalizeUnit(row.unit)
  const querySku = query.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return prices.flatMap(price => {
    if (price.unit === 'unknown' || normalizeUnit(price.unit) !== normalizedUnit) return []
    const sku = price.sku.replace(/[^a-z0-9]/gi, '').toLowerCase()
    const exact = Boolean(querySku && /\d/.test(querySku) && querySku === sku && price.pack_size !== null)
    if (!queryTerms.length && !exact) return []
    const title = normalizeName(price.material_name)
    const matches = queryTerms.filter(term => title.includes(term)).length
    if (!exact && matches < Math.ceil(queryTerms.length / 2)) return []
    return [{
      id: offerId(price),
      merchant: price.supplier_name,
      title: price.material_name,
      url: price.product_url,
      net: price.net_price,
      delivery: price.shipping_cost,
      pack: price.pack_size ?? 1,
      minPacks: 1,
      exact,
      source: 'scraped' as const,
      checkedAt: price.scraped_at,
    }]
  }).filter((offer, index, all) => all.findIndex(other => other.id === offer.id) === index)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.checkedAt.localeCompare(a.checkedAt))
    .slice(0, 20)
}

export async function findMarketPriceOffers(query: string, row: Position, client?: SupabaseClient): Promise<Offer[]> {
  const normalizedQuery = normalizeName(query)
  if (!normalizedQuery) return []
  const terms = normalizedQuery.split(' ').filter(term => term.length > 1)
  const skuQuery = query.trim()
  const hasSku = Boolean(skuQuery && /\d/.test(skuQuery))
  if (!terms.length && !hasSku) return []
  const supabase = client ?? getSupabaseAdmin()
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString()
  const normalized = terms.length ? await supabase.from('material_prices')
    .select(priceColumns)
    .or(terms.map(term => `normalized_name.ilike.%${term}%`).join(','))
    .eq('currency', 'EUR')
    .gte('scraped_at', cutoff)
    .order('scraped_at', { ascending: false })
    .limit(40) : { data: [], error: null }
  if (normalized.error) throw new Error(`Could not search stored market prices: ${normalized.error.message}`)

  const sku = hasSku ? await supabase.from('material_prices')
    .select(priceColumns)
    .eq('sku', skuQuery)
    .eq('currency', 'EUR')
    .gte('scraped_at', cutoff)
    .order('scraped_at', { ascending: false })
    .limit(20) : { data: [], error: null }
  if (sku.error) throw new Error(`Could not search stored market prices by SKU: ${sku.error.message}`)

  const prices = [...(sku.data ?? []), ...(normalized.data ?? [])] as StoredPrice[]
  return storedPricesToOffers(prices, query, row)
}
