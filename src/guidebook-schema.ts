import { z } from 'zod'
export const GUIDEBOOK_MAX_BYTES = 512 * 1024
export const GUIDEBOOK_INDEX_MAX_BYTES = 256 * 1024
export const guidebookEntrySchema = z
  .object({
    id: z.string().regex(/^book-[a-z0-9-]+$/),
    name: z.string().min(1).max(80),
    english: z.string().max(100),
    country: z.string().min(1).max(80),
    summary: z.string().max(150),
    region: z.string().max(40),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    file: z.string().regex(/^book-[a-z0-9-]+-[a-f0-9]{64}\.json$/),
    bytes: z.number().int().positive().max(GUIDEBOOK_MAX_BYTES),
    updatedAt: z.string().datetime(),
    minBuild: z.number().int().positive(),
    placeCount: z.number().int().min(0).max(100),
  })
  .strict()
  .refine((v) => v.file === `${v.id}-${v.revision}.json`)
export const guidebookIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    updatedAt: z.string().datetime(),
    books: z.array(guidebookEntrySchema).max(300),
  })
  .strict()
  .refine((v) => new Set(v.books.map((b) => b.id)).size === v.books.length)
export type GuidebookEntry = z.infer<typeof guidebookEntrySchema>
export type GuidebookIndex = z.infer<typeof guidebookIndexSchema>
