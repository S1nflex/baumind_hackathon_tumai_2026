import type { Position } from './model'

function mm(value: string, unit: string) {
  return Math.round(Number(value.replace(',', '.')) * (unit.toLowerCase() === 'cm' ? 10 : 1))
}

export function catalogLookup(row: Pick<Position, 'title' | 'description'>) {
  if (!/\b(?:tiefspül[- ]?wc|flachspül[- ]?wc|wand[- ]?wc|stand[- ]?wc|wc[- ]becken)\b/i.test(row.title)) return null
  const text = row.title + '\n' + row.description
  const dimension = (pattern: RegExp) => {
    const match = text.match(pattern)
    return match ? mm(match[1], match[2]) : undefined
  }
  const depth = dimension(/\b(?:ausladung|tiefe)\s*:?\s*(\d{1,4}(?:[.,]\d+)?)\s*(mm|cm)\b/i) ??
    dimension(/\b(\d{1,4}(?:[.,]\d+)?)\s*(mm|cm)\s+ausladung\b/i)
  const width = dimension(/\bbreite\s*:?\s*(\d{1,4}(?:[.,]\d+)?)\s*(mm|cm)\b/i)
  const height = dimension(/(?:^|[,;]\s*|\bgröße:\s*)höhe\s*:?\s*(\d{1,4}(?:[.,]\d+)?)\s*(mm|cm)\b/im)
  const model = [...text.matchAll(/\bmodell\s*-?\s*nr\.?\s*:?\s*(\d{6,9})\b/gi)].at(-1)?.[1]
  const accessible = /barrierefrei|rollstuhl/i.test(text)
  const wall = /wandhängend|wand[- ]?wc/i.test(text)
  const standing = /stand[- ]?wc|bodenstehend/i.test(text)
  const deep = /tiefspül/i.test(text)
  const coating = /keratect/i.test(text)
  const specs = [wall && 'Wandmontage', standing && 'Standmontage', deep && 'Tiefspüler', accessible && 'barrierefrei',
    depth && 'Ausladung ' + depth + ' mm', width && 'Breite ' + width + ' mm', height && 'Höhe ' + height + ' mm',
    /abgang\s*:?\s*(?:waagerecht|horizontal)/i.test(text) && 'Abgang horizontal',
    /spülrandlos|rimfree/i.test(text) ? 'spülrandlos' : /spülrand/i.test(text) ? 'mit Spülrand' : '',
    /\bEN\s*997\b/i.test(text) && 'EN 997', coating && 'KeraTect', model && 'LV-Modell ' + model].filter(Boolean).join(' · ')
  const query = [wall ? 'Wand-WC' : standing ? 'Stand-WC' : 'WC-Becken',
    deep && 'Tiefspüler', accessible && 'barrierefrei', depth && ('Ausladung ' + depth + ' mm'),
    width && (width + ' mm breit'), coating && 'KeraTect', model].filter(Boolean).join(' ')
  const product = !standing && (depth === 700 && accessible) ? {
    name: 'Geberit Renova Comfort · ' + (coating ? '208520600' : '208520000'),
    sku: coating ? '208520600' : '208520000',
    url: 'https://catalog.geberit.de/de-DE/product/PRO_484670',
    match: 'Datenblatt: 700 mm Ausladung, 355 mm Breite, Wandmontage, horizontaler Abgang',
    check: (width && width !== 355 ? 'LV-Breite: ' + width + ' mm. ' : '') + 'Befestigung, Sitzhöhe und Lieferumfang abgleichen.',
  } : !standing && model?.startsWith('203040') ? {
    name: 'Geberit Renova · ' + (coating ? '203040600' : '203040000'),
    sku: coating ? '203040600' : '203040000',
    url: 'https://catalog.geberit.de/de-DE/product/PRO_449864',
    match: 'Modellfamilie 203040 im Herstellerkatalog',
    check: 'Breite laut Katalog: 355 mm.' + (width && width !== 355 ? ' LV-Breite: ' + width + ' mm.' : '') + ' Maße, Glasur und Lieferumfang prüfen.'
  } : undefined
  return {
    specs, query, product,
    searchUrl: 'https://www.google.de/search?q=' + encodeURIComponent(query + ' Hersteller Datenblatt'),
  }
}
