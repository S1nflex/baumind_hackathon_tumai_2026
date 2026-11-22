'use client'
import { TrendingUp, ExternalLink, RefreshCw, AlertCircle, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { Project } from '@/lib/model'
import { quantityOf } from '@/lib/estimate'

const currency = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'})
export function MarketOverview({ project, onSelect, onRefresh, busy=false }: {project:Project;onSelect:(id:string)=>void;onRefresh?:()=>void;busy?:boolean}) {
  const { language } = useI18n()
  const market = project.analysis.market
  const rowById = new Map(project.positions.map(row => [row.id,row]))
  const estimates = market?.estimates ?? []
  const budget = estimates.reduce((total,item)=>{
    const row=rowById.get(item.positionId)
    const quantity=row && row.included && row.accepted && row.type!=='unit-only' ? quantityOf(row) : null
    if(quantity===null || !Number.isFinite(quantity) || quantity<0)return total
    return {min:total.min+item.min*quantity,max:total.max+item.max*quantity,count:total.count+1}
  },{min:0,max:0,count:0})
  const eligible = project.positions.filter(row=>row.origin==='imported'&&row.accepted).length
  const tr = {
    de:{heading:'KI-Preisanalyse',disclaimer:'Unverbindliche Netto-Richtwerte für den beschriebenen Leistungsumfang. Keine Händlerofferten; vor Freigabe prüfen.',
      offers:'Angebote',no:'Noch keine KI-Preisorientierung verfügbar.',refresh:'Preisrecherche erneut ausführen',
      budget:'Unverbindlicher Gesamtpreisbereich (nur geschätzte Positionen)',source:'Datenlage',covered:'Positionen geschätzt',notReady:'Nicht freigabefähig ohne Bestätigung',inspect:'Position prüfen'},
    en:{heading:'AI pricing analysis',disclaimer:'Indicative net prices for the full described scope. Not verified vendor quotations; validate before approval.',
      offers:'quotes',no:'No AI pricing range yet.',refresh:'Run pricing analysis again',
      budget:'Indicative project range (estimated items only)',source:'Analysis note',covered:'items estimated',notReady:'Review before submitting',inspect:'Review item'},
    ru:{heading:'AI-анализ стоимости',disclaimer:'Ориентировочные цены без НДС за весь описанный объём работ. Это не коммерческие предложения: перед утверждением проверь.',
      offers:'предложений',no:'AI пока не рассчитал ориентиры.',refresh:'Повторить анализ цен',
      budget:'Примерный бюджет (только оценённые позиции)',source:'Причина / состояние',covered:'позиций оценено',notReady:'Нельзя утверждать без проверки',inspect:'Проверить позицию'},
  }[language]
  return <details className="bm-market-overview bm-market-overview--compact">
    <summary><span><TrendingUp size={20}/><strong>{tr.heading}</strong><small>{estimates.length}/{eligible} {tr.covered} · {market?.positionsWithOffers ?? 0} {tr.offers}</small></span><span className="bm-market-toggle">{budget.count>0 ? <strong>{currency.format(budget.min)} – {currency.format(budget.max)}</strong> : tr.no}</span></summary>
    <div className="bm-market-body">
      <p className="bm-market-disclaimer"><AlertCircle size={15}/>{tr.disclaimer}</p>
      <div className="bm-market-actions"><span>{market?.refreshedAt ? new Date(market.refreshedAt).toLocaleString(language==='ru'?'ru-RU':language==='en'?'en-GB':'de-DE') : ''}</span>
        {onRefresh&&!project.archivedAt&&!project.shelvedAt&&<button className="button" type="button" onClick={onRefresh} disabled={busy}><RefreshCw size={15}/>{tr.refresh}</button>}</div>
      {budget.count>0 && <div className="bm-market-budget"><span>{tr.budget}</span><strong>{currency.format(budget.min)} – {currency.format(budget.max)}</strong>
        <small>{budget.count} / {eligible} {tr.covered}</small></div>}
      {estimates.length ? <div className="bm-market-grid">{estimates.map(item=><button type="button" key={item.positionId} className="bm-market-item" onClick={()=>onSelect(item.positionId)}>
        <div><span className="bm-market-oz">{item.oz}</span><strong>{item.title}</strong><ExternalLink size={14}/></div>
        <span className="bm-market-price"><Sparkles size={13}/> ≈ {currency.format(item.min)} – {currency.format(item.max)} / {item.unit}</span>
        <span className="bm-market-review-link" title={item.reason}>{tr.inspect}</span></button>)}</div> : <div className="bm-market-none"><strong>{tr.no}</strong><p>{tr.refresh}</p></div>}
      {market?.note && <details className="bm-market-diagnostics"><summary>{tr.source}</summary><p>{market.note}</p></details>}
    </div>
  </details>
}
