import { catalogLookup } from './catalog'
import { estimateIndicativePrices } from './market-estimator'
import { quantityOf, unitOf } from './estimate'
import { findSuppliers, shopConfigured } from './suppliers'
import type { Position, Project } from './model'

export type MarketUpdate = { percent:number; detail:string }
export type MarketCallback = (event:MarketUpdate)=>void

/** A search suggestion, not an assertion that a product matches the LV scope.
 * Works for non-catalogued systems such as WC-Trennwände, while retaining OZ/title unchanged. */
export function supplierQueryFor(row:Position):string|null {
  if (row.origin!=='imported' || !row.included || !row.accepted) return null
  const specified=row.supplierQuery?.trim()
  if (specified && specified.length>=3) return specified.slice(0,130)
  const catalog=catalogLookup(row)?.query
  if (catalog) return catalog.slice(0,130)
  const source=row.title.trim()
  if (!source || source.length<5) return null
  if (/\b(?:wc[-\s]?trennw|duschtrennw|schamw|sichtschutzw)/i.test(source)) {
    const kind=/duschtrennw/i.test(source)?'Duschtrennwand':/schamw/i.test(source)?'Schamwand':/sichtschutzw/i.test(source)?'Sichtschutzwand':'WC Trennwand System'
    const material=/\bHPL\b/i.test(source)?'HPL Vollkernplatte':/melamin/i.test(source)?'Melamin Vollspanplatte':''
    const text=(source+' '+row.description).slice(0,1800)
    const thickness=text.match(/(?:d\s*[=>]\s*|dicke\s*:?\s*|stärke\s*:?\s*)(\d{2,3})\s*mm/i)?.[1]
    const dimensions=text.match(/(?:\b\d{2,3}\s*[x×]\s*\d{2,3}\s*(?:cm|mm)\b)/i)?.[0]
    // Product search only; dimensions and thickness are queries, not verified matches.
    return [kind,material,dimensions,thickness ? thickness+' mm' : ''].filter(Boolean).join(' ').slice(0,130)
  }
  return source.replace(/\b(?:EG|UG|OG|KG|Damen|Herren)\b/gi,' ').replace(/[,_/]+/g,' ').replace(/\s+/g,' ').trim().slice(0,110)
}

/** Does not silently treat a material product as an installed LV unit price.
 * Empty Supabase catalogs remain valid connected services, but do not create offers. */
export async function enrichMarket(rows:Position[], postcode:string, useAi:boolean, onProgress:MarketCallback=()=>{}) {
  const candidates=shopConfigured()?rows.filter(row=>/^(?:st|stk|stück|pcs?|m²|m2|m³|m3|m|lfm|kg|l|paar|packung)\.?$/i.test(unitOf(row)) && quantityOf(row)!==null)
    .map(row=>({row,query:supplierQueryFor(row)})).filter((x):x is {row:Position;query:string}=>Boolean(x.query)).slice(0,24):[]
  let queried=0, offerCount=0
  const notes:string[]=[]
  for(let index=0;index<candidates.length;index+=3){
    const batch=candidates.slice(index,index+3)
    const results=await Promise.allSettled(batch.map(x=>findSuppliers(x.query,x.row,postcode,true)))
    results.forEach((result,i)=>{
      const row=batch[i].row
      if(result.status==='rejected'){notes.push(`OZ ${row.oz}: Marktanfrage fehlgeschlagen.`);return}
      const found=result.value.offers
      const existing=new Map(row.offers.map(o=>[o.id,o]))
      found.forEach(o=>{if(!existing.get(o.id)?.confirmed)existing.set(o.id,o)})
      row.offers=[...existing.values()].slice(0,100)
      if(result.value.note)notes.push(`OZ ${row.oz}: ${result.value.note.slice(0,250)}`)
      offerCount+=found.length
    })
    queried+=batch.length
    onProgress({percent:Math.round(45*queried/Math.max(candidates.length,1)),detail:`Lieferanten geprüft: ${queried}/${candidates.length}`})
  }
  onProgress({percent:48,detail:'KI erstellt unverbindliche Einheitspreis-Bandbreiten'})
  const market=useAi ? await estimateIndicativePrices(rows) : {estimates:[],note:'Nur lokale Verarbeitung; KI-Schätzung übersprungen.'}
  const estimateById=new Map(market.estimates.map(x=>[x.positionId,x]))
  for(const row of rows){
    const estimate=estimateById.get(row.id)
    if(estimate && estimate.unit===unitOf(row)){
      // Default draft pricing: use the low end of the AI estimate when no verified
      // unit price is provided. The source remains visibly marked 'AI'.
      const midpoint=Math.round(estimate.min*1000)/1000
      row.provisionalPrice={ min:estimate.min,max:estimate.max,suggested:midpoint,unit:estimate.unit,confidence:estimate.confidence,reason:estimate.reason }
    } else row.provisionalPrice=undefined
  }
  const positionsWithOffers=rows.filter(r=>r.offers.some(o=>o.source==='scraped'||o.source==='live'||o.source==='manual')).length
  const note=[market.note, `${queried} Positionen bei Marktquellen angefragt, ${positionsWithOffers} mit Angebotsdaten.`,
    !candidates.length?'Keine automatische Lieferantensuche für diese Einheiten/Produkte möglich.':'',
    offerCount===0?(process.env.SERPAPI_API_KEY ?
      'Noch keine passenden Händlerangebote. SerpAPI wurde abgefragt; kontrolliere Suchbegriffe, Einheiten und Kontingent.' :
      'Keine Händlerangebote. Supabase speichert bestehende Datensätze; für neue Live-Ergebnisse SerpAPI verbinden.'):'',
    ...notes.slice(0,5)].filter(Boolean).join(' ')
  onProgress({percent:100,detail:`${market.estimates.length} KI-Richtwerte · ${positionsWithOffers} Positionen mit Angeboten`})
  return {estimates:market.estimates,note,checkedOffers:rows.reduce((sum,r)=>sum+r.offers.length,0),queried, positionsWithOffers, provider:useAi?'AI':'none'} satisfies NonNullable<Project['analysis']['market']>
}
