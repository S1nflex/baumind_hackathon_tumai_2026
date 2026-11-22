export function stripPdfPageFurniture(line: string) {
  if (/^\s*(?:LV-Datum\s*:\s*\d[\d.]*)\s*$/i.test(line) ||
    /^\s*\[(?:PERSON|FIRMA)_\d+\]\s+Seite\s*:\s*\d+\s*$/i.test(line) ||
    /^\s*(?:Pos-Nr\.\s+\(Pos-\s*Menge|Nr\.\)\s*(?:EUR\s*){0,2}$)/i.test(line)) return ''
  if (/^\s*Nr\.\)/i.test(line)) return line.replace(/^\s*Nr\.\)\s*/i, '').replace(/\s*EUR\s+EUR\s*$/i, '')
  return line.replace(/\s+Einheit\s+Einheitspreis\s+in\s+Gesamtpreis\s+in\s*$/i, '')
}
