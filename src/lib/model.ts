export type Origin = 'imported' | 'manual' | 'suggested'
export type PositionType = 'normal' | 'optional' | 'unit-only' | 'alternative'
export type Category = 'work' | 'material' | 'labor' | 'crew' | 'equipment' | 'other'
export type Format = 'PDF' | 'GAEB XML' | 'GAEB 90' | 'Excel' | 'Demo'

export type Source = { location: string; pages?: number[]; text: string }

export type Offer = {
  id: string
  merchant: string
  title: string
  url?: string
  net: number
  delivery: number | null
  pack: number
  minPacks: number
  leadTime?: string
  exact: boolean
  source: 'live' | 'demo' | 'manual'
  checkedAt: string
  confirmed?: boolean
}

export type Position = {
  id: string
  oz: string
  group: string
  groupLabel: string
  title: string
  description: string
  quantity: number | null
  unit: string
  type: PositionType
  origin: Origin
  category: Category
  source?: Source
  sourcePrice?: number
  sourceTotal?: number
  supplierQuery?: string
  parentId?: string
  trade?: string
  accepted: boolean
  included: boolean
  adjustment?: { quantity: number | null; unit: string }
  costs: { material: number | null; hours: number | null; rate: number | null; equipment: number | null; other: number | null }
  laborReference?: { value: number; label: string; url: string }
  overridePrice: number | null
  markup: number | null
  marketPrice: number | null
  marketSource?: string
  marketComparable?: boolean
  selectedOfferId: string | null
  offers: Offer[]
}

export type Finding = {
  id: string
  type: 'reference' | 'duplicate' | 'data' | 'mismatch' | 'scope' | 'price'
  title: string
  detail: string
  question?: string
  positionIds: string[]
  evidence: { positionId: string; location: string; quote: string }[]
  score: 'confirmed' | 'review'
  status: 'open' | 'resolved' | 'dismissed'
  resolution?: string
  createdBy: 'rule' | 'AI'
}

export type ImportResult = {
  title: string
  format: Format
  positions: Position[]
  pages?: number
  warnings: string[]
}

export type Project = ImportResult & {
  id: string
  name: string
  fileName: string
  createdAt: string
  archivedAt: string | null
  revision: number
  findings: Finding[]
  baseMarkup: number
  vat: number
  company: string
  postcode: string
  demo: boolean
  hasOriginal: boolean
  analysis: { mode: 'rules' | 'AI + rules'; status?: 'disabled' | 'applied' | 'partial' | 'unavailable'; note?: string }
}

export type ProjectListItem = Pick<Project, 'id' | 'name' | 'fileName' | 'format' | 'createdAt' | 'archivedAt' | 'demo'> & {
  count: number
  open: number
}

export type Preference = { trade: string; title: string; rate: number | null; uses: number }

export function position(fields: Pick<Position, 'id' | 'oz' | 'title'> & Partial<Position>): Position {
  return {
    group: '', groupLabel: '', quantity: null, unit: '', description: fields.title,
    type: 'normal', origin: 'imported', category: 'work', included: true, accepted: true,
    costs: { material: null, hours: null, rate: null, equipment: null, other: null },
    overridePrice: null, selectedOfferId: null, offers: [], markup: null, marketPrice: null,
    ...fields,
  }
}

export function normalizeOz(value: string) {
  return value.trim().replace(/\.{2,}/g, '.').replace(/\.$/, '')
}
