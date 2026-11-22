'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, FileSearch, LoaderCircle, Search, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useI18n, translate } from '@/lib/i18n'

type Word = { text: string; x: number; y: number; w: number; h: number }
type PreviewPage = { page: number; count: number | null; image: string; words: Word[] }
type Hit = { index: number; source: 'title' | 'oz' }

function tokens(input: string) {
  return input.toLocaleLowerCase('de').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g,'ss').match(/[\p{L}\p{N}]+/gu) || []
}

// Search contiguous words; never mark arbitrary text just because it shares a keyword.
function locate(words: Word[], title: string, oz: string): { hits: Hit[]; kind: 'title'|'oz'|'none' } {
  const flat = words.flatMap((word, index) => tokens(word.text).map(token => ({token,index})))
  const occurrences = (query: string) => {
    const phrase = tokens(query)
    if (!phrase.length) return [] as number[][]
    const results: number[][] = []
    for (let start = 0; start + phrase.length <= flat.length; start++) {
      if (phrase.every((part,i)=>flat[start+i].token === part)) {
        results.push([...new Set(flat.slice(start,start+phrase.length).map(x=>x.index))])
      }
    }
    return results
  }
  const titles = occurrences(title)
  const numbers = occurrences(oz)
  if (titles.length) {
    // Same descriptions can occur more than once. Prefer the text nearest to
    // the selected OZ instead of silently choosing the first occurrence.
    const cost = (titleHit: number[]) => {
      if (!numbers.length) return 0
      const first = words[titleHit[0]]
      return Math.min(...numbers.map(numberHit => {
        const code = words[numberHit[0]]
        return Math.hypot(first.x-code.x, (first.y-code.y)*1.5)
      }))
    }
    const winner = [...titles].sort((a,b)=>cost(a)-cost(b))[0]
    return {hits:winner.map(index=>({index,source:'title'})),kind:'title'}
  }
  if (numbers.length) return {hits:numbers[0].map(index=>({index,source:'oz'})),kind:'oz'}
  return {hits:[],kind:'none'}
}

export function PdfSourceViewer({ projectId, title, oz, pages, close }: {
  projectId: string; title: string; oz: string; pages: number[]; close: () => void
}) {
  const { t, language } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [page,setPage] = useState(Math.max(1,pages[0] || 1))
  const [zoom,setZoom] = useState(1)
  const [loading,setLoading] = useState(true)
  const [data,setData] = useState<PreviewPage | null>(null)
  const [error,setError] = useState('')
  const [query,setQuery] = useState(title)
  const match = useMemo(()=>data ? locate(data.words,query,oz) : {hits:[],kind:'none' as const},[data,query,oz])

  useEffect(()=>{
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return ()=> { if (dialog.open) dialog.close() }
  },[])
  useEffect(()=>{
    const controller = new AbortController()
    setLoading(true);setError('');setData(null)
    fetch(`/api/projects/${encodeURIComponent(projectId)}/pdf-preview?page=${page}`, { signal:controller.signal, cache:'no-store' })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || translate('PDF konnte nicht geladen werden',language))
        return json as PreviewPage
      })
      .then(value=>{setData(value);setLoading(false)})
      .catch(err=>{if (!controller.signal.aborted) {setError((err as Error).message);setLoading(false)}})
    return ()=>controller.abort()
  },[projectId,page,language])

  useEffect(()=>{
    if (!match.hits.length || !data || !viewportRef.current) return
    const first = data.words[match.hits[0].index]
    const viewport = viewportRef.current
    const image = viewport.querySelector<HTMLElement>('.bm-pdf-page')
    if (!image) return
    const destination = image.offsetTop + image.clientHeight * first.y/100 - viewport.clientHeight * .28
    viewport.scrollTo({ top:Math.max(0,destination),behavior:'smooth' })
  },[data,match])

  const maxPage = data?.count || Math.max(page, ...pages, 1)
  const marked = new Set(match.hits.map(hit=>hit.index))
  return <dialog ref={ref} className="bm-pdf-dialog" onCancel={event=>{event.preventDefault();close()}}>
    <div className="bm-pdf-dialog-inner">
      <header className="bm-pdf-dialog-head">
        <div className="bm-pdf-dialog-title"><FileSearch size={22}/><span><strong>{t('Original im PDF')}</strong><small>{oz} · {title}</small></span></div>
        <button className="bm-pdf-icon" onClick={close} type="button" aria-label={t('Schließen')}><X size={21}/></button>
      </header>
      <div className="bm-pdf-toolbar">
        <div className="bm-pdf-page-controls">
          <button className="bm-pdf-icon" disabled={page<=1 || loading} onClick={()=>setPage(value=>Math.max(1,value-1))} aria-label={t('Vorherige Seite')}><ChevronLeft size={19}/></button>
          <span>{t('Seite')} <b>{page}</b> / {data?.count || '?'}</span>
          <button className="bm-pdf-icon" disabled={page>=maxPage || loading} onClick={()=>setPage(value=>Math.min(maxPage,value+1))} aria-label={t('Nächste Seite')}><ChevronRight size={19}/></button>
        </div>
        <form className="bm-pdf-find" onSubmit={event=>{event.preventDefault()}}>
          <Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} aria-label={t('Text im PDF suchen')} placeholder={t('Text im PDF suchen')}/>
        </form>
        <div className="bm-pdf-zoom">
          <button className="bm-pdf-icon" disabled={zoom<=.75} onClick={()=>setZoom(value=>Math.max(.75,+(value-.25).toFixed(2)))} aria-label={t('Verkleinern')}><ZoomOut size={18}/></button>
          <span>{Math.round(zoom*100)}%</span>
          <button className="bm-pdf-icon" disabled={zoom>=1.75} onClick={()=>setZoom(value=>Math.min(1.75,+(value+.25).toFixed(2)))} aria-label={t('Vergrößern')}><ZoomIn size={18}/></button>
        </div>
        <a className="bm-pdf-original-link" href={`/api/projects/${encodeURIComponent(projectId)}/original#page=${page}`} target="_blank" rel="noreferrer">{t('Original öffnen')}<ArrowUpRight size={15}/></a>
      </div>
      <div className={'bm-pdf-found ' + (match.hits.length?'is-found':'is-unmatched')} role="status">
        {loading ? t('Seite wird geladen …') : error ? error : match.hits.length ?
          (match.kind==='title' ? t('Positionstext markiert') : t('OZ im Original markiert')) :
          t('Kein exakter Texttreffer auf dieser Seite. Bitte Seite und Quelle prüfen.')}
      </div>
      <div className="bm-pdf-scroller" ref={viewportRef}>
        {loading ? <div className="bm-pdf-loader"><LoaderCircle className="bm-pdf-spin" size={30}/>{t('PDF wird geladen …')}</div> :
          error ? <div className="bm-pdf-loader bm-pdf-error">{error}<a href={`/api/projects/${encodeURIComponent(projectId)}/original#page=${page}`} target="_blank" rel="noreferrer">{t('Original öffnen')} <ArrowUpRight size={15}/></a></div> :
          data && <div className="bm-pdf-page" style={{width:`${zoom*100}%`}}>
            <img src={data.image} alt={`${t('PDF-Seite')} ${page}`} draggable={false}/>
            {data.words.map((word,index) => marked.has(index) ? <span key={index} className="bm-pdf-highlight" title={word.text} style={{left:`${word.x}%`,top:`${word.y}%`,width:`${word.w}%`,height:`${word.h}%`}}/> : null)}
          </div>}
      </div>
      <footer className="bm-pdf-dialog-foot">{t('Gelbe Markierung zeigt den gefundenen Text. Bei Abweichungen bitte den Originalbeleg prüfen.')}</footer>
    </div>
  </dialog>
}
