'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Calculator, Check, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardCheck, Download, FileText, FolderOpen, LayoutGrid, Layers3, Plus, Search, Settings2,
  Sparkles, TriangleAlert, Upload, X,
} from 'lucide-react'
import { decimal, estimateRow, eur, quantityOf, summarize, unitEur, unitOf } from '@/lib/estimate'
import type { Position, Project, ProjectListItem } from '@/lib/model'
import { canUploadLv, lvUploadAccept, lvUploadFormatMessage } from '@/lib/upload'
import { amountLabel, FindingCard, optionalNumber, PositionDetail, type DetailTab } from './position-detail'

type Section = 'lv' | 'review' | 'bid'
type Modal = 'new' | 'add' | 'finalize' | null
type Sort = 'oz' | 'title' | 'quantity' | 'price' | 'total'
type Filter = 'all' | 'open' | 'suggestions' | 'unpriced'
const pageSize = 25
const statuses = [
  {key:'lv', label:'Leistungsverzeichnis', icon:Layers3},
  {key:'review', label:'Prüfung', icon:ClipboardCheck},
  {key:'bid', label:'Angebot', icon:Calculator},
] as const

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'short', year:'numeric', timeZone:'Europe/Berlin' }).format(new Date(iso))
}

async function responseData(response: Response) {
  const value = await response.json()
  if (!response.ok) throw Object.assign(new Error(value.error || 'Die Anfrage konnte nicht bearbeitet werden.'), { status: response.status })
  return value
}

function Dialog({ label, close, children, busy }: { label: string; close: () => void; children: ReactNode; busy: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="dialog" onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <div className="dialog-heading"><h2>{label}</h2><button className="icon-button" aria-label="Dialog schließen" onClick={close} disabled={busy}><X size={19}/></button></div>
    {children}
  </dialog>
}

function UploadForm({ busy, submit, error }: { busy: boolean; submit: (form: FormData) => void; error: string }) {
  const [file, setFile] = useState<File>()
  const [drag, setDrag] = useState(false)
  const [fileError, setFileError] = useState('')
  const upload = useRef<HTMLInputElement>(null)

  function selectFile(next: File | undefined) {
    if (next && !canUploadLv(next.name)) {
      if (upload.current) upload.current.value = ''
      setFile(undefined)
      setFileError(lvUploadFormatMessage)
      return
    }
    setFile(next)
    setFileError('')
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (file) form.set('file', file)
    submit(form)
  }
  return <form className="pane-stack" onSubmit={send}>
    <p className="muted">Importiere ein Leistungsverzeichnis als Ausgangspunkt für das Angebot.</p>
    <label className={'upload-zone ' + (drag ? 'dragging' : '')} onDragOver={event => {event.preventDefault(); setDrag(true)}}
      onDragLeave={() => setDrag(false)} onDrop={event => {event.preventDefault(); setDrag(false); selectFile(event.dataTransfer.files[0])}}>
      <Upload size={23}/><strong>{file ? file.name : 'Datei auswählen oder hierher ziehen'}</strong><span>PDF, Excel (.xlsx) oder GAEB · bis 24 MB</span>
      <input ref={upload} type="file" name="file" accept={lvUploadAccept}
        onChange={event => selectFile(event.target.files?.[0])} aria-label="LV-Datei"/>
    </label>
    <label className="field"><span>Projektname (optional)</span><input name="name" placeholder="Name des Leistungsverzeichnisses" maxLength={120}/></label>
    <div className="field-grid">
      <label className="field"><span>Bieter / Unternehmen</span><input name="company" maxLength={120}/></label>
      <label className="field"><span>PLZ der Baustelle</span><input name="postcode" inputMode="numeric" pattern="[0-9]{5}" maxLength={5}/></label>
    </div>
    <label className="check"><input type="checkbox" name="prices" value="1" defaultChecked/> Lieferanten für erkannte Artikel suchen</label>
    <p className="small muted">Bei aktiver KI-Prüfung werden Auszüge aus dem LV zur Text- und Schnittstellenprüfung an OpenAI übermittelt.</p>
    {(fileError || error) && <div className="error-inline" role="alert">{fileError || error}</div>}
    <div className="dialog-actions"><button type="submit" className="button button-primary" disabled={busy || !file}>
      {busy ? 'Datei wird geprüft …' : 'Importieren und prüfen'} <ArrowRight size={16}/></button></div>
  </form>
}

function AddForm({ project, busy, submit, error }: { project: Project; busy: boolean; submit: (form: FormData) => void; error: string }) {
  const [category, setCategory] = useState('material')
  const groups = [...new Map(project.positions.map(row => [row.group,row.groupLabel])).entries()]
  return <form className="pane-stack" onSubmit={event => {event.preventDefault(); submit(new FormData(event.currentTarget))}}>
    <label className="field"><span>Bezeichnung</span><input name="title" placeholder="z. B. Elektro-Montageteam" required minLength={2} maxLength={140}/></label>
    <div className="field-grid">
      <label className="field"><span>Typ</span><select name="category" value={category} onChange={event=>setCategory(event.target.value)}>
        <option value="material">Material</option><option value="crew">Kolonne / Firma</option><option value="labor">Arbeitszeit</option>
        <option value="work">Leistung</option><option value="equipment">Gerät</option><option value="other">Sonstiges</option>
      </select></label>
      <label className="field"><span>Abschnitt</span><select name="group"><option value="">Ergänzungen</option>{groups.map(([key,label]) => <option key={key} value={key}>{key} {label}</option>)}</select></label>
      <label className="field"><span>Menge</span><input type="number" name="quantity" min="0" step="any" defaultValue="1" required/></label>
      <label className="field"><span>Einheit</span><input key={category} name="unit" maxLength={12} defaultValue={category === 'labor' ? 'h' : category === 'crew' ? 'psch' : 'St'} required/></label>
      <label className="field"><span>Kosten je Einheit (€)</span><input name="price" type="number" min="0" step="any" /></label>
      <label className="field"><span>Gewerk</span><input name="trade" placeholder="z. B. Elektro" maxLength={40} /></label>
    </div>
    <label className="field"><span>Beschreibung / Preisgrundlage</span><textarea name="note" rows={3} maxLength={1600}/></label>
    {error && <div className="error-inline" role="alert">{error}</div>}
    <div className="dialog-actions"><button className="button button-primary" disabled={busy}><Plus size={16}/> Position hinzufügen</button></div>
  </form>
}

function ProjectsView({ projects, archive, open, create, demo, busy }: {
  projects: ProjectListItem[]; archive: boolean; open: (id: string) => void; create: () => void; demo: () => void; busy: boolean
}) {
  const visible = projects.filter(project => Boolean(project.archivedAt) === archive)
  return <div className="projects-page">
    <div className="projects-heading"><div><h1>{archive ? 'Archiv' : 'Projekte'}</h1>
      <p>{archive ? 'Freigegebene Angebote und ihre Kalkulationen.' : 'Leistungsverzeichnisse prüfen und Angebote kalkulieren.'}</p></div>
      {!archive && <button className="button button-primary" onClick={create} disabled={busy}><Plus size={17}/> Neues Projekt</button>}
    </div>
    {!visible.length && <div className="welcome">
      <div className="welcome-mark"><Layers3 size={33} strokeWidth={1.5}/></div>
      <h2>{archive ? 'Noch keine freigegebenen Angebote' : 'Ein LV. Ein fertiges Angebot.'}</h2>
      <p>{archive ? 'Abgeschlossene Angebote werden hier gespeichert.' : 'Importiere eine Datei, prüfe die Positionen und erstelle dein bepreistes Leistungsverzeichnis.'}</p>
      {!archive && <div className="button-row"><button className="button button-primary" onClick={create} disabled={busy}><Upload size={16}/> LV importieren</button>
        <button className="button" onClick={demo} disabled={busy}>Beispiel öffnen <ArrowUpRight size={15}/></button></div>}
    </div>}
    {!!visible.length && <div className="project-grid">
      {visible.map(project => <button key={project.id} className="project-card" onClick={() => open(project.id)} disabled={busy}>
        <div className="project-card-top"><span className="file-icon"><FileText size={20}/></span>
          <span className={'tag ' + (project.archivedAt ? 'tag-green' : 'tag-neutral')}>{project.archivedAt ? 'Freigegeben' : project.demo ? 'Übungsdaten' : project.format}</span></div>
        <h2>{project.name}</h2><p className="small muted">{project.fileName}</p>
        <div className="project-card-foot"><span>{project.count} Positionen · {formatDate(project.createdAt)}</span>
          {project.open ? <span className="text-amber">{project.open} offen</span> : <ArrowUpRight size={16}/>}</div>
      </button>)}
      {!archive && <button className="project-card add-card" onClick={demo} disabled={busy}><Sparkles size={21}/> Beispiel öffnen <ArrowUpRight size={15}/></button>}
    </div>}
  </div>
}

export function Workspace() {
  const [projects,setProjects] = useState<ProjectListItem[]>([])
  const [current,setCurrent] = useState<Project | null>(null)
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const pending = useRef(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [modal,setModal] = useState<Modal>(null)
  const [archive,setArchive] = useState(false)
  const [section,setSection] = useState<Section>('lv')
  const [rowId,setRowId] = useState<string | null>(null)
  const [tab,setTab] = useState<DetailTab>('detail')
  const [query,setQuery] = useState('')
  const [group,setGroup] = useState('all')
  const [filter,setFilter] = useState<Filter>('all')
  const [sort,setSort] = useState<{field:Sort; asc:boolean}>({field:'oz',asc:true})
  const [page,setPage] = useState(0)

  const updateProjects = useCallback(async () => {
    const data = await responseData(await fetch('/api/projects', {cache:'no-store'}))
    setProjects(data.projects)
  }, [])
  const loadProject = useCallback(async (id:string) => {
    const data = await responseData(await fetch('/api/projects/' + id, {cache:'no-store'}))
    setCurrent(data.project)
  }, [])

  useEffect(() => {
    const project = new URLSearchParams(location.search).get('projekt')
    const initial = async () => {
      try { await updateProjects(); if (project) await loadProject(project) }
      catch (error) { setError((error as Error).message) }
      finally { setLoading(false) }
    }
    void initial()
  }, [updateProjects,loadProject])

  function resetTable() { setRowId(null); setSection('lv'); setQuery(''); setFilter('all'); setGroup('all'); setPage(0); setTab('detail') }
  function projectUrl(id: string | null) {
    history.replaceState(null, '', id ? '?projekt=' + encodeURIComponent(id) : location.pathname)
  }
  function list(archived: boolean) {
    setCurrent(null); setArchive(archived); setError(''); setNotice(''); resetTable(); projectUrl(null)
  }
  async function openProject(id: string) {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setNotice(''); resetTable()
    try { await loadProject(id); projectUrl(id) }
    catch (error) { setError((error as Error).message) }
    finally { setBusy(false); pending.current = false }
  }

  async function create(form:FormData) {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await responseData(await fetch('/api/projects', {method:'POST',body:form}))
      setCurrent(data.project); setModal(null); resetTable(); projectUrl(data.project.id)
      setNotice(data.project.positions.filter((item: Position) => item.origin === 'imported').length + ' Positionen importiert.')
      await updateProjects().catch(() => {})
    } catch (error) { setError((error as Error).message) }
    finally { setBusy(false); pending.current = false }
  }
  function openDemo() { const form = new FormData(); form.set('demo','1'); void create(form) }

  async function run(action:Record<string,unknown>) {
    if (!current || pending.current) return false
    pending.current = true
    const id = current.id
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await responseData(await fetch('/api/projects/' + id, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...action, revision:current.revision}),
      }))
      setCurrent(data.project)
      setNotice(data.note || (action.action === 'finalize' ? 'Angebot freigegeben und archiviert.' : 'Gespeichert.'))
      await updateProjects().catch(() => {})
      return true
    } catch (error) {
      if ((error as {status?:number}).status === 409) await loadProject(id).catch(() => {})
      setError((error as Error).message)
      return false
    } finally { setBusy(false); pending.current = false }
  }

  function selectRow(id: string, view:DetailTab = 'detail', returnToTable = false) {
    setRowId(id); setTab(view)
    if (returnToTable) setSection('lv')
  }

  const summary = useMemo(() => current ? summarize(current) : null, [current])
  const openIds = useMemo(() => new Set(current?.findings.filter(finding => finding.status === 'open').flatMap(finding => finding.positionIds)), [current])
  const groups = useMemo(() => [...new Map(current?.positions.map(row => [row.group, row.groupLabel])).entries()], [current])
  const shown = useMemo(() => {
    if (!current) return []
    const q = query.toLowerCase().trim()
    const dataset = current.positions.filter(row => {
      const calc = estimateRow(row,current.baseMarkup)
      return (group === 'all' || row.group === group) && (!q || (row.oz + ' ' + row.title + ' ' + row.description).toLowerCase().includes(q)) &&
        (filter === 'all' || (filter === 'open' && openIds.has(row.id)) || (filter === 'suggestions' && row.origin === 'suggested') ||
          (filter === 'unpriced' && row.accepted && (row.included || row.type === 'unit-only') && calc.unitPrice === null))
    })
    const natural = Intl.Collator('de', {numeric:true,sensitivity:'base'})
    return dataset.map(row => ({row,calc:estimateRow(row,current.baseMarkup)})).sort((a,b) => {
      let result: number
      if (sort.field === 'oz' || sort.field === 'title') result = natural.compare(a.row[sort.field],b.row[sort.field])
      else {
        const first = sort.field === 'price' ? a.calc.unitPrice : sort.field === 'total' ? a.calc.total : a.calc.quantity
        const second = sort.field === 'price' ? b.calc.unitPrice : sort.field === 'total' ? b.calc.total : b.calc.quantity
        if (first === null) return second === null ? 0 : 1
        if (second === null) return -1
        result = first - second
      }
      return sort.asc ? result : -result
    })
  },[current,query,group,filter,openIds,sort])
  const selected = current?.positions.find(row => row.id === rowId)
  const lastPage = Math.max(0, Math.ceil(shown.length / pageSize)-1)
  const effectivePage = Math.min(page,lastPage)
  const from = effectivePage * pageSize
  const activeRows = shown.slice(from,from+pageSize)

  const closeDialog = () => {setModal(null);setError('')}
  function toggleSort(field:Sort) {
    setSort(value => ({field,asc:field === value.field ? !value.asc : true}));setPage(0)
  }
  function header(label:string, field:Sort, numeric = false) {
    return <th className={numeric ? 'num' : ''} aria-sort={sort.field === field ? (sort.asc ? 'ascending' : 'descending') : undefined}><button onClick={() => toggleSort(field)}>
      {label} {sort.field === field ? (sort.asc ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : null}
    </button></th>
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => list(false)} aria-label="Bauton Projekte"><span className="brand-icon"><Layers3 size={24} strokeWidth={2.3}/></span><span>Bauton<span className="brand-dot">.</span><small>LV-Kalkulation</small></span></button>
      <div className="side-divider"/>
      <nav aria-label="Arbeitsbereich" className="side-nav">
        <button className={!(current?.archivedAt || archive) ? 'active' : ''} onClick={() => list(false)}><LayoutGrid size={17}/> Projekte</button>
        <button className={current?.archivedAt || archive ? 'active' : ''} onClick={() => list(true)}><Archive size={17}/> Archiv</button>
      </nav>
      {current && groups.length > 1 && <div className="side-section">
        <div className="side-label">ABSCHNITTE</div>
        <button className={group === 'all' && section === 'lv' ? 'current' : ''} onClick={() => {setGroup('all');setSection('lv');setPage(0)}}>Alle Positionen</button>
        {groups.map(([id,label]) => <button key={id} className={group === id && section === 'lv' ? 'current' : ''}
          title={id + ' ' + label} onClick={() => {setGroup(id);setSection('lv');setPage(0)}}><span>{id}</span>{label}</button>)}
      </div>}
      <div className="side-bottom"><span className="avatar">OZ</span><div><strong>OZ 404</strong><span>Arbeitsbereich</span></div></div>
    </aside>
    <div className="surface">
      <header className="topbar">
        <div className="breadcrumbs"><button onClick={() => list(Boolean(current?.archivedAt || archive))}>{current?.archivedAt || archive ? 'Archiv' : 'Projekte'}</button>
          {current && <><ChevronRight size={14}/><span title={current.name}>{current.name}</span></>}</div>
        <div className="top-actions"><button className="button mobile-archive" aria-label={archive || current?.archivedAt ? 'Projekte' : 'Archiv'} onClick={() => list(!(archive || current?.archivedAt))}>
          {archive || current?.archivedAt ? <LayoutGrid size={15}/> : <Archive size={15}/>}</button>
        <button className="button top-create" onClick={() => {setError('');setModal('new')}} disabled={busy}><Plus size={15}/> Neues Projekt</button></div>
      </header>
      {loading ? <div className="loading-status" role="status">Arbeitsbereich wird geladen …</div> :
        !current ? <>{error && <div className="global-alert error-inline" role="alert">{error}</div>}
          <ProjectsView projects={projects} archive={archive} create={() => {setError('');setModal('new')}} demo={openDemo} open={openProject} busy={busy}/></> :
        <>
          <div className="project-head">
            <div className="project-title-badges"><span className="tag tag-neutral">{current.format}</span>
              <span className={'tag ' + (current.archivedAt ? 'tag-green' : 'tag-teal')}>{current.archivedAt ? 'Freigegeben' : 'In Kalkulation'}</span>
              {current.demo && <span className="tag tag-purple">Übungsdaten</span>}
            </div>
            <div className="project-head-main"><div><h1>{current.name}</h1>
              <p><FileText size={15}/> {current.fileName}{current.pages ? ' · ' + current.pages + ' Seiten' : ''}</p></div>
              <div className="button-row head-actions">
                {current.archivedAt ? <a className="button button-primary" href={'/api/projects/' + current.id + '/report'}><Download size={16}/> Abgabe LV</a> :
                  <><a className="button" href={'/api/projects/' + current.id + '/report'}><Download size={16}/> PDF-Entwurf</a>
                    <button className="button button-primary" onClick={() => {setError('');setModal('finalize')}} disabled={busy}><Check size={16}/> Freigeben</button></>}
              </div>
            </div>
          </div>
          {error && !modal && <div className="global-alert error-inline" role="alert">{error}</div>}
          {notice && <div className="workspace-notice" role="status"><Check size={14}/> {notice}<button className="icon-button" aria-label="Hinweis schließen" onClick={()=>setNotice('')}><X size={14}/></button></div>}
          {!!current.warnings.length && <details className="import-warnings"><summary><TriangleAlert size={15}/> {current.warnings.length} Importhinweis(e)</summary>
            <ul>{current.warnings.map((warning,i) => <li key={i}>{warning}</li>)}</ul></details>}
          <div className="stats">
            <div className="stat"><span><Layers3 size={15}/> Originalpositionen</span><strong>{current.positions.filter(row=>row.origin === 'imported').length}</strong><small>{groups.length} Abschnitte</small></div>
            <button className="stat" onClick={() => {setSection('review');setRowId(null)}}><span><ClipboardCheck size={15}/> Offene Prüfpunkte</span><strong>{summary?.open}</strong><small>{current.analysis.status === 'unavailable' ? 'Regeln · KI nicht erreichbar' : current.analysis.status === 'partial' ? 'Regeln · KI teilweise geprüft' : current.analysis.status === 'disabled' ? 'Regeln · KI inaktiv' : current.analysis.mode === 'rules' ? 'Regelprüfung' : 'Regeln und KI'}</small></button>
            <div className="stat"><span><CircleHelp size={15}/> Ohne vollständigen Preis</span><strong>{summary?.withoutPrice}</strong><small>Aktive Positionen</small></div>
            <div className="stat total-stat"><span><Calculator size={15}/> Angebot netto</span><strong>{amountLabel(summary?.net)}</strong><small>{current.archivedAt ? 'Freigegeben' : 'Aktueller Entwurf'}</small></div>
          </div>
          <nav className="view-tabs" aria-label="Projektansichten">{statuses.map(({key,label,icon:Icon}) =>
            <button className={section === key ? 'active' : ''} key={key} aria-current={section === key ? 'page' : undefined} onClick={()=>{setSection(key);setRowId(null)}}>
              <Icon size={16}/>{label}{key === 'review' && !!summary?.open && <span>{summary.open}</span>}
            </button>)}</nav>
          {section === 'lv' && <div className={'workspace-body ' + (selected ? 'with-inspector' : '')}>
            <div className="positions-panel">
              <header className="toolbar">
                <label className="search"><Search size={16}/><input value={query} placeholder="Position oder OZ suchen" aria-label="Position suchen" onChange={event => {setQuery(event.target.value);setPage(0)}}/></label>
                <select aria-label="Abschnitt filtern" value={group} onChange={event => {setGroup(event.target.value);setPage(0)}}><option value="all">Alle Abschnitte</option>
                  {groups.map(([key,label]) => <option key={key} value={key}>{key} {label}</option>)}</select>
                <select aria-label="Prüfstatus filtern" value={filter} onChange={event => {setFilter(event.target.value as Filter);setPage(0)}}>
                  <option value="all">Alle Status</option><option value="open">Offene Prüfpunkte</option><option value="suggestions">Vorschläge</option><option value="unpriced">Ohne Preis</option>
                </select>
                {!current.archivedAt && <button className="button add-position" onClick={()=>{setError('');setModal('add')}}><Plus size={15}/> Position</button>}
              </header>
              <div className="table-scroll">
                <table className="lv-table"><thead><tr>
                  {header('OZ','oz')}{header('Leistung','title')}{header('Menge','quantity',true)}
                  <th>ME</th>{header('EP netto','price',true)}{header('GP netto','total',true)}<th>Status</th>
                </tr></thead><tbody>{activeRows.map(({row,calc}) => {
                  const needs = openIds.has(row.id)
                  const outside = !row.included
                  const high = row.marketComparable && row.marketPrice !== null && calc.unitPrice !== null && row.marketPrice > 0 && calc.unitPrice > row.marketPrice * 1.15
                  return <tr className={(rowId === row.id ? 'selected-row ' : '') + (row.origin === 'suggested' ? 'suggested-row ' : '') + (outside ? 'outside-row' : '')} key={row.id} onClick={()=>selectRow(row.id)}>
                    <td><button className="oz-button" onClick={event=>{event.stopPropagation();selectRow(row.id)}} aria-label={'Position ' + row.oz}>{row.oz}</button></td>
                    <td className="title-cell"><b title={row.title}>{row.title}</b>{row.origin !== 'imported' && <span>{row.origin === 'suggested' ? 'Vorgeschlagen' : 'Ergänzt'}</span>}</td>
                    <td className="num">{calc.quantity === null ? '—' : decimal.format(calc.quantity)}</td><td className="unit">{unitOf(row) || '—'}</td>
                    <td className="num"><button className="price-cell" aria-label={'Preise für ' + row.oz} onClick={event => { event.stopPropagation(); selectRow(row.id,'offers') }}>
                      {calc.unitPrice === null ? '—' : unitEur.format(calc.unitPrice)}
                    </button></td>
                    <td className="num">{!row.included ? '—' : amountLabel(calc.total)}</td>
                    <td className="cell-status">
                      {needs ? <span className="tag tag-amber"><TriangleAlert size={13}/> Prüfen</span> :
                        high ? <span className="tag tag-amber"><TriangleAlert size={13}/> Über Referenz</span> :
                          row.origin === 'suggested' && !row.accepted ? <span className="tag tag-purple"><Sparkles size={12}/> Vorschlag</span> :
                            row.type === 'unit-only' ? <span className="tag tag-neutral">Nur EP</span> :
                              calc.unitPrice === null ? <span className="plain-status">Offen</span> : <span className="dot-status"><i/> Kalkuliert</span>}
                    </td>
                  </tr>
                })}</tbody></table>
                {!activeRows.length && <div className="table-empty">Keine Positionen für diese Auswahl.<button className="text-button" onClick={()=>{setQuery('');setGroup('all');setFilter('all');setPage(0)}}>Filter zurücksetzen</button></div>}
              </div>
              <footer className="table-footer"><span>{shown.length ? (from+1) + '–' + Math.min(from+pageSize,shown.length) + ' von ' + shown.length : '0'} Positionen</span>
                <div className="button-row"><button className="icon-button" aria-label="Vorherige Seite" onClick={()=>setPage(effectivePage-1)} disabled={!effectivePage}><ChevronLeft size={16}/></button>
                  <span>Seite {effectivePage+1} / {lastPage+1}</span><button className="icon-button" aria-label="Nächste Seite" onClick={()=>setPage(effectivePage+1)} disabled={effectivePage===lastPage}><ChevronRight size={16}/></button></div></footer>
            </div>
            {selected && <PositionDetail key={selected.id} project={current} row={selected} tab={tab} setTab={setTab} close={()=>setRowId(null)} run={run} busy={busy}
              onSource={id=>selectRow(id,'source')}/>}
          </div>}
          {section === 'review' && <div className="view-body review-body">
            <div className="view-title"><div><h2>Prüfprotokoll</h2><p className="muted">Fundstellen und Entscheidungen zum Leistungsverzeichnis.</p></div>
              <button className="button" onClick={()=>{setFilter('open');setGroup('all');setPage(0);setQuery('');setSection('lv')}}>Offene Positionen <ArrowRight size={15}/></button></div>
            {current.analysis.note && <p className="small muted">{current.analysis.note}</p>}
            {current.analysis.agent && <p className="small muted">
              {current.analysis.agent.status === 'applied'
                ? <>Abschnittsübergreifende Prüfung · {current.analysis.agent.candidates} Ausgangsposition(en), {current.analysis.agent.searches} Suche(n) im ganzen LV, {current.analysis.agent.read} Langtext(e) geöffnet.</>
                : 'Die abschnittsübergreifende Prüfung konnte nicht abgeschlossen werden.'}
            </p>}
            {!current.findings.length ? <div className="welcome compact"><ClipboardCheck size={25}/><h3>Keine Prüfpunkte gefunden</h3><p>Die geprüften Positionen bleiben im Original einsehbar.</p></div> :
              <div className="finding-grid">{[...current.findings].sort((a,b)=>Number(b.status === 'open')-Number(a.status === 'open')).map(finding=>
                <FindingCard key={finding.id + finding.status} project={current} finding={finding} busy={busy} run={run} onSource={id=>selectRow(id,'source',true)}/>)}</div>}
          </div>}
          {section === 'bid' && <div className="view-body bid-body">
            <div className="view-title"><div><h2>Angebot</h2><p className="muted">Zusammenstellung und Angaben für die Abgabe.</p></div>
              <div className="button-row">
                <a className="button" href={'/api/projects/' + current.id + '/report?layout=long'}><Download size={15}/> LV-Langfassung</a>
                <a className="button" href={'/api/projects/' + current.id + '/report?layout=internal'}><Download size={15}/> Interne Kalkulation</a>
              </div>
            </div>
            <div className="bid-columns"><section className="sheet"><header><h3>Zusammenstellung</h3></header>
              {[...(summary?.byGroup || [])].map(([key,total]) => <div className="bid-line" key={key}><span>{groups.find(([id])=>key===id)?.[1] ?? key}</span><b>{eur.format(total)}</b></div>)}
              <div className="bid-line"><strong>Netto</strong><b>{amountLabel(summary?.net)}</b></div>
              <div className="bid-line"><span>Umsatzsteuer ({current.vat} %)</span><b>{amountLabel(summary?.taxes)}</b></div>
              <div className="bid-line grand"><strong>Brutto</strong><strong>{amountLabel(summary?.gross)}</strong></div>
            </section>
            <section className="sheet"><header><h3><Settings2 size={17}/> Angebotsdaten</h3></header>
              <form key={current.revision} className="pane-stack settings-form" onSubmit={event=>{
                event.preventDefault();const form=new FormData(event.currentTarget)
                void run({action:'settings',name:form.get('name'),company:form.get('company'),postcode:form.get('postcode'),
                  markup:optionalNumber(form,'markup'),vat:optionalNumber(form,'vat')})
              }}>
                <label className="field"><span>Projektname</span><input name="name" defaultValue={current.name} required minLength={2} maxLength={120} disabled={Boolean(current.archivedAt)}/></label>
                <label className="field"><span>Bieter / Unternehmen</span><input name="company" defaultValue={current.company} maxLength={120} disabled={Boolean(current.archivedAt)}/></label>
                <label className="field"><span>PLZ</span><input name="postcode" defaultValue={current.postcode} inputMode="numeric" maxLength={5} pattern="[0-9]{5}" disabled={Boolean(current.archivedAt)}/></label>
                <div className="field-grid"><label className="field"><span>Standardzuschlag (%)</span><input name="markup" type="number" min={0} max={300} step="any" defaultValue={current.baseMarkup} required disabled={Boolean(current.archivedAt)}/></label>
                  <label className="field"><span>Umsatzsteuer (%)</span><input name="vat" type="number" min={0} max={100} step="any" defaultValue={current.vat} required disabled={Boolean(current.archivedAt)}/></label></div>
                {!current.archivedAt && <button className="button button-primary" disabled={busy}>Angaben speichern</button>}
              </form>
            </section></div>
          </div>}
        </>}
    </div>
    {modal === 'new' && <Dialog label="Neues Projekt" close={closeDialog} busy={busy}><UploadForm busy={busy} submit={form=>void create(form)} error={error}/></Dialog>}
    {modal === 'add' && current && <Dialog label="Position ergänzen" close={closeDialog} busy={busy}>
      <AddForm project={current} busy={busy} error={error} submit={async form=>{
        if (await run({action:'add', title:form.get('title'), category:form.get('category'), group:form.get('group'),
          quantity:optionalNumber(form,'quantity'), unit:form.get('unit'), price:optionalNumber(form,'price'),
          trade:form.get('trade'), note:form.get('note')})) {setModal(null);setFilter('all');setGroup('all');setQuery('')}
      }}/></Dialog>}
    {modal === 'finalize' && current && <Dialog label="Angebot freigeben" close={closeDialog} busy={busy}>
      <div className="pane-stack">
        <p>Die geprüfte Kalkulation wird als Abgabe-LV gespeichert und im Archiv abgelegt.</p>
        <div className="inset">
          <div className="bid-line"><span>Offene Prüfpunkte</span><b>{summary?.open}</b></div>
          <div className="bid-line"><span>Unvollständig kalkuliert</span><b>{summary?.withoutPrice}</b></div>
          <div className="bid-line"><strong>Angebot netto</strong><strong>{amountLabel(summary?.net)}</strong></div>
        </div>
        {error && <div className="error-inline" role="alert">{error}</div>}
        <div className="dialog-actions"><button className="button" onClick={closeDialog} disabled={busy}><ArrowLeft size={15}/> Zurück</button>
          <button className="button button-primary" disabled={busy || !!summary?.open || !!summary?.withoutPrice}
            onClick={async ()=>{if(await run({action:'finalize'})){setModal(null);setSection('bid')}}}><Check size={16}/> Freigeben und archivieren</button></div>
      </div>
    </Dialog>}
  </div>
}
