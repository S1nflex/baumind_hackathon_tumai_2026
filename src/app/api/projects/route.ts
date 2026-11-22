import { importProject } from '@/lib/import-pipeline'
import { listProjects } from '@/lib/store'
import { workspaceId } from '@/lib/workspace'
import { errorResponse } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET() {
  try { return Response.json({ projects: listProjects(await workspaceId()) }) }
  catch (error) { return errorResponse(error) }
}

/** Compatibility endpoint; the browser uses import-stream for incremental progress. */
export async function POST(request: Request) {
  try {
    const workspace = await workspaceId()
    const form = await request.formData()
    return Response.json({ project: await importProject(form, workspace) }, { status: 201 })
  } catch (error) { return errorResponse(error) }
}
