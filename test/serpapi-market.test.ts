import test from 'node:test'
import assert from 'node:assert/strict'
import { position } from '../src/lib/model'
import { findSuppliers } from '../src/lib/suppliers'

const buildRow = () => position({
  id:'serpapi-test-position', oz:'16.1.10', title:'WC Trennwand Melamin', description:'Lieferung und Montage',
  unit:'St', quantity:2,
})

test('SerpAPI reports a quota error returned with HTTP 200', { concurrency:false }, async () => {
  const originalFetch=globalThis.fetch
  const oldKey=process.env.SERPAPI_API_KEY
  const oldUrl=process.env.SUPABASE_URL
  process.env.SERPAPI_API_KEY='test-only-not-a-real-key'
  delete process.env.SUPABASE_URL
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'You have reached your monthly searches limit.'}),{
    status:200,headers:{'content-type':'application/json'},
  })
  try {
    const result=await findSuppliers('WC Test quota query isolated',buildRow(),'')
    assert.deepEqual(result.offers,[])
    assert.match(result.note??'',/Suchkontingent/)
  } finally {
    globalThis.fetch=originalFetch
    if(oldKey===undefined)delete process.env.SERPAPI_API_KEY; else process.env.SERPAPI_API_KEY=oldKey
    if(oldUrl===undefined)delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=oldUrl
  }
})

test('SerpAPI Google Shopping offers are visible but remain unverified', { concurrency:false }, async () => {
  const originalFetch=globalThis.fetch
  const oldKey=process.env.SERPAPI_API_KEY
  const oldUrl=process.env.SUPABASE_URL
  process.env.SERPAPI_API_KEY='test-only-not-a-real-key'
  delete process.env.SUPABASE_URL
  globalThis.fetch=async()=>new Response(JSON.stringify({shopping_results:[{
    title:'WC Trennwand Melamin',source:'Test Baustoffmarkt',price:'119,00 €',extracted_price:119,
    delivery:'Kostenloser Versand',product_link:'https://example.org/wc-trennwand',
  }]}),{status:200,headers:{'content-type':'application/json'}})
  try {
    const result=await findSuppliers('WC Trennwand test isolated vendor',buildRow(),'')
    assert.equal(result.offers.length,1)
    assert.equal(result.offers[0].source,'live')
    assert.equal(result.offers[0].net,100)
    assert.equal(result.offers[0].delivery,0)
    assert.notEqual(result.offers[0].confirmed,true)
  } finally {
    globalThis.fetch=originalFetch
    if(oldKey===undefined)delete process.env.SERPAPI_API_KEY; else process.env.SERPAPI_API_KEY=oldKey
    if(oldUrl===undefined)delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=oldUrl
  }
})
