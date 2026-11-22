'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check, FileText, Loader2, MessageCircle, Send, Sparkles, TriangleAlert } from 'lucide-react'
import type { Project } from '@/lib/model'
import { useI18n } from '@/lib/i18n'

type Field = 'title' | 'description' | 'quantity' | 'unit' | 'overridePrice' | 'markup'
type Proposal = { rowId: string; field: Field; value: string | number; reason: string; before: string | number | null; oz: string; title: string; applied?: boolean }
type Clarification = {question:string;options:string[]}
type ChatMessage = { role: 'user' | 'assistant'; text: string; proposals?: Proposal[]; clarification?: Clarification | null }
const labels = {
  de: {title:'BauMind Assistent',subtitle:'Fragen zur Kalkulation stellen und Änderungen prüfen, bevor sie übernommen werden.',placeholder:'Z. B. Prüfe die Preise in Abschnitt 6.1 oder ändere die Menge für OZ 6.1.30 auf 250.',send:'Senden',empty:'Frage zum LV stellen',tip:'Die KI kann Vorschläge vorbereiten. Änderungen werden nur nach deiner Bestätigung gespeichert.',apply:'Änderung übernehmen',applied:'Übernommen',open:'Position öffnen',before:'Bisher',after:'Vorgeschlagen',missing:'KI nicht eingerichtet. Konfiguriere OpenAI oder Anthropic unter Integrationen und starte den Server neu.',error:'Anfrage fehlgeschlagen. Bitte Verbindung und API-Konfiguration prüfen.',readOnly:'Archivierte Projekte sind schreibgeschützt.',coverage:'Berücksichtigte Positionen',fields: {title:'Titel',description:'Beschreibung',quantity:'Menge',unit:'Einheit',overridePrice:'EP netto',markup:'Zuschlag (%)'}},
  en: {title:'BauMind Assistant',subtitle:'Ask about your estimate and review suggested edits before applying.',placeholder:'E.g. review prices in section 6.1 or change OZ 6.1.30 quantity to 250.',send:'Send',empty:'Ask about this bill of quantities',tip:'AI can draft changes; nothing is saved without your approval.',apply:'Apply change',applied:'Applied',open:'Open position',before:'Current',after:'Suggested',missing:'AI is not configured. Add OpenAI or Anthropic in Integrations, then restart.',error:'Request failed. Check your connection and API settings.',readOnly:'Archived projects are read-only.',coverage:'Positions considered',fields:{title:'Title',description:'Description',quantity:'Quantity',unit:'Unit',overridePrice:'Net unit price',markup:'Markup (%)'}},
  ru: {title:'Ассистент BauMind',subtitle:'Обсуждай смету и проверяй предложенные изменения до применения.',placeholder:'Например: проверь цены раздела 6.1 или измени количество OZ 6.1.30 на 250.',send:'Отправить',empty:'Задай вопрос по смете',tip:'AI предлагает изменения, но сохраняет их только после твоего подтверждения.',apply:'Применить изменение',applied:'Применено',open:'Открыть позицию',before:'Сейчас',after:'Предложено',missing:'AI ещё не подключён. Настрой OpenAI или Anthropic в разделе интеграций и перезапусти сервер.',error:'Ошибка запроса. Проверь соединение и настройки API.',readOnly:'Архивные проекты доступны только для чтения.',coverage:'Учтено позиций',fields:{title:'Название',description:'Описание',quantity:'Количество',unit:'Единица',overridePrice:'Цена за единицу',markup:'Наценка (%)'}},
} as const

export function AssistantPanel({project,run,onSelectPosition,selectedRowId,active}:{
  project:Project;run:(action:Record<string,unknown>)=>Promise<boolean>;onSelectPosition:(id:string)=>void;selectedRowId?:string|null;active:boolean
}) {
  const {language} = useI18n()
  const L=labels[language]
  const [text,setText] = useState('')
  const [messages,setMessages]=useState<ChatMessage[]>([])
  const [loading,setLoading]=useState(false)
  const [applying,setApplying]=useState(false)
  const [error,setError]=useState('')
  const [coverage,setCoverage]=useState<{sampled:number;total:number}|null>(null)
  const bottom=useRef<HTMLDivElement>(null)
  const composer=useRef<HTMLTextAreaElement>(null)
  useEffect(()=>{setMessages([]);setCoverage(null);setError('');setText('')},[project.id])
  const quickQuestions=({
    de:['Wie hoch ist die aktuelle Netto-Kalkulation?','Welche Positionen haben das größte Preisrisiko?','Welche Lieferantenangebote gibt es?'],
    en:['What is the current net project cost?','Which items have the biggest pricing risks?','Which supplier offers do we have?'],
    ru:['Сколько стоит вся смета?','Какие позиции самые рискованные?','Какие есть предложения поставщиков?'],
  })[language]
  useEffect(()=>{if(active)bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'})},[messages.length,loading,active])

  async function ask(event:FormEvent) {
    event.preventDefault()
    const question=text.trim()
    if(!question || loading) return
    const history=messages.slice(-8).map(m=>({role:m.role,text:m.text.slice(0,1600)}))
    setText('');setError('');setMessages(prev=>[...prev,{role:'user',text:question}]);setLoading(true)
    try{
      const res=await fetch(`/api/projects/${encodeURIComponent(project.id)}/assistant`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,language,history,selectedRowId})
      })
      const data=await res.json()
      if(!res.ok) throw new Error(data.error === 'AI_NOT_CONFIGURED' ? 'AI_NOT_CONFIGURED' : `${data.error || 'AI_ERROR'}: ${data.message || 'Проверь настройки модели и лимиты API.'}`)
      setMessages(prev=>[...prev,{role:'assistant',text:String(data.answer),clarification:data.clarification && typeof data.clarification.question==='string'?{question:data.clarification.question,options:Array.isArray(data.clarification.options)?data.clarification.options:[]}:null,proposals:Array.isArray(data.proposals)?data.proposals:[]}])
      setCoverage({sampled:Number(data.sampled),total:Number(data.total)})
    } catch(e){setError((e as Error).message==='AI_NOT_CONFIGURED'?L.missing:(e as Error).message||L.error)}
    finally{setLoading(false)}
  }
  async function apply(messageIndex:number,proposalIndex:number,proposal:Proposal) {
    if(applying || project.archivedAt || project.shelvedAt) return
    const fresh=project.positions.find(x=>x.id===proposal.rowId)
    if(!fresh){setError(L.error);return}
    const now=proposal.field==='quantity'?fresh.adjustment?.quantity??fresh.quantity:
      proposal.field==='unit'?fresh.adjustment?.unit??fresh.unit:fresh[proposal.field]
    if(now!==proposal.before){setError(language==='ru'?'Позиция уже изменилась. Задай вопрос заново, чтобы получить актуальное предложение.':
      language==='en'?'The position changed since this suggestion. Ask again to refresh.':'Die Position hat sich geändert. Bitte frage erneut.');return}
    setApplying(true);setError('')
    const values:Record<string,unknown>={}
    let action:Record<string,unknown>
    if(proposal.field==='title'||proposal.field==='description') action={action:'editText',rowId:proposal.rowId,field:proposal.field,value:proposal.value}
    else {
      values[proposal.field] = proposal.value
      action={action:'row',rowId:proposal.rowId,values}
    }
    try{
      const ok=await run(action)
      if(ok)setMessages(prev=>prev.map((msg,i)=>i!==messageIndex?msg:{...msg,proposals:msg.proposals?.map((p,j)=>j===proposalIndex?{...p,applied:true}:p)}))
      else setError(L.error)
    } finally{setApplying(false)}
  }
  return <section className="bm-ai-shell" aria-label={L.title}>
    <header className="bm-ai-heading"><span className="bm-ai-mark"><MessageCircle size={22}/></span><div><h2>{L.title}</h2><p>{L.subtitle}</p></div></header>
    {selectedRowId&&<div className="bm-ai-context">OZ {project.positions.find(p=>p.id===selectedRowId)?.oz} · {project.positions.find(p=>p.id===selectedRowId)?.title}</div>}
    <div className="bm-ai-messages" aria-live="polite">
      {!messages.length&&<div className="bm-ai-intro"><Sparkles size={27}/><h3>{L.empty}</h3><p>{L.tip}</p><div className="bm-ai-quick-prompts">{quickQuestions.map(q=><button type="button" key={q} onClick={()=>{setText(q);composer.current?.focus()}}>{q}</button>)}</div></div>}
      {messages.map((message,i)=><article key={i} className={'bm-ai-message bm-ai-message--'+message.role}>
        <div className="bm-ai-bubble">{message.text}</div>
        {message.role==='assistant' && message.clarification && <div className="bm-ai-clarification">
          <strong>{message.clarification.question}</strong>
          {message.clarification.options.length>0 && <div className="bm-ai-clarification-options">{message.clarification.options.map((option,j)=><button type="button" key={j} onClick={()=>{setText(option);composer.current?.focus()}}>{option}</button>)}</div>}
          <small>{({de:'Wähle eine Antwort oder schreibe deine Erläuterung und sende sie ab.',en:'Select an answer or type more detail, then send.',ru:'Выбери ответ или напиши уточнение и отправь его.'})[language]}</small>
        </div>}
        {message.proposals?.map((p,j)=><div key={j} className="bm-ai-proposal">
          <div className="bm-ai-proposal-head"><FileText size={17}/><strong>OZ {p.oz} · {L.fields[p.field]}</strong></div>
          <div className="bm-ai-before-after"><div><span>{L.before}</span><strong>{String(p.before??'—')}</strong></div><ArrowRight size={17}/><div><span>{L.after}</span><strong>{String(p.value)}</strong></div></div>
          {p.reason&&<p>{p.reason}</p>}
          <div className="bm-ai-proposal-actions"><button type="button" className="button" onClick={()=>onSelectPosition(p.rowId)}>{L.open}</button>
            <button type="button" disabled={p.applied||applying||!!project.archivedAt||!!project.shelvedAt} className="button button-primary" onClick={()=>void apply(i,j,p)}>{p.applied?<><Check size={16}/>{L.applied}</>:L.apply}</button></div>
        </div>)}
      </article>)}
      {loading&&<div className="bm-ai-thinking"><Loader2 size={17} className="bm-ai-spin"/> BauMind AI…</div>}
      <div ref={bottom}/>
    </div>
    {error&&<div className="bm-ai-error" role="alert"><TriangleAlert size={17}/><span>{error}</span></div>}
    <form onSubmit={ask} className="bm-ai-composer"><textarea ref={composer} value={text} onChange={event=>setText(event.target.value)} placeholder={L.placeholder} rows={2} maxLength={2500} aria-label={L.empty}/>
      <button type="submit" className="button button-primary" disabled={loading||!text.trim()}><Send size={16}/>{L.send}</button></form>
    {coverage&&<p className="bm-ai-footnote">{L.coverage}: {coverage.sampled}/{coverage.total}. {L.tip}</p>}
    {(project.archivedAt||project.shelvedAt)&&<p className="bm-ai-footnote">{L.readOnly}</p>}
  </section>
}
