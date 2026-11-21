import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { position, type Position } from '@/lib/model'
import { bestOffer, comparable, quantityOf } from '@/lib/estimate'
import { findSuppliers } from '@/lib/suppliers'
import { errorResponse } from '@/lib/http'
import { workspaceId } from '@/lib/workspace'
import { finalizeProject, ProjectError, requireProject, updateProject } from '@/lib/store'

export const runtime = 'nodejs'
type Ctx = { params: Promise<{ id: string }> }

const id = z.string().min(1).max(160)
const money = z.number().min(0).max(100000000)
const cost = money.nullable()
const costs = z.object({ material: cost, hours: cost, rate: cost, equipment: cost, other: cost })
const rowValues = z.object({
  quantity: z.number().min(-100000000).max(100000000).nullable().optional(), unit: z.string().trim().max(12).optional(),
  costs: costs.optional(), markup: z.number().min(0).max(300).nullable().optional(),
  overridePrice: z.number().min(-100000000).max(100000000).nullable().optional(),
  marketPrice: cost.optional(), marketSource: z.string().trim().max(230).optional(),
  included: z.boolean().optional(),
})
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('row'), rowId: id, values: rowValues }),
  z.object({ action: z.literal('add'), title: z.string().trim().min(2).max(140), category: z.enum(['work','material','labor','crew','equipment','other']),
    group: z.string().trim().max(60), quantity: money, unit: z.string().trim().min(1).max(12),
    price: cost, trade: z.string().trim().max(40), note: z.string().trim().max(1600) }),
  z.object({ action: z.literal('suggestion'), rowId: id, accept: z.boolean() }),
  z.object({ action: z.literal('finding'), findingId: id, status: z.enum(['open','resolved','dismissed']),
    resolution: z.string().trim().max(800), keepId: id.optional() }),
  z.object({ action: z.literal('search'), rowId: id, query: z.string().trim().min(2).max(130) }),
  z.object({ action: z.literal('offer'), rowId: id, offerId: id.nullable(), confirm: z.boolean().optional(),
    delivery: cost.optional(), pack: z.number().positive().max(100000).optional(), minPacks: z.number().int().positive().max(10000).optional() }),
  z.object({ action: z.literal('manualOffer'), rowId: id, merchant: z.string().trim().min(2).max(80), net: money,
    delivery: money, pack: z.number().positive().max(100000), minPacks: z.number().int().positive().max(10000),
    leadTime: z.string().trim().max(100), url: z.string().trim().max(500).refine(url => !url || /^https?:\/\//i.test(url)) }),
  z.object({ action: z.literal('settings'), name: z.string().trim().min(2).max(120), company: z.string().trim().max(120),
    postcode: z.string().max(5).regex(/^(?:|\d{5})$/), markup: z.number().min(0).max(300), vat: z.number().min(0).max(100) }),
  z.object({ action: z.literal('finalize') }),
])

export async function GET(_request: Request, { params }: Ctx) {
  try { return Response.json({ project: requireProject(await workspaceId(), (await params).id) }) }
  catch (error) { return errorResponse(error) }
}

function requiredRow(rows: Position[], rowId: string) {
  const row = rows.find(position => position.id === rowId)
  if (!row) throw new ProjectError('Position nicht gefunden.', 404)
  return row
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const workspace = await workspaceId()
    const projectId = (await params).id
    const value = await request.json()
    const action = actionSchema.parse(value)
    const revision = z.number().int().positive().parse(value.revision)
    let search: Awaited<ReturnType<typeof findSuppliers>> | undefined
    if (action.action === 'search') {
      const active = requireProject(workspace, projectId)
      if (active.archivedAt || active.revision !== revision) throw new ProjectError('Der Projektstand hat sich geändert.', 409)
      const row = requiredRow(active.positions, action.rowId)
      try { search = await findSuppliers(action.query, row, active.postcode) }
      catch { throw new ProjectError('Preis-Suchdienst nicht erreichbar. Bitte später erneut versuchen.', 502) }
    }
    const project = updateProject(workspace, projectId, revision, current => {
      switch (action.action) {
        case 'row': {
          const row = requiredRow(current.positions, action.rowId)
          const { quantity, unit, ...update } = action.values
          if (quantity !== undefined || unit !== undefined) row.adjustment = { quantity: quantity === undefined ? quantityOf(row) : quantity,
            unit: unit ?? row.adjustment?.unit ?? row.unit }
          if (update.marketPrice && !(update.marketSource ?? row.marketSource)) throw new ProjectError('Bitte eine Quelle für den Marktpreis angeben.')
          if (row.type === 'unit-only') delete update.included
          Object.assign(row, update)
          break
        }
        case 'add': {
          const label = current.positions.find(row => row.group === action.group)?.groupLabel
          const number = 1 + current.positions.filter(row => row.origin === 'manual').length
          const labor = action.category === 'labor' || action.category === 'crew'
          current.positions.push(position({ id: randomUUID(), oz: 'E-' + String(number).padStart(3, '0'),
            title: action.title, description: action.note || action.title, origin: 'manual', category: action.category,
            group: action.group || 'Ergänzungen', groupLabel: label ?? (action.group || 'Ergänzungen'),
            quantity: action.quantity, unit: action.unit, trade: action.trade || undefined,
            costs: {
              material: action.category === 'material' ? action.price : null,
              hours: labor && action.price !== null ? 1 : null,
              rate: labor ? action.price : null,
              equipment: action.category === 'equipment' ? action.price : null,
              other: action.category === 'other' || action.category === 'work' ? action.price : null,
            },
          }))
          break
        }
        case 'suggestion': {
          const row = requiredRow(current.positions, action.rowId)
          if (row.origin !== 'suggested') throw new ProjectError('Diese Position ist kein Vorschlag.')
          row.accepted = action.accept
          row.included = action.accept
          break
        }
        case 'finding': {
          const item = current.findings.find(finding => finding.id === action.findingId)
          if (!item) throw new ProjectError('Prüfpunkt nicht gefunden.', 404)
          if (action.status !== 'open' && !action.resolution) throw new ProjectError('Bitte eine kurze Begründung eintragen.')
          if (action.keepId) {
            if (item.type !== 'duplicate' || !item.positionIds.includes(action.keepId)) throw new ProjectError('Diese Position gehört nicht zur Dublette.')
            for (const row of current.positions) if (item.positionIds.includes(row.id) && row.id !== action.keepId) row.included = false
          }
          item.status = action.status
          item.resolution = action.resolution
          break
        }
        case 'search': {
          const row = requiredRow(current.positions, action.rowId)
          const offers = new Map(row.offers.map(offer => [offer.id, offer]))
          for (const offer of search?.offers ?? []) {
            const saved = offers.get(offer.id)
            if (!saved?.confirmed && row.selectedOfferId !== offer.id) offers.set(offer.id, offer)
          }
          row.offers = [...offers.values()].slice(0, 100)
          if (!row.selectedOfferId) row.selectedOfferId = bestOffer(row.offers, row)?.id ?? null
          break
        }
        case 'offer': {
          const row = requiredRow(current.positions, action.rowId)
          if (action.offerId === null) { row.selectedOfferId = null; break }
          const offer = row.offers.find(item => item.id === action.offerId)
          if (!offer) throw new ProjectError('Lieferantenangebot nicht gefunden.', 404)
          if (action.confirm) {
            offer.confirmed = true
            if (action.delivery !== undefined) offer.delivery = action.delivery
            if (action.pack !== undefined) offer.pack = action.pack
            if (action.minPacks !== undefined) offer.minPacks = action.minPacks
          }
          if (!comparable(offer, row)) throw new ProjectError('Bitte Einheit, Packungsgröße und Lieferkosten bestätigen.')
          row.selectedOfferId = offer.id
          row.overridePrice = null
          break
        }
        case 'manualOffer': {
          const row = requiredRow(current.positions, action.rowId)
          if (row.offers.length >= 100) throw new ProjectError('Diese Position enthält bereits 100 Angebote.')
          row.offers.push({ id: randomUUID(), merchant: action.merchant, title: row.title, source: 'manual',
            net: action.net, delivery: action.delivery, pack: action.pack, minPacks: action.minPacks,
            url: action.url || undefined, leadTime: action.leadTime || undefined, checkedAt: new Date().toISOString(), exact: true, confirmed: true })
          if (!row.selectedOfferId && row.overridePrice === null) row.selectedOfferId = bestOffer(row.offers, row)?.id ?? null
          break
        }
        case 'settings': {
          current.name = action.name
          current.company = action.company
          current.postcode = action.postcode
          current.baseMarkup = action.markup
          current.vat = action.vat
          break
        }
        case 'finalize': finalizeProject(workspace, current)
      }
    })
    return Response.json({ project, note: search?.note })
  } catch (error) { return errorResponse(error) }
}
