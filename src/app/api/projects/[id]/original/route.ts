import { errorResponse } from '@/lib/http'
import { workspaceId } from '@/lib/workspace'
import { originalFile, requireProject } from '@/lib/store'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await workspaceId()
    const { id } = await context.params
    const project = requireProject(workspace, id)
    if (!project.hasOriginal) return new Response('PDF-Original nicht verfügbar.', { status: 404 })
    return new Response(originalFile(workspace, id), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store' } })
  } catch (error) { return errorResponse(error) }
}
