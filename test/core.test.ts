import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import ExcelJS from 'exceljs'
import { bestOffer, estimateRow, markupSuggestion, numberDE, offerAmount, summarize } from '../src/lib/estimate'
import { position, type Offer, type Project } from '../src/lib/model'
import { importLv, parseGaebXml, parsePdfText } from '../src/lib/import'
import { combineFindings, laborSuggestions, reviewRules } from '../src/lib/review'
import { parseShoppingResults } from '../src/lib/suppliers'
import { demoImport } from '../src/lib/demo'
import { exportAbgabe } from '../src/lib/report'
import { canUploadLv } from '../src/lib/upload'
import { catalogLookup } from '../src/lib/catalog'
import { scopeCandidates, searchScopePositions } from '../src/lib/scope-search'
import { validateScopeChecks } from '../src/lib/scope-agent'

test('German decimal, thousand separators and invalid unit text', () => {
  assert.equal(numberDE('1.300'), 1300)
  assert.equal(numberDE('9.304,105 €'), 9304.105)
  assert.equal(numberDE('3,5 m²'), null)
})

test('PDF preserves same-line, next-page and unit-only quantities', () => {
  const headings = 'OZ           Leistungsbeschreibung          Menge Einheit      Einheitspreis     Gesamtbetrag'
  const doc = headings + '\n1.1.10.         Material liefern\n                 Stahlsorte 1.4301\n' +
    '\f' + headings + '\n                 Weiterer Text\n                1.300 m²     ................   Nur Einh.-Pr.\n' +
    '1.1.20.         2,000 St                          3,500           7,00\n                 Montage'
  const parsed = parsePdfText(doc, 'Test.pdf')
  assert.deepEqual(parsed.positions.map(p=>[p.oz,p.quantity,p.sourcePrice,p.type]), [
    ['1.1.10',1300,undefined,'unit-only'],['1.1.20',2,3.5,'normal']])
  assert.deepEqual(parsed.positions[0].source?.pages,[1,2])
})

test('PDF accepts repeated OZ separators and keeps a quantity when the unit is blank', () => {
  const table = [
    'OZ           Leistungsbeschreibung          Menge Einheit      Einheitspreis     Gesamtbetrag',
    '2.6.         KG 456 Gefahrenmelde- und Alarmanlage',
    '2.6..1       Kommunikations-Stele',
    ' '.repeat(58) + '1,000           .........................   .........................',
    '2.6..2       Türstation',
    '             Anschluss an Pos. 2.6..1.',
    ' '.repeat(58) + '2,000 St        .........................   .........................',
  ].join('\n')
  const result = parsePdfText(table, 'Elektro.pdf')
  assert.deepEqual(result.positions.map(row => [row.oz, row.quantity, row.unit]),
    [['2.6.1', 1, ''], ['2.6.2', 2, 'St']])
  assert.equal(result.positions[0].groupLabel, 'KG 456 Gefahrenmelde- und Alarmanlage')
  assert.deepEqual(reviewRules(result.positions).map(finding => finding.type), ['data'])
})

test('GAEB preserves hierarchy, decimal quantity and rejects external declarations', () => {
  const xml = '<GAEB><Award><BoQ><BoQInfo><LblBoQ>Test</LblBoQ></BoQInfo><BoQBody><BoQCtgy RNoPart="01"><LblTx>Dach</LblTx><BoQBody><Itemlist><Item RNoPart="0010"><Qty>1.250</Qty><QU>m2</QU><Description><p>Material</p><p>Montage</p></Description></Item></Itemlist></BoQBody></BoQCtgy></BoQBody></BoQ></Award></GAEB>'
  const {positions:[row]} = parseGaebXml(xml,'test.X83')
  assert.equal(row.oz,'01.0010')
  assert.equal(row.description, 'Material\nMontage')
  assert.equal(row.quantity,1.25)
  assert.throws(() => parseGaebXml('<!DOCTYPE some>' + xml,'test.xml'))
})

test('Excel imports text OZ, numeric quantity and cached formula results', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dach')
  sheet.addRow(['OZ','Beschreibung','Menge','Einheit','EP','GP'])
  sheet.addRow(['01.01.0010','Dachbahnen',1234.25,'m²',21.5,{formula:'C2*E2',result:26536.375}])
  const data = await importLv(Buffer.from(await workbook.xlsx.writeBuffer()),'test.xlsx')
  assert.equal(data.positions[0].oz,'01.01.0010')
  assert.equal(data.positions[0].quantity,1234.25)
  assert.equal(data.positions[0].sourceTotal,26536.375)
  const second = workbook.addWorksheet('Sanitär')
  second.addRow(['Positionsnummer', 'Kurztext', 'Langtext', 'Menge Soll', 'Einheit (ME)', 'Einheitspreis netto (€)'])
  second.addRow([34, 'Dachablauf', 'Montage in Abschnitt B', 2, 'St', 60]).getCell(1).numFmt = '0000'
  const multi = await importLv(Buffer.from(await workbook.xlsx.writeBuffer()), 'Mehrere Blätter.xlsx')
  assert.equal(multi.positions.length, 2)
  assert.deepEqual(multi.positions.slice(1).map(row => [row.oz, row.quantity, row.sourcePrice, row.description]),
    [['0034', 2, 60, 'Dachablauf\nMontage in Abschnitt B']])
})

test('checks cover duplicate grouping and references without suppressing genuine alternatives', () => {
  const row = position({ id:'a',oz:'1.1.1',title:'Dach',description:'Dachhaut einbauen, siehe Pos. 1.1.99.', quantity:6, unit:'m²' })
  const other = { ...row, id:'b' }
  const findings = reviewRules([row,other])
  assert.equal(findings.filter(f=>f.type === 'reference').length,2)
  assert.deepEqual(findings.find(f=>f.type === 'duplicate')?.positionIds,['a','b'])
  assert.equal(other.included,true)
})

test('conflicting WC installation dimensions are found with exact evidence without GPT', () => {
  const supply = position({ id: 'a', oz: '8.1', group: '8', title: 'Wand-WC in barrierefreier Kabine', quantity: 1, unit: 'St',
    description: 'Für dasselbe Wand-WC ist eine Ausladung von 700 mm gefordert.' })
  const install = position({ id: 'b', oz: '8.2', group: '8', title: 'Montage des gleichen Wand-WC', quantity: 1, unit: 'St',
    description: 'Für dieses Wand-WC ist eine Ausladung von 540 mm verbindlich.' })
  const checks = (rows: typeof supply[]) => reviewRules(rows).filter(finding => finding.title === 'Abweichende Ausladung beim WC')
  const [issue] = checks([supply, install])
  assert.deepEqual(issue.evidence.map(item => item.quote), ['Ausladung von 700 mm', 'Ausladung von 540 mm'])
  assert.equal(issue.createdBy, 'rule')
  assert.equal(issue.score, 'review')
  const repeated = { ...issue, id: 'ai-1', createdBy: 'AI' as const, evidence: issue.evidence.map(evidence =>
    ({ ...evidence, quote: 'Text mit ' + evidence.quote })) }
  const different = { ...repeated, id: 'ai-2', evidence: repeated.evidence.map(evidence =>
    ({ ...evidence, quote: 'Anschluss am Bauwerk' })) }
  assert.deepEqual(combineFindings([issue], [repeated, different]).map(finding => finding.id), [issue.id, 'ai-2'])
  const extended = { ...issue, evidence: [...issue.evidence, { positionId: supply.id, location: 'S. 1', quote: supply.title }] }
  assert.deepEqual(combineFindings([extended], [repeated]).map(finding => finding.id), [issue.id])
  assert.equal(checks([supply, { ...install, group: '9' }]).length, 0)
  assert.equal(checks([supply, { ...install, description: '70 cm Ausladung für das Wand-WC.' }]).length, 0)
  assert.equal(checks([supply, { ...install, description: 'Mindestens 54 cm Ausladung.' }]).length, 0)
  assert.equal(checks([supply, { ...install, description: install.description + ' Montage des gleichen Wand-WC aus Pos. 8.1.', group: '9' }])[0].score, 'confirmed')
})

test('supplier selection uses delivered pack cost, exact model and shipping', () => {
  const source: Offer = {id:'a',title:'Dachablauf',merchant:'A',net:100,delivery:5,pack:1,minPacks:1,source:'demo',exact:true,checkedAt:'2026-11-21'}
  const row = position({id:'a',oz:'1.1.1',title:'Dachablauf',quantity:4,unit:'St'})
  const cheaperSticker = {...source,id:'b',net:80,minPacks:6}
  assert.equal(offerAmount(cheaperSticker,4).total,485)
  assert.equal(bestOffer([cheaperSticker,{...source,id:'x',net:20,delivery:null},{...source,id:'y',net:7,exact:false},source],row)?.id,'a')
  const parsed = parseShoppingResults([
    {source:'Händler',title:'Dachablauf 359.105.00.1',price:'119,00 €',extracted_price:119,
      delivery:'Kostenloser Versand',product_link:'https://example.org/'},
  ],'359105001','2026-11-21')
  assert.equal(parsed[0]?.net,100)
  assert.equal(parsed[0]?.delivery,0)
  assert.equal(parsed[0]?.exact,true)
})

test('suggested trade is grounded, provisional and picks an approved known crew', () => {
  const p = position({id:'a',oz:'1.1.1',title:'Lichtkuppel',description:'RWA-Motoröffner vorhanden.',quantity:1,unit:'St'})
  const [row] = laborSuggestions([p],[{trade:'Elektro',title:'Elektroteam Nord',rate:51,uses:3}])
  assert.equal(row.origin,'suggested')
  assert.equal(row.category,'crew')
  assert.equal(row.costs.rate,51)
  assert.equal(row.accepted,false)
  assert.equal(estimateRow(row,25).cost,null)
})

test('markups require a sourced benchmark and project rounds net and VAT', async () => {
  const row = position({id:'p',oz:'1.1.1',title:'Dacharbeiten',quantity:2,unit:'St',costs:{material:100,hours:null,rate:null,equipment:null,other:null}, marketPrice:130})
  assert.equal(markupSuggestion(row,25),null)
  row.marketSource = 'Testangebot für denselben Umfang'
  assert.equal(markupSuggestion(row,25),null)
  row.marketComparable = true
  assert.deepEqual(markupSuggestion(row,25), {proposed:30,unitPrice:130,revenueGain:10})
  assert.equal(markupSuggestion({ ...row, marketPrice:160, markup:30 },25),null)
  assert.equal(estimateRow({ ...row, markup:30 },25).cost, estimateRow(row,25).cost)
  const demo = demoImport()
  const project: Project = { ...demo, id:'demo', name:demo.title, positions:[row], findings:[], createdAt:'2026-11-21', revision:1, archivedAt:null,
    baseMarkup:25, vat:19, fileName:'Test.pdf', postcode:'', company:'OZ 404', demo:true, hasOriginal:false, analysis:{mode:'rules'} }
  assert.equal(summarize(project).gross,297.5)
  const report = await PDFDocument.load(await exportAbgabe(project))
  assert.equal(report.getPageCount(),1)
  assert.equal((await PDFDocument.load(await exportAbgabe(project, 'internal'))).getPageCount(), 1)
  assert.match(report.getTitle() || '', /Abgabe LV/)
})

test('all three LV formats are accepted and catalog matches come from dimensions and model references', () => {
  for (const file of ['LV.PDF', 'LV.XLSX', 'LV.X83', 'LV.d86', 'LV.XML']) assert.ok(canUploadLv(file))
  assert.equal(canUploadLv('LV.xlsx.zip'), false)
  const lookup = catalogLookup({ title: 'Tiefspül-WC', description: 'Mit 70 cm Ausladung, Breite: 355 mm, wandhängend, barrierefrei, KeraTect.' })
  assert.equal(lookup?.product?.sku, '208520600')
  assert.match(lookup?.specs ?? '', /Ausladung 700 mm.*Breite 355 mm/)
  assert.match(lookup?.product?.url ?? '', /^https:\/\/catalog\.geberit\.de\//)
  assert.equal(catalogLookup({ title: 'WC-Sitz', description: 'für Wand-WC' }), null)
  assert.equal(catalogLookup({ title: 'Tiefspül-WC', description: '45 cm Ausladung, barrierefrei' })?.product, undefined)
})

test('scope agent searches distant sections and verifies read evidence before linking them', () => {
  const roof = position({ id: 'roof', oz: '1.1', group: 'Dach', groupLabel: 'Dach',
    title: 'RWA-Lichtkuppel Treppenhaus Nord', description: 'Der Elektroanschluss des RWA-Antriebs ist bauseits.' })
  const electric = position({ id: 'electric', oz: '9.5', group: 'ELT', groupLabel: 'Elektro',
    title: 'Elektroanschluss RWA Treppenhaus Nord', description: 'Wir stellen den Elektroanschluss der RWA-Lichtkuppel im Treppenhaus Nord her.' })
  const ignore = Array.from({length: 60}, (_, i) => position({
    id: 'fill' + i, oz: '2.' + i, group: 'Ausbau', title: 'Sockelleisten im Flur',
  }))
  const positions = [roof, ...ignore, electric]
  assert.deepEqual(scopeCandidates(positions).map(row => row.id), ['roof', 'electric'])
  assert.equal(searchScopePositions(positions, roof, ['RWA', 'Elektroanschluss'])[0].id, 'electric')
  const sources = new Map([['Z1', { row: roof, quote: roof.description }], ['Z2', { row: electric, quote: electric.description }]])
  const linked = { kind: 'linked' as const, title: 'Elektroanschluss zugeordnet',
    detail: 'Der Elektroanschluss der RWA-Lichtkuppel ist in der Elektroposition enthalten.', question: null, evidence: ['Z1', 'Z2'] }
  const searches = new Map([['roof', new Set(['electric'])]])
  assert.equal(validateScopeChecks([linked], sources, searches, new Set()).length, 0)
  assert.equal(validateScopeChecks([linked], sources, new Map(), new Set(['electric'])).length, 0)
  const [finding] = validateScopeChecks([linked], sources, searches, new Set(['electric']))
  assert.equal(finding.type, 'link')
  assert.equal(finding.status, 'resolved')
  assert.equal(finding.createdBy, 'agent')
  assert.equal(finding.evidence[1].quote, electric.description)
  const conflictSources = new Map([
    ['Z1', { row: roof, quote: 'Der RWA-Elektroanschluss ist in der Dachdeckerposition nicht enthalten.' }],
    ['Z2', { row: electric, quote: 'Der RWA-Elektroanschluss ist nicht Teil der Elektroinstallation und muss in der Dachdeckerposition enthalten sein.' }],
  ])
  const [conflict] = validateScopeChecks([linked], conflictSources, searches, new Set(['electric']))
  assert.equal(conflict.type, 'mismatch')
  assert.equal(conflict.status, 'open')
  const openText = 'Die Zuständigkeit für Anschluss und Inbetriebnahme ist zu klären.'
  const [question] = validateScopeChecks([], new Map([['Z3', { row: roof, quote: openText }]]),
    new Map([['roof', new Set()]]), new Set())
  assert.equal(question.type, 'scope')
  assert.equal(question.evidence[0].quote, openText)

  assert.equal(validateScopeChecks([{ ...linked, evidence: ['Z1', 'Z9'] }], sources, searches, new Set(['electric'])).length, 0)

})
