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
  type PriceSourceAdapter,
  type PriceSourceRecord,
  type RawScrapedItem,
} from '../src/lib/scraper'

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
  assert.throws(() => MaterialPriceRecordSchema.parse({ ...record, net_price: -1 }))
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
})
