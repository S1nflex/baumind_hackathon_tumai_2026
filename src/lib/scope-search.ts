import { normalizeOz, type Position } from './model'

const primary = /\b(?:RWA(?:-Motoröffner)?|Elektroanschluss|Elektroantrieb|elektrisch(?:e[nsrm]?)?\s+(?:anschließen|Anschluss|Antrieb)|Liefergrenze|Schnittstelle|durch\s+ein\s+anderes\s+Gewerk)\b/i
const secondary = /\b(?:Vorleistung|Folgeleistung|bauseits|anderes\s+Gewerk|separat\s+auszuführen)\b/i

export function scopeCandidates(rows: Position[], limit = 5) {
  const ranked = rows.flatMap(row => {
    if (row.type === 'alternative' || row.origin !== 'imported') return []
    const strong = primary.test(row.description) || primary.test(row.title)
    const weak = secondary.test(row.description)
    return strong || weak ? [{ row, score: (strong ? 2 : 0) + (weak ? 1 : 0) }] : []
  }).sort((a, b) => b.score - a.score)

  const groups = new Set<string>()
  const selected = new Set<Position>()
  for (const { row } of ranked) {
    if (selected.size === limit) break
    if (!groups.has(row.group)) {
      groups.add(row.group)
      selected.add(row)
    }
  }
  for (const { row } of ranked) {
    if (selected.size === limit) break
    selected.add(row)
  }
  return [...selected]
}

const normalized = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

export function searchScopePositions(rows: Position[], anchor: Position, queries: string[], limit = 5) {
  const terms = [...new Set(queries.map(normalized).filter(q => q.length >= 2))]
  const tokens = [...new Set(terms.flatMap(q => q.split(/[^\p{L}\p{N}]+/u)).filter(term => term.length >= 4))]
  return rows.flatMap(row => {
    if (row.id === anchor.id || row.type === 'alternative') return []
    const title = normalized(row.title)
    const description = normalized(row.description)
    const section = normalized(row.groupLabel)
    const exact = terms.some(q => q === row.id.toLowerCase() || normalizeOz(q.replace(/^(?:oz|pos\.?)\s+/i, '')) === normalizeOz(row.oz))
    const score = terms.reduce((n, q) => n + (title.includes(q) ? 12 : 0) + (description.includes(q) ? 6 : 0) + (section.includes(q) ? 3 : 0), 0) +
      tokens.reduce((n, token) => n + (title.includes(token) ? 3 : 0) + (description.includes(token) ? 1 : 0), 0)
    if (!exact && !score) return []
    return [{ row, score: exact ? 1000 : score + (row.group !== anchor.group ? 3 : 0) }]
  }).sort((a, b) => b.score - a.score).slice(0, limit).map(({ row }) => row)
}

// Quote windows retain characters and spacing from the imported position.
export function positionExcerpt(row: Position, query: string[], limit: number) {
  const text = row.description
  const lower = text.toLowerCase()
  const matches = query.map(term => lower.indexOf(term.trim().toLowerCase())).filter(index => index >= 0)
  const start = matches.length ? Math.max(0, Math.min(...matches) - Math.floor(limit / 3)) : 0
  return text.slice(start, start + limit)
}
