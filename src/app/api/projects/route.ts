import { randomUUID } from 'node:crypto'
import { importLv } from '@/lib/import'
import { demoImport } from '@/lib/demo'
import { catalogLookup } from '@/lib/catalog'
import { combineFindings, reviewRules, laborSuggestions } from '@/lib/review'
import { semanticReview } from '@/lib/ai-review'
import { runScopeAgent } from '@/lib/scope-agent'
import { bestOffer } from '@/lib/estimate'
import { findSuppliers, referenceOffers, shopConfigured } from '@/lib/suppliers'
import { createProject, getPreferences, listProjects, ProjectError } from '@/lib/store'
import { errorResponse } from '@/lib/http'
import { workspaceId } from '@/lib/workspace'
import { canUploadLv, lvUploadFormatMessage } from '@/lib/upload'
import type { Project } from '@/lib/model'

export const runtime = 'nodejs'

export async function GET() {
  try { return Response.json({ projects: listProjects(await workspaceId()) }) }
  catch (error) { return errorResponse(error) }
}

export async function POST(request: Request) {
  try {
    const workspace = await workspaceId()
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      throw new ProjectError('Bitte die LV-Datei als Formular-Upload senden.')
    }
    const form = await request.formData()
    const demo = form.get('demo') === '1'
    const file = form.get('file')
    const name = (typeof file === 'object' && file?.name ? file.name : 'Übungs-LV.pdf').slice(0, 230)
    const postcode = String(form.get('postcode') || '').trim().slice(0, 5)
    if (!demo && (!(file instanceof File) || !file.size || file.size > 24 * 1024 * 1024)) {
      throw new ProjectError('Bitte eine Datei bis 24 MB auswählen.')
    }
    if (!demo && !canUploadLv(name)) throw new ProjectError(lvUploadFormatMessage)
    const bytes = !demo && file instanceof File ? Buffer.from(await file.arrayBuffer()) : undefined
    if (bytes && /\.pdf$/i.test(name) && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new ProjectError('Die Datei ist kein lesbares PDF.')
    const parsed = demo ? demoImport() : await importLv(bytes!, name).catch(error => {
      throw new ProjectError(error instanceof Error ? error.message : 'Datei konnte nicht importiert werden.')
    })
    const findings = reviewRules(parsed.positions)
    const [semantic, agent] = demo ? [undefined, undefined] :
      await Promise.all([semanticReview(parsed.positions), runScopeAgent(parsed.positions)])
    const analysisStatus = semantic?.status === 'unavailable' && agent?.summary.status === 'applied' ? 'partial' : semantic?.status
    const availability = !demo && shopConfigured()
    if (!demo) {
      for (const row of parsed.positions) row.offers = referenceOffers(row)
      if (availability && form.get('prices') === '1') {
        const selected = parsed.positions.flatMap(row => {
          if (!row.quantity || !row.unit) return []
          const query = row.supplierQuery ?? catalogLookup(row)?.query ?? row.title
          return query ? [{ row, query }] : []
        }).slice(0, 8)
        const results = await Promise.allSettled(selected.map(({ row, query }) => findSuppliers(query, row, postcode)))
        let incompletes = 0
        results.forEach((result, index) => {
          if (result.status === 'rejected' || !result.value.offers.length) incompletes++
          if (result.status === 'rejected') return
          const { row } = selected[index]
          row.offers = result.value.offers
          row.selectedOfferId = bestOffer(row.offers, row)?.id ?? null
        })
        if (incompletes) parsed.warnings.push('Bei ' + incompletes + ' Artikeln fehlen bestätigbare Live-Angebote.')
      }
    }
    const suggestions = laborSuggestions(parsed.positions, demo ? [] : getPreferences(workspace).filter(preference => preference.uses >= 2))
    const project: Project = { ...parsed, id: randomUUID(), name: String(form.get('name') || '').trim().slice(0, 120) || parsed.title,
      fileName: name, createdAt: new Date().toISOString(), archivedAt: null, revision: 1,
      positions: [...parsed.positions, ...suggestions], findings: combineFindings(combineFindings(findings, agent?.findings ?? []), semantic?.findings ?? []),
      company: String(form.get('company') || '').trim().slice(0, 120), postcode,
      baseMarkup: 25, vat: 19, demo, hasOriginal: Boolean(bytes && parsed.format === 'PDF'),
      analysis: { mode: semantic?.status === 'applied' || semantic?.status === 'partial' || agent?.summary.status === 'applied' ? 'AI + rules' : 'rules',
        status: analysisStatus, note: semantic?.note, agent: agent?.summary },
    }
    return Response.json({ project: createProject(workspace, project, bytes) }, { status: 201 })
  } catch (error) { return errorResponse(error) }
}
