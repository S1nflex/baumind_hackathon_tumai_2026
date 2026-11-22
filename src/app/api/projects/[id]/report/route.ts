import { errorResponse } from '@/lib/http'
import { workspaceId } from '@/lib/workspace'
import { exportAbgabe } from '@/lib/report'
import { requireProject } from '@/lib/store'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await workspaceId()
    const { id } = await context.params
    const project = requireProject(workspace, id)
    const report = await exportAbgabe(project)
    const name = project.archivedAt ? 'Abgabe-LV.pdf' : 'Abgabe-LV-Entwurf.pdf'
    return new Response(new Uint8Array(report), { headers: { 'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + name + '"', 'Cache-Control': 'private, no-store' } })
  } catch (error) { return errorResponse(error) }
}
