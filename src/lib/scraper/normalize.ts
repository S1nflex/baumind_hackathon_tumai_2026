import Decimal from 'decimal.js'
import { numberDE, round } from '../estimate'
import { RawScrapedItemSchema, type MaterialPriceRecord, type PriceSourceRecord, type RawScrapedItem } from './types'

const VAT = new Decimal(1.19)

function parseNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value !== 'string') return null
  const fromGermanFormat = numberDE(value)
  if (fromGermanFormat !== null) return fromGermanFormat
  const plain = Number(value.replace(/[^0-9.,-]/g, '').replace(',', '.'))
  return Number.isFinite(plain) ? plain : null
}

export function normalizeUnit(value: string | null | undefined): string {
  const input = (value ?? '').trim().toLowerCase()
  if (input === 'mtr') return 'm'
  if (input === 'm2' || input === 'mtk') return 'm²'
  if (input === 'm3' || input === 'mtq') return 'm³'
  if (input === 'kgm') return 'kg'
  if (input === 'grm') return 'g'
  if (input === 'tne') return 't'
  if (input === 'h87' || input === 'c62') return 'St'
  if (/^(m\s*[²2]|qm|quadratmeter|square\s*meter|m2)$/i.test(input)) return 'm²'
  if (/^(m\s*[³3]|cbm|cubic\s*meter|m3)$/i.test(input)) return 'm³'
  if (/^(st|stk|stück|piece|pieces|pcs?)\.?$/i.test(input)) return 'St'
  if (/^(kg|kilogramm|kilogram)$/i.test(input)) return 'kg'
  if (/^(g|gramm|gram)$/i.test(input)) return 'g'
  if (/^(l|ltr|liter|litre)$/i.test(input)) return 'l'
  if (/^(m|lfm|laufmeter|meter)$/i.test(input)) return 'm'
  if (/^(to|t|tonne)$/i.test(input)) return 't'
  if (/^(pa|paar|pairs)$/i.test(input)) return 'Paar'
  if (/^(ro|rolle|rollen|roll)$/i.test(input)) return 'Rolle'
  if (/^(pa?ck(?:ung)?|pack)$/i.test(input)) return 'Packung'
  return input || 'St'
}

export function normalizePackSize(value: number | string | null | undefined, name = ''): number | null {
  const parsed = typeof value === 'number' ? value : parseNumber(value)
  if (parsed !== null && parsed > 0) return parsed
  const match = name.match(/(\d+(?:[.,]\d+)?)\s*(?:er[- ]?pack|stück|stk|packung|x)\b/i)
  return match ? parseNumber(match[1]) : null
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inferCategory(name: string, supplied?: string | null): string {
  if (supplied?.trim()) return supplied.trim().slice(0, 80)
  const normalized = normalizeName(name)
  if (/(beton|zement|mortar|moertel|sack)/.test(normalized)) return 'concrete'
  if (/(stahl|metall|blech|profile)/.test(normalized)) return 'metal'
  if (/(holz|brett|sparren|platte)/.test(normalized)) return 'wood'
  if (/(dach|ziegel|bahn|folie|dachrinne)/.test(normalized)) return 'roofing'
  if (/(rohr|leitung|armatur|sanitaer)/.test(normalized)) return 'plumbing'
  if (/(farbe|lack|grundierung)/.test(normalized)) return 'paint'
  if (/(elektro|kabel|dose|schalter)/.test(normalized)) return 'electrical'
  if (/(werkzeug|bohrer|schaeumer|maschine)/.test(normalized)) return 'tools'
  return 'other'
}

export function normalizePricePair(netValue: number | string | null | undefined, grossValue: number | string | null | undefined):
  { net: number; gross: number } | null {
  const net = parseNumber(netValue)
  const gross = parseNumber(grossValue)
  if (net !== null && net > 0) {
    const netRounded = round(new Decimal(net), 4)
    return { net: netRounded, gross: gross !== null && gross > 0 ? round(new Decimal(gross), 4) : round(new Decimal(net).times(VAT), 4) }
  }
  if (gross !== null && gross > 0) {
    const grossRounded = round(new Decimal(gross), 4)
    return { net: round(new Decimal(gross).div(VAT), 4), gross: grossRounded }
  }
  return null
}

export function normalizeRawItem(raw: RawScrapedItem, source: PriceSourceRecord, scrapedAt = new Date().toISOString()):
  MaterialPriceRecord {
  const item = RawScrapedItemSchema.parse(raw)
  const currency = (item.currency ?? 'EUR').toUpperCase()
  if (currency !== 'EUR') throw new Error(`Unsupported currency ${currency} for ${item.materialName}; only EUR can be compared.`)
  const prices = normalizePricePair(item.netPrice, item.grossPrice)
  if (!prices) throw new Error(`Missing price for ${item.materialName}`)
  const shipping = parseNumber(item.shippingCost)
  const sku = item.sku?.trim() || item.productUrl?.match(/(?:sku|p|id)[=/\-]?([a-zA-Z0-9._-]+)/i)?.[1]?.toUpperCase() ||
    `NAME-${normalizeName(item.materialName)}`.slice(0, 160)
  return {
    source_id: source.id,
    sku,
    material_name: item.materialName.trim().slice(0, 240),
    normalized_name: normalizeName(item.materialName).slice(0, 240),
    category: inferCategory(item.materialName, item.category),
    unit: item.unit?.trim() ? normalizeUnit(item.unit) : 'unknown',
    pack_size: normalizePackSize(item.packSize, item.materialName),
    net_price: prices.net,
    gross_price: prices.gross,
    shipping_cost: shipping === null ? null : round(new Decimal(shipping), 4),
    currency,
    supplier_name: (item.supplierName ?? source.name).trim().slice(0, 160),
    product_url: item.productUrl ?? source.base_url,
    scraped_at: scrapedAt,
  }
}
