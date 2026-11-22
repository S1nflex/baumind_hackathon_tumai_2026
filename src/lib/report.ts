import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import Decimal from 'decimal.js'
import { decimal, estimateRow, eur, round, summarize, unitEur, unitOf } from './estimate'
import type { Project } from './model'
import { stripPdfPageFurniture } from './pdf-text'

export type ReportKind = 'short' | 'long' | 'internal'

const ink = rgb(.10, .15, .19)
const muted = rgb(.33, .39, .42)
const line = rgb(.81, .85, .85)
const accent = rgb(.08, .30, .25)
const tint = rgb(.93, .96, .95)
const width = 595.28, height = 841.89, left = 43, right = width - left
const bottom = 66
const clean = (value: string) => value.normalize().replace(/[−–]/g, '–').replace(/[∅⌀]/g, 'Ø').replace(/≤/g, '<=')
  .replace(/≥/g, '>=').replace(/≈/g, 'ca. ').replace(/[^\u0020-\u007e\u00a0-\u00ff€–—‘’“”•…]/g, ' ').replace(/\u00a0/g, ' ')
const amount = (value: number | null) => value === null ? '–' : eur.format(value)
const dateFormat = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium' })

function splitLines(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = []
  const fits = (value: string) => font.widthOfTextAtSize(value, size) <= maxWidth
  for (const paragraph of text.split(/\r?\n/)) {
    let current = ''
    for (const token of clean(paragraph).split(/\s+/).filter(Boolean)) {
      let word = token
      if (current && !fits(current + ' ' + word)) { lines.push(current); current = '' }
      while (!fits(word)) {
        let cut = word.length - 1
        while (cut > 1 && !fits(word.slice(0, cut))) cut--
        lines.push(word.slice(0, cut))
        word = word.slice(cut)
      }
      if (word) current += (current ? ' ' : '') + word
    }
    if (current) lines.push(current)
  }
  return lines
}

export async function exportAbgabe(project: Project, kind: ReportKind = 'short') {
  const pdf = await PDFDocument.create()
  const internal = kind === 'internal'
  const status = (project.archivedAt ? 'FREIGEGEBEN' : 'ENTWURF') + (project.demo ? ' · ÜBUNGSDATEN' : '')
  const date = dateFormat.format(new Date(project.archivedAt ?? new Date().toISOString()))
  pdf.setTitle((internal ? 'Interne Kalkulation' : 'Abgabe LV') + ' · ' + project.name)
  pdf.setSubject(status)
  pdf.setCreator('Bauton LV')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const totals = summarize(project)
  const included = project.positions.filter(row => row.accepted && (row.included || row.type === 'unit-only'))
  const sections = new Map<string, { label: string; rows: typeof included }>()
  for (const row of included) {
    const existing = sections.get(row.group)
    if (existing) existing.rows.push(row)
    else sections.set(row.group, { label: row.groupLabel, rows: [row] })
  }

  let page!: PDFPage
  let y = 0
  const draw = (value: string, x: number, at: number, size = 10, font = regular, color = ink) =>
    page.drawText(clean(value), { x, y: at, size, font, color })
  function cell(value: string, from: number, to: number, at: number, size = 9, font = regular, alignRight = false) {
    const measure = font.widthOfTextAtSize(clean(value), size)
    const adjusted = measure > to - from ? size * (to - from) / measure : size
    draw(value, alignRight ? to - Math.min(measure, to - from) : from, at, adjusted, font)
  }
  const rule = (at: number, from = left, to = right) =>
    page.drawLine({ start: { x: from, y: at }, end: { x: to, y: at }, color: line, thickness: .65 })
  const strip = (at: number, h: number) => page.drawRectangle({ x: left, y: at, width: right - left, height: h, color: tint })
  function wrapped(text: string, size = 10, font = regular, max = right - left) {
    for (const part of splitLines(text, font, size, max)) {
      draw(part, left, y, size, font)
      y -= size + 4
    }
  }
  function newPage(title: string) {
    page = pdf.addPage([width, height])
    draw(internal ? 'BAUTON LV  /  INTERN' : 'BAUTON LV  /  ANGEBOT', left, 796, 10, bold, accent)
    cell(status, 320, right, 796, 9, bold, true)
    rule(781)
    y = 750
    wrapped(title, 23, bold)
    cell(project.name, left, right, y - 1, 10)
    y -= 25
  }
  function sectionLabel(label: string) {
    const lines = splitLines(label, bold, 9.5, right - left - 16)
    const h = Math.max(lines.length, 1) * 13 + 9
    strip(y - h + 12, h)
    for (const content of lines) {
      draw(content, left + 8, y - 2, 9.5, bold, accent)
      y -= 13
    }
    y -= 12
  }
  function summaryRow(name: string, value: string, strong = false) {
    const labels = splitLines(name, strong ? bold : regular, 10, right - left - 127)
    const h = Math.max(1, labels.length) * 13 + 8
    if (y - h < bottom) newPage(internal ? 'Kalkulation · Fortsetzung' : 'Zusammenstellung · Fortsetzung')
    if (strong) strip(y - h + 11, h)
    cell(value, right - 118, right - 6, y - 1, 10, strong ? bold : regular, true)
    for (const label of labels) { draw(label, left + 6, y - 1, 10, strong ? bold : regular); y -= 13 }
    rule(y + 3)
    y -= 8
  }

  if (internal) {
    newPage('Interne Kalkulation')
    wrapped('Bieter: ' + (project.company || '–') + '   ·   Stand: ' + date)
    const breakdown = { material: new Decimal(0), labor: new Decimal(0), equipment: new Decimal(0), other: new Decimal(0), unallocated: new Decimal(0) }
    for (const row of included) {
      if (!row.included) continue
      const calc = estimateRow(row, project.baseMarkup)
      if (calc.quantity === null || calc.total === null) continue
      if (calc.cost === null || row.overridePrice !== null) {
        breakdown.unallocated = breakdown.unallocated.plus(calc.total)
        continue
      }
      for (const key of ['material', 'labor', 'equipment', 'other'] as const) {
        breakdown[key] = breakdown[key].plus(new Decimal(calc.components[key] ?? 0).times(calc.quantity))
      }
    }
    y -= 14
    sectionLabel('Kosten und Zuschläge netto')
    const keys = [['Material', 'material'], ['Eigene Lohnkosten', 'labor'], ['Geräte', 'equipment'],
      ['Sonstiges und Nachunternehmer', 'other'], ['Übernommene Preise ohne Aufschlüsselung', 'unallocated']] as const
    for (const [label, key] of keys) summaryRow(label, amount(round(breakdown[key])))
    const allocated = keys.reduce((total, [, key]) => total.plus(round(breakdown[key])), new Decimal(0))
    summaryRow('Zuschläge inkl. Rundung', amount(round(new Decimal(totals.net).minus(allocated))))
    summaryRow('Angebotssumme netto', amount(totals.net), true)
    if (project.findings.length) {
      y -= 24
      if (y < 170) newPage('Prüfprotokoll')
      sectionLabel('Prüfprotokoll')
      const codes = new Map(project.positions.map(row => [row.id, row.oz]))
      for (const finding of project.findings) {
        if (y < 140) newPage('Prüfprotokoll · Fortsetzung')
        const label = finding.positionIds.map(id => codes.get(id)).filter(Boolean).join(', ')
        wrapped((label ? label + '  ' : '') + finding.title, 10, bold)
        for (const part of splitLines(finding.detail + '\n' + (finding.resolution || finding.question || (finding.type === 'link' ? 'Zugeordnet' : 'Offen')), regular, 10, right - left)) {
          if (y < bottom + 12) newPage('Prüfprotokoll · Fortsetzung')
          draw(part, left, y)
          y -= 14
        }
        rule(y + 4)
        y -= 11
      }
    }
  } else {
    newPage('Abgabe-Leistungsverzeichnis')
    wrapped('Bieter: ' + (project.company || '________________________________________'), 11, bold)
    wrapped('Bezug: ' + project.fileName)
    wrapped('Angebotsdatum: ' + date)
    y -= 15
    sectionLabel('Angebotssumme')
    summaryRow('Netto', amount(totals.net))
    summaryRow('Umsatzsteuer ' + decimal.format(project.vat) + ' %', amount(totals.taxes))
    summaryRow('Brutto', amount(totals.gross), true)
    y -= 10
    if (!project.archivedAt && totals.withoutPrice) wrapped('Vorläufige Summe · ' + totals.withoutPrice + ' Position(en) mit offenen Mengen-, Einheiten- oder Preisangaben.', 9)
    y -= 33
    rule(y, left, 227)
    rule(y, 291, right)
    draw('Ort / Datum', left, y - 13, 9, regular, muted)
    draw('Unterschrift / Firmenstempel', 291, y - 13, 9, regular, muted)
    y -= 47
    if (sections.size) {
      sectionLabel('Zusammenstellung nach Abschnitten')
      for (const [code, section] of sections) {
        summaryRow([code, section.label].filter(Boolean).join('  '), amount(totals.byGroup.get(code) ?? null))
      }
    }

    const descX = 121, qtyLeft = 319, qtyRight = 373, unitX = 382, epLeft = 410, epRight = 477, gpLeft = 485
    const title = kind === 'long' ? 'Leistungsverzeichnis · Langfassung' : 'Leistungsverzeichnis · Kurzfassung'
    function tableHead() {
      strip(y - 9, 21)
      draw('OZ', left + 4, y - 2, 9, bold)
      draw('Leistungsbeschreibung', descX, y - 2, 9, bold)
      cell('Menge', qtyLeft, qtyRight, y - 2, 9, bold, true)
      draw('ME', unitX, y - 2, 9, bold)
      cell('EP netto', epLeft, epRight, y - 2, 9, bold, true)
      cell('GP netto', gpLeft, right - 4, y - 2, 9, bold, true)
      rule(y - 9)
      y -= 25
    }
    function tablePage(section?: string) {
      newPage(title)
      if (section) sectionLabel(section + ' · Fortsetzung')
      tableHead()
    }
    if (included.length && y >= bottom + 160) {
      y -= 10
      wrapped(title, 14, bold)
      tableHead()
    } else if (included.length) {
      tablePage()
    }
    for (const [code, section] of sections) {
      const label = [code, section.label].filter(Boolean).join('  ') || 'Leistungen'
      if (y < bottom + 73) tablePage()
      sectionLabel(label)
      for (const row of section.rows) {
        const calc = estimateRow(row, project.baseMarkup)
        const rowTitle = project.format === 'PDF' ? stripPdfPageFurniture(row.title) : row.title
        const heading = splitLines(rowTitle || row.oz, bold, 9, qtyLeft - descX - 6)
        const longText = row.description === row.title ? '' : row.description.startsWith(row.title + '\n') ?
          row.description.slice(row.title.length + 1) : row.description
        const description = project.format === 'PDF' ? longText.split(/\r?\n/).map(stripPdfPageFurniture).join('\n') : longText
        const detail = kind === 'long' ? splitLines(description, regular, 9, right - descX - 5) : []
        const required = Math.min(96, heading.length * 12 + 20 + (detail.length ? 12 : 0))
        if (y - required < bottom) tablePage(label)
        cell(row.oz, left + 4, descX - 11, y, 9, bold)
        cell(calc.quantity === null ? '–' : decimal.format(calc.quantity), qtyLeft, qtyRight, y, 9, regular, true)
        cell(unitOf(row) || '–', unitX, epLeft - 5, y, 9)
        cell(calc.unitPrice === null ? '–' : unitEur.format(calc.unitPrice), epLeft, epRight, y, 9, regular, true)
        cell(row.included ? amount(calc.total) : 'Nur EP', gpLeft, right - 4, y, 9, bold, true)
        for (const [font, lines] of [[bold, heading], [regular, detail]] as const) {
          for (const part of lines) {
            if (y < bottom + 10) {
              tablePage(label)
              cell(row.oz, left + 4, descX - 11, y, 9, bold)
            }
            draw(part, descX, y, 9, font)
            y -= 12
          }
        }
        rule(y + 4)
        y -= 8
      }
      if (y < bottom + 30) tablePage(label)
      draw('Abschnittssumme netto', descX, y - 1, 9, bold)
      cell(amount(totals.byGroup.get(code) ?? null), gpLeft, right - 4, y - 1, 9, bold, true)
      y -= 27
    }
  }

  const pages = pdf.getPages()
  pages.forEach((current, index) => {
    page = current
    rule(54)
    draw(project.demo ? 'Übungsdaten' : internal ? 'Intern · Kalkulation und Prüfung' : 'Abgabe-LV · ' + date, left, 36, 9, regular, muted)
    cell('Seite ' + (index + 1) + ' / ' + pages.length, 440, right, 36, 9, regular, true)
  })
  return pdf.save()
}
