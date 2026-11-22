'use client';
import { useI18n, initializeLanguage, setLanguage, translate } from '@/lib/i18n';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type CSSProperties } from 'react';
import { Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Calculator, Check, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, Download, FileText, LayoutGrid, Layers3, Plus, Search, MessageCircle, Settings2, RotateCcw, Sparkles, TriangleAlert, Upload, X, Languages, Grid2X2, ChevronDown, Trash2, } from 'lucide-react';
import { decimal, estimateRow, eur, quantityOf, summarize, unitEur, unitOf } from '@/lib/estimate';
import type { Position, Project, ProjectListItem } from '@/lib/model';
import { amountLabel, optionalNumber, PositionDetail, type DetailTab, type InspectorMode, UnitPicker } from './position-detail';
import { ReviewWizard } from './review-wizard';
import { buildSectionNavigation, positionBelongsToSection } from '@/lib/sections';
import { AssistantPanel } from './assistant-panel';
type Section = 'lv' | 'review' | 'bid' | 'assistant';
type Modal = 'new' | 'add' | 'finalize' | 'sections' | null;
type Sort = 'oz' | 'title' | 'quantity' | 'price' | 'total';
type Filter = 'all' | 'open' | 'suggestions' | 'unpriced';
const pageSize = 25;
const statuses = [
    { key: 'lv', label: 'Leistungsverzeichnis', icon: Layers3 },
    { key: 'review', label: 'Prüfung', icon: ClipboardCheck },
    { key: 'bid', label: 'Angebot', icon: Calculator },
    { key: 'assistant', label: 'AI-Chat', icon: MessageCircle },
] as const;
function formatDate(iso: string, language: 'de'|'en'|'ru') {
    return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : language === 'ru' ? 'ru-RU' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(iso));
}
async function responseData(response: Response) {
    const value = await response.json();
    if (!response.ok)
        throw Object.assign(new Error(value.error || 'Die Anfrage konnte nicht bearbeitet werden.'), { status: response.status });
    return value;
}
function Dialog({ label, close, children, busy, wide = false }: {
    label: string;
    close: () => void;
    children: ReactNode;
    busy: boolean;
    wide?: boolean;
}) {
    const { t } = useI18n();
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { dialog.current?.showModal(); }, []);
    return <dialog ref={dialog} className={"dialog" + (wide ? " bm-dialog-wide" : "")} onCancel={event => { event.preventDefault(); if (!busy)
        close(); }}>
    <div className="dialog-heading"><h2>{t(label)}</h2><button className="icon-button" aria-label={t("Dialog schlie\u00DFen")} onClick={close} disabled={busy}><X size={19}/></button></div>
    {children}
  </dialog>;
}
function UploadForm({ busy, submit, error, embedded = false }: {
    busy: boolean;
    submit: (form: FormData) => void;
    error: string;
    embedded?: boolean;
}) {
    const { t } = useI18n();
    const [file, setFile] = useState<File>();
    const [drag, setDrag] = useState(false);
    const [localError, setLocalError] = useState('');
    const input = useRef<HTMLInputElement>(null);
    function acceptFile(value: File | undefined) {
        if (!value)
            return;
        if (value.size > 24 * 1024 * 1024) {
            setFile(undefined);
            setLocalError(t("Datei zu gro\u00DF: maximal 24 MB."));
            return;
        }
        if (!/\.(?:pdf|x8[1-6]|d8[1-6]|xml|xlsx)$/i.test(value.name)) {
            setFile(undefined);
            setLocalError(t("Unterst\u00FCtzt werden PDF, GAEB und XLSX."));
            return;
        }
        setLocalError('');
        setFile(value);
    }
    function send(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file)
            return;
        const form = new FormData(event.currentTarget);
        form.set('file', file);
        submit(form);
    }
    return <form className={embedded ? 'bm-import-form' : 'pane-stack bm-import-form'} onSubmit={send}>
    <div className={'bm-dropzone ' + (drag ? 'is-dragging ' : '') + (file ? 'has-file' : '')} role="group" aria-label={t("Datei hochladen")} onDragOver={event => { event.preventDefault(); setDrag(true); }} onDragLeave={event => { event.preventDefault(); setDrag(false); }} onDrop={event => { event.preventDefault(); setDrag(false); acceptFile(event.dataTransfer.files[0]); }}>
      <img className="bm-drop-cloud" src="/brand/elements/bm-cloud-small.webp" alt="" aria-hidden="true"/>
      <div className="bm-drop-content">
        <span className="bm-drop-icon"><FileText size={23}/></span>
        <div className="bm-drop-copy"><strong>{file ? file.name : t("Datei hier ablegen")}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${t("bereit zum Import")}` : t("PDF, GAEB oder XLSX hierher ziehen")}</span></div>
        <button type="button" className={'button bm-file-picker' + (embedded ? ' bm-primary-picker' : '')} onClick={() => input.current?.click()} disabled={busy}>
          <Upload size={16}/>{file ? t("Datei wechseln") : t("Datei ausw\u00E4hlen")}
        </button>
      </div>
      <input ref={input} className="bm-upload-input" type="file" name="file" accept=".pdf,.x81,.x83,.x84,.x85,.x86,.xml,.d81,.d83,.d84,.d85,.d86,.xlsx" onChange={event => acceptFile(event.target.files?.[0])} aria-label={t("Datei ausw\u00E4hlen")}/>
    </div>
    <div className="bm-upload-legend"><span><Check size={13}/> PDF</span><span><Check size={13}/> GAEB</span><span><Check size={13}/> XLSX</span><small>{"" + t("Max. 24 MB") + ""}</small></div>
    {(!embedded || file) && <div className="bm-upload-options-on-select">
    <label className="field bm-name-field"><span>{"" + t("Projektname") + " "}<small>{"" + t("optional") + ""}</small></span><input name="name" placeholder={t("z. B. Neubau Wohnhaus M\u00FCnchen")} maxLength={120}/></label>
    <details className="bm-import-options"><summary><Settings2 size={16}/>{" " + t("Weitere Importoptionen") + ""}</summary>
      <div className="field-grid">
        <label className="field"><span>{"" + t("Unternehmen") + ""}</span><input name="company" maxLength={120}/></label>
        <label className="field"><span>{"" + t("PLZ der Baustelle") + ""}</span><input name="postcode" inputMode="numeric" pattern="[0-9]{5}" maxLength={5}/></label>
      </div>
      <label className="check"><input type="checkbox" name="prices" value="1" defaultChecked/>{" " + t("Lieferantenpreise suchen") + ""}</label>
      <label className="check"><input type="checkbox" name="ai" value="1"/>{" " + t("KI-Textpr\u00FCfung (mit API-Schl\u00FCssel)") + ""}</label>
    </details>
    </div>}
    {(error || localError) && <div className="error-inline" role="alert">{localError || error}</div>}
    {(!embedded || file) && <button type="submit" className="button button-primary bm-import-submit" disabled={busy || !file}>
      {busy ? t("Datei wird verarbeitet \u2026") : t("Importieren und pr\u00FCfen")} <ArrowRight size={17}/>
    </button>}
  </form>;
}
function AddForm({ project, busy, submit, error }: {
    project: Project;
    busy: boolean;
    submit: (form: FormData) => void;
    error: string;
}) {
    const { t } = useI18n();
    const [category, setCategory] = useState('material');
    const navigationGroups = buildSectionNavigation(project.positions);
    const sectionDisplayName = (id: string, label: string) => /^Abschnitt\s+\d+(?:\.\d+)*$/i.test(label) ? `${t('Abschnitt')} ${id}` : label;
    return <form className="pane-stack" onSubmit={event => { event.preventDefault(); submit(new FormData(event.currentTarget)); }}>
    <label className="field"><span>{"" + t("Bezeichnung") + ""}</span><input name="title" placeholder={t("z. B. Elektro-Montageteam")} required minLength={2} maxLength={140}/></label>
    <div className="field-grid">
      <label className="field"><span>{"" + t("Typ") + ""}</span><select name="category" value={category} onChange={event => setCategory(event.target.value)}>
        <option value="material">{"" + t("Material") + ""}</option><option value="crew">{"" + t("Kolonne / Firma") + ""}</option><option value="labor">{"" + t("Arbeitszeit") + ""}</option>
        <option value="work">{"" + t("Leistung") + ""}</option><option value="equipment">{"" + t("Ger\u00E4t") + ""}</option><option value="other">{"" + t("Sonstiges") + ""}</option>
      </select></label>
      <label className="field"><span>{"" + t("Abschnitt") + ""}</span><select name="group"><option value="">{"" + t("Erg\u00E4nzungen") + ""}</option>{navigationGroups.map(({id,label,depth}) => <option key={id} value={id}>{depth ? '  ↳ ' : ''}{id} {sectionDisplayName(id,label)}</option>)}</select></label>
      <label className="field"><span>{"" + t("Menge") + ""}</span><input type="number" name="quantity" min="0" step="any" defaultValue="1" required/></label>
      <UnitPicker key={category} initial={category === 'labor' ? 'h' : category === 'crew' ? 'psch' : 'St'}/>
      <label className="field"><span>{"" + t("Kosten je Einheit (\u20AC)") + ""}</span><input name="price" type="number" min="0" step="any"/></label>
      <label className="field"><span>{"" + t("Gewerk") + ""}</span><input name="trade" placeholder={t("z. B. Elektro")} maxLength={40}/></label>
    </div>
    <label className="field"><span>{"" + t("Beschreibung / Preisgrundlage") + ""}</span><textarea name="note" rows={3} maxLength={1600}/></label>
    {error && <div className="error-inline" role="alert">{error}</div>}
    <div className="dialog-actions"><button className="button button-primary" disabled={busy}><Plus size={16}/>{" " + t("Position hinzuf\u00FCgen") + ""}</button></div>
  </form>;
}
function StartView({ submit, busy, error }: {
    submit: (form: FormData) => void;
    busy: boolean;
    error: string;
}) {
    const { t } = useI18n();
    return <main className="bm-start-page bm-start-page--minimal">
      <section className="bm-start-primary bm-minimal-upload" aria-labelledby="bm-minimal-upload-title">
        <span className="bm-minimal-upload-mark" aria-hidden="true"><Upload size={26}/></span>
        <h1 id="bm-minimal-upload-title">{t('Leistungsverzeichnis hochladen')}</h1>
        <p className="bm-minimal-upload-subtitle">{t('Datei auswählen, Positionen prüfen und direkt kalkulieren.')}</p>
        <UploadForm busy={busy} submit={submit} error={error} embedded/>
      </section>
    </main>;
}

function ProjectsView({ projects, archive, open, create, manage, busy }: {
    projects: ProjectListItem[];
    archive: boolean;
    open: (id: string) => void;
    create: () => void;
    manage: (id: string, action: 'archive'|'restore'|'delete') => void;
    busy: boolean;
}) {
    const {t,language} = useI18n();
    const [search,setSearch] = useState('');
    const [order,setOrder] = useState<'newest'|'name'>('newest');
    const visible = projects.filter(project => Boolean(project.archivedAt || project.shelvedAt) === archive);
    const filtered = visible.filter(project => `${project.name} ${project.fileName} ${project.format}`.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a,b) => order === 'name' ? a.name.localeCompare(b.name,language) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return <main className="bm-projects-page">
      <header className="bm-projects-heading">
        <div><h1>{archive ? t('Archiv') : t('Meine Projekte')}</h1>
          <p>{archive ? t('Archivierte Entwürfe und freigegebene Angebote.') : t('Alle importierten Leistungsverzeichnisse und Kalkulationen.')}</p></div>
        {!archive && <button className="button button-primary bm-projects-new" onClick={create} disabled={busy}><Plus size={18}/>{t('Datei importieren')}</button>}
      </header>
      <section className="bm-projects-library" aria-label={archive ? t('Archivierte Projekte') : t('Meine Projekte')}>
        <div className="bm-projects-library-head"><h2>{archive ? t('Archivierte Projekte') : t('Projektübersicht')} <span className="bm-project-count">{visible.length}</span></h2>
          <div className="bm-file-tools">
            <label className="bm-project-search"><Search size={18}/><input value={search} onChange={event=>setSearch(event.target.value)}
              placeholder={t('Projekt oder Datei suchen')} aria-label={t('Projekte durchsuchen')}/>
              {search && <button type="button" aria-label={t('Suche löschen')} onClick={()=>setSearch('')}><X size={14}/></button>}</label>
            <select aria-label={t('Projekte sortieren')} value={order} onChange={event=>setOrder(event.target.value as 'newest'|'name')}>
              <option value="newest">{t('Neueste')}</option><option value="name">A–Z</option>
            </select>
          </div>
        </div>
        <div className="bm-projects-list">
          {filtered.length ? filtered.map(project => <article key={project.id} className="bm-project-item bm-project-row">
            <button type="button" className="bm-project-open" onClick={()=>open(project.id)} disabled={busy} aria-label={`${t('Öffnen')}: ${project.name}`}>
              <span className="bm-project-item-icon"><FileText size={21}/></span>
              <span className="bm-project-item-body"><strong>{project.name}</strong><small title={project.fileName}>{project.fileName}</small>
                <span>{project.count} {t('Positionen')} · {formatDate(project.createdAt,language)}</span></span>
              <span className="bm-project-item-meta"><span className="tag tag-neutral">{project.archivedAt ? t('Freigegeben') : project.shelvedAt ? t('Archiviert') : project.demo ? t('Demo') : project.format}</span><ChevronRight size={18}/></span>
            </button>
            <div className="bm-project-manage">
              {!project.archivedAt && <button type="button" onClick={()=>manage(project.id,project.shelvedAt ? 'restore' : 'archive')} disabled={busy} title={project.shelvedAt ? t('Wiederherstellen') : t('Archivieren')} aria-label={project.shelvedAt ? t('Wiederherstellen') : t('Archivieren')}>
                {project.shelvedAt ? <RotateCcw size={18}/> : <Archive size={18}/>}
              </button>}
              <button type="button" className="bm-project-delete" onClick={()=>manage(project.id,'delete')} disabled={busy} title={t('Löschen')} aria-label={t('Löschen')}><Trash2 size={18}/></button>
            </div>
          </article>) : <div className="bm-no-files">
            <span className="bm-projects-empty-icon"><FileText size={32}/></span>
            <strong>{search ? t('Nichts gefunden') : archive ? t('Noch nichts archiviert') : t('Noch keine Projekte')}</strong>
            <span>{search ? t('Suche ändern oder zurücksetzen.') : archive ? t('Freigegebene Angebote werden hier gespeichert.') : t('Importiere dein erstes Leistungsverzeichnis.')}</span>
            {!archive && !search && <button type="button" className="button button-primary" onClick={create}><Plus size={17}/>{t('Datei importieren')}</button>}
          </div>}
        </div>
      </section>
    </main>;
}
export function Workspace() {
    const { t, language } = useI18n();
    const [projects, setProjects] = useState<ProjectListItem[]>([]);
    const [current, setCurrent] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [modal, setModal] = useState<Modal>(null);
    const [archive, setArchive] = useState(false);
    const [home, setHome] = useState(true);
    const [manageTarget, setManageTarget] = useState<{id:string; action:'archive'|'restore'|'delete'}|null>(null);
    const [section, setSection] = useState<Section>('lv');
    const [rowId, setRowId] = useState<string | null>(null);
    const [assistantTargetId,setAssistantTargetId]=useState<string | null>(null);
    const [tab, setTab] = useState<DetailTab>('detail');
    const [inspectorMode, setInspectorMode] = useState<InspectorMode>('compact');
    const [query, setQuery] = useState('');
    const [group, setGroup] = useState('all');
    const [sectionSearch, setSectionSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [sort, setSort] = useState<{
        field: Sort;
        asc: boolean;
    }>({ field: 'oz', asc: true });
    const [page, setPage] = useState(0);
    const searchRef = useRef<HTMLInputElement>(null);
    const [inspectorWidth, setInspectorWidth] = useState(390);
    const resizeCleanup = useRef<null | (() => void)>(null);
    useEffect(() => {
      initializeLanguage();
      try {
        const saved = Number(window.localStorage.getItem('baumind-inspector-width'));
        if (Number.isFinite(saved) && saved >= 310 && saved <= 840) setInspectorWidth(saved);
      } catch {}
      return () => { resizeCleanup.current?.(); };
    }, []);
    function clampInspectorWidth(value: number) {
      const sidebar = window.innerWidth <= 620 ? 0 : window.innerWidth <= 850 ? 72 : window.innerWidth <= 1080 ? 175 : window.innerWidth <= 1300 ? 194 : 216;
      return Math.round(Math.max(310, Math.min(value, 820, window.innerWidth - sidebar - 450)));
    }
    function persistInspectorWidth(value: number) {
      try { window.localStorage.setItem('baumind-inspector-width', String(value)); } catch {}
    }
    function resizeStart(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.button !== 0 || window.innerWidth <= 1080) return;
      event.preventDefault();
      const startX = event.clientX;
      const widthAtStart = inspectorWidth;
      const previousSelect = document.body.style.userSelect;
      const previousCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      let nextWidth = inspectorWidth;
      const move = (moveEvent: PointerEvent) => {
        nextWidth = clampInspectorWidth(widthAtStart + startX - moveEvent.clientX);
        setInspectorWidth(nextWidth);
      };
      const finish = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        document.body.style.userSelect = previousSelect;
        document.body.style.cursor = previousCursor;
        persistInspectorWidth(nextWidth);
        resizeCleanup.current = null;
      };
      resizeCleanup.current?.();
      resizeCleanup.current = finish;
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    }
    function resizeByKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const width = clampInspectorWidth(event.key === 'Home' ? 310 : event.key === 'End' ? 820 : inspectorWidth + (event.key === 'ArrowLeft' ? 24 : -24));
      setInspectorWidth(width);
      persistInspectorWidth(width);
    }
    const updateProjects = useCallback(async () => {
        const data = await responseData(await fetch('/api/projects', { cache: 'no-store' }));
        setProjects(data.projects);
    }, []);
    const loadProject = useCallback(async (id: string) => {
        const data = await responseData(await fetch('/api/projects/' + id, { cache: 'no-store' }));
        setCurrent(data.project);
    }, []);
    useEffect(() => {
        const project = new URLSearchParams(location.search).get('projekt');
        const initial = async () => {
            try {
                await updateProjects();
                if (project) {
                    await loadProject(project);
                    setHome(false);
                }
            }
            catch (error) {
                setError(translate((error as Error).message));
            }
            finally {
                setLoading(false);
            }
        };
        void initial();
    }, [updateProjects, loadProject]);
    function resetTable() { setInspectorMode('compact'); setRowId(null); setSection('lv'); setQuery(''); setFilter('all'); setGroup('all'); setPage(0); setTab('detail'); }
    function projectUrl(id: string | null) {
        history.replaceState(null, '', id ? '?projekt=' + encodeURIComponent(id) : location.pathname);
    }
    function start() {
        setCurrent(null);
        setHome(true);
        setArchive(false);
        setError('');
        setNotice('');
        resetTable();
        projectUrl(null);
    }
    function list(archived: boolean) {
        setHome(false);
        setCurrent(null);
        setArchive(archived);
        setError('');
        setNotice('');
        resetTable();
        projectUrl(null);
    }
    async function openProject(id: string) {
        if (pending.current)
            return;
        pending.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        resetTable();
        try {
            await loadProject(id);
            setHome(false);
            projectUrl(id);
        }
        catch (error) {
            setError(translate((error as Error).message));
        }
        finally {
            setBusy(false);
            pending.current = false;
        }
    }
    async function create(form: FormData) {
        if (pending.current)
            return;
        pending.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const data = await responseData(await fetch('/api/projects', { method: 'POST', body: form }));
            setCurrent(data.project);
            setHome(false);
            setArchive(false);
            setModal(null);
            resetTable();
            projectUrl(data.project.id);
            setNotice(data.project.positions.filter((item: Position) => item.origin === 'imported').length + t(" Positionen importiert."));
            await updateProjects().catch(() => { });
        }
        catch (error) {
            setError(translate((error as Error).message));
        }
        finally {
            setBusy(false);
            pending.current = false;
        }
    }
    async function manageProject(target: {id:string;action:'archive'|'restore'|'delete'}) {
      if (pending.current) return;
      pending.current = true;
      setBusy(true); setError('');
      try {
        const response = await fetch('/api/projects/' + encodeURIComponent(target.id), {
          method: target.action === 'delete' ? 'DELETE' : 'PATCH',
          headers: target.action === 'delete' ? undefined : {'Content-Type':'application/json'},
          body: target.action === 'delete' ? undefined : JSON.stringify({action:target.action}),
        });
        if (!response.ok) await responseData(response);
        if (current?.id === target.id) {
          setCurrent(null);setHome(false);setArchive(target.action !== 'restore');resetTable();projectUrl(null);
        }
        await updateProjects();
        setManageTarget(null);
      } catch(error) {setError(translate((error as Error).message));setManageTarget(null);}
      finally {setBusy(false);pending.current=false;}
    }
    async function run(action: Record<string, unknown>) {
        if (!current || pending.current)
            return false;
        pending.current = true;
        const id = current.id;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const data = await responseData(await fetch('/api/projects/' + id, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...action, revision: current.revision }),
            }));
            setCurrent(data.project);
            setNotice(data.note ? translate(data.note) : (action.action === 'finalize' ? t("Angebot freigegeben und archiviert.") : t("Gespeichert.")));
            await updateProjects().catch(() => { });
            return true;
        }
        catch (error) {
            if ((error as {
                status?: number;
            }).status === 409)
                await loadProject(id).catch(() => { });
            setError(translate((error as Error).message));
            return false;
        }
        finally {
            setBusy(false);
            pending.current = false;
        }
    }
    function selectRow(id: string, view: DetailTab = 'detail', returnToTable = false) {
        setRowId(id);
        setTab(view);
        if (returnToTable)
            setSection('lv');
    }
    const summary = useMemo(() => current ? summarize(current) : null, [current]);
    const openIds = useMemo(() => new Set(current?.findings.filter(finding => finding.status === 'open').flatMap(finding => finding.positionIds)), [current]);
    const groups = useMemo(() => [...new Map(current?.positions.map(row => [row.group, row.groupLabel])).entries()], [current]);
    const navigationGroups = useMemo(() => buildSectionNavigation(current?.positions ?? []), [current]);
    const sectionDisplayName = (id: string, label: string) => /^Abschnitt\s+\d+(?:\.\d+)*$/i.test(label) ? `${t('Abschnitt')} ${id}` : label;
    const shown = useMemo(() => {
        if (!current)
            return [];
        const q = query.toLowerCase().trim();
        const dataset = current.positions.filter(row => {
            const calc = estimateRow(row, current.baseMarkup);
            return positionBelongsToSection(row, group) && (!q || (row.oz + ' ' + row.title + ' ' + row.description).toLowerCase().includes(q)) &&
                (filter === 'all' || (filter === 'open' && openIds.has(row.id)) || (filter === 'suggestions' && row.origin === 'suggested') ||
                    (filter === 'unpriced' && row.accepted && (row.included || row.type === 'unit-only') && calc.unitPrice === null));
        });
        const natural = Intl.Collator('de', { numeric: true, sensitivity: 'base' });
        return dataset.map(row => ({ row, calc: estimateRow(row, current.baseMarkup) })).sort((a, b) => {
            let result: number;
            if (sort.field === 'oz' || sort.field === 'title')
                result = natural.compare(a.row[sort.field], b.row[sort.field]);
            else {
                const first = sort.field === 'price' ? a.calc.unitPrice : sort.field === 'total' ? a.calc.total : a.calc.quantity;
                const second = sort.field === 'price' ? b.calc.unitPrice : sort.field === 'total' ? b.calc.total : b.calc.quantity;
                if (first === null)
                    return second === null ? 0 : 1;
                if (second === null)
                    return -1;
                result = first - second;
            }
            return sort.asc ? result : -result;
        });
    }, [current, query, group, filter, openIds, sort]);
    const selected = current?.positions.find(row => row.id === rowId);
    const lastPage = Math.max(0, Math.ceil(shown.length / pageSize) - 1);
    const effectivePage = Math.min(page, lastPage);
    const from = effectivePage * pageSize;
    const activeRows = shown.slice(from, from + pageSize);
    function navigateToShown(index: number) {
        const item = shown[index];
        if (!item)
            return;
        selectRow(item.row.id, tab);
        setPage(Math.floor(index / pageSize));
    }
    useEffect(() => {
        function shortcuts(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null;
            const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]');
            if (event.key === '/' && !typing && current && section === 'lv' && !modal) {
                event.preventDefault();
                searchRef.current?.focus();
            }
            if (event.key === 'Escape' && !modal && rowId && !typing) {
                if (inspectorMode !== 'compact')
                    setInspectorMode('compact');
                else
                    setRowId(null);
            }
        }
        window.addEventListener('keydown', shortcuts);
        return () => window.removeEventListener('keydown', shortcuts);
    }, [current, section, modal, rowId, inspectorMode]);
    const closeDialog = () => { setModal(null); setError(''); };
    function toggleSort(field: Sort) {
        setSort(value => ({ field, asc: field === value.field ? !value.asc : true }));
        setPage(0);
    }
    function header(label: string, field: Sort, numeric = false) {
        return <th className={numeric ? 'num' : ''} aria-sort={sort.field === field ? (sort.asc ? 'ascending' : 'descending') : undefined}><button onClick={() => toggleSort(field)}>
      {t(label)} {sort.field === field ? (sort.asc ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : null}
    </button></th>;
    }
    function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
      return <label className={'bm-language-switcher bm-language-switcher-v58' + (mobile ? ' bm-language-switcher--mobile' : '')}>
        <span><Languages size={15}/>{t('Sprache')}</span>
        <select aria-label={t('Sprache auswählen')} value={language} onChange={event => setLanguage(event.target.value as 'de'|'en'|'ru')}>
          <option value="de">DE</option><option value="en">EN</option><option value="ru">RU</option>
        </select>
      </label>;
    }
    function selectSection(value: string) {
      setGroup(value); setSection('lv'); setPage(0); setRowId(null); setModal(null);
    }
    const visibleSidebarGroups = navigationGroups.length <= 8 ? navigationGroups : [
      ...navigationGroups.slice(0, 5),
      ...navigationGroups.filter(({id}) => id === group && !navigationGroups.slice(0, 5).some(item => item.id === id)),
    ];
    const filteredSections = navigationGroups.filter(({id, label}) => `${id} ${sectionDisplayName(id,label)}`.toLocaleLowerCase(language).includes(sectionSearch.trim().toLocaleLowerCase(language)));
    return <div className={'app-shell' + (current && section === 'review' ? ' bm-review-active' : '')}>
    <aside className="sidebar">
      <button className="brand" onClick={start} aria-label="BauMind"><span className="brand-icon"><img src="/brand/mountain-mark.png" alt={t("BauMind Bergsymbol")}/></span><span>BauMind<small>{"" + t("BAUKALKULATION & DATEIEN") + ""}</small></span></button>
      <div className="side-divider"/>
      <nav aria-label="Arbeitsbereich" className="side-nav">
        <button className={home && !current ? 'active' : ''} aria-current={home && !current ? 'page' : undefined} onClick={start}><Upload size={18}/>{t('Start')}</button>
        <button className={!home && !(current?.archivedAt || current?.shelvedAt || archive) ? 'active' : ''} aria-current={!home && !(current?.archivedAt || current?.shelvedAt || archive) ? 'page' : undefined} onClick={() => list(false)}><LayoutGrid size={18}/>{t('Projekte')}</button>
        <button className={!home && (current?.archivedAt || current?.shelvedAt || archive) ? 'active' : ''} aria-current={!home && (current?.archivedAt || current?.shelvedAt || archive) ? 'page' : undefined} onClick={() => list(true)}><Archive size={18}/>{t('Archiv')}</button>
      </nav>
      {current && navigationGroups.length > 0 && <div className="side-section bm-side-sections">
        <div className="bm-side-section-head"><div className="side-label">{t('Gewerke / Abschnitte')}</div><span className="bm-side-section-count">{navigationGroups.filter(item => item.depth === 0).length}</span></div>
        <button className={group === 'all' && section === 'lv' ? 'current' : ''} onClick={() => selectSection('all')}>{t('Alle Positionen')}</button>
        <div className="bm-side-sections-scroll">
          {visibleSidebarGroups.map(({id, label, depth}) => <button key={id} className={(group === id && section === 'lv' ? 'current ' : '') + (depth ? 'bm-subsection-option' : 'bm-main-section-option')}
            title={`${id} ${sectionDisplayName(id,label)}`} onClick={() => selectSection(id)}><span>{id}</span><b>{sectionDisplayName(id,label)}</b></button>)}
        </div>
        {navigationGroups.length > 8 && <button className="bm-sections-expand" onClick={() => {setSectionSearch('');setModal('sections')}}>
          <Grid2X2 size={16}/>{t('Alle Abschnitte')} <span>{navigationGroups.length}</span><ArrowRight size={16}/>
        </button>}
      </div>}
      <div className="bm-sidebar-bottom bm-sidebar-bottom-v58"><LanguageSwitcher/></div>
    </aside>
    <div className="surface">
      <header className="topbar">
        <div className="breadcrumbs"><button onClick={() => current ? list(Boolean(current.archivedAt || current.shelvedAt)) : home ? start() : list(archive)}>{current?.archivedAt || current?.shelvedAt || archive ? t('Archiv') : home && !current ? t('Start') : t('Projekte')}</button>
          {current && <><ChevronRight size={14}/><span title={current.name}>{current.name}</span></>}</div>
        <div className="top-actions"><LanguageSwitcher mobile/><button className="button mobile-archive" aria-label={archive || current?.archivedAt || current?.shelvedAt ? t("Projekte") : t("Archiv")} onClick={() => list(!(archive || current?.archivedAt || current?.shelvedAt))}>
          {archive || current?.archivedAt || current?.shelvedAt ? <LayoutGrid size={15}/> : <Archive size={15}/>}</button>
        {(!home || current) && <button className="button top-create" onClick={start} disabled={busy}><Plus size={15}/>{t('Neues Projekt')}</button>}</div>
      </header>
      {loading ? <div className="loading-status" role="status">{"" + t("Arbeitsbereich wird geladen \u2026") + ""}</div> :
            !current ? <>{error && !home && <div className="global-alert error-inline" role="alert">{error}</div>}
          {home ? <StartView submit={form => void create(form)} busy={busy} error={error}/> :
            <ProjectsView projects={projects} archive={archive} create={start} open={openProject} manage={(id,action)=>{if (action === 'delete') setManageTarget({id,action}); else void manageProject({id,action});}} busy={busy}/>}</> :
                <>
          <div className="project-head bm-project-head">
            <img className="bm-project-cloud" src="/brand/elements/bm-cloud-small.webp" alt="" aria-hidden="true"/>
            <div className="project-title-badges bm-project-state">
              <span className={'bm-state-pill ' + (current.archivedAt ? 'bm-state-pill--done' : current.shelvedAt ? 'bm-state-pill--done' : current.demo ? 'bm-state-pill--demo' : 'bm-state-pill--work')}>
                {current.archivedAt ? <Check size={14}/> : current.shelvedAt ? <Archive size={14}/> : current.demo ? <Sparkles size={14}/> : <Calculator size={14}/>}
                {current.archivedAt ? t('Freigegeben') : current.shelvedAt ? t('Archiviert') : current.demo ? t('Beispielprojekt') : t('In Kalkulation')}
              </span>
              <span className="bm-state-source"><FileText size={13}/>{current.format}</span>
            </div>
            <div className="project-head-main"><div><h1>{current.name}</h1>
              <p><FileText size={15}/> {current.fileName}{current.pages ? ' · ' + current.pages + ' Seiten' : ''}</p></div>
              <div className="button-row head-actions">
                {(current.archivedAt || current.shelvedAt) ? <a className="button button-primary" href={'/api/projects/' + current.id + '/report'}><Download size={16}/>{" " + t("Abgabe LV") + ""}</a> :
                        <><a className="button" href={'/api/projects/' + current.id + '/report'}><Download size={16}/>{" " + t("PDF-Entwurf") + ""}</a>
                    <button className="button button-primary" onClick={() => { setError(''); setModal('finalize'); }} disabled={busy}><Check size={16}/>{" " + t("Freigeben") + ""}</button></>}
              </div>
            </div>
          </div>
          {error && !modal && <div className="global-alert error-inline" role="alert">{error}</div>}
          {notice && <div className="workspace-notice" role="status"><Check size={14}/> {notice}<button className="icon-button" aria-label={t("Hinweis schlie\u00DFen")} onClick={() => setNotice('')}><X size={14}/></button></div>}
          {!!current.warnings.length && <details className="import-warnings"><summary><TriangleAlert size={15}/> {current.warnings.length}{" " + t("Importhinweis(e)") + ""}</summary>
            <ul>{current.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
          <div className="stats">
            <div className="stat"><span><Layers3 size={15}/>{" " + t("Originalpositionen") + ""}</span><strong>{current.positions.filter(row => row.origin === 'imported').length}</strong><small>{groups.length}{" " + t("Abschnitte") + ""}</small></div>
            <button className={'stat ' + ((summary?.open || 0) > 0 ? 'stat-danger' : 'stat-success')} onClick={() => { setSection('review'); setRowId(null); }}><span><ClipboardCheck size={15}/>{" " + t("Offene Pr\u00FCfpunkte") + ""}</span><strong>{summary?.open}</strong><small>{current.analysis.mode === 'rules' ? t("Regelpr\u00FCfung") : t("Regeln und KI")}</small></button>
            <div className={'stat ' + ((summary?.withoutPrice || 0) > 0 ? 'stat-warning' : 'stat-success')}><span><CircleHelp size={15}/>{" " + t("Ohne vollst\u00E4ndigen Preis") + ""}</span><strong>{summary?.withoutPrice}</strong><small>{(summary?.withoutPrice || 0) > 0 ? t("Noch nicht freigabef\u00E4hig") : t("Alles vollst\u00E4ndig kalkuliert")}</small></div>
            <div className="stat total-stat"><span><Calculator size={15}/>{" " + t("Angebot netto") + ""}</span><strong>{amountLabel(summary?.net)}</strong><small>{current.archivedAt ? t("Freigegeben") : t("Aktueller Entwurf")}</small></div>
          </div>
          <nav className="view-tabs" aria-label={t("Projektansichten")}>{statuses.map(({ key, label, icon: Icon }) => <button className={section === key ? 'active' : ''} key={key} aria-current={section === key ? 'page' : undefined} onClick={() => { setSection(key); setRowId(null); }}>
              <Icon size={16}/>{t(label)}{key === 'review' && !!summary?.open && <span>{summary.open}</span>}
            </button>)}</nav>
          {section === 'lv' && <div className={'workspace-body ' + (selected ? 'with-inspector' : '') + (selected && inspectorMode !== 'compact' ? ' inspector-expanded' : '')} style={{ '--bm-inspector-width': `${inspectorWidth}px` } as CSSProperties}>
            <div className="positions-panel">
              <header className="toolbar bm-table-toolbar">
                <div className="bm-table-topline"><div><h2>{"" + t("Positionen") + " "}<span>{shown.length}</span></h2><p>{"" + t("Position ausw\u00E4hlen, um Menge, Preise und Quelle zu bearbeiten.") + ""}</p></div>
                  {!current.archivedAt && !current.shelvedAt && <button className="button add-position" onClick={() => { setError(''); setModal('add'); }}><Plus size={16}/>{" " + t("Position hinzuf\u00FCgen") + ""}</button>}
                </div>
                <div className="bm-table-controls">
                  <label className="search"><Search size={17}/><input ref={searchRef} value={query} placeholder={t("OZ oder Leistung suchen  /")} aria-label={t("Position suchen")} onChange={event => { setQuery(event.target.value); setPage(0); }}/>
                    {query && <button className="bm-clear-query" aria-label={t("Suche l\u00F6schen")} onClick={() => { setQuery(''); setPage(0); }}><X size={15}/></button>}</label>
                  <label className="bm-group-filter"><span className="sr-only">{"" + t("Abschnitt") + ""}</span><select aria-label={t("Abschnitt filtern")} value={group} onChange={event => { setGroup(event.target.value); setPage(0); }}><option value="all">{"" + t("Alle Abschnitte") + ""}</option>
                    {navigationGroups.map(({id,label,depth}) => <option key={id} value={id}>{depth ? '  ↳ ' : ''}{id} {sectionDisplayName(id,label)}</option>)}</select></label>
                </div>
                <div className="bm-filter-row" aria-label={t("Statusfilter")}>
                  {([['all', t("Alle")], ['open', t("Pr\u00FCfen")], ['unpriced', t("Ohne Preis")], ['suggestions', t("Vorschl\u00E4ge")]] as const).map(([value, label]) => <button key={value} className={'bm-filter-chip ' + (filter === value ? 'active' : '')} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); }}>{value === 'open' && <TriangleAlert size={14}/>} {label}{value === 'open' && !!summary?.open && <b>{summary.open}</b>}</button>)}
                  {(query || group !== 'all' || filter !== 'all') && <button className="bm-reset-filters" onClick={() => { setQuery(''); setGroup('all'); setFilter('all'); setPage(0); }}><RotateCcw size={13}/>{" " + t("Zur\u00FCcksetzen") + ""}</button>}
                </div>
              </header>
              <div className="table-scroll">
                <table className="lv-table"><thead><tr>
                  {header('OZ', 'oz')}{header(t("Leistung"), 'title')}{header(t("Menge"), 'quantity', true)}
                  <th className="bm-unit-head">{"" + t("ME") + ""}</th>{header(t("EP netto"), 'price', true)}{header(t("GP netto"), 'total', true)}<th>{"" + t("Status") + ""}</th>
                </tr></thead><tbody>{activeRows.map(({ row, calc }) => {
                            const needs = openIds.has(row.id);
                            const outside = !row.included;
                            const high = row.marketPrice !== null && calc.unitPrice !== null && row.marketPrice > 0 && calc.unitPrice > row.marketPrice * 1.15;
                            return <tr tabIndex={0} role="button" aria-label={t('Position') + ' ' + row.oz + ' ' + t('öffnen:') + ' ' + row.title} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                                event.preventDefault();
                                selectRow(row.id);
                            } }} className={(rowId === row.id ? 'selected-row ' : '') + (row.origin === 'suggested' ? 'suggested-row ' : '') + (outside ? 'outside-row' : '')} key={row.id} onClick={() => selectRow(row.id)}>
                    <td><button className="oz-button" onClick={event => { event.stopPropagation(); selectRow(row.id); }} aria-label={'Position ' + row.oz}>{row.oz}</button></td>
                    <td className="title-cell"><b title={row.title}>{row.title}</b>{row.origin !== 'imported' && <span>{row.origin === 'suggested' ? t("Vorgeschlagen") : t("Erg\u00E4nzt")}</span>}</td>
                    <td className="num bm-qty-cell">{calc.quantity === null ? '—' : decimal.format(calc.quantity)}</td><td className="unit bm-unit-cell">{unitOf(row) || '—'}</td>
                    <td className="num bm-ep-cell"><button className="price-cell" aria-label={t('Preise für') + ' ' + row.oz} onClick={event => { event.stopPropagation(); selectRow(row.id, 'offers'); }}>
                      {calc.unitPrice === null ? '—' : unitEur.format(calc.unitPrice)}
                    </button></td>
                    <td className="num bm-gp-cell">{!row.included ? '—' : amountLabel(calc.total)}</td>
                    <td className="cell-status">
                      {needs ? <span className="tag tag-danger"><TriangleAlert size={13}/>{" " + t("Problem pr\u00FCfen") + ""}</span> :
                                    high ? <span className="tag tag-amber"><TriangleAlert size={13}/>{" " + t("\u00DCber Referenz") + ""}</span> :
                                        row.origin === 'suggested' && !row.accepted ? <span className="tag tag-purple"><Sparkles size={12}/>{" " + t("Vorschlag") + ""}</span> :
                                            row.type === 'unit-only' ? <span className="tag tag-neutral">{"" + t("Nur EP") + ""}</span> :
                                                calc.unitPrice === null ? <span className="plain-status">{"" + t("Offen") + ""}</span> : <span className="dot-status"><i />{" " + t("Kalkuliert") + ""}</span>}
                    </td>
                  </tr>;
                        })}</tbody></table>
                <div className="bm-mobile-position-list" aria-label={t('Positionen')}>
                  {activeRows.map(({row,calc}) => {
                    const flagged = openIds.has(row.id)
                    const unpriced = calc.unitPrice === null
                    const high = row.marketPrice !== null && calc.unitPrice !== null && row.marketPrice > 0 && calc.unitPrice > row.marketPrice * 1.15
                    return <button type="button" key={row.id} className={'bm-mobile-position ' + (row.id === rowId ? 'is-selected' : '')} onClick={()=>selectRow(row.id)}>
                      <span className="bm-mposition-head"><span className="bm-mposition-oz">{row.oz}</span>
                        {flagged ? <span className="tag tag-danger"><TriangleAlert size={13}/>{t('Problem prüfen')}</span> :
                        high ? <span className="tag tag-amber"><TriangleAlert size={13}/>{t('Über Referenz')}</span> :
                        unpriced ? <span className="tag tag-amber">{t('Ohne Preis')}</span> :
                        <span className="tag tag-green"><Check size={13}/>{t('Kalkuliert')}</span>}
                      </span>
                      <strong className="bm-mposition-title">{row.title}</strong>
                      <span className="bm-mposition-values">
                        <span><small>{t('Menge')}</small><b>{calc.quantity === null ? '—' : decimal.format(calc.quantity)} {unitOf(row)}</b></span>
                        <span><small>{t('EP netto')}</small><b>{calc.unitPrice === null ? '—' : unitEur.format(calc.unitPrice)}</b></span>
                        <span><small>{t('GP netto')}</small><b>{!row.included ? '—' : amountLabel(calc.total)}</b></span>
                      </span>
                      <span className="bm-mposition-foot">{t('Details')}<ChevronRight size={17}/></span>
                    </button>
                  })}
                </div>
                {!activeRows.length && <div className="table-empty">{"" + t("Keine Positionen f\u00FCr diese Auswahl.") + ""}<button className="text-button" onClick={() => { setQuery(''); setGroup('all'); setFilter('all'); setPage(0); }}>{"" + t("Filter zur\u00FCcksetzen") + ""}</button></div>}
              </div>
              <footer className="table-footer"><span>{shown.length ? (from + 1) + '–' + Math.min(from + pageSize, shown.length) + ' ' + t('von') + ' ' + shown.length : '0'}{" " + t("Positionen") + ""}</span>
                <div className="button-row"><button className="icon-button" aria-label={t("Vorherige Seite")} onClick={() => setPage(effectivePage - 1)} disabled={!effectivePage}><ChevronLeft size={16}/></button>
                  <span>{"" + t("Seite") + " "}{effectivePage + 1} / {lastPage + 1}</span><button className="icon-button" aria-label={t("N\u00E4chste Seite")} onClick={() => setPage(effectivePage + 1)} disabled={effectivePage === lastPage}><ChevronRight size={16}/></button></div></footer>
            </div>
            {selected && <>
              {inspectorMode === 'focus' && <button className="bm-inspector-backdrop" type="button" aria-label={t("Fokusansicht verlassen")} title={t("Zur kompakten Ansicht")} onClick={() => setInspectorMode('compact')}/>}
              <PositionDetail key={selected.id} project={current} row={selected} tab={tab} setTab={setTab} close={() => setRowId(null)} run={run} busy={busy} mode={inspectorMode} setMode={setInspectorMode} inspectorWidth={inspectorWidth} onResizeStart={resizeStart} onResizeKeyDown={resizeByKeyboard} indexLabel={(() => { const index = shown.findIndex(item => item.row.id === selected.id); return index >= 0 ? `${index + 1} ${t('von')} ${shown.length} ${t('Positionen')}` : `OZ ${selected.oz}`; })()} previous={(() => { const index = shown.findIndex(item => item.row.id === selected.id); return index > 0 ? () => navigateToShown(index - 1) : null; })()} next={(() => { const index = shown.findIndex(item => item.row.id === selected.id); return index >= 0 && index < shown.length - 1 ? () => navigateToShown(index + 1) : null; })()} onSource={id => selectRow(id, 'source')} onAskAI={()=>{setAssistantTargetId(selected.id);setSection('assistant');setRowId(null)}}/>
            </>}
          </div>}
          {section === 'review' && <div className="view-body review-body bm-review-view">
            <ReviewWizard project={current} busy={busy} run={run}
              onSource={id=>selectRow(id,'source',true)}
              onOpenPositions={()=>{setFilter('all');setGroup('all');setPage(0);setQuery('');setSection('lv')}} />
          </div>}
          <div className="view-body bm-assistant-view" style={{display:section==='assistant'?undefined:'none'}} aria-hidden={section!=='assistant'}>
            <AssistantPanel project={current} active={section==='assistant'} selectedRowId={assistantTargetId} run={run} onSelectPosition={(id)=>selectRow(id,'detail',true)}/>
          </div>
          {section === 'bid' && <div className="view-body bid-body">
            <div className="view-title"><div><h2>{"" + t("Angebot") + ""}</h2><p className="muted">{"" + t("Zusammenstellung und Angaben f\u00FCr die Abgabe.") + ""}</p></div></div>
            <div className="bid-columns"><section className="sheet"><header><h3>{"" + t("Zusammenstellung") + ""}</h3></header>
              {[...(summary?.byGroup || [])].map(([key, total]) => <div className="bid-line" key={key}><span>{groups.find(([id]) => key === id)?.[1] ?? key}</span><b>{eur.format(total)}</b></div>)}
              <div className="bid-line"><strong>{"" + t("Netto") + ""}</strong><b>{amountLabel(summary?.net)}</b></div>
              <div className="bid-line"><span>{"" + t("Umsatzsteuer (") + ""}{current.vat} %)</span><b>{amountLabel(summary?.taxes)}</b></div>
              <div className="bid-line grand"><strong>{"" + t("Brutto") + ""}</strong><strong>{amountLabel(summary?.gross)}</strong></div>
            </section>
            <section className="sheet"><header><h3><Settings2 size={17}/>{" " + t("Angebotsdaten") + ""}</h3></header>
              <form key={current.revision} className="pane-stack settings-form" onSubmit={event => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            void run({ action: 'settings', name: form.get('name'), company: form.get('company'), postcode: form.get('postcode'),
                                markup: optionalNumber(form, 'markup'), vat: optionalNumber(form, 'vat') });
                        }}>
                <label className="field"><span>{"" + t("Projektname") + ""}</span><input name="name" defaultValue={current.name} required minLength={2} maxLength={120} disabled={Boolean(current.archivedAt || current.shelvedAt)}/></label>
                <label className="field"><span>{"" + t("Bieter / Unternehmen") + ""}</span><input name="company" defaultValue={current.company} maxLength={120} disabled={Boolean(current.archivedAt || current.shelvedAt)}/></label>
                <label className="field"><span>{"" + t("PLZ") + ""}</span><input name="postcode" defaultValue={current.postcode} inputMode="numeric" maxLength={5} pattern="[0-9]{5}" disabled={Boolean(current.archivedAt || current.shelvedAt)}/></label>
                <div className="field-grid"><label className="field"><span>{"" + t("Standardzuschlag (%)") + ""}</span><input name="markup" type="number" min={0} max={300} step="any" defaultValue={current.baseMarkup} required disabled={Boolean(current.archivedAt || current.shelvedAt)}/></label>
                  <label className="field"><span>{"" + t("Umsatzsteuer (%)") + ""}</span><input name="vat" type="number" min={0} max={100} step="any" defaultValue={current.vat} required disabled={Boolean(current.archivedAt || current.shelvedAt)}/></label></div>
                {!current.archivedAt && !current.shelvedAt && <button className="button button-primary" disabled={busy}>{"" + t("Angaben speichern") + ""}</button>}
              </form>
            </section></div>
          </div>}
        </>}
    </div>
    {modal === 'sections' && current && <Dialog label={t('Alle Abschnitte')} close={closeDialog} busy={false} wide>
      <div className="bm-sections-picker">
        <label className="bm-sections-search"><Search size={19}/><input autoFocus value={sectionSearch}
          placeholder={t('Abschnitt suchen')} onChange={event => setSectionSearch(event.target.value)}/>
          {sectionSearch && <button type="button" aria-label={t('Suche löschen')} onClick={() => setSectionSearch('')}><X size={16}/></button>}
        </label>
        <div className="bm-sections-picker-grid">
          <button className={'bm-section-choice ' + (group === 'all' ? 'is-active' : '')} onClick={() => selectSection('all')}>
            <Layers3 size={17}/><strong>{t('Alle Positionen')}</strong><span>{current.positions.length}</span>
          </button>
          {filteredSections.map(({id,label,depth}) => <button className={'bm-section-choice ' + (group === id ? 'is-active ' : '') + (depth ? 'bm-section-choice--sub' : '')}
            onClick={() => selectSection(id)} key={id} title={`${id} ${sectionDisplayName(id,label)}`}>
            <span className="bm-choice-oz">{id}</span><strong>{sectionDisplayName(id,label)}</strong><span>{current.positions.filter(row => positionBelongsToSection(row,id)).length}</span>
          </button>)}
        </div>
        {!filteredSections.length && <p className="bm-sections-empty">{t('Nichts gefunden')}</p>}
      </div>
    </Dialog>}
    {modal === 'new' && <Dialog label="Neues Projekt" close={closeDialog} busy={busy}><UploadForm busy={busy} submit={form => void create(form)} error={error}/></Dialog>}
    {modal === 'add' && current && <Dialog label="Position ergänzen" close={closeDialog} busy={busy}>
      <AddForm project={current} busy={busy} error={error} submit={async (form) => {
                if (await run({ action: 'add', title: form.get('title'), category: form.get('category'), group: form.get('group'),
                    quantity: optionalNumber(form, 'quantity'), unit: form.get('unit'), price: optionalNumber(form, 'price'),
                    trade: form.get('trade'), note: form.get('note') })) {
                    setModal(null);
                    setFilter('all');
                    setGroup('all');
                    setQuery('');
                }
            }}/></Dialog>}
    {modal === 'finalize' && current && <Dialog label="Angebot freigeben" close={closeDialog} busy={busy}>
      <div className="pane-stack">
        <p>{"" + t("Die gepr\u00FCfte Kalkulation wird als Abgabe-LV gespeichert und im Archiv abgelegt.") + ""}</p>
        {((summary?.open || 0) > 0 || (summary?.withoutPrice || 0) > 0) ? <div className="bm-finalize-status bm-finalize-status--danger" role="alert">
          <TriangleAlert size={18}/>
          <div><strong>{"" + t("Freigabe blockiert") + ""}</strong><p>{"" + t("Behebe zuerst alle offenen Pr\u00FCfpunkte und fehlenden Preise. Erst dann kann das Angebot sauber abgegeben werden.") + ""}</p></div>
        </div> : <div className="bm-finalize-status bm-finalize-status--success">
          <Check size={18}/>
          <div><strong>{"" + t("Freigabe ist m\u00F6glich") + ""}</strong><p>{"" + t("Alle Pr\u00FCfpunkte sind gekl\u00E4rt und alle aktiven Positionen sind kalkuliert.") + ""}</p></div>
        </div>}
        <div className="inset bm-finalize-metrics">
          <div className={'bm-finalize-check ' + ((summary?.open || 0) > 0 ? 'is-danger' : 'is-ok')}><span>{"" + t("Offene Pr\u00FCfpunkte") + ""}</span><b>{summary?.open}</b><small>{(summary?.open || 0) > 0 ? t("Muss vor der Abgabe gekl\u00E4rt werden") : t("Keine offenen Pr\u00FCfprobleme")}</small></div>
          <div className={'bm-finalize-check ' + ((summary?.withoutPrice || 0) > 0 ? 'is-warning' : 'is-ok')}><span>{"" + t("Unvollst\u00E4ndig kalkuliert") + ""}</span><b>{summary?.withoutPrice}</b><small>{(summary?.withoutPrice || 0) > 0 ? t("Aktive Positionen ohne vollst\u00E4ndigen Preis") : t("Alle aktiven Positionen haben einen Preis")}</small></div>
          <div className="bm-finalize-check is-total"><span>{"" + t("Angebot netto") + ""}</span><b>{amountLabel(summary?.net)}</b><small>{"" + t("Wird als Abgabe-LV archiviert") + ""}</small></div>
        </div>
        {error && <div className="error-inline" role="alert">{error}</div>}
        <div className="dialog-actions"><button className="button" onClick={closeDialog} disabled={busy}><ArrowLeft size={15}/>{" " + t("Zur\u00FCck") + ""}</button>
          <button className="button button-primary" disabled={busy || !!summary?.open || !!summary?.withoutPrice} onClick={async () => { if (await run({ action: 'finalize' })) {
            setModal(null);
            setSection('bid');
        } }}><Check size={16}/>{" " + t("Freigeben und archivieren") + ""}</button></div>
        {((summary?.open || 0) > 0 || (summary?.withoutPrice || 0) > 0) && <p className="bm-submit-help">{"" + t("Hinweis: Die Freigabe bleibt gesperrt, bis alle Probleme gel\u00F6st sind.") + ""}</p>}
      </div>
    </Dialog>}
    {manageTarget && <Dialog label={manageTarget.action === 'delete' ? 'Projekt löschen?' : manageTarget.action === 'archive' ? 'Projekt archivieren?' : 'Projekt wiederherstellen?'}
      busy={busy} close={()=>setManageTarget(null)}>
      <div className="pane-stack bm-manage-dialog">
        <p><strong>{projects.find(p=>p.id===manageTarget.id)?.name ?? t('Projekt')}</strong></p>
        <p>{manageTarget.action === 'delete' ? t('Dieses Projekt und die hochgeladene Originaldatei werden dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.') :
          manageTarget.action === 'archive' ? t('Das Projekt wird ins Archiv verschoben. Es wird nicht als Angebot freigegeben. Du kannst es später wiederherstellen.') :
          t('Das Projekt wird zurück in Meine Projekte verschoben.')}</p>
        {manageTarget.action === 'delete' && <div className="bm-delete-warning" role="alert"><TriangleAlert size={18}/>{t('Endgültiges Löschen — auch die Quelldatei wird entfernt.')}</div>}
        <div className="dialog-actions"><button className="button" type="button" disabled={busy} onClick={()=>setManageTarget(null)}>{t('Abbrechen')}</button>
          <button type="button" className={'button ' + (manageTarget.action === 'delete' ? 'bm-danger-button' : 'button-primary')} disabled={busy} onClick={()=>void manageProject(manageTarget)}>
            {manageTarget.action === 'delete' ? <Trash2 size={16}/> : manageTarget.action === 'archive' ? <Archive size={16}/> : <RotateCcw size={16}/>}
            {manageTarget.action === 'delete' ? t('Endgültig löschen') : manageTarget.action === 'archive' ? t('Archivieren') : t('Wiederherstellen')}
          </button></div>
      </div>
    </Dialog>}
    <nav className="bm-mobile-navigation" aria-label={t('Arbeitsbereich')}>
      <button aria-current={home && !current ? 'page' : undefined} className={home && !current ? 'active' : ''} onClick={start}><Upload size={22}/><span>{t('Start')}</span></button>
      <button aria-current={!home && !(current?.archivedAt || current?.shelvedAt || archive) ? 'page' : undefined} className={!home && !(current?.archivedAt || current?.shelvedAt || archive) ? 'active' : ''} onClick={() => list(false)}><LayoutGrid size={22}/><span>{t('Projekte')}</span></button>
      <button aria-current={!home && (current?.archivedAt || current?.shelvedAt || archive) ? 'page' : undefined} className={!home && (current?.archivedAt || current?.shelvedAt || archive) ? 'active' : ''} onClick={() => list(true)}><Archive size={22}/><span>{t('Archiv')}</span></button>
    </nav>
  </div>;
}
