import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import ExcelJS from 'exceljs'
import { bestOffer, estimateRow, markupSuggestion, numberDE, offerAmount, summarize } from '../src/lib/estimate'
import { position, type Offer, type Project } from '../src/lib/model'
import { importLv, parseGaebXml, parsePdfText } from '../src/lib/import'
import { laborSuggestions, reviewRules } from '../src/lib/review'
import { parseShoppingResults } from '../src/lib/suppliers'
import { demoImport } from '../src/lib/demo'
import { exportAbgabe } from '../src/lib/report'

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
})

test('checks cover duplicate grouping and references without suppressing genuine alternatives', () => {
  const row = position({ id:'a',oz:'1.1.1',title:'Dach',description:'Dachhaut einbauen, siehe Pos. 1.1.99.', quantity:6, unit:'m²' })
  const other = { ...row, id:'b' }
  const findings = reviewRules([row,other])
  assert.equal(findings.filter(f=>f.type === 'reference').length,2)
  assert.deepEqual(findings.find(f=>f.type === 'duplicate')?.positionIds,['a','b'])
  assert.equal(other.included,true)
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
  assert.deepEqual(markupSuggestion(row,25), {proposed:30,unitPrice:130})
  const demo = demoImport()
  const project: Project = { ...demo, id:'demo', name:demo.title, positions:[row], findings:[], createdAt:'2026-11-21', revision:1, archivedAt:null,
    baseMarkup:25, vat:19, fileName:'Test.pdf', postcode:'', company:'OZ 404', demo:true, hasOriginal:false, analysis:{mode:'rules'} }
  assert.equal(summarize(project).gross,297.5)
  const report = await PDFDocument.load(await exportAbgabe(project))
  assert.equal(report.getPageCount(),3)
  assert.match(report.getTitle() || '', /Abgabe LV/)
})
