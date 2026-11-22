import { execFile } from 'node:child_process'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import ExcelJS from 'exceljs'
import { numberDE } from './estimate'
import { normalizeOz, position, type ImportResult, type Position, type PositionType } from './model'
import { stripPdfPageFurniture } from './pdf-text'

const filenameTitle = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
const issueType = (text: string, amount = ''): PositionType => /Bedarfsposition ohne\s+(?:GB|Gesamtbetrag)|Nur Einh\.?-Pr|nur\s+EP/i.test(text + ' ' + amount) ? 'unit-only' :
  /Alternativposition|Wahlposition/i.test(text) ? 'alternative' :
  /Bedarfsposition|Eventualposition/i.test(text) ? 'optional' : 'normal'

function supplierQuery(text: string) {
  const ae = text.match(/\b(?:EAN|GTIN)\s*:?\s*(\d{8,14})\b/i)?.[1]
  const article = text.match(/\b(?:Art(?:ikel)?\.?\s*[- ]?Nr\.?|Artikelnummer)\s*[:.]?\s*([\dA-Z][\dA-Z./-]{4,30})/i)?.[1]
  return (ae ?? article)?.replace(/[-.]$/, '')
}

function concreteRow(fields: Parameters<typeof position>[0]) {
  const row = position(fields)
  const reference = supplierQuery(row.description)
  if (reference && /liefer|einlauf|fabrikat|typ\b/i.test(row.description)) row.supplierQuery = reference
  return row
}

const numberPattern = '[+\\-−]?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d+)?'
const unitPattern = '(?:[a-zA-ZäöüÄÖÜµ%]+(?:[²³23])?(?:[a-zA-Z]{0,4})?(?:[./-][a-zA-Z0-9²³]+)?\\.?)'
const quantityPattern = new RegExp('^(' + numberPattern + ')\\s+(' + unitPattern + ')(?=\\s|$)(.*)$')
const quantityWithoutUnit = new RegExp('^\\s{25,}(' + numberPattern + ')\\s{2,}\\.{5,}\\s{2,}\\.{5,}\\s*$')
const moneyPattern = new RegExp('^' + numberPattern + '(?:\\s*€)?$')
const units = /^(?:st(?:k|d|ck|ück|mt|wo|d\/h)?|m(?:[²³23])?(?:d|mt|wo|\/h)?|cm(?:[²³23])?|km(?:[²³23])?|kg|t|to|h|d|tg|l|ls|lt|lfm|jm|mt|mo|mon|wo|jr|jahr|jahre|a|kwh|kw|psch|pschl|pausch|pau|p|ges|set|satz|stk|stk\/d|st\/[mj]|m\/d|std\/st|[hm]2\/h|%)\.?$/i

function quantityLine(text: string) {
  const trimmed = text.trim()
  const normalized = /\b(?:EP|GP)\s*\.{2}/.test(trimmed) ? trimmed.replace(/^(\d+(?:[.,]\d+)*)(?=[a-zA-Z])/, '$1 ') : trimmed
  const match = normalized.match(quantityPattern)
  if (!match || !units.test(match[2])) {
    const blankUnit = text.match(quantityWithoutUnit)
    const qty = blankUnit ? numberDE(blankUnit[1]) : null
    return qty === null ? null : { qty, unit: '', price: undefined, amount: undefined, raw: trimmed, strength: 1 }
  }
  const trailing = match[3].trim()
  const cells = trailing.split(/\s{2,}/).filter(Boolean)
  const prices = cells.filter(cell => moneyPattern.test(cell))
  if (trailing && !prices.length && !/^[.\s]+$|(?:GP|EP)\s*\.{2,}|Nur\s+Einh|^€|^EUR|^-{2,}/i.test(trailing)) return null
  const qty = numberDE(match[1])
  if (qty === null) return null
  return { qty, unit: match[2].replace(/\.$/, ''), price: numberDE(prices[0] ?? '') ?? undefined,
    amount: numberDE(prices[1] ?? '') ?? undefined, raw: text.trim(), strength: prices.length ? 3 : trailing ? 2 : 1 }
}
type PdfLine = { text: string; page: number }
type Candidate = { code: string; title: string; span: PdfLine[]; page: number; quantity?: ReturnType<typeof quantityLine>; quantityPage?: number }

const columnHeader = /(?:Menge|Mengen)\s*(?:\/\s*)?(?:Einh|ME|Einheit|[^\n]{0,15}\s{2,})[^\n]{0,80}(?:EP|Einheitspreis|Preis|Gesamt)|^\s*OZ\s{2,}(?:Leistungsbeschreibung|Beschreibung)/im
const skipLine = /^\s*(?:Übertrag\s*:|Zwischensumme\b|Druckdatum\b|Seite\s*:?\s+\d+(?:\s|$)|LV\s*:|Projekt\s*:|Datum\s*:|\[FIRMA_[^\]]+\]\s*$|(?:Nr\.|OZ|Pos-Nr\.|Ordnungszahl)\s{2,}|(?:EUR\s+){1,}EUR\s*$|in EUR\s+in EUR|Alle Einzelbeträge Netto|\[BILD[^\]]*\]\s*$|Fortsetzung auf nächster Seite|-\s*Fortsetzung auf nächster Seite)/i

export function parsePdfText(text: string, filename: string): ImportResult {
  const raw = text.split('\f').filter((part, i, all) => i < all.length - 1 || part.trim())
  const firstLVPage = raw.findIndex(page => columnHeader.test(page))
  const hasLVHeader = firstLVPage >= 0
  const candidates: Candidate[] = []
  const titles = new Map<string, string>()
  const warnings: string[] = []
  let current: Candidate | undefined
  const complete = () => { if (current) candidates.push(current); current = undefined }
  const addAmount = (row: Candidate, amount: NonNullable<ReturnType<typeof quantityLine>>, page: number) => {
    if (!row.quantity || amount.strength >= row.quantity.strength) { row.quantity = amount; row.quantityPage = page }
  }
  raw.forEach((page, index) => {
    if (hasLVHeader && index < firstLVPage) return
    const number = index + 1
    const lines = page.split(/\r?\n/).map((line, i) => i < 16 ? stripPdfPageFurniture(line) : line)
    const starts = lines.map(line => line.match(/^(\s{0,14})(\.?\d+(?:\.+\d+){0,6}\.?)(?:\s{2,})(\S.*)$/))
    const margin = Math.min(14, ...starts.flatMap(match => match ? [match[1].length] : []))
    lines.forEach((text, i) => {
      if (/^\s*(?:Zusammenstellung\s*$|Summe\s+(?:LV|[\d.]+|Abschnitt|Bereich)|Zusammenstellung Bereich)/i.test(text)) { complete(); return }
      if (skipLine.test(text)) return
      const match = starts[i]
      if (match && /^LV\s{2,}/i.test(match[3])) return
      const namedHeading = text.match(/^\s{0,14}((?:\d+\.)*\d+)\.?\s+(?:Titel|Bereich|Abschnitt|Los)\s+(.+)$/i)
      const reversedHeading = text.match(/^\s{0,14}(?:Titel|Bereich|Abschnitt|Los)\s+((?:\d+\.)*\d+)\.?\s+(.+)$/i)
      if (namedHeading || reversedHeading) {
        const heading = (namedHeading ?? reversedHeading)!
        titles.set(heading[1], heading[2].trim())
        return
      }
      if (match && match[1].length <= margin + 3 && /^(?:\d+(?:\.+\d+)+\.?|\.\d+\.?|\d{1,2}\.?)$/.test(match[2])) {
        const code = normalizeOz(match[2])
        const amount = quantityLine(match[3])
        if (current?.code === code && current.page < number && !current.quantity) {
          if (amount) addAmount(current, amount, number)
          else if (!current.title.includes(match[3].trim())) current.span.push({ text: match[3].trim(), page: number })
          return
        }
        complete()
        current = { code, title: amount ? '' : match[3].trim(), span: [], page: number }
        if (amount) addAmount(current, amount, number)
        return
      }
      if (current && text.trim()) {
        const amount = quantityLine(text)
        if (amount && /^\s{12,}/.test(text)) addAmount(current, amount, number)
        else if (!/^[.\s\d]+$|^(?:Gesamtbetrag|Bauvorhaben|Projekt-Nr\.|Pos-Nr\.)\s*:/i.test(text.trim())) current.span.push({ text: text.trim(), page: number })
      }
    })
  })
  complete()

  const goodCodes = candidates.filter(row => row.quantity).map(row => row.code)
  const prefixes = new Set(goodCodes.flatMap(code => {
    const parts = code.split('.')
    return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('.'))
  }))
  const depthCounts = new Map<number, number>()
  for (const oz of goodCodes) depthCounts.set(oz.split('.').length, (depthCounts.get(oz.split('.').length) ?? 0) + 1)
  const positions: Position[] = []
  for (const row of candidates) {
    if (!row.quantity && (prefixes.has(row.code) || /^KG\s+\d{3}\b/i.test(row.title))) {
      titles.set(row.code, row.title)
      continue
    }
    if (!row.quantity && (!row.code.includes('.') || !depthCounts.has(row.code.split('.').length) || !row.title ||
      /^(?:Übertrag|Gesamt|Summe|Titel|Abschnitt|Bereich)/i.test(row.title))) continue
    const parts = row.code.split('.')
    const group = parts.slice(0, -1).join('.') || 'LV'
    const original = [row.title, ...row.span.map(line => line.text)].filter(Boolean)
    const label = original.find(line => !/^\*{2,}|^(?:Grundposition|Alternativposition|Bedarfsposition)/i.test(line)) || 'Position ' + row.code
    const body = original.filter((line, i) => i === 0 || line !== original[i - 1]).join('\n')
    const type = issueType(body, row.quantity?.raw)
    const pages = Array.from(new Set([row.page, ...row.span.map(line => line.page), ...(row.quantityPage ? [row.quantityPage] : [])])).sort((a, b) => a - b)
    positions.push(concreteRow({
      id: 'p' + (positions.length + 1), oz: row.code, group, groupLabel: titles.get(group) ?? 'Abschnitt ' + group,
      title: label, description: body, quantity: row.quantity?.qty ?? null, unit: row.quantity?.unit ?? '',
      sourcePrice: row.quantity?.price, sourceTotal: row.quantity?.amount,
      type, included: type !== 'unit-only' && type !== 'alternative',
      source: { location: 'S. ' + pages.join(', '), pages, text: [body, row.quantity?.raw].filter(Boolean).join('\n') },
    }))
  }
  const missing = positions.filter(row => row.quantity === null || !row.unit).length
  if (missing) warnings.push(missing + ' Position(en) mit unvollständiger Menge oder Einheit. Bitte anhand der Quelle prüfen.')
  if (!hasLVHeader) warnings.push('Tabellenkopf nicht erkannt. Bitte den Import anhand des Originals abgleichen.')
  return { title: filenameTitle(filename), positions, format: 'PDF', pages: raw.length, warnings }
}

async function extractPdf(bytes: Buffer) {
  return new Promise<string>((resolve, reject) => {
    const child = execFile('pdftotext', ['-layout', '-enc', 'UTF-8', '-', '-'], { maxBuffer: 40 * 1024 * 1024, timeout: 50000 }, (error, stdout) => {
      if (error) reject(new Error(error.code === 'ENOENT'
        ? 'PDF-Import benötigt Poppler (pdftotext). Installationshinweise stehen im README.'
        : 'Der Text dieser PDF-Datei konnte nicht gelesen werden.'))
      else resolve(stdout)
    })
    child.stdin?.on('error', () => {})
    child.stdin?.end(bytes)
  })
}

type XmlNode = Record<string, unknown>
const entryArray = (value: unknown): XmlNode[] => Array.isArray(value) ? value as XmlNode[] :
  value && typeof value === 'object' ? [value as XmlNode] : []
const childNodes = (node: XmlNode, tag: string) => node[tag] as XmlNode[] ?? []
const tagValue = (node: XmlNode, tag: string) => childNodes(node, tag).flatMap(textLeaves).join(' ').trim()
const attr = (node: XmlNode, name: string) => String((node[':@'] as Record<string, unknown> | undefined)?.['@_' + name] ?? '')

function textLeaves(node: XmlNode): string[] {
  return Object.entries(node).flatMap(([key, value]) => key === '#text' ? [String(value)] : key === ':@' ? [] : entryArray(value).flatMap(textLeaves))
}

function formattedXml(node: XmlNode): string {
  return Object.entries(node).map(([key, val]) => {
    if (key === ':@') return ''
    if (key === '#text') return String(val)
    if (key.toLowerCase() === 'br') return '\n'
    const text = entryArray(val).map(formattedXml).join('')
    return /^(?:p|div|tr|li|line)$/i.test(key) ? text + '\n' : text
  }).join('')
}

function tagNodes(nodes: XmlNode[], tag: string): XmlNode[] {
  return nodes.flatMap(node => [...(tag in node ? [node] : []),
    ...Object.entries(node).flatMap(([key, value]) => key === ':@' ? [] : tagNodes(entryArray(value), tag))])
}

function xmlNumber(v: string) { return v && Number.isFinite(Number(v)) ? Number(v) : undefined }

export function parseGaebXml(xml: string, filename: string): ImportResult {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Externe XML-Deklarationen werden nicht unterstützt.')
  if (XMLValidator.validate(xml) !== true) throw new Error('Ungültige GAEB-XML-Datei.')
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, removeNSPrefix: true,
    parseTagValue: false, processEntities: { enabled: true, maxEntitySize: 1024, maxExpansionDepth: 3, maxTotalExpansions: 500000, maxExpandedLength: 12000000 } })
  const tree = parser.parse(xml) as XmlNode[]
  const booths = tagNodes(tree, 'BoQ')
  const positions: Position[] = []
  function walk(nodes: XmlNode[], path: string[], groupLabel: string) {
    for (const node of nodes) {
      if ('BoQCtgy' in node) {
        const entries = childNodes(node, 'BoQCtgy')
        const code = attr(node, 'RNoPart')
        const label = entries.flatMap(e => tagValue(e, 'LblTx')).filter(Boolean).join(' ') || groupLabel
        walk(entries, [...path, code].filter(Boolean), label)
      } else if ('Item' in node) {
        const entries = childNodes(node, 'Item')
        const get = (tag: string) => entries.flatMap(n => tagValue(n, tag)).filter(Boolean).join(' ')
        const description = tagNodes(entries, 'Description').map(formattedXml).join('\n').replace(/\n{3,}/g, '\n\n').trim()
        const short = tagNodes(entries, 'OutlineText').flatMap(textLeaves).join(' ').trim()
        const oz = get('RNo') || [...path, attr(node, 'RNoPart')].filter(Boolean).join('.')
        if (!oz) continue
        const title = short || description.split('\n').find(Boolean) || 'Position ' + oz
        const provisional = get('Provis')
        const alternative = get('ALNAssignment') || get('AltItem')
        const type: PositionType = /ohne|without|withouttotal/i.test(provisional) ? 'unit-only' :
          alternative && alternative.toLowerCase() !== 'no' ? 'alternative' : provisional && provisional.toLowerCase() !== 'no' ? 'optional' : issueType(description)
        positions.push(concreteRow({
          id: 'p' + (positions.length + 1), oz, group: path.join('.') || 'LV', groupLabel: groupLabel || 'Leistungsverzeichnis',
          title, description: description || title, quantity: xmlNumber(get('Qty')) ?? null, unit: get('QU'),
          sourcePrice: xmlNumber(get('UP')), sourceTotal: xmlNumber(get('IT')), type,
          included: type !== 'unit-only' && type !== 'alternative',
          source: { location: 'GAEB · OZ ' + oz, text: description || title },
        }))
      } else {
        for (const [key, content] of Object.entries(node)) if (key !== ':@') walk(entryArray(content), path, groupLabel)
      }
    }
  }
  booths.forEach(boq => walk(childNodes(boq, 'BoQ'), [], ''))
  const title = tagNodes(tree, 'LblBoQ').flatMap(textLeaves).join(' ').trim() || filenameTitle(filename)
  return { title, format: 'GAEB XML', positions, warnings: [] }
}

function parseLegacy(bytes: Buffer, name: string): ImportResult {
  const text = new TextDecoder('windows-1252').decode(bytes)
  const lines = text.split(/\r?\n/)
  const header = lines.find(row => row.startsWith('00')) ?? ''
  const widths = Array.from(header.slice(62, 71).matchAll(/(.)\1*/g), match => match[0].length)
  const buildOz = (field: string) => {
    if (!widths.length) return field.trim()
    let offset = 0
    return widths.map(width => {
      const code = field.slice(offset, offset + width).trim()
      offset += width
      return code
    }).filter(Boolean).join('.')
  }
  const fixedNumber = (text: string, digits: number) => /^-?\d+$/.test(text.trim()) ? Number(text.trim()) / 10 ** digits : undefined
  const positions: Position[] = []
  const sections = new Map<string, string>()
  let pendingSection = ''
  let current: Position | undefined
  for (const line of lines) {
    const field = line.slice(2, 11)
    const oz = buildOz(field)
    const type = line.slice(0, 2)
    const payload = line.slice(2, 72).trim()
    if (type === '11') { pendingSection = oz; current = undefined }
    if (type === '12' && pendingSection) { sections.set(pendingSection, payload); pendingSection = '' }
    if (type === '21' || (type === '23' && (!current || current.oz !== oz))) {
      const group = oz.split('.').slice(0, -1).join('.') || 'LV'
      const quantity = type === '21' ? fixedNumber(line.slice(23, 34), 3) : fixedNumber(line.slice(11, 72).trim().split(/\s+/)[2] ?? '', 3)
      current = position({ id: 'p' + (positions.length + 1), oz, group, groupLabel: sections.get(group) ?? 'Abschnitt ' + group,
        title: 'Position ' + oz, description: '', quantity: quantity ?? null, unit: type === '21' ? line.slice(34, 38).trim() : '',
        source: { location: 'GAEB · OZ ' + oz, text: '' } })
      positions.push(current)
    }
    if (!current) continue
    if (type === '23') {
      const [price, amount] = line.slice(11, 72).trim().split(/\s+/)
      current.sourcePrice = fixedNumber(price ?? '', 3)
      current.sourceTotal = fixedNumber(amount ?? '', price?.length === 10 ? 3 : 2)
    } else if (type === '25') current.title = payload
    else if (type === '26') current.description += (current.description ? '\n' : '') + payload
  }
  for (const row of positions) {
    row.description = row.description || row.title
    row.type = issueType(row.title + '\n' + row.description)
    row.included = row.type !== 'unit-only' && row.type !== 'alternative'
    row.supplierQuery = supplierQuery(row.description)
    row.source!.text = row.description
  }
  return { title: filenameTitle(name), format: 'GAEB 90', positions, warnings: positions.some(row => row.quantity === null || !row.unit)
    ? ['Dieser GAEB-Preisdatei fehlen Mengen oder Einheiten. Für die Angebotsabgabe die Positionen mit dem Haupt-LV abgleichen.'] : [] }
}

const columnNames = {
  oz: /^(oz|positionsnr|posnr|positionsnummer|ordnungszahl|position|itemno)$/,
  title: /^(kurztext|bezeichnung|beschreibung|leistungsbeschreibung|description|title|leistung)$/,
  description: /^(langtext|details|detailbeschreibung|fulltext)$/,
  quantity: /^(menge|mengesoll|sollmenge|anzahl|quantity|qty)$/,
  unit: /^(me|einheit|einheitme|mengeneinheit|mengeneinheitme|unit|einh)$/,
  price: /^(ep|einheitspreis|einzelpreis|unitprice|preis)(?:netto)?(?:eur)?$/,
  total: /^(gp|gesamt(?:betrag|preis)|summe|total)(?:netto)?(?:eur)?$/,
}

const cellNum = (cell: ExcelJS.Cell) => typeof cell.value === 'number' ? cell.value :
  cell.value && typeof cell.value === 'object' && 'result' in cell.value && typeof cell.value.result === 'number'
    ? cell.value.result : numberDE(cell.text)

async function parseExcel(bytes: Buffer, filename: string): Promise<ImportResult> {
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(bytes as unknown as ExcelJS.Buffer)
  const positions: Position[] = []
  const warnings: string[] = []
  for (const sheet of book.worksheets) {
    let map: Partial<Record<keyof typeof columnNames, number>> = {}
    let header = 0
    for (let i = 1; i <= Math.min(sheet.rowCount, 40); i++) {
      const trial: typeof map = {}
      sheet.getRow(i).eachCell((cell, col) => {
        const label = cell.text.toLowerCase().replaceAll('€', 'eur').replace(/[^a-z]/g, '')
        for (const [key, pattern] of Object.entries(columnNames)) {
          if (!pattern.test(label)) continue
          const field = key as keyof typeof columnNames
          if (!trial[field] || label === 'kurztext') trial[field] = col
        }
      })
      if (trial.oz && trial.title && trial.quantity && trial.unit) { map = trial; header = i; break }
    }
    if (!header) { warnings.push(sheet.name + ': Keine Spalten für OZ, Beschreibung, Menge und Einheit erkannt.'); continue }
    const read = (row: ExcelJS.Row, key: keyof typeof columnNames) => map[key] ? row.getCell(map[key]!).text.trim() : ''
    const num = (row: ExcelJS.Row, key: keyof typeof columnNames) => map[key] ? cellNum(row.getCell(map[key]!)) : null
    for (let i = header + 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i)
      const code = row.getCell(map.oz!)
      const oz = typeof code.value === 'number' && Number.isInteger(code.value) && /^0{2,}$/.test(code.numFmt)
        ? String(code.value).padStart(code.numFmt.length, '0') : code.text.trim()
      const shortText = read(row, 'title')
      const longText = read(row, 'description')
      if (!oz || (!shortText && !longText) || /^(?:summe|total|gesamt)/i.test(oz)) continue
      const title = (shortText || longText).split(/\r?\n/).find(line => line.trim())!.trim()
      const description = [...new Set([shortText, longText].filter(Boolean))].join('\n')
      const group = oz.split('.').slice(0, -1).join('.') || sheet.name
      positions.push(concreteRow({ id: 'p' + (positions.length + 1), oz, title, description,
        group, groupLabel: sheet.name, unit: read(row, 'unit'), quantity: num(row, 'quantity'),
        sourcePrice: num(row, 'price') ?? undefined, sourceTotal: num(row, 'total') ?? undefined,
        source: { location: sheet.name + ' · Zeile ' + i, text: description } }))
    }
  }
  return { title: filenameTitle(filename), format: 'Excel', positions, warnings }
}

export async function importLv(bytes: Buffer, filename: string): Promise<ImportResult> {
  const extension = filename.split('.').at(-1)?.toLowerCase() ?? ''
  let result: ImportResult
  if (extension === 'pdf') result = parsePdfText(await extractPdf(bytes), filename)
  else if (/^(x8[13456]|xml)$/.test(extension)) result = parseGaebXml(bytes.toString('utf8'), filename)
  else if (/^d8[13456]$/.test(extension)) result = parseLegacy(bytes, filename)
  else if (extension === 'xlsx') result = await parseExcel(bytes, filename)
  else throw new Error('Bitte eine PDF-, GAEB- oder XLSX-Datei auswählen.')
  if (!result.positions.length) throw new Error('Keine LV-Positionen erkannt. Bei reinen Scans bitte ein PDF mit Textschicht oder die GAEB-Datei verwenden.')
  if (result.positions.length > 20000) throw new Error('Diese Datei enthält mehr als 20.000 Positionen. Bitte nach Losen trennen.')
  return result
}
