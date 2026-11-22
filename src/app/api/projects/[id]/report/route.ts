import { errorResponse } from '@/lib/http'
import { workspaceId } from '@/lib/workspace'
import { exportAbgabe, type ReportKind } from '@/lib/report'
import { requireProject } from '@/lib/store'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await workspaceId()
    const { id } = await context.params
    const project = requireProject(workspace, id)
    const requested = new URL(request.url).searchParams.get('layout')
    const kind: ReportKind = requested === 'long' || requested === 'internal' ? requested : 'short'
    const report = await exportAbgabe(project, kind)
    const label = kind === 'internal' ? 'Kalkulation-Intern' : kind === 'long' ? 'Abgabe-LV-Langfassung' : 'Abgabe-LV'
    const name = label + (project.archivedAt ? '.pdf' : '-Entwurf.pdf')
    return new Response(new Uint8Array(report), { headers: { 'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + name + '"', 'Cache-Control': 'private, no-store' } })
  } catch (error) { return errorResponse(error) }
}
