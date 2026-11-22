import { z } from 'zod'

const safeHttpsUrl = z.string().trim().url().refine(value => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
}, 'URL must use credential-free HTTPS')

export const RawScrapedItemSchema = z.object({
  sku: z.string().trim().min(1).max(160).nullable().optional(),
  materialName: z.string().trim().min(1).max(240),
  netPrice: z.union([z.number(), z.string()]).nullable().optional(),
  grossPrice: z.union([z.number(), z.string()]).nullable().optional(),
  shippingCost: z.union([z.number(), z.string()]).nullable().optional(),
  currency: z.string().trim().min(1).max(12).optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  packSize: z.union([z.number(), z.string()]).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  supplierName: z.string().trim().max(160).nullable().optional(),
  productUrl: safeHttpsUrl.nullable().optional(),
})

export type RawScrapedItem = z.infer<typeof RawScrapedItemSchema>

export const MaterialPriceRecordSchema = z.object({
  source_id: z.string().uuid(),
  sku: z.string().trim().min(1).max(160),
  material_name: z.string().trim().min(1).max(240),
  normalized_name: z.string().trim().min(1).max(240),
  category: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(40),
  pack_size: z.number().positive().nullable(),
  net_price: z.number().positive(),
  gross_price: z.number().positive(),
  shipping_cost: z.number().nonnegative().nullable(),
  currency: z.string().trim().min(1).max(12),
  supplier_name: z.string().trim().min(1).max(160),
  product_url: safeHttpsUrl,
  scraped_at: z.string().datetime(),
})

export type MaterialPriceRecord = z.infer<typeof MaterialPriceRecordSchema>

export const PriceSourceRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  base_url: safeHttpsUrl,
  adapter_type: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
  created_at: z.string().optional(),
})

export type PriceSourceRecord = z.infer<typeof PriceSourceRecordSchema>

export interface PriceSourceAdapter {
  readonly type: string
  scrape(source: PriceSourceRecord): Promise<RawScrapedItem[]>
}
