'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Calculator, Check, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardCheck, Download, FileText, LayoutGrid, Layers3, Plus, Search, Settings2, RotateCcw,
  Sparkles, TriangleAlert, Upload, X, Languages,
} from 'lucide-react'
import { decimal, estimateRow, eur, quantityOf, summarize, unitEur, unitOf } from '@/lib/estimate'
import type { Position, Project, ProjectListItem } from '@/lib/model'
import { amountLabel, FindingCard, optionalNumber, PositionDetail, type DetailTab, type InspectorMode, UnitPicker } from './position-detail'

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

function UploadForm({ busy, submit, error, embedded = false }: { busy: boolean; submit: (form: FormData) => void; error: string; embedded?: boolean }) {
  const [file, setFile] = useState<File>()
  const [drag, setDrag] = useState(false)
  const [localError,setLocalError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  function acceptFile(value: File | undefined) {
    if (!value) return
    if (value.size > 24 * 1024 * 1024) {setFile(undefined);setLocalError('Datei zu groß: maximal 24 MB.');return}
    if (!/\.(?:pdf|x8[1-6]|d8[1-6]|xml|xlsx)$/i.test(value.name)) {setFile(undefined);setLocalError('Unterstützt werden PDF, GAEB und XLSX.');return}
    setLocalError('');setFile(value)
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    const form = new FormData(event.currentTarget)
    form.set('file',file)
    submit(form)
  }
  return <form className={embedded ? 'bm-import-form' : 'pane-stack bm-import-form'} onSubmit={send}>
    <div className={'bm-dropzone ' + (drag ? 'is-dragging ' : '') + (file ? 'has-file' : '')} role="group" aria-label="Datei hochladen"
      onDragOver={event=>{event.preventDefault();setDrag(true)}} onDragLeave={event=>{event.preventDefault();setDrag(false)}}
      onDrop={event=>{event.preventDefault();setDrag(false);acceptFile(event.dataTransfer.files[0])}}>
      <img className="bm-drop-cloud" src="/brand/elements/bm-cloud-small.webp" alt="" aria-hidden="true"/>
      <div className="bm-drop-content">
        <span className="bm-drop-icon"><FileText size={23}/></span>
        <div className="bm-drop-copy"><strong>{file ? file.name : 'Leistungsverzeichnis ablegen'}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · bereit zum Import` : 'PDF, GAEB oder XLSX hierher ziehen'}</span></div>
        <button type="button" className="button bm-file-picker" onClick={()=>input.current?.click()} disabled={busy}>
          <Upload size={16}/>{file ? 'Datei wechseln' : 'Datei auswählen'}
        </button>
      </div>
      <input ref={input} className="bm-upload-input" type="file" name="file" accept=".pdf,.x81,.x83,.x84,.x85,.x86,.xml,.d81,.d83,.d84,.d85,.d86,.xlsx"
        onChange={event=>acceptFile(event.target.files?.[0])} aria-label="Datei auswählen"/>
    </div>
    <div className="bm-upload-legend"><span><Check size={13}/> PDF</span><span><Check size={13}/> GAEB</span><span><Check size={13}/> XLSX</span><small>Max. 24 MB</small></div>
    <label className="field bm-name-field"><span>Projektname <small>optional</small></span><input name="name" placeholder="z. B. Neubau Wohnhaus München" maxLength={120}/></label>
    <details className="bm-import-options"><summary><Settings2 size={16}/> Weitere Importoptionen</summary>
      <div className="field-grid">
        <label className="field"><span>Unternehmen</span><input name="company" maxLength={120}/></label>
        <label className="field"><span>PLZ der Baustelle</span><input name="postcode" inputMode="numeric" pattern="[0-9]{5}" maxLength={5}/></label>
      </div>
      <label className="check"><input type="checkbox" name="prices" value="1" defaultChecked/> Lieferantenpreise suchen</label>
      <label className="check"><input type="checkbox" name="ai" value="1"/> KI-Textprüfung (mit API-Schlüssel)</label>
    </details>
    {(error || localError) && <div className="error-inline" role="alert">{localError || error}</div>}
    <button type="submit" className="button button-primary bm-import-submit" disabled={busy || !file}>
      {busy ? 'Datei wird verarbeitet …' : 'Importieren und prüfen'} <ArrowRight size={17}/>
    </button>
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
      <UnitPicker key={category} initial={category === 'labor' ? 'h' : category === 'crew' ? 'psch' : 'St'}/>
      <label className="field"><span>Kosten je Einheit (€)</span><input name="price" type="number" min="0" step="any" /></label>
      <label className="field"><span>Gewerk</span><input name="trade" placeholder="z. B. Elektro" maxLength={40} /></label>
    </div>
    <label className="field"><span>Beschreibung / Preisgrundlage</span><textarea name="note" rows={3} maxLength={1600}/></label>
    {error && <div className="error-inline" role="alert">{error}</div>}
    <div className="dialog-actions"><button className="button button-primary" disabled={busy}><Plus size={16}/> Position hinzufügen</button></div>
  </form>
}

function ProjectsView({ projects, archive, open, create, submit, demo, busy, error }: {
  projects: ProjectListItem[]; archive: boolean; open: (id: string) => void; create: () => void;
  submit: (form: FormData) => void; demo: () => void; busy: boolean; error: string
}) {
  const [search, setSearch] = useState('')
  const [order,setOrder] = useState<'newest'|'name'>('newest')
  const visible = projects.filter(project => Boolean(project.archivedAt) === archive)
  const filtered = visible.filter(project => `${project.name} ${project.fileName} ${project.format}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a,b) => order === 'name' ? a.name.localeCompare(b.name,'de') : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return <main className="projects-page bm-work-home">
    <div className="bm-work-heading">
      <div className="bm-page-headline"><span className="bm-overline"><span className="bm-overline-dot"/> BAUMIND WORKSPACE</span>
        <h1>{archive ? 'Archiv' : 'Dateien & Kalkulation'}</h1>
        <p>{archive ? 'Abgeschlossene Kalkulationen und freigegebene Angebote.' : 'Datei importieren, Positionen prüfen und das Angebot kalkulieren.'}</p>
      </div>
      {!archive && <button className="button bm-demo-shortcut" onClick={demo} disabled={busy}><Sparkles size={16}/> Demo öffnen</button>}
      <img className="bm-heading-cloud" src="/brand/elements/bm-cloud-soft.webp" alt="" aria-hidden="true"/>
    </div>
    <div className={'bm-dashboard-grid ' + (archive ? 'is-archive' : '')}>
      {!archive && <section className="bm-import-panel" aria-label="Leistungsverzeichnis importieren">
        <div className="bm-panel-heading">
          <div className="bm-panel-icon"><Upload size={21}/></div>
          <div><h2>LV importieren</h2><p>Starte mit einer vorhandenen Datei.</p></div>
        </div>
        <UploadForm busy={busy} submit={submit} error={error} embedded />
        <img className="bm-panel-ivy" src="/brand/elements/bm-blueprint.webp" alt="" aria-hidden="true"/>
      </section>}
      <section className="bm-files-panel" aria-label={archive ? 'Archivierte Projekte' : 'Projekte und Dateien'}>
        <div className="bm-files-title">
          <div><h2>{archive ? 'Archivierte Projekte' : 'Meine Projekte'} <span className="bm-project-count">{visible.length}</span></h2>
            <p>Deine Dateien und Kalkulationen an einem Ort.</p></div>
          {!archive && <button className="bm-icon-action" onClick={create} disabled={busy} aria-label="Projekt hinzufügen" title="Projekt hinzufügen"><Plus size={19}/></button>}
        </div>
        <div className="bm-file-tools">
          <label className="bm-project-search"><Search size={18}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Projekt oder Datei suchen" aria-label="Projekte durchsuchen"/>
            {search && <button type="button" aria-label="Suche löschen" onClick={()=>setSearch('')}><X size={14}/></button>}</label>
          <select aria-label="Projekte sortieren" value={order} onChange={event=>setOrder(event.target.value as 'newest'|'name')}><option value="newest">Neueste</option><option value="name">A–Z</option></select>
        </div>
        <div className="bm-project-list">
          {filtered.length ? filtered.map(project => <button key={project.id} className="bm-project-item" onClick={()=>open(project.id)} disabled={busy}>
            <span className="bm-project-item-icon"><FileText size={21}/></span>
            <span className="bm-project-item-body"><strong>{project.name}</strong><small title={project.fileName}>{project.fileName}</small><span>{project.count} Positionen <span aria-hidden="true">·</span> {formatDate(project.createdAt)}</span></span>
            <span className="bm-project-item-meta"><span className={'tag ' + (project.archivedAt ? 'tag-green' : 'tag-neutral')}>{project.archivedAt ? 'Freigegeben' : project.demo ? 'Demo' : project.format}</span><ChevronRight size={17}/></span>
          </button>) : <div className="bm-no-files">
            <img src="/brand/elements/bm-blueprint.webp" alt="" aria-hidden="true"/>
            <strong>{search ? 'Nichts gefunden' : archive ? 'Noch nichts archiviert' : 'Hier erscheinen deine Projekte'}</strong>
            <span>{search ? 'Suche ändern oder zurücksetzen.' : archive ? 'Freigegebene Angebote werden hier gespeichert.' : 'Importiere links ein LV oder öffne die Demo.'}</span>
          </div>}
        </div>
        {!archive && <div className="bm-files-footer"><span><Check size={15}/> Änderungen werden im Projekt gespeichert</span><button onClick={demo} disabled={busy}>Demo testen <ArrowUpRight size={15}/></button></div>}
      </section>
    </div>
    <div className="bm-work-tips"><div><FileText size={18}/><span><strong>Dateien importieren</strong><small>PDF, GAEB, XLSX</small></span></div>
      <div><ClipboardCheck size={18}/><span><strong>Positionen prüfen</strong><small>Risiken und Unklarheiten</small></span></div>
      <div><Calculator size={18}/><span><strong>Kosten kalkulieren</strong><small>Preise und Angebote</small></span></div></div>
  </main>
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
  const [inspectorMode,setInspectorMode] = useState<InspectorMode>('compact')
  const [query,setQuery] = useState('')
  const [group,setGroup] = useState('all')
  const [filter,setFilter] = useState<Filter>('all')
  const [sort,setSort] = useState<{field:Sort; asc:boolean}>({field:'oz',asc:true})
  const [page,setPage] = useState(0)
  const [language,setLanguage] = useState<'de'|'en'|'ru'>('de')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('baumind-language')
      if (saved === 'de' || saved === 'en' || saved === 'ru') setLanguage(saved)
    } catch {}
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem('baumind-language', language) } catch {}
  }, [language])

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

  function resetTable() { setInspectorMode('compact'); setRowId(null); setSection('lv'); setQuery(''); setFilter('all'); setGroup('all'); setPage(0); setTab('detail') }
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
  function navigateToShown(index:number) {
    const item = shown[index]
    if (!item) return
    selectRow(item.row.id,tab)
    setPage(Math.floor(index / pageSize))
  }
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]')
      if (event.key === '/' && !typing && current && section === 'lv' && !modal) {
        event.preventDefault();searchRef.current?.focus()
      }
      if (event.key === 'Escape' && !modal && rowId && !typing) {
        if (inspectorMode !== 'compact') setInspectorMode('compact')
        else setRowId(null)
      }
    }
    window.addEventListener('keydown',shortcuts)
    return () => window.removeEventListener('keydown',shortcuts)
  },[current,section,modal,rowId,inspectorMode])

  const closeDialog = () => {setModal(null);setError('')}
  function toggleSort(field:Sort) {
    setSort(value => ({field,asc:field === value.field ? !value.asc : true}));setPage(0)
  }
  function header(label:string, field:Sort, numeric = false) {
    return <th className={numeric ? 'num' : ''} aria-sort={sort.field === field ? (sort.asc ? 'ascending' : 'descending') : undefined}><button onClick={() => toggleSort(field)}>
      {label} {sort.field === field ? (sort.asc ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : null}
    </button></th>
  }


  function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
    return <label className={'bm-language-switcher' + (mobile ? ' bm-language-switcher--mobile' : '')}>
      <span><Languages size={15}/> Sprache</span>
      <select aria-label="Sprache auswählen" value={language} onChange={event => setLanguage(event.target.value as 'de'|'en'|'ru')}>
        <option value="de">DE</option>
        <option value="en">EN</option>
        <option value="ru">RU</option>
      </select>
    </label>
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => list(false)} aria-label="BauMind Projekte"><span className="brand-icon"><img src="/brand/mountain-mark.png" alt="BauMind Bergsymbol" /></span><span>BauMind<small>BAUKALKULATION & DATEIEN</small></span></button>
      <div className="side-divider"/>
      <nav aria-label="Arbeitsbereich" className="side-nav">
        <button className={!(current?.archivedAt || archive) ? 'active' : ''} onClick={()=>list(false)}><LayoutGrid size={18}/> Projekte</button>
        <button className={current?.archivedAt || archive ? 'active' : ''} onClick={()=>list(true)}><Archive size={18}/> Archiv</button>
      </nav>
      {current && groups.length > 1 && <div className="side-section">
        <div className="side-label">Gewerke / Abschnitte</div>
        <button className={group === 'all' && section === 'lv' ? 'current' : ''} onClick={()=>{setGroup('all');setSection('lv');setPage(0)}}>Alle Positionen</button>
        {groups.map(([id,label])=><button key={id} className={group === id && section === 'lv' ? 'current' : ''}
          title={id + ' ' + label} onClick={()=>{setGroup(id);setSection('lv');setPage(0)}}><span>{id}</span>{label}</button>)}
      </div>}
      <div className="bm-sidebar-bottom">
        <LanguageSwitcher />
        <div className="bm-sidebar-card"><img src="/brand/elements/bm-bricks.webp" alt=""/><span><strong>BauMind</strong><small>Dein Arbeitsbereich</small></span></div>
      </div>
    </aside>
    <div className="surface">
      <header className="topbar">
        <div className="breadcrumbs"><button onClick={() => list(Boolean(current?.archivedAt || archive))}>{current?.archivedAt || archive ? 'Archiv' : 'Projekte'}</button>
          {current && <><ChevronRight size={14}/><span title={current.name}>{current.name}</span></>}</div>
        <div className="top-actions"><LanguageSwitcher mobile /><button className="button mobile-archive" aria-label={archive || current?.archivedAt ? 'Projekte' : 'Archiv'} onClick={() => list(!(archive || current?.archivedAt))}>
          {archive || current?.archivedAt ? <LayoutGrid size={15}/> : <Archive size={15}/>}</button>
        <button className="button top-create" onClick={() => {setError('');setModal('new')}} disabled={busy}><Plus size={15}/> Neues Projekt</button></div>
      </header>
      {loading ? <div className="loading-status" role="status">Arbeitsbereich wird geladen …</div> :
        !current ? <>{error && archive && <div className="global-alert error-inline" role="alert">{error}</div>}
          <ProjectsView projects={projects} archive={archive} create={() => {setError('');setModal('new')}} submit={form => void create(form)} demo={openDemo} open={openProject} busy={busy} error={error}/></> :
        <>
          <div className="project-head bm-project-head">
            <img className="bm-project-cloud" src="/brand/elements/bm-cloud-small.webp" alt="" aria-hidden="true"/>
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
            <button className={'stat ' + ((summary?.open || 0) > 0 ? 'stat-danger' : 'stat-success')} onClick={() => {setSection('review');setRowId(null)}}><span><ClipboardCheck size={15}/> Offene Prüfpunkte</span><strong>{summary?.open}</strong><small>{current.analysis.mode === 'rules' ? 'Regelprüfung' : 'Regeln und KI'}</small></button>
            <div className={'stat ' + ((summary?.withoutPrice || 0) > 0 ? 'stat-warning' : 'stat-success')}><span><CircleHelp size={15}/> Ohne vollständigen Preis</span><strong>{summary?.withoutPrice}</strong><small>{(summary?.withoutPrice || 0) > 0 ? 'Noch nicht freigabefähig' : 'Alles vollständig kalkuliert'}</small></div>
            <div className="stat total-stat"><span><Calculator size={15}/> Angebot netto</span><strong>{amountLabel(summary?.net)}</strong><small>{current.archivedAt ? 'Freigegeben' : 'Aktueller Entwurf'}</small></div>
          </div>
          <nav className="view-tabs" aria-label="Projektansichten">{statuses.map(({key,label,icon:Icon}) =>
            <button className={section === key ? 'active' : ''} key={key} aria-current={section === key ? 'page' : undefined} onClick={()=>{setSection(key);setRowId(null)}}>
              <Icon size={16}/>{label}{key === 'review' && !!summary?.open && <span>{summary.open}</span>}
            </button>)}</nav>
          {section === 'lv' && <div className={'workspace-body ' + (selected ? 'with-inspector' : '') + (selected && inspectorMode !== 'compact' ? ' inspector-expanded' : '')}>
            <div className="positions-panel">
              <header className="toolbar bm-table-toolbar">
                <div className="bm-table-topline"><div><h2>Positionen <span>{shown.length}</span></h2><p>Position auswählen, um Menge, Preise und Quelle zu bearbeiten.</p></div>
                  {!current.archivedAt && <button className="button add-position" onClick={()=>{setError('');setModal('add')}}><Plus size={16}/> Position hinzufügen</button>}
                </div>
                <div className="bm-table-controls">
                  <label className="search"><Search size={17}/><input ref={searchRef} value={query} placeholder="OZ oder Leistung suchen  /" aria-label="Position suchen" onChange={event=>{setQuery(event.target.value);setPage(0)}}/>
                    {query && <button className="bm-clear-query" aria-label="Suche löschen" onClick={()=>{setQuery('');setPage(0)}}><X size={15}/></button>}</label>
                  <label className="bm-group-filter"><span className="sr-only">Abschnitt</span><select aria-label="Abschnitt filtern" value={group} onChange={event=>{setGroup(event.target.value);setPage(0)}}><option value="all">Alle Abschnitte</option>
                    {groups.map(([key,label])=><option key={key} value={key}>{key} {label}</option>)}</select></label>
                </div>
                <div className="bm-filter-row" aria-label="Statusfilter">
                  {([['all','Alle'],['open','Prüfen'],['unpriced','Ohne Preis'],['suggestions','Vorschläge']] as const).map(([value,label])=><button key={value} className={'bm-filter-chip ' + (filter===value?'active':'')} aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(0)}}>{value==='open'&&<TriangleAlert size={14}/>} {label}{value==='open'&&!!summary?.open&&<b>{summary.open}</b>}</button>)}
                  {(query || group !== 'all' || filter !== 'all') && <button className="bm-reset-filters" onClick={()=>{setQuery('');setGroup('all');setFilter('all');setPage(0)}}><RotateCcw size={13}/> Zurücksetzen</button>}
                </div>
              </header>
              <div className="table-scroll">
                <table className="lv-table"><thead><tr>
                  {header('OZ','oz')}{header('Leistung','title')}{header('Menge','quantity',true)}
                  <th className="bm-unit-head">ME</th>{header('EP netto','price',true)}{header('GP netto','total',true)}<th>Status</th>
                </tr></thead><tbody>{activeRows.map(({row,calc}) => {
                  const needs = openIds.has(row.id)
                  const outside = !row.included
                  const high = row.marketPrice !== null && calc.unitPrice !== null && row.marketPrice > 0 && calc.unitPrice > row.marketPrice * 1.15
                  return <tr tabIndex={0} role="button" aria-label={'Position ' + row.oz + ' öffnen: ' + row.title} onKeyDown={event=>{if(event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')){event.preventDefault();selectRow(row.id)}}} className={(rowId === row.id ? 'selected-row ' : '') + (row.origin === 'suggested' ? 'suggested-row ' : '') + (outside ? 'outside-row' : '')} key={row.id} onClick={()=>selectRow(row.id)}>
                    <td><button className="oz-button" onClick={event=>{event.stopPropagation();selectRow(row.id)}} aria-label={'Position ' + row.oz}>{row.oz}</button></td>
                    <td className="title-cell"><b title={row.title}>{row.title}</b>{row.origin !== 'imported' && <span>{row.origin === 'suggested' ? 'Vorgeschlagen' : 'Ergänzt'}</span>}</td>
                    <td className="num bm-qty-cell">{calc.quantity === null ? '—' : decimal.format(calc.quantity)}</td><td className="unit bm-unit-cell">{unitOf(row) || '—'}</td>
                    <td className="num bm-ep-cell"><button className="price-cell" aria-label={'Preise für ' + row.oz} onClick={event => { event.stopPropagation(); selectRow(row.id,'offers') }}>
                      {calc.unitPrice === null ? '—' : unitEur.format(calc.unitPrice)}
                    </button></td>
                    <td className="num bm-gp-cell">{!row.included ? '—' : amountLabel(calc.total)}</td>
                    <td className="cell-status">
                      {needs ? <span className="tag tag-danger"><TriangleAlert size={13}/> Problem prüfen</span> :
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
            {selected && <>
              {inspectorMode === 'focus' && <button className="bm-inspector-backdrop" type="button" aria-label="Fokusansicht verlassen" title="Zur kompakten Ansicht" onClick={() => setInspectorMode('compact')}/>}
              <PositionDetail key={selected.id} project={current} row={selected} tab={tab} setTab={setTab} close={()=>setRowId(null)} run={run} busy={busy}
                mode={inspectorMode} setMode={setInspectorMode}
                indexLabel={(() => { const index = shown.findIndex(item => item.row.id === selected.id); return index >= 0 ? `${index + 1} von ${shown.length} Positionen` : `OZ ${selected.oz}` })()}
                previous={(() => {const index = shown.findIndex(item => item.row.id === selected.id);return index > 0 ? () => navigateToShown(index - 1) : null})()}
                next={(() => {const index = shown.findIndex(item => item.row.id === selected.id);return index >= 0 && index < shown.length - 1 ? () => navigateToShown(index + 1) : null})()}
                onSource={id=>selectRow(id,'source')}/>
            </>}
          </div>}
          {section === 'review' && <div className="view-body review-body">
            <div className="view-title"><div><h2>Prüfprotokoll</h2><p className="muted">Fundstellen und Entscheidungen zum Leistungsverzeichnis.</p></div>
              <button className="button" onClick={()=>{setFilter('open');setGroup('all');setPage(0);setQuery('');setSection('lv')}}>Offene Positionen <ArrowRight size={15}/></button></div>
            {current.analysis.note && <p className="small muted">{current.analysis.note}</p>}
            {!current.findings.length ? <div className="welcome compact"><ClipboardCheck size={25}/><h3>Keine Prüfpunkte gefunden</h3><p>Die geprüften Positionen bleiben im Original einsehbar.</p></div> :
              <div className="finding-grid">{[...current.findings].sort((a,b)=>Number(b.status === 'open')-Number(a.status === 'open')).map(finding=>
                <FindingCard key={finding.id + finding.status} project={current} finding={finding} busy={busy} run={run} onSource={id=>selectRow(id,'source',true)}/>)}</div>}
          </div>}
          {section === 'bid' && <div className="view-body bid-body">
            <div className="view-title"><div><h2>Angebot</h2><p className="muted">Zusammenstellung und Angaben für die Abgabe.</p></div></div>
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
        {((summary?.open || 0) > 0 || (summary?.withoutPrice || 0) > 0) ? <div className="bm-finalize-status bm-finalize-status--danger" role="alert">
          <TriangleAlert size={18}/>
          <div><strong>Freigabe blockiert</strong><p>Behebe zuerst alle offenen Prüfpunkte und fehlenden Preise. Erst dann kann das Angebot sauber abgegeben werden.</p></div>
        </div> : <div className="bm-finalize-status bm-finalize-status--success">
          <Check size={18}/>
          <div><strong>Freigabe ist möglich</strong><p>Alle Prüfpunkte sind geklärt und alle aktiven Positionen sind kalkuliert.</p></div>
        </div>}
        <div className="inset bm-finalize-metrics">
          <div className={'bm-finalize-check ' + ((summary?.open || 0) > 0 ? 'is-danger' : 'is-ok')}><span>Offene Prüfpunkte</span><b>{summary?.open}</b><small>{(summary?.open || 0) > 0 ? 'Muss vor der Abgabe geklärt werden' : 'Keine offenen Prüfprobleme'}</small></div>
          <div className={'bm-finalize-check ' + ((summary?.withoutPrice || 0) > 0 ? 'is-warning' : 'is-ok')}><span>Unvollständig kalkuliert</span><b>{summary?.withoutPrice}</b><small>{(summary?.withoutPrice || 0) > 0 ? 'Aktive Positionen ohne vollständigen Preis' : 'Alle aktiven Positionen haben einen Preis'}</small></div>
          <div className="bm-finalize-check is-total"><span>Angebot netto</span><b>{amountLabel(summary?.net)}</b><small>Wird als Abgabe-LV archiviert</small></div>
        </div>
        {error && <div className="error-inline" role="alert">{error}</div>}
        <div className="dialog-actions"><button className="button" onClick={closeDialog} disabled={busy}><ArrowLeft size={15}/> Zurück</button>
          <button className="button button-primary" disabled={busy || !!summary?.open || !!summary?.withoutPrice}
            onClick={async ()=>{if(await run({action:'finalize'})){setModal(null);setSection('bid')}}}><Check size={16}/> Freigeben und archivieren</button></div>
        {((summary?.open || 0) > 0 || (summary?.withoutPrice || 0) > 0) && <p className="bm-submit-help">Hinweis: Die Freigabe bleibt gesperrt, bis alle Probleme gelöst sind.</p>}
      </div>
    </Dialog>}
  </div>
}
