import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

const key = '__Host-bauton-workspace'

export async function workspaceId() {
  if ((process.env.BAUMIND_PREVIEW ?? process.env.BAUTON_PREVIEW) !== '1') return ''

  const cookieStore = await cookies()
  const saved = cookieStore.get(key)?.value
  if (saved && /^[a-f0-9]{48}$/.test(saved)) return saved

  const workspace = randomBytes(24).toString('hex')
  cookieStore.set(key, workspace, { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14 })
  return workspace
}
