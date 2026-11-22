import { createHash } from 'node:crypto'
import Decimal from 'decimal.js'
import { numberDE, round } from './estimate'
import type { Offer, Position } from './model'

export const shopConfigured = () => Boolean(process.env.SERPAPI_API_KEY)
const tokens = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase()

const geberit = [
  { id: 'snapshot-proshop', merchant: 'Proshop', net: 157.52, delivery: null, leadTime: '2–4 Werktage laut Anbieter',
    url: 'https://www.proshop.de/Entwaesserungsprodukte/Geberit-Plu-roof-outlet-daf-d56-12ls/2901141' },
  { id: 'snapshot-ssd', merchant: 'SSD Armaturenshop', net: 138.34, delivery: null, leadTime: 'Ca. 5 Wochen laut Anbieter',
    url: 'https://ssd-armaturenshop.de/Geberit-359105001-Pluvia-Dachwassereinlauf-mit-Bef_1' },
]

export function referenceOffers(row: Position): Offer[] {
  if (!['359105001', '4025410162892'].includes(tokens(row.supplierQuery ?? ''))) return []
  return geberit.map(offer => ({ ...offer, title: 'Geberit Pluvia 359.105.00.1', source: 'manual',
    checkedAt: '2026-11-20', pack: 1, minPacks: 1, exact: true }))
}

export type ShoppingItem = { title?: string; source?: string; price?: string; extracted_price?: number;
  delivery?: string; installment?: unknown; product_link?: string; link?: string; second_hand_condition?: string }

function shippingCost(delivery: string | undefined, taxDivider: Decimal) {
  if (!delivery) return null
  if (/^(?:kostenlose lieferung|kostenloser versand|gratisversand|free delivery)\s*[.!]?$/i.test(delivery.trim())) return 0
  const amount = delivery.match(/([0-9]+(?:[.,][0-9]{2})?)\s*€/)
  if (!amount || /\bab\b|minimum|bestellwert|abholung|p\.?\s*st/i.test(delivery)) return null
  const priced = numberDE(amount[1])
  return priced === null ? null : round(new Decimal(priced).div(taxDivider), 4)
}

export function parseShoppingResults(items: ShoppingItem[], reference: string, date: string): Offer[] {
  const tax = new Decimal(1.19)
  const id = tokens(reference)
  return items.slice(0, 35).flatMap(item => {
    if (!item.title || !item.source || !item.price?.includes('€') || item.installment || item.second_hand_condition ||
        !Number.isFinite(item.extracted_price) || (item.extracted_price ?? 0) <= 0) return []
    const url = item.link ?? item.product_link
    if (!url?.startsWith('https://')) return []
    const pack = Number(item.title.match(/(\d+)\s*(?:er[- ]Pack|Stück|Stk|Packung)/i)?.[1] ?? 1)
    const signature = createHash('sha256').update(item.source + '\0' + item.title + '\0' + url).digest('hex').slice(0, 18)
    return [{ id: 'shop-' + signature, merchant: item.source.slice(0, 80), title: item.title.slice(0, 180), url,
      net: round(new Decimal(item.extracted_price!).div(tax), 4), delivery: shippingCost(item.delivery, tax),
      pack, minPacks: 1, leadTime: item.delivery?.slice(0, 90), checkedAt: date, source: 'live' as const,
      exact: id.length >= 5 && /\d/.test(id) && item.title.split(/[\s(),;]+/).some(token => tokens(token) === id) }]
  }).filter((offer, index, all) => all.findIndex(other => other.id === offer.id) === index)
}

const cache = new Map<string, { time: number; offers: Offer[] }>()
export async function findSuppliers(query: string, row: Position, postcode: string) {
  const apiKey = process.env.SERPAPI_API_KEY
  const fallback = referenceOffers(row)
  if (!apiKey) return { offers: fallback, note: 'Live-Suche benötigt SERPAPI_API_KEY. Vorliegende Quellen und eigene Angebote bleiben verfügbar.' }

  const exactSearch = row.supplierQuery || ''
  const cacheKey = [query, exactSearch, postcode].join('|')
  const previous = cache.get(cacheKey)
  if (previous && Date.now() - previous.time < 1800000) return { offers: previous.offers }
  const url = new URL('https://serpapi.com/search.json')
  for (const [key, value] of Object.entries({ engine: 'google_shopping', q: query, gl: 'de', hl: 'de',
    google_domain: 'google.de', api_key: apiKey })) url.searchParams.set(key, value)
  if (/^\d{5}$/.test(postcode)) url.searchParams.set('location', postcode + ', Germany')
  let response = await fetch(url, { signal: AbortSignal.timeout(9000), cache: 'no-store' })
  // Some postcodes cannot be resolved by the search provider.
  if (response.status === 400 && url.searchParams.has('location')) {
    url.searchParams.delete('location')
    response = await fetch(url, { signal: AbortSignal.timeout(9000), cache: 'no-store' })
  }
  if (!response.ok) return { offers: fallback, note: 'Der Preis-Suchdienst ist momentan nicht verfügbar (HTTP ' + response.status + ').' }
  const data = await response.json() as { shopping_results?: ShoppingItem[] }
  const live = parseShoppingResults(data.shopping_results ?? [], exactSearch, new Date().toISOString())
  const offers = live.length ? live : fallback
  if (cache.size >= 100) cache.delete(cache.keys().next().value!)
  cache.set(cacheKey, { time: Date.now(), offers })
  return { offers, note: live.length ? undefined : 'Keine Live-Treffer. Bitte Artikelnummer oder Suchbegriff prüfen.' }
}
