import * as cheerio from 'cheerio'
import type { RawScrapedItem } from '../types'
import { normalizeUnit } from '../normalize'
import { numberDE } from '../../estimate'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
}

function hasType(value: unknown, type: string): boolean {
  return values(value).some(item => typeof item === 'string' &&
    (item === type || item.endsWith('/' + type) || item.endsWith('#' + type)))
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function priceNumber(value: string | number | null): number {
  if (typeof value === 'number') return value
  if (!value) return Number.NaN
  const german = numberDE(value)
  if (german !== null) return german
  return Number(value.replace(/[^\d,.-]/g, '').replaceAll(',', ''))
}

function eurCurrency(value: unknown, priceText?: string | null): string | null {
  if (typeof value === 'string') {
    const currency = value.trim().toUpperCase()
    if (currency === 'EUR' || currency === '€') return 'EUR'
    if (currency) return null
  }
  return priceText && /(?:€|\bEUR\b)/i.test(priceText) ? 'EUR' : null
}

function unitFrom(value: unknown, title: string): { unit: string; packSize: number | null } | null {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  const codeMap: Record<string, string> = {
    C62: 'St', H87: 'St', MTR: 'm', M2: 'm²', MTK: 'm²', M3: 'm³', MTQ: 'm³',
    KGM: 'kg', GRM: 'g', LTR: 'l', TNE: 't',
  }
  const fromCode = codeMap[code]
  const source = title + ' ' + (typeof value === 'string' ? value : '')
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|qm|m³|m3|cbm|kilogramm|kg|gramm|g|lfm|laufmeter|meter|m|liter|litre|ltr|l|stk|stück|pcs?|st|rolle|packung)(?![a-zäöü])/i)
  const inferred = match?.[2]
  const unit = fromCode ?? (inferred ? normalizeUnit(inferred) : null)
  if (!unit) return null
  const packSize = match ? Number(match[1].replace(',', '.')) : null
  return { unit, packSize: packSize && Number.isFinite(packSize) && packSize > 0 ? packSize : null }
}

function productUrl(value: unknown, fallback: string): string {
  try {
    const url = new URL(typeof value === 'string' ? value : fallback, fallback)
    return url.protocol === 'https:' ? url.href : fallback
  } catch {
    return fallback
  }
}

function itemFromProduct(product: JsonRecord, pageUrl: string, supplierName: string): RawScrapedItem[] {
  if (!hasType(product['@type'], 'Product')) return []
  const name = text(product.name)
  if (!name) return []
  const sku = text(product.sku) ?? text(product.mpn)
  const url = productUrl(product.url, pageUrl)
  return values(product.offers).flatMap(candidate => {
    if (!isRecord(candidate)) return []
    const specification = isRecord(candidate.priceSpecification) ? candidate.priceSpecification : null
    const price = candidate.price ?? candidate.lowPrice ?? specification?.price
    const currencyValue = candidate.priceCurrency ?? specification?.priceCurrency
    const priceText = typeof price === 'number' ? String(price) : text(price)
    const currency = eurCurrency(currencyValue, priceText)
    const parsedPrice = priceNumber(typeof price === 'number' ? price : priceText)
    const quantity = candidate.unitCode ?? candidate.unitText ?? specification?.unitCode ?? specification?.unitText
    const measured = unitFrom(quantity, name)
    if (!currency || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !measured) return []
    return [{
      sku,
      materialName: name,
      grossPrice: parsedPrice,
      currency,
      unit: measured.unit,
      packSize: measured.packSize,
      supplierName,
      productUrl: url,
    }]
  })
}

function jsonLdProducts(html: string, pageUrl: string, supplierName: string): RawScrapedItem[] {
  const $ = cheerio.load(html)
  const items: RawScrapedItem[] = []
  $('script[type="application/ld+json"]').each((_index, element) => {
    let data: unknown
    try { data = JSON.parse($(element).text()) } catch { return }
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit)
        return
      }
      if (!isRecord(value)) return
      items.push(...itemFromProduct(value, pageUrl, supplierName))
      if (hasType(value['@type'], 'Offer') || hasType(value['@type'], 'AggregateOffer')) {
        const offered = value.itemOffered
        if (isRecord(offered)) {
          items.push(...itemFromProduct({ ...offered, '@type': 'Product', offers: value }, pageUrl, supplierName))
        }
      }
      for (const child of Object.values(value)) if (typeof child === 'object' && child !== null) visit(child)
    }
    visit(data)
  })
  return items
}

function metaContent($: cheerio.CheerioAPI, key: string): string | null {
  return text($(`meta[property="${key}"], meta[name="${key}"]`).first().attr('content'))
}

function metadataProduct(html: string, pageUrl: string, supplierName: string): RawScrapedItem[] {
  const $ = cheerio.load(html)
  const title = metaContent($, 'og:title') ?? text($('h1').first().text()) ?? text($('title').first().text())
  const amount = metaContent($, 'product:price:amount') ?? metaContent($, 'og:price:amount')
  const currencyText = metaContent($, 'product:price:currency') ?? metaContent($, 'og:price:currency')
  if (!title || !amount) return []
  const currency = eurCurrency(currencyText, amount)
  const price = priceNumber(amount)
  const unit = unitFrom(null, title)
  if (!currency || !Number.isFinite(price) || price <= 0 || !unit) return []
  return [{
    materialName: title,
    grossPrice: price,
    currency,
    unit: unit.unit,
    packSize: unit.packSize,
    supplierName,
    productUrl: pageUrl,
  }]
}

function microdataProducts(html: string, pageUrl: string, supplierName: string): RawScrapedItem[] {
  const $ = cheerio.load(html)
  const results: RawScrapedItem[] = []
  $('[itemtype*="Product"]').each((_index, element) => {
    const product = $(element)
    const title = text(product.find('[itemprop="name"]').first().attr('content')) ??
      text(product.find('[itemprop="name"]').first().text())
    const priceElement = product.find('[itemprop="price"]').first()
    const amount = text(priceElement.attr('content')) ?? text(priceElement.text())
    const priceCurrency = text(product.find('[itemprop="priceCurrency"]').first().attr('content')) ??
      text(product.find('[itemprop="priceCurrency"]').first().text())
    const currency = eurCurrency(priceCurrency, amount)
    const value = priceNumber(amount)
    const itemUnit = product.find('[itemprop="unitCode"], [itemprop="unitText"]').first()
    const unitValue = text(itemUnit.attr('content')) ?? text(itemUnit.text())
    const unit = title ? unitFrom(unitValue, title) : null
    if (!title || !amount || !currency || !Number.isFinite(value) || value <= 0 || !unit) return
    const sku = text(product.find('[itemprop="sku"]').first().attr('content')) ??
      text(product.find('[itemprop="sku"]').first().text())
    results.push({
      sku,
      materialName: title,
      grossPrice: value,
      currency,
      unit: unit.unit,
      packSize: unit.packSize,
      supplierName,
      productUrl: pageUrl,
    })
  })
  return results
}

function fallbackProducts(html: string, pageUrl: string, supplierName: string): RawScrapedItem[] {
  const $ = cheerio.load(html)
  const title = text($('h1').first().text()) ?? text($('title').first().text())
  if (!title) return []
  const content = $('body').text().replace(/\s+/g, ' ')
  const matches = content.matchAll(/(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)\s*(€|EUR)\s*(?:\/\s*)?(m²|m2|qm|m³|m3|cbm|kg|g|lfm|m|l|stk|stück|st)(?![a-zäöü])/gi)
  const results: RawScrapedItem[] = []
  for (const match of matches) {
    const price = priceNumber(match[1])
    const currency = eurCurrency(match[2], match[0])
    const unit = unitFrom(null, title + ' ' + match[3])
    if (!currency || !unit || !Number.isFinite(price) || price <= 0) continue
    results.push({
      materialName: title,
      grossPrice: price,
      currency,
      unit: unit.unit,
      packSize: unit.packSize ?? 1,
      supplierName,
      productUrl: pageUrl,
    })
  }
  return results
}

export function extractUniversalProducts(html: string, pageUrl: string, supplierName: string): RawScrapedItem[] {
  const products = [
    ...jsonLdProducts(html, pageUrl, supplierName),
    ...microdataProducts(html, pageUrl, supplierName),
    ...metadataProduct(html, pageUrl, supplierName),
    ...fallbackProducts(html, pageUrl, supplierName),
  ]
  return products.filter((item, index, all) =>
    all.findIndex(other => other.materialName === item.materialName &&
      other.productUrl === item.productUrl && other.grossPrice === item.grossPrice) === index)
}
