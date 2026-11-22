import { randomUUID } from 'node:crypto'
import { integrationReadiness } from './integration-readiness'
import { verifyMarketSources } from './verify-integrations'
import { importLv } from './import'
import { demoImport } from './demo'
import { combineFindings, reviewRules, laborSuggestions } from './review'
import { semanticReview } from './ai-review'
import { runScopeAgent } from './scope-agent'
import { referenceOffers } from './suppliers'
import { enrichMarket } from './market-enrichment'
import { createProject, getPreferences, ProjectError } from './store'
import { canUploadLv, lvUploadFormatMessage } from './upload'
import type { Project, Position } from './model'

export type ImportStage = 'parse' | 'rules' | 'ai' | 'market' | 'save' | 'done'
export type ImportProgress = { stage: ImportStage; percent: number; detail: string }
export type ImportProgressCallback = (update: ImportProgress) => void

export async function importProject(form: FormData, workspace: string, onProgress: ImportProgressCallback = () => {}): Promise<Project> {
  const progress = (stage: ImportStage, percent: number, detail: string) => onProgress({ stage, percent, detail })
  const demo = form.get('demo') === '1'
  const mode = form.get('analysisMode') === 'local' || demo ? 'local' : 'full'
  // Fail closed BEFORE parsing or saving: a full analysis must never silently become a rules-only import.
  if (mode === 'full') {
    const gate = integrationReadiness()
    if (!gate.readyForFullImport) throw new ProjectError(
      'FULL_IMPORT_NOT_CONFIGURED: ' + (gate.missing.includes('AI') ? 'AI-API ' : '') +
      (gate.missing.includes('MARKET') ? 'Marktquelle (Supabase oder SerpAPI)' : '') +
      '. Integrationen verbinden oder den lokalen Import wählen.', 503)
    if (form.get('ai') !== '1') throw new ProjectError('Bitte der externen KI-Analyse zustimmen oder den lokalen Import wählen.', 400)
    const marketConnectivity = await verifyMarketSources()
    if (!marketConnectivity.ready) throw new ProjectError('MARKET_UNAVAILABLE: ' + marketConnectivity.reason + ' Unter Integrationen reparieren oder lokal importieren.', 503)
  }
  progress('parse', 6, 'Originaldatei wird gelesen und strukturiert')
  const file = form.get('file')
  const name = (file instanceof File ? file.name : 'Übungs-LV.pdf').slice(0, 230)
  const postcode = String(form.get('postcode') || '').trim().slice(0, 5)
  if (!demo && (!(file instanceof File) || !file.size || file.size > 24 * 1024 * 1024)) {
    throw new ProjectError('Bitte eine Datei bis 24 MB auswählen.')
  }
  if (!demo && !canUploadLv(name)) throw new ProjectError(lvUploadFormatMessage)
  const bytes = !demo && file instanceof File ? Buffer.from(await file.arrayBuffer()) : undefined
  if (bytes && /\.pdf$/i.test(name) && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new ProjectError('Die Datei ist kein lesbares PDF.')
  }
  const parsed = demo ? demoImport() : await importLv(bytes!, name).catch(error => {
    throw new ProjectError(error instanceof Error ? error.message : 'Datei konnte nicht importiert werden.')
  })
  progress('rules', 27, `${parsed.positions.length} Positionen importiert · Regelprüfung läuft`)
  const findings = reviewRules(parsed.positions)
  // Third-party AI processing is opt-in. The form displays this consent before upload.
  const useAi = mode === 'full' && !demo && form.get('ai') === '1'
  let semantic: Awaited<ReturnType<typeof semanticReview>> | undefined
  let agent: Awaited<ReturnType<typeof runScopeAgent>> | undefined
  if (useAi) {
    progress('ai', 42, 'KI analysiert Risiken, Leistungsgrenzen und Zusammenhänge')
    const [semanticResult, agentResult] = await Promise.allSettled([
      semanticReview(parsed.positions), runScopeAgent(parsed.positions),
    ])
    semantic = semanticResult.status === 'fulfilled' ? semanticResult.value : undefined
    agent = agentResult.status === 'fulfilled' ? agentResult.value : undefined
    if (!semantic || semantic.status === 'unavailable' || (semantic.status === 'disabled' && parsed.positions.some(row => row.description.trim().length >= 12))) {
      // Do not store a project claiming successful AI enrichment when authentication, quota or model failed.
      throw new ProjectError('KI-Analyse nicht abgeschlossen: ' + (semantic?.note ?? 'Verbindung/Modell fehlgeschlagen.') +
        ' Bitte Schlüssel, Modell und Kontingent unter Integrationen prüfen.', 502)
    }
    if (agentResult.status === 'rejected' || agent?.summary.status === 'unavailable')
      parsed.warnings.push('Scope-Agent teilweise nicht verfügbar; KI-Textprüfung war erfolgreich.')
  } else progress('ai', 42, 'KI-Prüfung nicht aktiviert · Regelprüfung abgeschlossen')

  for (const row of parsed.positions) if (!demo) row.offers = referenceOffers(row)
  progress('market', 63, 'Lieferanten und KI-Richtwerte werden unabhängig ermittelt')
  const market = await enrichMarket(parsed.positions,postcode,useAi,update=>progress('market',63+Math.round(update.percent*0.29),update.detail))
  if (mode === 'full' && market.estimates.length === 0 && market.checkedOffers === 0)
    parsed.warnings.push('Keine Preise ermittelt. Prüfe AI-Modell und Marktquelle; starte die Preisrecherche erneut im Projekt.')
  const analysisStatus = semantic?.status === 'unavailable' && agent?.summary.status === 'applied'
    ? 'partial' : semantic?.status ?? (useAi ? 'unavailable' : 'disabled')
  const suggestions = laborSuggestions(parsed.positions, demo ? [] : getPreferences(workspace).filter(preference => preference.uses >= 2))
  progress('save', 95, 'Prüfergebnisse und Kalkulation werden lokal gespeichert')
  const project: Project = { ...parsed, id: randomUUID(), name: String(form.get('name') || '').trim().slice(0, 120) || parsed.title,
    fileName: name, createdAt: new Date().toISOString(), archivedAt: null, revision: 1,
    positions: [...parsed.positions, ...suggestions],
    findings: combineFindings(combineFindings(findings, agent?.findings ?? []), semantic?.findings ?? []),
    company: String(form.get('company') || '').trim().slice(0, 120), postcode,
    baseMarkup: 25, vat: 19, demo, hasOriginal: Boolean(bytes && parsed.format === 'PDF'),
    analysis: {
      mode: semantic?.status === 'applied' || semantic?.status === 'partial' || agent?.summary.status === 'applied'
        ? 'AI + rules' : 'rules',
      status: analysisStatus, provider: semantic?.provider, note: semantic?.note, agent: agent?.summary,
      market: { ...market, provider: semantic?.provider ?? 'none', refreshedAt:new Date().toISOString() },
    },
  }
  const saved = createProject(workspace, project, bytes)
  progress('done', 100, 'Projekt angelegt · Bereit zur Kalkulation')
  return saved
}
