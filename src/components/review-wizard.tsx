'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, CircleHelp, FileText, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { Finding, Project } from '@/lib/model'
import { AutoGrowTextarea } from './auto-grow-textarea'
import type { RunAction } from './position-detail'

type ReviewWizardProps = {
  project: Project
  busy: boolean
  run: RunAction
  onSource: (positionId: string) => void
  onOpenPositions: () => void
}

/** One review decision at a time. Submission stays on the existing project API. */
export function ReviewWizard({ project, busy, run, onSource, onOpenPositions }: ReviewWizardProps) {
  const { t } = useI18n()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [duplicateKeep, setDuplicateKeep] = useState<Record<string, string>>({})
  const [showCompleted, setShowCompleted] = useState(false)
  const findings = project.findings
  const pending = useMemo(() => findings.filter(item => item.status === 'open'), [findings])
  const completed = useMemo(() => findings.filter(item => item.status !== 'open'), [findings])
  const doneCount = completed.length
  const total = findings.length

  useEffect(() => {
    if (!pending.length) {
      setActiveId(null)
      return
    }
    // Keep the selected finding while it's open; otherwise progress to next.
    if (!activeId || !pending.some(item => item.id === activeId)) setActiveId(pending[0].id)
  }, [pending, activeId])

  const active = pending.find(item => item.id === activeId) ?? pending[0] ?? null
  const index = active ? pending.findIndex(item => item.id === active.id) : -1
  const resolution = active ? (drafts[active.id] ?? '') : ''
  const affected = active ? project.positions.filter(row=>active.positionIds.includes(row.id)) : []
  const firstAffected = affected[0]
  const locationFromText = firstAffected?.description.match(/Einbauort\s*:\s*([^\n]+)/i)?.[1]?.trim()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const expanded = completed.find(item => item.id === expandedId) ?? null
  const actionable = Boolean(active && resolution.trim())

  function fillSuggestion(value: string) {
    if (active) setDrafts(old=>({...old,[active.id]:value}))
  }

  function nextPending() {
    if (!pending.length) return
    setActiveId(pending[(index + 1) % pending.length].id)
  }
  function previousPending() {
    if (!pending.length) return
    setActiveId(pending[(index + pending.length - 1) % pending.length].id)
  }

  async function decide(status: 'resolved' | 'dismissed') {
    if (!active || !actionable || busy) return
    const currentId = active.id
    const nextId = pending.find((item, i) => i > index && item.id !== currentId)?.id
      ?? pending.find(item => item.id !== currentId)?.id ?? null
    const result = await run({ action: 'finding', findingId: currentId, status, resolution: resolution.trim(),
      ...(status === 'resolved' && duplicateKeep[currentId] ? {keepId: duplicateKeep[currentId]} : {}) })
    if (result) {
      setDrafts(old => {
        const copy = { ...old }
        delete copy[currentId]
        return copy
      })
      setActiveId(nextId)
      setShowCompleted(false)
    }
  }

  async function reopen(finding: Finding) {
    if (busy) return
    const success = await run({ action: 'finding', findingId: finding.id, status: 'open', resolution: finding.resolution ?? '' })
    if (success) {
      setActiveId(finding.id)
      setExpandedId(null)
      setShowCompleted(false)
      if (finding.resolution) setDrafts(old => ({ ...old, [finding.id]: finding.resolution ?? '' }))
    }
  }

  if (!total) return <section className="bm-review-empty">
    <ShieldCheck size={34}/>
    <h2>{t('Keine Prüfpunkte gefunden')}</h2>
    <p>{t('Die geprüften Positionen bleiben im Original einsehbar.')}</p>
    <button className="button button-primary" onClick={onOpenPositions}>{t('Positionen ansehen')} <ArrowRight size={16}/></button>
  </section>

  return <div className="bm-review-wizard">
    <header className="bm-review-progress-header">
      <div>
        <span className="bm-review-overline">{t('Prüfung der Positionen')}</span>
        <h2>{pending.length ? t('Offene Fragen klären') : t('Alle Prüfpunkte erledigt')}</h2>
        <p>{pending.length
          ? t('Entscheide einen Punkt nach dem anderen. Du kannst jederzeit später fortfahren.')
          : t('Alle Hinweise wurden bearbeitet. Du kannst Entscheidungen erneut öffnen.')}</p>
      </div>
      <div className="bm-review-progress-numbers">
        <strong>{doneCount}<span> / {total}</span></strong>
        <small>{t('Erledigt')}</small>
      </div>
    </header>
    <div className="bm-review-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label={t('Prüffortschritt')}>
      <span style={{width:`${(doneCount/total)*100}%`}}/>
    </div>

    {active ? <article className="bm-review-main-card" key={active.id}>
      <div className="bm-review-card-top">
        <div className="bm-review-counter"><span className="bm-review-counter-dot"/>{t('Prüfpunkt')} {index + 1} / {pending.length} {t('offen')}</div>
        <div className="bm-review-nav">
          <button className="bm-review-nav-button" onClick={previousPending} disabled={busy || pending.length < 2} aria-label={t('Vorheriger Prüfpunkt')}><ArrowLeft size={17}/></button>
          <button className="bm-review-nav-button" onClick={nextPending} disabled={busy || pending.length < 2} aria-label={t('Nächster Prüfpunkt')}><ArrowRight size={17}/></button>
        </div>
      </div>
      <div className="bm-review-card-body">
        <span className={'bm-review-importance ' + (active.score === 'confirmed' ? 'is-danger' : 'is-warning')}>
          <TriangleAlert size={15}/>{active.score === 'confirmed' ? t('Abweichung prüfen') : t('Hinweis prüfen')}
        </span>
        <h3>{active.title}</h3>
        <p className="bm-review-description">{active.detail}</p>
        {active.evidence.length > 0 && <section className="bm-review-evidence">
          <span className="bm-review-section-label"><FileText size={16}/>{t('Fundstelle im Dokument')}</span>
          {active.evidence.map((item, i) => <button key={`${item.positionId}-${i}`} className="bm-review-evidence-link" onClick={()=>onSource(item.positionId)}>
            <span><strong>{item.location}</strong><small>{item.quote}</small></span><ChevronRight size={17}/>
          </button>)}
        </section>}
        <div className="bm-review-answer">
          <label htmlFor="bm-review-decision"><span className="bm-review-section-label"><CircleHelp size={17}/>{active.question ? t('Was muss geklärt werden?') : t('Was ist deine Entscheidung?')}</span></label>
          {active.question && <p className="bm-review-question">{active.question}</p>}
          {active.type === 'mismatch' && firstAffected && <div className="bm-review-quick-choices" aria-label={t('Antwortvorschläge')}>
            <span>{t('Nach Prüfung auswählen:')}</span>
            <div>
              <button type="button" disabled={busy} onClick={()=>fillSuggestion(`${t('LV-Abschnitt geprüft und bestätigt:')} ${firstAffected.groupLabel}.`)}>{t('LV-Abschnitt bestätigt')}</button>
              {locationFromText && <button type="button" disabled={busy} onClick={()=>fillSuggestion(`${t('Einbauort aus Langtext geprüft und bestätigt:')} ${locationFromText}.`)}>{t('Einbauort bestätigt')}</button>}
            </div>
          </div>}
          {active.type === 'duplicate' && affected.length > 1 && <label className="bm-review-duplicate-picker">
            <span>{t('Mehrfachpositionen im Angebot')}</span>
            <select value={duplicateKeep[active.id] || ''} onChange={event=>setDuplicateKeep(old=>({...old,[active.id]:event.target.value}))}>
              <option value="">{t('Keine Position automatisch ausschließen')}</option>
              {affected.map(row=><option key={row.id} value={row.id}>{t('Nur behalten:')} {row.oz} · {row.title}</option>)}
            </select>
            {duplicateKeep[active.id] && <small>{t('Andere betroffene Positionen werden bei der Kalkulation ausgeschlossen.')}</small>}
          </label>}
          <AutoGrowTextarea id="bm-review-decision" value={resolution} disabled={busy}
            onChange={value=>setDrafts(old=>({...old,[active.id]:value}))}
            placeholder={t('Kurze Begründung eingeben …')}/>
          <p className="bm-review-help">{t('Deine Begründung wird gespeichert. Die LV-Position wird nicht automatisch geändert.')}</p>
        </div>
      </div>
      <footer className="bm-review-card-actions">
        <button className="button bm-review-later" onClick={nextPending} disabled={busy || pending.length < 2}>{t('Später bearbeiten')} <ArrowRight size={15}/></button>
        <div className="bm-review-decision-actions">
          <button className="button bm-review-dismiss" disabled={busy || !actionable} onClick={()=>void decide('dismissed')}>{t('Nicht relevant')}</button>
          <button className="button button-primary bm-review-confirm" disabled={busy || !actionable} onClick={()=>void decide('resolved')}><Check size={17}/>{t('Als geklärt speichern')}</button>
        </div>
      </footer>
    </article> : <section className="bm-review-complete">
      <div className="bm-review-complete-icon"><CheckCircle2 size={29}/></div>
      <h3>{t('Prüfung abgeschlossen')}</h3>
      <p>{t('Alle Hinweise sind dokumentiert. Prüfe fehlende Preise, bevor du das Angebot freigibst.')}</p>
      <div className="bm-review-complete-actions">
        <button className="button button-primary" onClick={onOpenPositions}>{t('Zur Kalkulation')} <ArrowRight size={16}/></button>
      </div>
    </section>}

    {completed.length > 0 && <section className="bm-review-history">
      <button className="bm-review-history-toggle" onClick={()=>setShowCompleted(old=>!old)} aria-expanded={showCompleted}>
        <span><CheckCircle2 size={18}/>{t('Bearbeitete Prüfpunkte')} <b>{completed.length}</b></span>
        <ChevronRight className={showCompleted ? 'is-expanded' : ''} size={18}/>
      </button>
      {showCompleted && <div className="bm-review-history-list">
        {completed.map(finding=><div key={finding.id} className="bm-review-history-item">
          <button className="bm-review-history-heading" onClick={()=>setExpandedId(old=>old===finding.id?null:finding.id)} aria-expanded={expandedId===finding.id}>
            <span><strong>{finding.title}</strong><small>{finding.status === 'resolved' ? t('Geklärt') : t('Nicht relevant')}</small></span><ChevronRight className={expandedId===finding.id?'is-expanded':''} size={16}/>
          </button>
          {expanded?.id===finding.id && <div className="bm-review-history-detail">
            <p>{finding.resolution}</p>
            {!project.archivedAt && !project.shelvedAt && <button className="button" disabled={busy} onClick={()=>void reopen(finding)}><RotateCcw size={15}/>{t('Erneut bearbeiten')}</button>}
          </div>}
        </div>)}
      </div>}
    </section>}
  </div>
}
