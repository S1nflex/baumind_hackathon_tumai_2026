import Decimal from 'decimal.js'
import { estimateRow, round } from './estimate'
import { normalizeOz, position, type Finding, type Position, type Preference } from './model'

function wording(text: string) { return text.trim().toLowerCase().replace(/\s+/g, ' ') }
function sourceEvidence(row: Position, quote = row.title) { return { positionId: row.id, location: row.source?.location ?? 'Kalkulation', quote } }

export function reviewRules(rows: Position[]): Finding[] {
  const findings: Finding[] = []
  function finding(type: Finding['type'], key: string, title: string, detail: string, affected: Position[],
    quotes: string[], score: Finding['score'] = 'review', question?: string) {
    findings.push({ id: type + '-' + key, type, title, detail, positionIds: affected.map(row => row.id),
      evidence: affected.map((row, index) => sourceEvidence(row, quotes[index])),
      score, status: 'open', question, createdBy: 'rule' })
  }

  const byCode = new Map<string, Position[]>()
  const byText = new Map<string, Position[]>()

  for (const row of rows) {
    const code = normalizeOz(row.oz)
    byCode.set(code, [...(byCode.get(code) ?? []), row])
    const description = wording(row.description)
    if (description.length > 40 && !/^(?:wie vor|wie zuvor|alternativ|\[person_\d+\])/.test(description)) {
      byText.set(description, [...(byText.get(description) ?? []), row])
    }

    if (row.quantity === null || !row.unit) {
      finding('data', row.id, 'Menge oder Einheit prüfen', 'Für die Position fehlt eine verwendbare Menge oder Mengeneinheit.',
        [row], [row.title], 'confirmed')
    }
    if (row.quantity !== null && row.sourcePrice !== undefined && row.sourceTotal !== undefined &&
        Math.abs(round(new Decimal(row.quantity).times(row.sourcePrice)) - row.sourceTotal) > 0.01) {
      finding('price', row.id, 'Abweichender Gesamtpreis', 'Menge × Einheitspreis weicht vom ausgewiesenen Gesamtpreis ab. Rundung, Rabatt oder Preisübernahme prüfen.',
        [row], [row.source?.text.split('\n').at(-1) ?? row.title], 'confirmed')
    }

    const location = row.description.match(/Einbauort\s*:\s*([^\n]+)/i)
    if (location && ((/halle/i.test(row.groupLabel) && /büro/i.test(location[1])) ||
        (/büro/i.test(row.groupLabel) && /halle/i.test(location[1])))) {
      finding('mismatch', row.id, 'Abschnitt und Einbauort weichen ab',
        'Die Position steht in „' + row.groupLabel + '“, der Langtext nennt „' + location[1].trim() + '“. Den maßgeblichen Bereich bestätigen.',
        [row], [location[0]], 'confirmed', 'Für welchen Gebäudeteil ist OZ ' + row.oz + ' vorgesehen?')
    }
    if (/\bDachanschluss\b/i.test(row.title) && /Durchdringung/i.test(row.title) && wording(row.description).length < 180) {
      finding('scope', row.id, 'Durchdringungen nicht zugeordnet', 'Abmessungen und Lage der Durchdringungen fehlen in dieser Position.',
        [row], [row.title], 'review', 'Bitte Durchdringungen, Lage und Abdichtungsdetails im Dachplan zuordnen.')
    }
  }

  for (const row of rows) {
    const referenceList = [...row.description.matchAll(/\b(?:Pos(?:ition)?[.-]?\s+(?:Nr\.?\s*)?|OZ\s+)(\d+(?:\.+\d+){1,6})\b/gi)]
    const seen = new Set<string>()
    for (const reference of referenceList) {
      const target = normalizeOz(reference[1])
      if (!byCode.has(target) && target !== row.oz && !seen.has(target)) {
        seen.add(target)
        finding('reference', row.id + '-' + target, 'Verweis auf fehlende OZ ' + target,
          'Im importierten LV ist die referenzierte Position nicht vorhanden. Prüfen, ob eine andere Position oder eine Anlage gemeint ist.',
          [row], [reference[0]], 'confirmed', 'Welche Position ist mit „' + reference[0] + '“ gemeint?')
      }
    }
  }

  for (const [code, matches] of byCode) {
    if (matches.length < 2) continue
    const same = matches.every(row => wording(row.description) === wording(matches[0].description) &&
      row.quantity === matches[0].quantity && row.unit.toLowerCase() === matches[0].unit.toLowerCase() &&
      row.sourcePrice === matches[0].sourcePrice && row.sourceTotal === matches[0].sourceTotal)
    finding('duplicate', 'oz-' + matches[0].id, same ? 'Identische OZ doppelt vorhanden' : 'Mehrere Einträge für OZ ' + code,
      same ? 'Übereinstimmende Texte, Mengen und Preise sind hier zusammengefasst. Eine Position behalten oder beide begründet übernehmen.'
        : 'Zur gleichen OZ gibt es unterschiedliche Einträge. Variante oder Menge anhand des Originals prüfen.',
      matches, matches.map(row => row.title), same ? 'confirmed' : 'review')
  }

  for (const matches of byText.values()) {
    if (new Set(matches.map(row => row.oz)).size <= 1) continue
    finding('duplicate', 'scope-' + matches[0].id, 'Gleicher Leistungstext an mehreren Stellen',
      'Die Fundstellen sind zusammengefasst. Mengen oder Einbauorte können getrennte Leistungen begründen. Den Umfang vor einer Zusammenführung prüfen.',
      matches, matches.map(row => row.title))
  }
  return findings
}

export const laborBenchmark = {
  value: 39.60,
  label: 'Destatis · Arbeitskosten Baugewerbe 2025',
  url: 'https://genesis.destatis.de/datenbank/online/statistic/62431/table/62431-0001',
}
const electrical = /\b(?:RWA[- ]Motoröffner|Elektroanschluss|elektrisch(?:er|en|e)? Anschluss|(?:230|400)\s*V\b|elektrisch\s+anschließen|Anschluss\s+Elektro)\b/i

export function laborSuggestions(rows: Position[], preferences: Preference[]) {
  const existingElectric = rows.some(row => /\bElektroarbeiten\b|\bElektroinstallation\b|\bElektromonteur\b/i.test(row.title))
  if (existingElectric) return []
  return rows.filter(row => row.origin === 'imported' && electrical.test(row.description)).slice(0, 8).map(row => {
    const preference = preferences.find(item => item.trade === 'Elektro')
    const quote = row.description.match(electrical)?.[0] ?? row.title
    return position({
      id: 'suggest-' + row.id + '-elektro', oz: row.oz + ' + E', group: row.group, groupLabel: row.groupLabel,
      title: preference?.title ?? 'Elektroanschluss prüfen', trade: 'Elektro', parentId: row.id,
      description: 'Möglicher Anschlussbedarf zu OZ ' + row.oz + ' („' + quote + '“). Zuständigkeit und Stundenaufwand bestätigen.',
      origin: 'suggested', category: preference ? 'crew' : 'labor', accepted: false, included: false,
      quantity: 1, unit: 'psch', source: row.source,
      laborReference: laborBenchmark,
      costs: { material: null, hours: null, rate: preference?.rate ?? laborBenchmark.value, equipment: null, other: null },
    })
  })
}

export function expensive(row: Position, markup: number) {
  const unitPrice = estimateRow(row, markup).unitPrice
  return row.marketPrice !== null && row.marketPrice > 0 && unitPrice !== null && unitPrice > row.marketPrice * 1.15
}
