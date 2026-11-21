import { bestOffer } from './estimate'
import { position, type ImportResult, type Offer, type Position } from './model'

export function demoImport(): ImportResult {
  const defaults = { hours: null, rate: null, equipment: null, other: null }
  const input: { oz: string; group: string; label: string; title: string; quantity: number; unit: string; material: number;
    text?: string; page: number; market?: number }[] = [
    { oz:'6.1.10', group:'6.1', label:'Bürodach', title:'Windsog- und Windlastnachweis', quantity:1, unit:'psch', material:380, page:1 },
    { oz:'6.1.30', group:'6.1', label:'Bürodach', title:'Voranstrich und Dampfsperre', quantity:275, unit:'m²', material:11.5, page:1,
      text:'Untergrund vorbereiten. Dachanschluss an die Lichtkuppel, siehe Pos. 6.1.80.' },
    { oz:'6.1.40', group:'6.1', label:'Bürodach', title:'EPS-Dämmung, 180 mm', quantity:275, unit:'m²', material:28.4, page:1, market:38 },
    { oz:'6.1.60', group:'6.1', label:'Bürodach', title:'Glasvlies liefern und einbauen', quantity:275, unit:'m²', material:4.25, page:2 },
    { oz:'6.1.70', group:'6.1', label:'Bürodach', title:'PVC-P Dachabdichtungsbahn, 1,8 mm', quantity:275, unit:'m²', material:19.85, page:2 },
    { oz:'6.1.130', group:'6.1', label:'Bürodach', title:'RWA-Lichtkuppel, 125 × 125 cm', quantity:1, unit:'St', material:810, page:3,
      text:'Wärmegedämmte Lichtkuppel mit Aufsetzkranz. RWA-Motoröffner ist im Lieferumfang enthalten.' },
    { oz:'6.2.30', group:'6.2', label:'Ausbildungshalle', title:'Dampfsperrbahn auf Porenbeton', quantity:223, unit:'m²', material:8.9, page:5 },
    { oz:'6.2.50', group:'6.2', label:'Ausbildungshalle', title:'Dachabdichtungsbahn, 1,8 mm', quantity:223, unit:'m²', material:20.25, page:6 },
    { oz:'6.2.80', group:'6.2', label:'Ausbildungshalle', title:'Dachanschluss und Abdichtung von Durchdringungen', quantity:4, unit:'St', material:32, page:7 },
    { oz:'6.2.150', group:'6.2', label:'Ausbildungshalle', title:'Dachablauf mit Befestigungsflansch', quantity:4, unit:'St', material:159, page:7,
      text:'Dachablauf mit Befestigungsflansch, Geberit Pluvia, Art.-Nr. 359.105.00.1. Lieferung und Einbau.' },
    { oz:'6.2.180', group:'6.2', label:'Ausbildungshalle', title:'Wärmegedämmte Sicherungsanker', quantity:6, unit:'St', material:79, page:8,
      text:'Wärmegedämmte Sicherungsanker. Nach Montageplan befestigen.\nEinbauort: Dach Büro' },
    { oz:'6.3.20', group:'6.3', label:'Terrasse', title:'Voranstrich und Dampfsperre', quantity:30, unit:'m²', material:10.2, page:8 },
    { oz:'6.3.60', group:'6.3', label:'Terrasse', title:'Terrassenplatten im Splittbett', quantity:30, unit:'m²', material:30, page:10 },
  ]
  const positions: Position[] = input.map((item, i) => {
    const body = [item.title, item.text].filter(Boolean).join('\n')
    return position({ id:'p' + (i + 1), oz: item.oz, group: item.group, groupLabel: item.label,
      title: item.title, description: body, quantity: item.quantity, unit: item.unit,
      costs: { ...defaults, material: item.material }, marketPrice: item.market ?? null,
      marketSource: item.market ? 'Beispiel-Referenz für das Demo-Szenario' : undefined,
      source: { location: 'Übungs-LV · S. ' + item.page, text: body } })
  })
  const outlet = positions.find(row => row.oz === '6.2.150')!
  outlet.supplierQuery = '359.105.00.1'
  outlet.costs.hours = 1.5
  outlet.costs.rate = 52
  const offers: Offer[] = [
    { id:'demo-a', merchant:'Nord Baustoffe (Demo)', net:151.2, delivery:18, leadTime:'5 Werktage', title:'Geberit Pluvia 359.105.00.1', pack:1, minPacks:1,
      exact:true, source:'demo', checkedAt:'2026-11-21' },
    { id:'demo-b', merchant:'Süd Bedachung (Demo)', net:158.5, delivery:9.5, leadTime:'2 Werktage', title:'Geberit Pluvia 359.105.00.1', pack:1, minPacks:1,
      exact:true, source:'demo', checkedAt:'2026-11-21' },
    { id:'demo-c', merchant:'Direkt Dach (Demo)', net:145, delivery:36, leadTime:'10 Werktage', title:'Geberit Pluvia 359.105.00.1', pack:1, minPacks:5,
      exact:true, source:'demo', checkedAt:'2026-11-21' },
  ]
  outlet.offers = offers
  outlet.selectedOfferId = bestOffer(offers, outlet)?.id ?? null
  return { title:'Dachabdichtung · Ausbildungszentrum', positions, format:'Demo',
    warnings: [] }
}
