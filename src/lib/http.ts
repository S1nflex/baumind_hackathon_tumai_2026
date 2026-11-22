import { ZodError } from 'zod'
import { ProjectError } from './store'

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: 'Bitte die Eingaben prüfen.', fields: error.issues.map(issue => issue.path.join('.')) }, { status: 400 })
  if (error instanceof ProjectError) return Response.json({ error: error.message }, { status: error.status })
  console.error('Unhandled API error:', error instanceof Error ? error.stack ?? error.message : error)
  return Response.json({ error: 'Die Anfrage konnte nicht bearbeitet werden.' }, { status: 500 })
}
