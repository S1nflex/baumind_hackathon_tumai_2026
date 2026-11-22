import type { Position } from './model'

type SectionSource = Pick<Position, 'group' | 'groupLabel' | 'oz'>
export type SectionNavigationItem = { id: string; label: string; depth: 0 | 1 }

const numericSection = /^\d+(?:\.\d+)*$/
const placeholderLabel = /^(?:Abschnitt\s+\d+(?:\.\d+)*|LV|Leistungsverzeichnis|Allgemein)$/i

// The project stores the most specific group (e.g. 16.1). Build the missing
// parent navigation from the real OZ prefix, also for projects already imported.
export function getSectionKey(row: SectionSource): string {
  const stored = row.group.trim()
  const normalizedOz = row.oz.replace(/\.$/, '').trim()
  const ozParts = normalizedOz.split('.')
  const ozPrefix = ozParts.length >= 2 && ozParts.every(part => /^\d+$/.test(part))
    ? ozParts.slice(0, -1).join('.') : ''
  // A PDF may have imported the entire trade as group 16, while its OZ values
  // describe real subgroups 16.1, 16.2. Preserve those recognizable groups.
  if (numericSection.test(stored) && stored !== normalizedOz) {
    if (ozPrefix && (ozPrefix === stored || ozPrefix.startsWith(stored + '.'))) return ozPrefix
    return stored
  }
  return ozPrefix || stored || 'LV'
}

export function positionBelongsToSection(row: SectionSource, selected: string): boolean {
  if (selected === 'all') return true
  const key = getSectionKey(row)
  if (key === selected || key.startsWith(selected + '.')) return true
  // Older imports can have an arbitrary worksheet name in `group`.
  const oz = row.oz.replace(/\.$/, '')
  return oz === selected || oz.startsWith(selected + '.')
}

export function buildSectionNavigation(rows: SectionSource[]): SectionNavigationItem[] {
  const sections = new Map<string, SectionNavigationItem>()
  for (const row of rows) {
    const group = getSectionKey(row)
    const parts = group.split('.')
    const numeric = numericSection.test(group)
    if (numeric && parts.length > 1) {
      const parent = parts[0]
      if (!sections.has(parent)) sections.set(parent, { id: parent, label: 'Abschnitt ' + parent, depth: 0 })
    }
    const specific = row.groupLabel.trim()
    const name = specific && !placeholderLabel.test(specific) ? specific : 'Abschnitt ' + group
    const depth: 0 | 1 = numeric && parts.length > 1 ? 1 : 0
    const previous = sections.get(group)
    if (!previous) sections.set(group, { id: group, label: name, depth })
    // Prefer a real imported heading to a generic placeholder when available.
    else if (placeholderLabel.test(previous.label) && !placeholderLabel.test(name)) sections.set(group, { ...previous, label: name })
  }
  const collator = new Intl.Collator('de', { numeric: true })
  return [...sections.values()].sort((a, b) => collator.compare(a.id, b.id))
}
