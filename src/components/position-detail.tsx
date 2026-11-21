'use client'

import { ArrowDown, ArrowUpRight, Check, ChevronLeft, ChevronRight, ExternalLink, FileText, Maximize2, Minimize2, Package, Search, Sparkles, TriangleAlert, X } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { bestOffer, comparable, decimal, estimateRow, eur, markupSuggestion, offerAmount, quantityOf, unitEur, unitOf } from '@/lib/estimate'
import type { Finding, Offer, Position, Project } from '@/lib/model'

export type RunAction = (action: Record<string, unknown>) => Promise<boolean>
export type DetailTab = 'detail' | 'offers' | 'source'
export type InspectorMode = 'compact' | 'focus'

export function optionalNumber(form: FormData, name: string) {
  const value = String(form.get(name) ?? '').trim()
  return value !== '' ? Number(value) : null
}
export const amountLabel = (value: number | null | undefined) => value == null ? '—' : eur.format(value)

function Num({ name, label, value, max, placeholder }: { name: string; label: string; value?: number | null; max?: number; placeholder?: string }) {
  return <label className="field"><span>{label}</span><input name={name} type="number" step="any" min="0" max={max || 100000000} defaultValue={value ?? ''} placeholder={placeholder || '—'} /></label>
}


// A native, keyboard-accessible unit selector. Unrecognized imported units are
// preserved verbatim until the user explicitly edits them.
export const COMMON_UNITS = [
  ['m²','m² · Quadratmeter'], ['m³','m³ · Kubikmeter'], ['m','m · Meter'],
  ['lfm','lfm · Laufmeter'], ['St','St · Stück'], ['Stk','Stk · Stück'],
  ['psch','psch · Pauschal'], ['h','h · Stunde'], ['Std','Std · Stunden'],
  ['kg','kg · Kilogramm'], ['t','t · Tonne'], ['l','l · Liter'],
  ['Paar','Paar'], ['Set','Set'], ['Tag','Tag'], ['Wo','Wo · Woche'],
  ['Monat','Monat'], ['km','km · Kilometer'], ['m2','m2 · Quadratmeter'],
  ['m3','m3 · Kubikmeter']
] as const

export function UnitPicker({ initial = 'St', label = 'Einheit' }: { initial?: string; label?: string }) {
  const known = COMMON_UNITS.some(([id]) => id === initial)
  const [selected,setSelected] = useState(known ? initial : 'custom')
  const [custom,setCustom] = useState(known ? '' : initial)
  return <div className="field bm-unit-picker">
    <span>{label}</span>
    <select aria-label="Mengeneinheit auswählen" value={selected} onChange={event => setSelected(event.target.value)}>
      <optgroup label="Häufige Einheiten">
        {COMMON_UNITS.slice(0,12).map(([id,text])=><option key={id} value={id}>{text}</option>)}
      </optgroup>
      <optgroup label="Weitere Einheiten">
        {COMMON_UNITS.slice(12).map(([id,text])=><option key={id} value={id}>{text}</option>)}
      </optgroup>
      <option value="custom">Eigene Einheit …</option>
    </select>
    {selected === 'custom' ? <input name="unit" aria-label="Eigene Mengeneinheit" placeholder="z. B. Rolle" value={custom}
      onChange={event => setCustom(event.target.value)} maxLength={12} required /> :
      <input type="hidden" name="unit" value={selected}/>}
  </div>
}

export function FindingCard({ finding, project, busy, run, currentId, onSource }:
  { finding: Finding; project: Project; busy: boolean; run: RunAction; currentId?: string; onSource: (id: string) => void }) {
  const [resolution, setResolution] = useState(finding.resolution ?? '')
  const rows = project.positions.filter(row => finding.positionIds.includes(row.id))
  function close(status: 'resolved' | 'dismissed' | 'open', keepId?: string) {
    void run({ action: 'finding', findingId: finding.id, status, resolution, keepId })
  }
  return <article className={'finding-card ' + (finding.status === 'open' ? 'open' : 'closed')}>
    <header><span className={'tag ' + (finding.status !== 'open' ? 'tag-green' : finding.score === 'confirmed' ? 'tag-amber' : 'tag-neutral')}>
      {finding.status === 'open' ? (finding.score === 'confirmed' ? 'Abweichung' : 'Prüfen') : finding.status === 'resolved' ? 'Geklärt' : 'Verworfen'}
    </span><span className="small muted">{finding.createdBy === 'AI' ? 'KI-Hinweis' : 'Regelprüfung'}</span></header>
    <h3>{finding.title}</h3><p className="finding-copy">{finding.detail}</p>
    {finding.evidence.map((evidence, index) => <button key={evidence.positionId + index} className="evidence-link" onClick={() => onSource(evidence.positionId)}>
      <FileText size={14} /><span><strong>{evidence.location}</strong><span>{evidence.quote}</span></span><ChevronRight size={14} />
    </button>)}
    {finding.question && <p className="question">{finding.question}</p>}
    {finding.status !== 'open' && finding.resolution && <p className="resolution">{finding.resolution}</p>}
    {!project.archivedAt && (finding.status === 'open' ? <div className="resolution-box">
      <label className="field"><span>Klärung dokumentieren</span><textarea placeholder="Antwort oder Kalkulationsannahme" rows={2} value={resolution} onChange={event => setResolution(event.target.value)} /></label>
      <div className="button-row">
        <button className="button small-button" disabled={busy || !resolution.trim()} onClick={() => close('dismissed')}>Verwerfen</button>
        <button className="button button-primary small-button" disabled={busy || !resolution.trim()} onClick={() => close('resolved')}><Check size={14} /> Klären</button>
      </div>
      {finding.type === 'duplicate' && rows.length > 1 && <button className="text-button" disabled={busy || !resolution.trim()}
        onClick={() => close('resolved', currentId && finding.positionIds.includes(currentId) ? currentId : rows[0].id)}>
        OZ {rows.find(row => row.id === currentId)?.oz ?? rows[0].oz} behalten, übrige ausschließen
      </button>}
    </div> : <button className="text-button" disabled={busy} onClick={() => close('open')}>Erneut öffnen</button>)}
  </article>
}

function OffersPanel({ row, busy, run, project }: { row: Position; busy: boolean; run: RunAction; project: Project }) {
  const [query, setQuery] = useState(row.supplierQuery || row.title)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [own, setOwn] = useState(false)
  const best = bestOffer(row.offers, row)
  const quantity = quantityOf(row)
  const offers = [...row.offers].sort((a, b) => (a.delivery === null ? Infinity : offerAmount(a, quantity ?? 0).total) -
    (b.delivery === null ? Infinity : offerAmount(b, quantity ?? 0).total))
  const chosen = row.offers.find(offer => offer.id === confirmId)
  function choose(offer: Offer) {
    if (!comparable(offer, row)) { setConfirmId(offer.id); return }
    void run({ action: 'offer', rowId: row.id, offerId: offer.id })
  }
  async function addOwn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (await run({ action: 'manualOffer', rowId: row.id, merchant: form.get('merchant'), net: optionalNumber(form, 'net'),
      delivery: optionalNumber(form, 'delivery'), pack: optionalNumber(form, 'pack'), minPacks: optionalNumber(form, 'minPacks'),
      leadTime: form.get('leadTime'), url: form.get('url') })) setOwn(false)
  }
  async function acceptShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (await run({ action: 'offer', rowId: row.id, offerId: confirmId, confirm: true, delivery: optionalNumber(form, 'delivery'),
      pack: optionalNumber(form, 'pack'), minPacks: optionalNumber(form, 'minPacks') })) setConfirmId(null)
  }
  return <div className="pane-stack">
    <div><h3>Lieferantenangebote</h3><p className="muted small">Vergleich nach Nettokosten für die LV-Menge, inklusive bekannter Lieferung.</p></div>
    {!project.archivedAt && <form className="offer-search" onSubmit={event => {event.preventDefault(); void run({ action:'search', rowId:row.id, query })}}>
      <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Artikel oder Suchbegriff" maxLength={130} />
      <button className="button button-primary" type="submit" disabled={busy || query.trim().length < 2} aria-label="Preise suchen"><Search size={16}/></button>
    </form>}
    {row.category === 'crew' && <a className="text-button" target="_blank" rel="noreferrer" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([row.trade || row.title, project.postcode, 'Deutschland'].join(' '))}>Betriebe in der Nähe suchen <ArrowUpRight size={14}/></a>}
    {!offers.length && <div className="inset empty-small"><Package size={23}/><strong>Keine Angebote hinterlegt</strong><span>Suche nach Artikelnummer oder ergänze ein Lieferantenangebot.</span></div>}
    <div className="offer-grid">{offers.map(offer => {
      const active = row.selectedOfferId === offer.id
      const result = quantity === null ? null : offerAmount(offer, quantity)
      return <article className={'offer-card ' + (active ? 'selected' : '')} key={offer.id}>
        <div className="offer-heading"><strong>{offer.merchant}</strong>
          {active ? <span className="tag tag-green"><Check size={12}/> Gewählt</span> : offer.id === best?.id ? <span className="tag tag-green"><ArrowDown size={12}/> Günstigstes</span> : null}
        </div>
        <p className="small muted">{offer.title}</p>
        <div className="offer-price"><b>{amountLabel(offer.delivery === null ? offer.net : result?.total)}</b>
          <span className="small muted">{offer.delivery === null ? 'je Packung · Versand offen' : 'gesamt netto'}</span></div>
        <p className="small muted">{offer.source === 'demo' ? 'Beispiel' : offer.source === 'live' ? 'Google Shopping · Richtwert' : 'Hinterlegte Quelle'}
          {' · '}{offer.pack} je Packung · ab {offer.minPacks} Packung(en)</p>
        {offer.leadTime && <p className="small muted">{offer.leadTime}</p>}
        {!offer.exact && !offer.confirmed && <span className="tag tag-amber">Spezifikation offen</span>}
        <div className="button-row">
          {offer.url && <a className="text-button" href={offer.url} rel="noreferrer" target="_blank">Quelle <ExternalLink size={12}/></a>}
          {!project.archivedAt && !active && <button className="button small-button" disabled={busy} onClick={() => choose(offer)}>
            {comparable(offer, row) ? 'Auswählen' : 'Prüfen und auswählen'}
          </button>}
        </div>
      </article>
    })}</div>
    {chosen && <form onSubmit={acceptShipping} className="inset pane-stack">
      <strong>Daten für „{chosen.merchant}“ bestätigen</strong>
      <p className="small muted">Packungsgröße in {unitOf(row)} und Nettoversand für die bestellte Menge eingeben. Eignung und Lieferbarkeit bitte anhand des Angebots prüfen.</p>
      <div className="field-grid">
        <Num name="delivery" label="Versand netto (€)" value={chosen.delivery} />
        <Num name="pack" label={unitOf(row) + ' je Packung'} value={chosen.pack} />
        <Num name="minPacks" label="Mindestpackungen" value={chosen.minPacks} />
      </div>
      <button className="button button-primary" disabled={busy || !quantity}>Bestätigen und auswählen</button>
    </form>}
    {!project.archivedAt && <>
      <div className="button-row">
        <button className="button" onClick={() => setOwn(!own)}>{own ? 'Eingabe schließen' : '+ Eigenes Angebot'}</button>
        {row.selectedOfferId && <button className="text-button" onClick={() => run({action:'offer', rowId:row.id, offerId:null})} disabled={busy}>Auswahl lösen</button>}
      </div>
      {own && <form onSubmit={addOwn} className="inset pane-stack">
        <label className="field"><span>Lieferant oder Betrieb</span><input name="merchant" required minLength={2} maxLength={80}/></label>
        <div className="field-grid">
          <label className="field"><span>Netto je Packung (€)</span><input name="net" required type="number" min="0" step="any"/></label>
          <Num name="delivery" label="Versand netto (€)" value={0} />
          <Num name="pack" label={unitOf(row) + ' je Packung'} value={1} />
          <Num name="minPacks" label="Mindestpackungen" value={1} />
        </div>
        <label className="field"><span>Lieferzeit</span><input name="leadTime" maxLength={100}/></label>
        <label className="field"><span>Link zum Angebot (optional)</span><input type="url" name="url" maxLength={500}/></label>
        <button className="button button-primary" disabled={busy}>Angebot speichern</button>
      </form>}
    </>}
  </div>
}

export function PositionDetail({ project, row, tab, setTab, close, run, busy, onSource, mode, setMode, previous, next, indexLabel }: {
  project: Project; row: Position; tab: DetailTab; setTab: (tab: DetailTab) => void; close: () => void; run: RunAction; busy: boolean;
  onSource: (rowId: string) => void; mode: InspectorMode; setMode: (mode: InspectorMode) => void;
  previous: (() => void) | null; next: (() => void) | null; indexLabel?: string
}) {
  const [pdfVisible, setPdfVisible] = useState(false)
  const calc = estimateRow(row, project.baseMarkup)
  const findings = project.findings.filter(finding => finding.positionIds.includes(row.id))
  const proposal = markupSuggestion(row, project.baseMarkup)
  async function saveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run({ action:'row', rowId:row.id, values:{
      quantity:optionalNumber(form,'quantity'), unit: form.get('unit'), overridePrice:optionalNumber(form,'override'),
      markup:optionalNumber(form,'markup'), marketPrice:optionalNumber(form,'market'), marketSource:form.get('marketSource'),
      included: form.get('included') === 'on',
      costs:{ material:optionalNumber(form,'material'), hours:optionalNumber(form,'hours'), rate:optionalNumber(form,'rate'),
        equipment:optionalNumber(form,'equipment'), other:optionalNumber(form,'other') } }})
  }
  const tabs: { key: DetailTab; label: ReactNode }[] = [
    {key:'detail',label:'Details'}, {key:'offers',label:<>Preise {row.offers.length > 0 && <span>{row.offers.length}</span>}</>},
    {key:'source',label:'Quelle'},
  ]
  return <aside className={'inspector bm-inspector bm-inspector--' + mode} aria-label="Positionsdetails">
    <header className="inspector-header bm-inspector-header">
      <span className="eyebrow">POSITION {row.oz}</span>
      <div className="bm-inspector-actions" aria-label="Größe der Positionsansicht">
        <button type="button" className="bm-inspector-mode-button bm-fullscreen-button" title={mode === 'focus' ? 'Zur Seitenansicht' : 'Vollbild öffnen'} aria-label={mode === 'focus' ? 'Vollbild schließen' : 'Vollbild öffnen'} aria-pressed={mode === 'focus'} onClick={() => setMode(mode === 'focus' ? 'compact' : 'focus')}>
          {mode === 'focus' ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
          <span>{mode === 'focus' ? 'Verkleinern' : 'Vollbild'}</span>
        </button>
        <span className="bm-action-divider" aria-hidden="true"/>
        <button type="button" className="bm-inspector-mode-button bm-close-button" onClick={close} title="Position schließen" aria-label="Positionsdetails schließen"><X size={19}/></button>
      </div>
      <h2>{row.title}</h2>
      <div className="detail-tags">
        <span className={'tag ' + (row.origin === 'suggested' ? 'tag-purple' : row.origin === 'manual' ? 'tag-teal' : 'tag-neutral')}>
          {row.origin === 'suggested' ? <><Sparkles size={12}/> Vorschlag</> : row.origin === 'manual' ? 'Ergänzt' : 'Original'}
        </span>
        <span className="muted small">{row.groupLabel || row.group}</span>
      </div>
      <div className="bm-position-navigator">
        <span>{indexLabel || ('OZ ' + row.oz)}</span>
        <div>
          <button type="button" aria-label="Vorherige Position" title="Vorherige Position" disabled={!previous} onClick={previous || undefined}><ChevronLeft size={17}/></button>
          <button type="button" aria-label="Nächste Position" title="Nächste Position" disabled={!next} onClick={next || undefined}><ChevronRight size={17}/></button>
        </div>
      </div>
    </header>
    <nav className="detail-tabs" aria-label="Positionsansicht">{tabs.map(item =>
      <button key={item.key} aria-current={tab === item.key ? 'page' : undefined} className={item.key === tab ? 'active' : ''} onClick={() => setTab(item.key)}>{item.label}</button>)}</nav>
    <div className="inspector-content">
      {tab === 'source' && <div className="pane-stack">
        <h3>Originalbeleg</h3>
        {row.source ? <><div className="source-label"><FileText size={17}/><strong>{row.source.location}</strong></div>
          {project.hasOriginal && <div className="button-row"><button className="button" onClick={() => setPdfVisible(!pdfVisible)}>{pdfVisible ? 'PDF ausblenden' : 'PDF anzeigen'}</button>
            <a className="text-button" href={'/api/projects/' + project.id + '/original#page=' + (row.source.pages?.[0] ?? 1)} target="_blank" rel="noreferrer">Separat öffnen <ArrowUpRight size={14}/></a></div>}
          {pdfVisible && project.hasOriginal && <iframe className="pdf-frame" title="Original-PDF" src={'/api/projects/' + project.id + '/original#page=' + (row.source.pages?.[0] ?? 1)} />}
          <pre className="source-text">{row.source.text}</pre></> : <p className="muted">Diese Position wurde im Projekt ergänzt.</p>}
      </div>}
      {tab === 'offers' && <OffersPanel row={row} project={project} run={run} busy={busy}/>}
      {tab === 'detail' && <div className="pane-stack">
        <div className="line-totals bm-calculation-totals" aria-label="Menge, Einheitspreis und Gesamtpreis">
          <div className="bm-total-quantity"><span>Menge</span><strong>{calc.quantity === null ? '—' : decimal.format(calc.quantity)} {unitOf(row)}</strong></div>
          <div className="bm-total-unit"><span>EP netto</span><strong>{calc.unitPrice === null ? '—' : unitEur.format(calc.unitPrice)}</strong></div>
          <div className="bm-total-grand"><span>GP netto</span><strong>{!row.included ? '—' : amountLabel(calc.total)}</strong></div>
        </div>
        {row.origin === 'suggested' && <div className="inset suggested"><p>{row.description}</p>
          {row.laborReference && <p className="small">Lohnorientierung: <b>{eur.format(row.laborReference.value)} / h</b> <a href={row.laborReference.url} target="_blank" rel="noreferrer">{row.laborReference.label} <ArrowUpRight size={12}/></a></p>}
          {!project.archivedAt && <button className="button small-button" disabled={busy} onClick={() => run({ action:'suggestion', rowId:row.id, accept:!row.accepted })}>
            {row.accepted ? 'Aus Angebot herausnehmen' : 'Vorschlag übernehmen'}
          </button>}</div>}
        {findings.map(finding => <FindingCard key={finding.id + finding.status} finding={finding} project={project} busy={busy} run={run} currentId={row.id} onSource={onSource}/>)}
        {proposal && <div className="inset suggested"><span className="tag tag-purple"><Sparkles size={12}/> Zuschlagsszenario</span>
          <h3>{decimal.format(calc.markup)} % → {proposal.proposed} %</h3>
          <p>EP {unitEur.format(proposal.unitPrice)} liegt innerhalb der hinterlegten Referenz von {amountLabel(row.marketPrice)}.</p>
          <p className="small muted">Quelle: {row.marketSource}. Die Annahme durch den Kunden bleibt offen.</p>
          {!project.archivedAt && <button className="button small-button" disabled={busy} onClick={() => run({action:'row', rowId:row.id, values:{markup:proposal.proposed}})}>Szenario übernehmen</button>}
        </div>}
        {!project.archivedAt && <form className="pane-stack cost-form" key={project.revision + row.id} onSubmit={saveRow}>
          <h3>Kalkulation bearbeiten</h3>
          <p className="small muted">Kosten pro Mengeneinheit. Ein manuell gesetzter EP hat Vorrang.</p>
          <section className="bm-form-section bm-form-section--measure">
            <h4>Menge & Einheit</h4>
            <div className="field-grid bm-measure-grid">
              <label className="field"><span>Menge</span><input name="quantity" type="number" min="0" defaultValue={quantityOf(row) ?? ''} step="any" /></label>
              <UnitPicker initial={unitOf(row)} />
            </div>
          </section>
          <section className="bm-form-section bm-form-section--cost">
            <h4>Kostenbestandteile <small>je Mengeneinheit</small></h4>
            <div className="field-grid">
              <Num name="material" label="Material (€)" value={row.costs.material} placeholder={calc.totalMaterial === null ? '—' : 'Lieferant gewählt'} />
              <Num name="hours" label="Arbeitsstunden" value={row.costs.hours}/>
              <Num name="rate" label="Lohnsatz (€/h)" value={row.costs.rate}/>
              <Num name="equipment" label="Geräte (€)" value={row.costs.equipment}/>
              <Num name="other" label="Sonstiges (€)" value={row.costs.other}/>
            </div>
            {calc.laborIncomplete && <p className="inline-warning"><TriangleAlert size={14}/> Für Lohnkosten Stunden und Satz ergänzen.</p>}
          </section>
          <section className="bm-form-section bm-form-section--price">
            <h4>Preis & Zuschlag</h4>
            <div className="field-grid">
              <Num name="markup" label="Zuschlag (%)" value={row.markup} max={300} placeholder={String(project.baseMarkup)}/>
              <label className="field"><span>EP netto festlegen (€)</span><input name="override" type="number" min="0" step="any" defaultValue={row.overridePrice ?? ''} placeholder={row.sourcePrice === undefined ? 'Berechnet' : String(row.sourcePrice)} /></label>
            </div>
          </section>
          <section className="bm-form-section bm-form-section--reference">
            <h4>Preisreferenz <small>optional</small></h4>
            <div className="field-grid">
              <Num name="market" label="Marktreferenz (€/ME)" value={row.marketPrice}/>
              <label className="field"><span>Referenzquelle</span><input name="marketSource" maxLength={230} defaultValue={row.marketSource || ''} /></label>
            </div>
          </section>
          {row.type !== 'unit-only' && row.accepted && <label className="check"><input name="included" type="checkbox" defaultChecked={row.included} /> In Angebotssumme aufnehmen</label>}
          <button className="button button-primary" disabled={busy}>Kalkulation speichern</button>
        </form>}
        {project.archivedAt && row.description && <pre className="source-text">{row.description}</pre>}
      </div>}
    </div>
  </aside>
}
