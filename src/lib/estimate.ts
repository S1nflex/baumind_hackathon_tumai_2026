import Decimal from 'decimal.js'
import type { Offer, Position, Project } from './model'

const d = (value: number) => new Decimal(value)
export const round = (value: Decimal, places = 2) => value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toNumber()

export function numberDE(value: string): number | null {
  const cleaned = value.trim().replace(/\s|€/g, '').replace(/[−–]/g, '-')
  if (!/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(cleaned)) return null
  const parsed = Number(cleaned.replaceAll('.', '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export function quantityOf(row: Position) { return row.adjustment ? row.adjustment.quantity : row.quantity }
export function unitOf(row: Position) { return row.adjustment?.unit ?? row.unit }

export function comparable(offer: Offer, row: Position) {
  const quantity = quantityOf(row)
  return (offer.exact || offer.confirmed) && offer.delivery !== null && quantity !== null && quantity > 0 &&
    (offer.confirmed || /^(st|stk|stück|pcs)\.?$/i.test(unitOf(row)))
}

export function offerAmount(offer: Offer, quantity: number) {
  const packs = Math.max(offer.minPacks, Math.ceil(d(quantity).div(offer.pack).toNumber()))
  return { packs, total: round(d(offer.net).times(packs).plus(offer.delivery ?? 0)) }
}

export function bestOffer(offers: Offer[], row: Position) {
  const quantity = quantityOf(row) ?? 0
  return offers.filter(offer => comparable(offer, row))
    .sort((a, b) => offerAmount(a, quantity).total - offerAmount(b, quantity).total)[0]
}

export function estimateRow(row: Position, baseMarkup: number) {
  const quantity = quantityOf(row)
  const offer = row.offers.find(item => item.id === row.selectedOfferId)
  const totalMaterial = offer && comparable(offer, row) && quantity !== null ? offerAmount(offer, quantity).total : null
  const material = totalMaterial !== null && quantity ? d(totalMaterial).div(quantity).toNumber() : row.costs.material
  const labor = row.costs.hours !== null && row.costs.rate !== null ? d(row.costs.hours).times(row.costs.rate).toNumber() : null
  const laborIncomplete = (row.costs.hours === null) !== (row.costs.rate === null)
  const components = { material, labor, equipment: row.costs.equipment, other: row.costs.other }
  const values = Object.values(components).filter(value => value !== null)
  const cost = values.length && !laborIncomplete ? values.reduce((sum, v) => sum.plus(v), d(0)).toNumber() : null
  const markup = row.markup ?? baseMarkup
  const computed = cost === null ? null : round(d(cost).times(d(markup).div(100).plus(1)), 3)
  const unitPrice = row.overridePrice ?? computed ?? row.sourcePrice ?? null
  const gross = quantity === null || unitPrice === null ? null : round(d(quantity).times(unitPrice))
  return { quantity, unitPrice, total: gross, cost, markup, components, laborIncomplete, totalMaterial }
}

export function summarize(project: Project) {
  const active = project.positions.filter(row => row.accepted && row.included)
  const rows = active.map(row => ({ row, calc: estimateRow(row, project.baseMarkup) }))
  const total = rows.reduce((sum, item) => sum.plus(item.calc.total ?? 0), d(0))
  const taxes = round(total.times(project.vat).div(100))
  const byGroup = new Map<string, number>()
  for (const { row, calc } of rows) {
    byGroup.set(row.group, round(d(byGroup.get(row.group) ?? 0).plus(calc.total ?? 0)))
  }
  const withoutPrice = project.positions.filter(row => row.accepted && (row.included || row.type === 'unit-only') &&
    (quantityOf(row) === null || !unitOf(row) || estimateRow(row, project.baseMarkup).unitPrice === null ||
      (estimateRow(row, project.baseMarkup).laborIncomplete && row.overridePrice === null))).length
  return {
    net: round(total), taxes, gross: round(total.plus(taxes)), byGroup, withoutPrice,
    open: project.findings.filter(finding => finding.status === 'open').length,
    calculated: rows.length - rows.filter(item => item.calc.total === null).length,
  }
}

export function markupSuggestion(row: Position, baseMarkup: number) {
  const estimate = estimateRow(row, baseMarkup)
  if (!row.marketPrice || !row.marketComparable || !row.marketSource || !estimate.cost || estimate.cost <= 0 ||
    row.overridePrice !== null || !row.included || !row.accepted || !estimate.quantity || estimate.quantity <= 0 ||
    estimate.unitPrice === null || estimate.total === null) return null
  const supported = d(row.marketPrice).div(estimate.cost).minus(1).times(100).floor().toNumber()
  const proposed = Math.min(supported, baseMarkup + 5, 100)
  if (proposed <= estimate.markup) return null
  const unitPrice = round(d(estimate.cost).times(d(proposed).div(100).plus(1)), 3)
  const revenueGain = round(d(round(d(estimate.quantity).times(unitPrice))).minus(estimate.total))
  if (revenueGain <= 0 || unitPrice > row.marketPrice) return null
  return { proposed, unitPrice, revenueGain }
}

export const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export const unitEur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 3 })
export const decimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 })
