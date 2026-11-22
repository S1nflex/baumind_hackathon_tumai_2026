import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import Decimal from 'decimal.js'
import { importLv } from '../src/lib/import'
import { reviewRules } from '../src/lib/review'

const pairs = [
  { pdf: 'LV-Ausdruck-[PROJEKT_004].pdf', reference: 'GAEB-[PROJEKT_004].X83', label: 'Trenching', expected: 50 },
  { pdf: 'HEM2301-2_Gesamt-LV.pdf', reference: '8209.003_Leistungsverzeichnis_leer.X83', label: 'Plant engineering', expected: 159 },
  { pdf: 'Angebot AN24-0305.pdf', reference: 'Angebot AN24-0305.D84', label: 'Priced bid', expected: 274 },
  { pdf: 'Abgabe LV.pdf', reference: '[NUMMER_001]_leer.X83', label: 'Abgabe LV', expected: 248 },
]
const normUnit = (u: string) => {
  const normalized = u.toLowerCase().replaceAll('²', '2').replaceAll('³', '3').replace(/[.\s]/g, '')
  return ['a','j','jr','jahr','jahre'].includes(normalized) ? 'jahr' : normalized
}
const normId = (id: string) => id.replace(/\.$/, '').split('.').map(part => part.replace(/^0+(?=\d)/, '')).join('.')

async function main() {
  const root = process.argv[2]
  if (!root) throw new Error('Usage: npm run benchmark -- "/path/to/Challenge A Dataset"')
  const read = async (file: string) => importLv(await readFile(join(root, file)), file)
  let count = 0, quantities = 0, units = 0, prices = 0, priced = 0, failures = 0
  const rows = []
  for (const pair of pairs) {
    const start = performance.now()
    const [pdf, reference] = await Promise.all([read(pair.pdf), read(pair.reference)])
    const map = new Map(reference.positions.map(row => [normId(row.oz), row]))
    let found = 0, q = 0, u = 0, p = 0, check = 0
    const mismatches: string[] = []
    for (const row of pdf.positions) {
      const expected = map.get(normId(row.oz))
      if (!expected) { mismatches.push(row.oz + ' unknown OZ'); continue }
      map.delete(normId(row.oz))
      found++
      if (expected.quantity === row.quantity) q++
      else mismatches.push(row.oz + ' qty ' + row.quantity + ' vs ' + expected.quantity)
      if (normUnit(expected.unit) === normUnit(row.unit)) u++
      else mismatches.push(row.oz + ' unit ' + row.unit + ' vs ' + expected.unit)
      if (expected.sourcePrice !== undefined) {
        check++
        if (expected.sourcePrice === row.sourcePrice && expected.sourceTotal === row.sourceTotal) p++
        else mismatches.push(row.oz + ' priced fields differ')
      }
    }
    rows.push({ pair:pair.label, pages:pdf.pages, matched: found + '/' + pair.expected, quantities:q + '/' + pair.expected,
      units:u + '/' + pair.expected, 'EP+GP': check ? p + '/' + check : '–', ms:Math.round(performance.now()-start) })
    if (map.size || pdf.positions.length !== pair.expected || mismatches.length || found !== pair.expected) {
      failures++
      console.log(pair.label, 'missing OZ', [...map.keys()].slice(0,30), 'differences', mismatches.slice(0,30))
    }
    count += found
    quantities += q
    units += u
    prices += p
    priced += check
  }
  console.table(rows)
  const cover = await read('Abgabe LV.pdf')
  const total = cover.positions.reduce((sum,row) => sum.plus(row.sourceTotal ?? 0),new Decimal(0))
  console.log('Abgabe LV: sum of imported source GP = ' + total.toFixed(2) + ' EUR; printed summary = 835804.22 EUR')
  assert.equal(total.toFixed(2), '835804.22')
  const roof = await read('LV_12_Dachabdichtung.pdf')
  const findings = reviewRules(roof.positions)
  const broken = findings.filter(finding => finding.type === 'reference' && finding.title.endsWith('6.1.80'))
  const conflict = findings.filter(finding => finding.type === 'mismatch' && finding.evidence.some(item => item.quote.includes('Dach Büro')))
  assert.equal(roof.positions.length, 33)
  assert.equal(broken.length, 2)
  assert.equal(conflict.length, 1)
  console.log('Roof gold checks: 33 positions, 2 missing-reference mentions, 1 section/location conflict.')
  let opened = 0, positions = 0, missing = 0
  const files = (await readdir(root)).filter(name => /\.pdf$/i.test(name)).sort()
  const start = performance.now()
  for (const file of files) {
    try {
      const result = await read(file)
      opened++
      positions += result.positions.length
      missing += result.positions.filter(row => row.quantity === null || !row.unit).length
    } catch (error) {
      console.log('Unable to import', file, error instanceof Error ? error.message : '')
    }
  }
  console.log('Corpus smoke test: ' + opened + '/' + files.length + ' PDFs, ' + positions + ' parsed positions, ' +
    missing + ' incomplete quantities or units, ' + Math.round(performance.now()-start) + ' ms.')
  console.log('Verified pair matches: ' + count + ' OZ, ' + quantities + ' quantities, ' + units + ' units, ' +
    prices + '/' + priced + ' complete price rows.')
  assert.equal(failures, 0)
}
main().catch(error => {console.error(error);process.exitCode = 1})
