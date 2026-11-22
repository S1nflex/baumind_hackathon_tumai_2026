import { createHash } from 'node:crypto'
import Decimal from 'decimal.js'
import { numberDE, round } from './estimate'
import { findMarketPriceOffers } from './scraper/lookup'
import type { Offer, Position } from './model'

export const marketPriceLookupConfigured = () =>
  Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY))
export const shopConfigured = () => Boolean(process.env.SERPAPI_API_KEY) || marketPriceLookupConfigured()
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
    // Google Shopping fields are inconsistently populated: extracted_price is canonical,
    // while price can be omitted; accept only EUR results (gl=de, google.de).
    if (!item.title || !item.source || (item.price && !/[€]|\bEUR\b/i.test(item.price)) || item.installment || item.second_hand_condition ||
        !Number.isFinite(item.extracted_price ?? parseEuroPrice(item.price)) || (item.extracted_price ?? parseEuroPrice(item.price) ?? 0) <= 0) return []
    const url = item.link ?? item.product_link
    if (!url?.startsWith('https://')) return []
    const pack = Number(item.title.match(/(\d+)\s*(?:er[- ]Pack|Stück|Stk|Packung)/i)?.[1] ?? 1)
    const signature = createHash('sha256').update(item.source + '\0' + item.title + '\0' + url).digest('hex').slice(0, 18)
    return [{ id: 'shop-' + signature, merchant: item.source.slice(0, 80), title: item.title.slice(0, 180), url,
      net: round(new Decimal(item.extracted_price ?? parseEuroPrice(item.price)!).div(tax), 4), delivery: shippingCost(item.delivery, tax),
      pack, minPacks: 1, leadTime: item.delivery?.slice(0, 90), checkedAt: date, source: 'live' as const,
      exact: id.length >= 5 && /\d/.test(id) && item.title.split(/[\s(),;]+/).some(token => tokens(token) === id) }]
  }).filter((offer, index, all) => all.findIndex(other => other.id === offer.id) === index)
}

/** Some Google Shopping results contain price text but no extracted_price. */
function parseEuroPrice(text?:string):number|null {
  if(!text || !/(?:€|\bEUR\b)/i.test(text)) return null
  const match=text.match(/\d[\d.,]*(?:\d)/) || text.match(/\d/)
  if(!match)return null
  const str=match[0]
  const parsed=numberDE(str.includes(',')?str:/\.\d{1,2}$/.test(str)?str.replace('.',','):str)
  return parsed!==null&&parsed>0?parsed:null
}

/** Different product phrasings are essential when a German LV uses abbreviations. */
export function supplierSearchQueries(query:string,row:Position):string[]{
  const candidates=[query.trim()]
  const text=(row.title+' '+row.description).slice(0,800)
  if(/(?:WC[-\s]?Trennw|WC[-\s]?Trennwand|Kabinentrennwand)/i.test(text)){
    candidates.push('WC Trennwandsystem Melamin Vollspanplatte kaufen')
    candidates.push('WC Kabinen Trennwände Vollspanplatte Sanitär Deutschland')
  }else if(/(?:Duschtrennw|Duschwand)/i.test(text)){
    candidates.push('Duschtrennwand HPL Vollkernplatte Deutschland kaufen')
  }else if(/(?:Fingerklemmschutz)/i.test(text)){
    candidates.push('Fingerklemmschutz Türprofil 200 cm kaufen')
  }else {
    const plain=row.title.replace(/\b(?:UG|OG|EG|Damen|Herren|WC)\b/gi,' ').replace(/[,.;/]+/g,' ').replace(/\s+/g,' ').trim()
    if(plain.length>=8 && plain!==query)candidates.push(plain.slice(0,110))
  }
  return [...new Set(candidates.filter(q=>q.length>=4))]
}
const cache = new Map<string, { time: number; offers: Offer[]; note?: string }>()
export async function findSuppliers(query: string, row: Position, postcode: string, forceRefresh = false) {
  const apiKey = process.env.SERPAPI_API_KEY?.trim()
  const fallback = referenceOffers(row)
  const exactSearch = row.supplierQuery || ''
  const cacheKey = [query, exactSearch, postcode, row.unit].join('|')
  const previous = cache.get(cacheKey)
  if (!forceRefresh && previous && Date.now() - previous.time < 300000) return { offers: previous.offers, note: previous.note }

  const offers = [...fallback]
  const notes: string[] = []
  if (marketPriceLookupConfigured()) {
    try { offers.push(...await findMarketPriceOffers(query, row)) }
    catch { notes.push('Supabase: Markt-Katalog nicht erreichbar oder keine passenden Tabellen. Prüfe Migrationen und Verbindung.') }
  }

  if (apiKey) {
    const queryLimit= Math.max(1,Math.min(3,Number(process.env.BAUMIND_MAX_SERP_QUERIES_PER_POSITION||2)||2))
    const queries=supplierSearchQueries(query,row).slice(0,queryLimit)
    for(const searchTerm of queries){
      if(offers.filter(item=>item.source==='live').length>=3)break
      const url=new URL('https://serpapi.com/search.json')
      for(const [key,value] of Object.entries({engine:'google_shopping',q:searchTerm,gl:'de',hl:'de',google_domain:'google.de',api_key:apiKey}))
        url.searchParams.set(key,value)
      try {
        const response=await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-store'})
        if(!response.ok){
          notes.push(response.status===401||response.status===403?'SerpAPI: API-Key ungültig.':response.status===429?
            'SerpAPI: Limit erreicht.':`SerpAPI: HTTP ${response.status}.`)
          if([401,403,429].includes(response.status))break
          continue
        }
        const data=await response.json() as {shopping_results?:ShoppingItem[];error?:string}
        if(data.error){
          notes.push(/limit|quota|plan/i.test(data.error)?'SerpAPI: Suchkontingent erschöpft.':
            /key|invalid|unauthorized|authenticate/i.test(data.error)?'SerpAPI: API-Key ungültig.':
            'SerpAPI: Google Shopping Fehler (prüfe SerpAPI-Konto).')
          break
        }
        const found=parseShoppingResults(data.shopping_results??[],exactSearch,new Date().toISOString())
        offers.push(...found)
        if(!found.length && queries.length===1)notes.push('Google Shopping: keine preislich verwertbaren Angebote.')
      }catch(error){
        notes.push(error instanceof Error && /timeout|abort/i.test(error.name+' '+error.message)?
          'SerpAPI: Suche hat das Zeitlimit erreicht.':'SerpAPI: Verbindung zu Google Shopping fehlgeschlagen.')
      }
    }
  }else notes.push('Google Shopping search is not configured; set SERPAPI_API_KEY in .env.local and restart Next.js.')

  const unique=[...new Map(offers.map(o=>[o.id,o])).values()].sort((a,b)=>{
    const comparable=(offer:Offer)=>offer.pack>0?offer.net/offer.pack:Number.POSITIVE_INFINITY
    return comparable(a)-comparable(b)
  })
  if(!unique.length && !notes.length)notes.push('Kein passendes echtes Händlerangebot gefunden. Keine Lieferanten erfinden.')
  if(apiKey && unique.length>0 && unique.length<3) notes.push(`Nur ${unique.length} echte Angebote verfügbar; weitere Händler konnten nicht verifiziert werden.`)
  if(cache.size>=100)cache.delete(cache.keys().next().value!)
  const note=notes.length?notes.join(' '):undefined
  cache.set(cacheKey,{time:Date.now(),offers:unique,note})
  return {offers:unique,note}
}
