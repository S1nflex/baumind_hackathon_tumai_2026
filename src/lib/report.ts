import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import Decimal from 'decimal.js'
import { decimal, estimateRow, eur, round, summarize, unitEur, unitOf } from './estimate'
import type { Project } from './model'

const colors = { ink: rgb(.10,.14,.17), dim: rgb(.32,.37,.4), rule: rgb(.83,.87,.87), shade: rgb(.94,.96,.95), teal: rgb(.02,.35,.32) }
const width = 595.28, height = 841.89, left = 44, right = width - left
const safe = (str: string) => str.normalize().replace(/[^\u0020-\u007e\u00a0-\u00ff€–—‘’“”•…]/g, ' ').replace(/\u00a0/g, ' ')
const fmt = (value: number | null) => value === null ? '–' : eur.format(value)
const stamp = (iso: string) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium' }).format(new Date(iso))

function splitLines(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    let line = ''
    for (const token of safe(paragraph).split(/\s+/).filter(Boolean)) {
      let word = token
      if (line && font.widthOfTextAtSize(line + ' ' + word, size) > maxWidth) { lines.push(line); line = '' }
      while (word && font.widthOfTextAtSize(word, size) > maxWidth) {
        let cut = word.length - 1
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--
        lines.push(word.slice(0, cut))
        word = word.slice(cut)
      }
      if (word) line += (line ? ' ' : '') + word
    }
    if (line) lines.push(line)
  }
  return lines
}

export async function exportAbgabe(project: Project) {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Abgabe LV · ' + project.name)
  pdf.setCreator('BauMind')
  pdf.setSubject(project.archivedAt ? 'Freigegebene Angebotskalkulation' : 'Entwurf zur Angebotskalkulation')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const totals = summarize(project)
  const date = stamp(project.archivedAt ?? new Date().toISOString())
  const status = (project.archivedAt ? 'FREIGEGEBEN' : 'ENTWURF') + (project.demo ? ' · ÜBUNGSDATEN' : '')
  const included = project.positions.filter(row => row.accepted && (row.included || row.type === 'unit-only'))

  let page!: PDFPage
  let y = 0
  const txt = (value: string, x: number, at: number, size = 10, strong = false, color = colors.ink) =>
    page.drawText(safe(value), { x, y: at, size, font: strong ? bold : font, color })
  const align = (value: string, x: number, at: number, size = 10, strong = false) =>
    txt(value, x - (strong ? bold : font).widthOfTextAtSize(safe(value), size), at, size, strong)
  const rule = (at: number) => page.drawLine({ start: { x: left, y: at }, end: { x: right, y: at }, color: colors.rule, thickness:.6 })
  const wrapped = (value: string, x: number, maxWidth: number, size: number, lineHeight: number, strong = false) => {
    for (const line of splitLines(value, strong ? bold : font, size, maxWidth)) {
      txt(line, x, y, size, strong)
      y -= lineHeight
    }
  }
  function newPage(title: string) {
    page = pdf.addPage([width, height])
    txt('BAUMIND / ANGEBOT', left, 795, 10, true, colors.teal)
    align(status, right, 795, 9, true)
    rule(782)
    y = 752
    wrapped(title, left, right - left, 22, 27, true)
    wrapped(project.name + '  ·  ' + date, left, right - left, 10, 15)
    y -= 12
  }
  function groupHeader(text: string) {
    const lines = splitLines(text, bold, 10, right - left - 12)
    const extra = Math.max(0, lines.length - 1) * 12
    page.drawRectangle({ x: left, y: y - 6 - extra, width: right - left, height: 20 + extra, color: colors.shade })
    for (const line of lines) {
      txt(line, left + 6, y, 10, true)
      y -= 12
    }
    y -= 12
  }
  function tableHead() {
    y -= 5
    txt('OZ', left, y, 9, true)
    txt('Leistungsbeschreibung', 97, y, 9, true)
    align('Menge / ME', 392, y, 9, true)
    align('EP netto', 466, y, 9, true)
    align('GP netto', right, y, 9, true)
    rule(y - 7)
    y -= 24
  }
  const summaryRow = (name: string, amount: string, strong = false) => {
    if (y < 95) newPage('Zusammenstellung (Fortsetzung)')
    txt(name, left, y, 10, strong)
    align(amount, right, y, 11, strong)
    rule(y - 8)
    y -= 25
  }

  newPage('Abgabe Leistungsverzeichnis')
  wrapped('Bieter: ' + (project.company || '________________________________________'), left, right - left, 11, 18)
  wrapped('Referenz: ' + project.fileName, left, right - left, 10, 15)
  y -= 12
  groupHeader('Zusammenstellung')
  const groups = Array.from(new Map(included.filter(row => row.included).map(row => [row.group, row.groupLabel])).entries())
  for (const [id, label] of groups) {
    if (y < 110) newPage('Zusammenstellung (Fortsetzung)')
    for (const line of splitLines(id + '   ' + label, font, 10, 360)) { txt(line, left, y, 10); y -= 13 }
    align(fmt(totals.byGroup.get(id) ?? 0), right, y + 13)
    rule(y - 3)
    y -= 11
  }
  summaryRow('Angebotssumme netto', fmt(totals.net), true)
  summaryRow('Umsatzsteuer ' + decimal.format(project.vat) + ' %', fmt(totals.taxes))
  summaryRow('Angebotssumme brutto', fmt(totals.gross), true)
  y -= 15
  if (!project.archivedAt) wrapped('Entwurf: ' + totals.open + ' offene Prüfpunkte, ' + totals.withoutPrice + ' Positionen ohne vollständige Preisgrundlage.',
    left, right-left, 10, 14)
  if (y < 120) newPage('Angebotsabschluss')
  y -= 25
  rule(y)
  txt('Ort / Datum', left, y - 18, 9, false, colors.dim)
  txt('Unterschrift / Firmenstempel', 335, y - 18, 9, false, colors.dim)

  newPage('Kalkulationsübersicht')
  wrapped('Direkte Kosten, soweit separat erfasst. Übernommene Einheitspreise und manuelle Angebotspreise werden ohne erfundene Aufschlüsselung ausgewiesen.',
    left, right - left, 10, 15)
  y -= 16
  const breakdown = { material: new Decimal(0), labor: new Decimal(0), equipment: new Decimal(0), other: new Decimal(0), unallocated: new Decimal(0), uplift: new Decimal(0) }
  for (const row of included.filter(row => row.included)) {
    const calc = estimateRow(row, project.baseMarkup)
    if (calc.quantity === null || calc.total === null) continue
    if (calc.cost === null || row.overridePrice !== null) { breakdown.unallocated = breakdown.unallocated.plus(calc.total); continue }
    for (const key of ['material','labor','equipment','other'] as const) {
      breakdown[key] = breakdown[key].plus(new Decimal(calc.components[key] ?? 0).times(calc.quantity))
    }
    breakdown.uplift = breakdown.uplift.plus(new Decimal(calc.total).minus(new Decimal(calc.cost).times(calc.quantity)))
  }
  const categories = [['Stoffkosten / Material','material'],['Eigene Lohnkosten','labor'],['Gerätekosten','equipment'],
    ['Sonstige Kosten / Nachunternehmer','other'],['Preise ohne Aufschlüsselung','unallocated'],['Zuschläge inkl. Rundung','uplift']] as const
  const allocated = categories.slice(0, -1).reduce((n, [, key]) => n.plus(round(breakdown[key])), new Decimal(0))
  for (const [name,key] of categories) summaryRow(name, fmt(key === 'uplift' ? round(new Decimal(totals.net).minus(allocated)) : round(breakdown[key])))
  summaryRow('Angebotssumme netto', fmt(totals.net), true)

  newPage('Leistungsverzeichnis')
  tableHead()
  let group = ''
  for (const row of included) {
    const calc = estimateRow(row, project.baseMarkup)
    if (group !== row.group) {
      if (y < 128) { newPage('Leistungsverzeichnis'); tableHead() }
      group = row.group
      groupHeader(row.group + '   ' + row.groupLabel)
    }
    if (y < 112) { newPage('Leistungsverzeichnis'); tableHead() }
    const title = splitLines(row.title, bold, 9, 218)
    txt(row.oz, left, y, 9, true)
    align(calc.quantity === null ? '–' : decimal.format(calc.quantity) + ' ' + unitOf(row), 392, y, 9)
    align(calc.unitPrice === null ? '–' : unitEur.format(calc.unitPrice), 466, y, 9)
    align(row.included ? fmt(calc.total) : 'Nur EP', right, y, 9, true)
    for (const line of title) {
      if (y < 80) { newPage('Leistungsverzeichnis · OZ ' + row.oz); tableHead() }
      txt(line, 97, y, 9, true)
      y -= 12
    }
    const description = row.description === row.title ? '' : row.description.startsWith(row.title + '\n') ? row.description.slice(row.title.length + 1) : row.description
    const originText = row.origin === 'imported' ? '' : row.origin === 'manual' ? 'Ergänzt durch Kalkulation.' : 'Bestätigte vorgeschlagene Position.'
    const lines = splitLines([description, originText].filter(Boolean).join('\n'), font, 9, right - 97)
    for (const line of lines) {
      if (y < 76) { newPage('Leistungsverzeichnis · OZ ' + row.oz); tableHead() }
      txt(line, 97, y, 9)
      y -= 12
    }
    rule(y - 1)
    y -= 15
  }

  if (project.findings.length) {
    newPage('Prüfvermerk')
    for (const item of project.findings) {
      if (y < 120) newPage('Prüfvermerk (Fortsetzung)')
      const lines = splitLines(item.title + '\n' + item.detail + '\n' + (item.resolution || item.question || 'Offen'), font, 10, right - left)
      for (const line of lines) {
        if (y < 76) newPage('Prüfvermerk (Fortsetzung)')
        txt(line, left, y, 10)
        y -= 14
      }
      y -= 12
    }
  }

  const pages = pdf.getPages()
  pages.forEach((current, index) => {
    page = current
    rule(55)
    txt(project.demo ? 'BauMind • Übungsunterlagen' : 'BauMind • Angebotsunterlagen', left, 37, 9, false, colors.dim)
    align(String(index + 1) + ' / ' + pages.length, right, 37, 9)
  })
  return pdf.save()
}
