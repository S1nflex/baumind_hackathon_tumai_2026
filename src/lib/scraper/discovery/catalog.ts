import { z } from 'zod'
import entries from '../query-catalog.json'

export const DiscoveryQuerySchema = z.object({
  query: z.string().trim().min(3).max(160),
  category: z.string().trim().min(1).max(80),
  keywords: z.array(z.string().trim().min(2)).min(1).max(12),
})

export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>

export const constructionQueryCatalog = DiscoveryQuerySchema.array().parse(entries)
