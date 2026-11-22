import { normalizeName } from '../normalize'
import type { DiscoveryQuery } from './catalog'

export function isConstructionRelevant(name: string, category: string | null | undefined, query: DiscoveryQuery): boolean {
  const text = normalizeName([name, category ?? ''].join(' '))
  return query.keywords.some(keyword => {
    const normalized = normalizeName(keyword)
    return normalized.length > 1 && text.includes(normalized)
  })
}
