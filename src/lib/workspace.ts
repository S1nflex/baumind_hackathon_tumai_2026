import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

export class WorkspaceAccessError extends Error {
  readonly status = 503
}

export function workspaceMode(env: NodeJS.ProcessEnv = process.env) {
  if ((env.BAUMIND_PREVIEW ?? env.BAUTON_PREVIEW) === '1') return 'preview' as const
  if (env.NODE_ENV !== 'production' || env.BAUMIND_SINGLE_USER === '1') return 'single-user' as const
  return 'locked' as const
}

export async function workspaceId() {
  const mode = workspaceMode()
  if (mode === 'single-user') return ''
  if (mode === 'locked') {
    throw new WorkspaceAccessError('BauMind ist ohne Benutzerisolation nicht für öffentlichen Zugriff freigeschaltet.')
  }

  const cookieStore = await cookies()
  const secure = process.env.NODE_ENV === 'production'
  const key = secure ? '__Host-baumind-workspace' : 'baumind-workspace'
  const saved = cookieStore.get(key)?.value
  if (saved && /^[a-f0-9]{48}$/.test(saved)) return saved

  const workspace = randomBytes(24).toString('hex')
  cookieStore.set(key, workspace, { secure, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14 })
  return workspace
}
