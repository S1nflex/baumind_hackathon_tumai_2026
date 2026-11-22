'use client'

import { ArrowUpRight, CheckCircle2, PackageSearch, Search, ShieldAlert, ShoppingBag, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { comparable, offerAmount, quantityOf, eur } from '@/lib/estimate'
import { useI18n } from '@/lib/i18n'
import type { Project } from '@/lib/model'

export function SupplierBoard({project,openPosition,onRefresh,busy=false}:{project:Project;openPosition:(id:string)=>void;onRefresh?:()=>void;busy?:boolean}) {
  const {language} = useI18n()
  const [filter,setFilter] = useState<'all'|'confirmed'|'review'>('all')
  const [query,setQuery] = useState('')
  const [connections,setConnections] = useState<{supabase?:{configured:boolean;marketCatalogCount?:number|null};shopping?:{configured:boolean}}|null>(null)
  useEffect(()=>{let active=true;fetch('/api/integrations/status?check=1',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active)setConnections(data)}).catch(()=>{});return ()=>{active=false}},[])
  const tr = {
    de:{title:'Lieferanten',intro:'Marktquellen pro LV-Position. Ein Angebot wird erst nach Prüfung von Einheit, Lieferkosten und Eignung kalkulationsrelevant.',all:'Alle',confirmed:'Bestätigt',review:'Zu prüfen',none:'Keine Lieferantenangebote gefunden',empty:'Öffne die Preisansicht einer Position, um Anbieter zu suchen oder ein eigenes Angebot zu hinterlegen.',open:'Preise der Position',shipping:'Versand noch offen',total:'Gesamt netto inkl. Versand',perPack:'Netto je Packung',source:'Quelle öffnen',data:'Quelle',offers:'Angebote',positions:'Positionen mit Angeboten',selected:'Ausgewählt',ai:'AI-Richtwerte sind keine Lieferantenangebote.',search:'OZ, Leistung oder Anbieter suchen',verified:'Kalkulierbar',pending:'Eignung / Einheit / Versand prüfen'},
    en:{title:'Suppliers',intro:'Market sources by line item. Quotes affect calculations only after unit, delivery and suitability are verified.',all:'All',confirmed:'Confirmed',review:'Review',none:'No supplier quotes found',empty:'Open an item’s Prices view to search suppliers or add your own quote.',open:'Item prices',shipping:'Shipping unknown',total:'Net total incl. delivery',perPack:'Net per package',source:'Open source',data:'Source',offers:'Quotes',positions:'Items with quotes',selected:'Selected',ai:'AI ranges are not supplier quotes.',search:'Search item, OZ or supplier',verified:'Usable for costing',pending:'Verify suitability, units and delivery'},
    ru:{title:'Поставщики',intro:'Реальные источники цен по позициям сметы. Предложение попадает в расчёт только после проверки единиц, доставки и соответствия товару.',all:'Все',confirmed:'Подтверждены',review:'Нужна проверка',none:'Предложения поставщиков не найдены',empty:'Открой вкладку «Цены» нужной позиции, чтобы найти поставщика или добавить предложение вручную.',open:'Цены позиции',shipping:'Доставка неизвестна',total:'Итого без НДС с доставкой',perPack:'Без НДС за упаковку',source:'Открыть источник',data:'Источник',offers:'Предложения',positions:'Позиций с предложениями',selected:'Выбрано',ai:'Диапазоны AI — не предложения поставщиков.',search:'Найти OZ, работу или поставщика',verified:'Подходит для расчёта',pending:'Проверить параметры, единицы и доставку'},
  }[language]
  const all = useMemo(()=>project.positions.flatMap(row=>row.offers.map(offer=>({row,offer,
    comparable:comparable(offer,row),selected:row.selectedOfferId===offer.id,
  }))),[project])
  const offeredPositions = new Set(all.map(item=>item.row.id)).size
  const indicative = project.positions.filter(row=>Boolean(row.provisionalPrice)).filter(row=>`${row.oz} ${row.title}`.toLowerCase().includes(query.toLowerCase().trim()))
  const shown = all.filter(({row,offer,comparable:matching})=>{
    if(filter==='confirmed' && !matching) return false
    if(filter==='review' && matching) return false
    return `${row.oz} ${row.title} ${offer.merchant} ${offer.title}`.toLowerCase().includes(query.toLowerCase().trim())
  }).sort((a,b)=>Number(b.comparable)-Number(a.comparable) ||
    (a.comparable&&b.comparable ? (offerAmount(a.offer,quantityOf(a.row)??0).total - offerAmount(b.offer,quantityOf(b.row)??0).total) : (a.offer.net/Math.max(1,a.offer.pack)-b.offer.net/Math.max(1,b.offer.pack))) || Number(b.selected)-Number(a.selected))
  return <section className="bm-suppliers-board" aria-label={tr.title}>
    <header className="bm-suppliers-heading"><div><h2><ShoppingBag size={22}/>{tr.title}</h2><p>{tr.intro}</p></div>
      <div className="bm-suppliers-counts"><span>{all.length} {tr.offers}</span><span>{offeredPositions} {tr.positions}</span></div>
    </header>
    <div className="bm-suppliers-toolbar">
      <label className="bm-suppliers-search"><Search size={17}/><input value={query} placeholder={tr.search} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="bm-suppliers-filters" role="group" aria-label={tr.title}>
        {(['all','confirmed','review'] as const).map(key=><button key={key} className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{tr[key]}</button>)}
      </div>
    </div>
    <div className="bm-suppliers-message"><ShieldAlert size={17}/>{tr.ai} {language==='ru'?'Цена товара без монтажа не равна цене готовой позиции LV.':language==='en'?'Product-only prices are not equivalent to fully installed LV prices.':'Materialpreise sind keine vollständig ausgeführten LV-Preise.'}</div>
    <div className="bm-suppliers-connection" role="status">
      <span>{connections?.shopping?.configured ? 'Google Shopping · SerpAPI ✓' :
        (language==='ru'?'Живой поиск магазинов не подключён — нужен SERPAPI_API_KEY':language==='en'?'Live retailer search requires SERPAPI_API_KEY':'Live-Händlersuche benötigt SERPAPI_API_KEY')}</span>
      <span>{connections?.supabase?.configured ? `Supabase: ${connections.supabase.marketCatalogCount??'?'} ${language==='ru'?'товаров':language==='en'?'records':'Datensätze'}` : 'Supabase · —'}</span>
      {onRefresh&&!project.archivedAt&&!project.shelvedAt&&<button type="button" className="button" onClick={onRefresh} disabled={busy}><RefreshCw size={14}/>{language==='ru'?'Обновить поиск':language==='en'?'Refresh search':'Marktsuche aktualisieren'}</button>}
    </div>
    {project.analysis.market?.note && <details className="bm-market-diagnostics"><summary>{language==='ru'?'Результаты поиска и диагностика':language==='en'?'Search results and diagnostics':'Suchergebnis und Hinweise'}</summary><p>{project.analysis.market.note}</p></details>}
    {shown.length ? <div className="bm-suppliers-list">{shown.map(({row,offer,comparable:matching,selected})=>{
      const qty=quantityOf(row)
      const total=matching && qty!==null ? offerAmount(offer,qty).total:null
      return <article className="bm-supplier-card" key={`${row.id}:${offer.id}`}>
        <div className="bm-supplier-card-head"><div><span>OZ {row.oz}</span><strong>{row.title}</strong></div>
          <span className={'bm-supplier-state '+(matching?'is-ok':'is-check')}>{matching?<CheckCircle2 size={14}/>:<ShieldAlert size={14}/>} {matching?tr.verified:tr.pending}</span></div>
        <div className="bm-supplier-details"><div><span>{tr.data}</span><strong>{offer.merchant}</strong><small>{offer.title}</small></div>
          <div><span>{total!==null?tr.total:tr.perPack}</span><strong>{eur.format(total??offer.net)}</strong><small>{total===null?(offer.delivery===null?tr.shipping:tr.pending):(offer.leadTime??'')}</small></div></div>
        <div className="bm-supplier-card-actions">
          <span className="bm-supplier-source">{offer.source === 'live' ? 'Google Shopping' : offer.source === 'scraped' ? 'Supabase' : offer.source === 'demo' ? 'Demo' : 'Manuell / Referenz'}{selected?` · ${tr.selected}`:''}</span>
          <div>{offer.url&&<a href={offer.url} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={14}/>{tr.source}</a>}
            <button onClick={()=>openPosition(row.id)}><PackageSearch size={15}/>{tr.open}</button></div>
        </div>
      </article>
    })}</div> : <div className="bm-suppliers-empty"><PackageSearch size={33}/><h3>{tr.none}</h3><p>{tr.empty} {language==='ru'?'Если Supabase пустой, добавь SerpAPI или сначала собери цены в каталог.':'Wenn Supabase leer ist, erst Preise sammeln oder SerpAPI konfigurieren.'}</p></div>}
    {indicative.length>0&&<section className="bm-supplier-ai-section"><h3><Sparkles size={18}/>{language==='ru'?'AI-ориентиры (не поставщики)':language==='en'?'AI estimates (not vendor quotes)':'KI-Richtwerte (keine Händlerangebote)'}</h3>
      <p>{language==='ru'?'AI оценил стоимость выполнения работ по документу. Это не подтверждённые предложения магазинов.':language==='en'?'Estimates reflect the described LV scope, not real supplier quotes.':'KI-Schätzungen zum LV-Leistungsumfang, keine echten Händlerangebote.'}</p>
      <div className="bm-supplier-ai-grid">{indicative.map(row=><button type="button" key={row.id} onClick={()=>openPosition(row.id)}><strong>OZ {row.oz} · {row.title}</strong>
        <span>≈ {eur.format(row.provisionalPrice!.min)} – {eur.format(row.provisionalPrice!.max)} / {row.provisionalPrice!.unit}</span><small>{row.provisionalPrice!.reason}</small></button>)}</div>
    </section>}

  </section>
}
