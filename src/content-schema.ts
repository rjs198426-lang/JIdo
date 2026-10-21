import { z } from 'zod'
import { citySchema, placeSchema } from './guide-schema.ts'
export const MAX_CONTENT_BYTES = 8 * 1024 * 1024
export const contentManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sequence: z.number().int().positive(),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    file: z.string().regex(/^catalog-[a-f0-9]{64}\.json$/),
    bytes: z.number().int().positive().max(MAX_CONTENT_BYTES),
    minBuild: z.number().int().positive(),
    publishedAt: z.string().datetime(),
  })
  .strict()
  .refine(
    (v) => v.file === `catalog-${v.revision}.json`,
    '정보 파일과 해시가 다릅니다.',
  )
export const publicContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    cities: z.array(citySchema).min(1).max(300),
    places: z.array(placeSchema).max(10000),
  })
  .strict()
  .superRefine((v, context) => {
    const cityIds = new Set(v.cities.map((c) => c.id)),
      placeIds = new Set(v.places.map((p) => p.id))
    if (
      cityIds.size !== v.cities.length ||
      placeIds.size !== v.places.length ||
      v.places.some((p) => !cityIds.has(p.cityId))
    )
      context.addIssue({
        code: 'custom',
        message: '중복되거나 연결되지 않은 여행 정보입니다.',
      })
  })
export type PublicContent = z.infer<typeof publicContentSchema>
export type ContentManifest = z.infer<typeof contentManifestSchema>
