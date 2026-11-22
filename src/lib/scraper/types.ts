import { z } from 'zod'

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
  productUrl: z.string().trim().url().nullable().optional(),
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
  net_price: z.number().nonnegative(),
  gross_price: z.number().nonnegative(),
  shipping_cost: z.number().nonnegative().nullable(),
  currency: z.string().trim().min(1).max(12),
  supplier_name: z.string().trim().min(1).max(160),
  product_url: z.string().url(),
  scraped_at: z.string().datetime(),
})

export type MaterialPriceRecord = z.infer<typeof MaterialPriceRecordSchema>

export type PriceSourceRecord = {
  id: string
  name: string
  base_url: string
  adapter_type: string
  enabled: boolean
  created_at?: string
}

export interface PriceSourceAdapter {
  readonly type: string
  scrape(source: PriceSourceRecord): Promise<RawScrapedItem[]>
}
