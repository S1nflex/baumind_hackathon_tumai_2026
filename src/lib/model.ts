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
  source: 'live' | 'demo' | 'manual' | 'scraped'
  checkedAt: string
  confirmed?: boolean
  unit?: string
  packConfirmed?: boolean
  deliveryConfirmed?: boolean
  verification?: 'reference' | 'verified' | 'manual'
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
  /** A visible, UNVERIFIED AI scenario, never a real vendor quote. */
  provisionalPrice?: {min:number;max:number;suggested:number;unit:string;confidence:'low'|'medium';reason:string}
  markup: number | null
  marketPrice: number | null
  marketSource?: string
  marketComparable?: boolean
  selectedOfferId: string | null
  offers: Offer[]
}

export type Finding = {
  id: string
  type: 'reference' | 'duplicate' | 'data' | 'mismatch' | 'scope' | 'price' | 'link'
  title: string
  detail: string
  question?: string
  positionIds: string[]
  evidence: { positionId: string; location: string; quote: string }[]
  score: 'confirmed' | 'review'
  status: 'open' | 'resolved' | 'dismissed'
  resolution?: string
  createdBy: 'rule' | 'AI' | 'agent'
}

export type ImportResult = {
  title: string
  format: Format
  positions: Position[]
  pages?: number
  warnings: string[]
}

export type ScopeAgentResult = {
  status: 'applied' | 'unavailable'
  candidates: number
  searches: number
  read: number
}

export type IndicativePrice = {
  positionId: string
  oz: string
  title: string
  unit: string
  min: number
  max: number
  confidence: 'low' | 'medium'
  reason: string
}

export type Project = ImportResult & {
  id: string
  name: string
  fileName: string
  createdAt: string
  archivedAt: string | null
  shelvedAt?: string | null
  revision: number
  findings: Finding[]
  baseMarkup: number
  vat: number
  company: string
  postcode: string
  demo: boolean
  hasOriginal: boolean
  analysis: {
    mode: 'rules' | 'AI + rules'
    status?: 'disabled' | 'applied' | 'partial' | 'unavailable'
    provider?: 'anthropic' | 'openai'
    note?: string
    agent?: ScopeAgentResult
    market?: { estimates: IndicativePrice[]; note: string; checkedOffers: number; provider: string; queried?: number; positionsWithOffers?: number; refreshedAt?: string }
  }
}

export function normalizeOz(value: string) {
  return value.trim().replace(/\.{2,}/g, '.').replace(/\.$/, '')
}

export type ProjectListItem = Pick<Project, 'id' | 'name' | 'fileName' | 'format' | 'createdAt' | 'archivedAt' | 'shelvedAt' | 'demo'> & {
  count: number
  open: number
}

export type Preference = { trade: string; title: string; rate: number | null; uses: number }

export function position(fields: Pick<Position, 'id' | 'oz' | 'title'> & Partial<Position>): Position {
  return {
    group: '', groupLabel: '', quantity: null, unit: '', description: fields.title,
    type: 'normal', origin: 'imported', category: 'work', included: true, accepted: true,
    costs: { material: null, hours: null, rate: null, equipment: null, other: null },
    overridePrice: null, selectedOfferId: null, offers: [], markup: null, marketPrice: null, marketComparable: false,
    ...fields,
  }
}
