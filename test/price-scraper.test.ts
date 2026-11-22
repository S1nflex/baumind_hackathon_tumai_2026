import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  inferCategory,
  normalizeName,
  normalizePackSize,
  normalizePricePair,
  normalizeUnit,
  normalizeRawItem,
  MaterialPriceRecordSchema,
  executeAdapters,
  GenericHtmlJsonAdapter,
  storedPricesToOffers,
  type PriceSourceAdapter,
  type PriceSourceRecord,
  type RawScrapedItem,
  type StoredPrice,
} from '../src/lib/scraper'
import type { Position } from '../src/lib/model'

test('normalizes German prices, VAT, units, pack sizes and names', () => {
  assert.deepEqual(normalizePricePair('1.300,00 €', null), { net: 1300, gross: 1547 })
  assert.deepEqual(normalizePricePair(null, '119,00 €'), { net: 100, gross: 119 })
  assert.equal(normalizeUnit('Quadratmeter'), 'm²')
  assert.equal(normalizeUnit('Stk.'), 'St')
  assert.equal(normalizeUnit('Kilogramm'), 'kg')
  assert.equal(normalizePackSize(null, 'Betonsäcke 25er-Pack'), 25)
  assert.equal(normalizeName('Beton-Dachziegel, Rund  #1'), 'beton dachziegel rund 1')
  assert.equal(inferCategory('Kabel NYM 3x1,5'), 'electrical')
})

test('normalizes raw items into a Zod-valid market price payload', () => {
  const source: PriceSourceRecord = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Example Supplier',
    base_url: 'https://example.com',
    adapter_type: 'generic',
    enabled: true,
  }
  const record = normalizeRawItem({
    sku: 'ABC-123',
    materialName: 'Betonsack 25 kg',
    grossPrice: '119,00 €',
    unit: 'kg',
    packSize: 25,
    productUrl: 'https://example.com/betonsack',
  }, source, '2026-11-21T03:00:00.000Z')

  assert.deepEqual(MaterialPriceRecordSchema.parse(record), record)
  assert.equal(record.net_price, 100)
  assert.equal(record.gross_price, 119)
  assert.equal(record.category, 'concrete')
  assert.equal(record.unit, 'kg')
  assert.equal(record.pack_size, 25)
  assert.throws(() => normalizeRawItem({ materialName: 'Zement', netPrice: 10, currency: 'USD' }, source))
  assert.equal(normalizeRawItem({ materialName: 'Werkzeug', netPrice: 10 }, source).unit, 'unknown')
  assert.throws(() => MaterialPriceRecordSchema.parse({ ...record, net_price: -1 }))
})

test('reads nested product feeds and reports unsupported JavaScript-only pages', async () => {
  const adapter = new GenericHtmlJsonAdapter()
  const source: PriceSourceRecord = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Example Supplier',
    base_url: 'https://example.com/feed',
    adapter_type: 'generic',
    enabled: true,
  }
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ products: [
      { name: 'Zement', price: 12.9, sku: 'Z-1', url: '/zement' },
    ] }), { headers: { 'content-type': 'application/json' } })
    const records = await adapter.scrape(source)
    assert.equal(records.length, 1)
    assert.equal(records[0].productUrl, 'https://example.com/zement')

    globalThis.fetch = async () => new Response('<html><body><div id="app"></div></body></html>', {
      headers: { 'content-type': 'text/html' },
    })
    await assert.rejects(adapter.scrape(source), /JavaScript rendering and link traversal are not supported/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('maps stored prices only to matching units and only treats exact SKU matches as exact', () => {
  const row = {
    id: 'position-1', oz: '01.01', group: '1', groupLabel: 'Rohbau', title: 'Zement',
    description: 'Zement', quantity: 5, unit: 'kg', type: 'normal', origin: 'imported',
    category: 'material', accepted: true, included: true,
    costs: { material: null, hours: null, rate: null, equipment: null, other: null },
    overridePrice: null, markup: null, marketPrice: null, selectedOfferId: null, offers: [],
  } satisfies Position
  const price: StoredPrice = {
    source_id: '550e8400-e29b-41d4-a716-446655440000',
    sku: 'Z-1',
    material_name: 'Zement',
    unit: 'kg',
    pack_size: 25,
    net_price: 12.9,
    shipping_cost: 3,
    supplier_name: 'Baustoffhandel',
    product_url: 'https://example.com/zement',
    scraped_at: '2026-11-21T03:00:00.000Z',
  }
  const offers = storedPricesToOffers([price, { ...price, unit: 'St', sku: 'OTHER' }], 'Z-1', row)
  assert.equal(offers.length, 1)
  assert.equal(offers[0].source, 'scraped')
  assert.equal(offers[0].exact, true)
  assert.equal(offers[0].net, 12.9)
  assert.equal(offers[0].pack, 25)
  assert.equal(offers[0].delivery, 3)
})

test('executes mocked adapters and isolates an individual source failure', async () => {
  const sources: PriceSourceRecord[] = [
    { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Good', base_url: 'https://good.example', adapter_type: 'mock', enabled: true },
    { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Bad', base_url: 'https://bad.example', adapter_type: 'mock', enabled: true },
  ]
  const goodAdapter: PriceSourceAdapter = {
    type: 'mock',
    async scrape(): Promise<RawScrapedItem[]> {
      return [{ materialName: 'Zement', netPrice: '12,90 €', unit: 'kg', productUrl: 'https://good.example/zement' }]
    },
  }
  const badAdapter: PriceSourceAdapter = {
    type: 'mock',
    async scrape(): Promise<RawScrapedItem[]> {
      throw new Error('upstream unavailable')
    },
  }
  const emptyAdapter: PriceSourceAdapter = {
    type: 'empty',
    async scrape(): Promise<RawScrapedItem[]> { return [] },
  }
  const registry = new Map<string, PriceSourceAdapter>([
    ['mock', goodAdapter],
    ['mock-failing', badAdapter],
  ])
  const goodOnly = await executeAdapters([sources[0]], registry, 0)
  const badOnly = await executeAdapters([{ ...sources[1], adapter_type: 'mock-failing' }], registry, 0)

  assert.equal(goodOnly[0].itemsCollected, 1)
  assert.equal(goodOnly[0].error, null)
  assert.equal(badOnly[0].itemsCollected, 0)
  assert.match(badOnly[0].error ?? '', /upstream unavailable|Unknown adapter_type/)

  const combined = new Map<string, PriceSourceAdapter>([['mock', goodAdapter]])
  combined.set('mock-failing', badAdapter)
  const mixedSources = [
    sources[0],
    { ...sources[1], adapter_type: 'mock-failing' },
  ]
  const results = await executeAdapters(mixedSources, combined, 0)
  assert.equal(results.length, 2)
  assert.equal(results[0].itemsCollected, 1)
  assert.match(results[1].error ?? '', /upstream unavailable/)

  const emptyResult = await executeAdapters([{ ...sources[0], adapter_type: 'empty' }], new Map([['empty', emptyAdapter]]), 0)
  assert.match(emptyResult[0].error ?? '', /No products were extracted/)
})
