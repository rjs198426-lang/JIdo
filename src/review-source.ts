import { z } from 'zod'

const httpsUrl = z
  .string()
  .max(1500)
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !url.username && !url.password
    } catch {
      return false
    }
  }, 'HTTPS 후기 출처가 필요합니다.')

export const reviewSourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: httpsUrl,
  kind: z.enum(['visit-review', 'traveler-guide']),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  license: z.enum(['CC BY-SA 3.0', 'CC BY-SA 4.0']).optional(),
  // This records an editorial check, not a guarantee about undisclosed payments.
  sponsorshipCheck: z.literal('no-disclosure-found'),
  screeningNote: z.string().trim().min(10).max(800),
})
export type ReviewSource = z.infer<typeof reviewSourceSchema>
