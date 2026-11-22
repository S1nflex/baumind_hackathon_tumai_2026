import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  discoverConstructionProducts,
  extractUniversalProducts,
  isConstructionRelevant,
  runMarketPriceIngestion,
  fetchPublicHtml,
  normalizeUnit,
  type DiscoveryQuery,
  type PriceSourceRecord,
  type SearchProvider,
} from '../src/lib/scraper'
import type { ShoppingItem } from '../src/lib/suppliers'

const query: DiscoveryQuery = {
  query: 'Dachabdichtung Bitumenbahn',
  category: 'roofing',
  keywords: ['dachabdichtung', 'bitumenbahn', 'dachbahn'],
}

test('extracts domain-agnostic JSON-LD, metadata, Microdata and generic EU prices', () => {
  const html = `<html><head>
    <meta property="og:title" content="Bitumenbahn 5 m²">
    <meta property="product:price:amount" content="119,00">
    <meta property="product:price:currency" content="EUR">
    <script type="application/ld+json">
      {"@type":"Product","name":"Bitumenbahn 5 m²","sku":"BIT-5",
       "offers":{"@type":"AggregateOffer","lowPrice":"59.90","priceCurrency":"EUR"}}
    </script>
  </head><body><h1>Bitumenbahn 5 m²</h1><span>59,90 € / m²</span></body></html>`

  const results = extractUniversalProducts(html, 'https://supplier.example/p/bitumen', 'Supplier')
  assert.ok(results.some(item => item.sku === 'BIT-5' && item.grossPrice === 59.9 && item.unit === 'm²' && item.packSize === 5))
  assert.ok(results.some(item => item.grossPrice === 119 && item.currency === 'EUR'))
  assert.ok(results.every(item => item.productUrl === 'https://supplier.example/p/bitumen'))

  const microdata = `<div itemscope itemtype="https://schema.org/Product">
    <h1 itemprop="name">KG Rohr 2 m</h1>
    <span itemprop="price" content="12,90"></span>
    <meta itemprop="priceCurrency" content="EUR">
    <meta itemprop="unitCode" content="MTR">
  </div>`
  const microdataProducts = extractUniversalProducts(microdata, 'https://supplier.example/kg-rohr', 'Supplier')
  assert.ok(microdataProducts.some(item => item.unit === 'm' && item.packSize === 2))
})

test('extracts nested Offer data and filters irrelevant product names', () => {
  const html = `<script type="application/ld+json">
    {"@type":"Offer","price":"25,00","priceCurrency":"EUR",
     "itemOffered":{"name":"Bitumenbahn 2 m²","sku":"BIT-2"}}
  </script>`
  const products = extractUniversalProducts(html, 'https://merchant.example/item', 'Merchant')
  assert.equal(products.length, 1)
  assert.equal(products[0].grossPrice, 25)
  assert.equal(products[0].packSize, 2)
  assert.equal(isConstructionRelevant(products[0].materialName, null, query), true)
  assert.equal(isConstructionRelevant('Espressomaschine 2 kg', null, query), false)
})

test('rejects unsafe page targets and normalizes standard commerce unit codes', async () => {
  await assert.rejects(fetchPublicHtml('http://127.0.0.1/'), /HTTPS/)
  await assert.rejects(fetchPublicHtml('https://127.0.0.1/'), /Private or reserved/)
  assert.equal(normalizeUnit('MTR'), 'm')
  assert.equal(normalizeUnit('MTK'), 'm²')
  assert.equal(normalizeUnit('KGM'), 'kg')
})

test('runs bounded shopping and web discovery with mocked responses and filters irrelevant offers', async () => {
  const shopping: ShoppingItem[] = [
    { title: 'Bitumenbahn 5 m²', source: 'Baustoffhandel', price: '59,90 €', extracted_price: 59.9,
      delivery: 'Kostenloser Versand', product_link: 'https://shop.example/bitumenbahn' },
    { title: 'Kaffee 1 kg', source: 'Coffee Shop', price: '9,90 €', extracted_price: 9.9,
      product_link: 'https://coffee.example/kaffee' },
  ]
  const provider: SearchProvider = {
    async searchShopping() { return shopping },
    async searchWeb() {
      return [{ title: 'Bitumenbahn 5 m²', source: 'Baustoffhandel', link: 'https://shop.example/bitumenbahn' }]
    },
  }
  const result = await discoverConstructionProducts(provider, [query], {
    delayMs: 0,
    async fetchPage(url) {
      return {
        url,
        html: `<script type="application/ld+json">
          {"@type":"Product","name":"Bitumenbahn 5 m²",
           "offers":{"@type":"Offer","price":"59,90","priceCurrency":"EUR"}}
        </script>`,
      }
    },
  })

  assert.equal(result.errors.length, 0)
  assert.equal(result.candidates.length, 2)
  assert.ok(result.candidates.every(candidate => candidate.baseUrl === 'https://shop.example'))
  assert.equal(result.sources.length, 2)
})

test('registers discovered merchant domains and batch-deduplicates weekly offers', async () => {
  const registered: PriceSourceRecord[] = []
  const batches: Array<Array<Record<string, unknown>>> = []
  const runId = '550e8400-e29b-41d4-a716-446655440001'
  const sourceId = '550e8400-e29b-41d4-a716-446655440002'
  const fakeSupabase = {
    from(table: string) {
      if (table === 'scrape_runs') {
        return {
          insert() {
            return { select() { return { single: async () => ({ data: { id: runId }, error: null }) } } }
          },
          update() { return { async eq() { return { error: null } } } },
        }
      }
      if (table === 'price_sources') {
        return {
          select() { return { async order() { return { data: registered, error: null } } } },
          insert(value: Omit<PriceSourceRecord, 'id'>) {
            const row = { ...value, id: sourceId }
            registered.push(row)
            return { select() { return { single: async () => ({ data: row, error: null }) } } }
          },
          update(value: Partial<PriceSourceRecord>) {
            return { async eq() { Object.assign(registered[0], value); return { error: null } } }
          },
        }
      }
      return {
        upsert(values: Array<Record<string, unknown>>) {
          batches.push(values)
          return Promise.resolve({ error: null })
        },
      }
    },
  } as unknown as SupabaseClient
  const provider: SearchProvider = {
    async searchShopping() {
      return [
        { title: 'Bitumenbahn 5 m²', source: 'Baustoffhandel', price: '59,90 €', extracted_price: 59.9,
          delivery: 'Kostenloser Versand', product_link: 'https://shop.example/bitumenbahn' },
        { title: 'Bitumenbahn 5 m²', source: 'Baustoffhandel', price: '69,90 €', extracted_price: 69.9,
          delivery: 'Kostenloser Versand', product_link: 'https://shop.example/bitumenbahn' },
      ]
    },
    async searchWeb() { return [] },
  }

  const summary = await runMarketPriceIngestion({
    supabase: fakeSupabase,
    searchProvider: provider,
    queryCatalog: [query],
    delayMs: 0,
  })
  assert.equal(summary.status, 'success')
  assert.equal(summary.itemsCollected, 1)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'Baustoffhandel')
  assert.equal(registered[0].base_url, 'https://shop.example')
  assert.equal(registered[0].adapter_type, 'discovered')
  assert.equal(registered[0].enabled, true)
  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 1)
  assert.match(String(batches[0][0].snapshot_date), /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(Number(batches[0][0].net_price) < 55)
})
