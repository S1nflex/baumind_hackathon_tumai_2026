import { importProject } from '@/lib/import-pipeline'
import { workspaceId } from '@/lib/workspace'
import { ProjectError } from '@/lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Streaming NDJSON events accurately track backend phases; no artificial timers. */
export async function POST(request: Request) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true
      const send = (data: unknown) => { if (open) controller.enqueue(encoder.encode(JSON.stringify(data) + '\n')) }
      try {
        const workspace = await workspaceId()
        const form = await request.formData()
        const project = await importProject(form, workspace, update => send({ type: 'progress', ...update }))
        send({ type: 'complete', project })
      } catch (error) {
        send({ type: 'error', message: error instanceof ProjectError ? error.message :
          'Import fehlgeschlagen. Details im Server-Log prüfen.' })
        console.error('BauMind import-stream:', error instanceof Error ? error.name : 'unknown')
      } finally { open = false; controller.close() }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform', 'X-Content-Type-Options': 'nosniff' } })
}
