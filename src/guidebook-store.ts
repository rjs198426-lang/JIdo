import { z } from 'zod'
import { guideSchema, placeSchema, type Guide } from './guide-schema'
export const GUIDEBOOK_CACHE_KEY = 'jdo-guidebooks-v1'
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const schema = z
  .object({
    schemaVersion: z.literal(1),
    books: z.array(z.object({ revision: hash, guide: guideSchema })).max(300),
    retainedPlaces: z.array(placeSchema).max(10000),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = value.books.map((b) => b.guide.id)
    if (
      new Set(ids).size !== ids.length ||
      value.books.some((b) => !validBook(b.guide))
    )
      ctx.addIssue({
        code: 'custom',
        message: '가이드북 연결을 확인하지 못했어요.',
      })
  })
export function validBook(guide: Guide) {
  return (
    /^book-[a-z0-9-]+$/.test(guide.id) &&
    guide.scope === 'city' &&
    guide.status === 'published' &&
    !!guide.city.timeZone &&
    guide.city.image === '/images/guide-placeholder.svg' &&
    guide.places.every(
      (p) =>
        p.id.startsWith(guide.id + '-') &&
        p.image === '/images/place-placeholder.svg',
    )
  )
}
let original: string | null = null
let unreadable = false
const empty = () => ({
  schemaVersion: 1 as const,
  books: [] as { revision: string; guide: Guide }[],
  retainedPlaces: [] as z.infer<typeof placeSchema>[],
})
let snapshot: z.infer<typeof schema> = empty()
try {
  original = localStorage.getItem(GUIDEBOOK_CACHE_KEY)
  if (original) snapshot = schema.parse(JSON.parse(original))
} catch {
  unreadable = !!original
}
const listeners = new Set<() => void>()
export const guidebooksSnapshot = () => snapshot
export const guidebooksUnreadable = () => unreadable
export const subscribeGuidebooks = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function installGuidebook(guide: Guide, revision: string) {
  guide = guideSchema.parse(guide)
  hash.parse(revision)
  if (!validBook(guide)) throw new Error('지원하지 않는 가이드북입니다.')
  const previous = snapshot.books.find((book) => book.guide.id === guide.id)
  if (previous?.revision === revision) return
  if (
    previous &&
    Date.parse(previous.guide.updatedAt) > Date.parse(guide.updatedAt)
  )
    throw new Error(
      '기기에 더 최신 가이드북이 있어요. 기존 가이드북을 유지했어요.',
    )
  const oldPlaces = new Map(snapshot.retainedPlaces.map((p) => [p.id, p]))
  for (const previous of snapshot.books)
    for (const p of previous.guide.places) oldPlaces.set(p.id, p)
  const next = schema.parse({
    schemaVersion: 1,
    books: [
      ...snapshot.books.filter((b) => b.guide.id !== guide.id),
      { guide, revision },
    ],
    retainedPlaces: [...oldPlaces.values()],
  })
  const text = JSON.stringify(next)
  if (new TextEncoder().encode(text).byteLength > 4 * 1024 * 1024)
    throw new Error(
      '가이드북 저장 용량을 초과했어요. 기존 가이드북은 그대로 유지해요.',
    )
  try {
    if (localStorage.getItem(GUIDEBOOK_CACHE_KEY) !== original)
      throw new Error('stale guidebook cache')
    if (unreadable && original) {
      localStorage.setItem(
        `${GUIDEBOOK_CACHE_KEY}-unreadable-${crypto.randomUUID()}`,
        original,
      )
    }
    localStorage.setItem(GUIDEBOOK_CACHE_KEY, text)
  } catch {
    throw new Error(
      '가이드북을 저장하지 못했어요. 기기 저장 공간을 확인해 주세요. 기존 가이드와 여행은 그대로예요.',
    )
  }
  original = text
  unreadable = false
  snapshot = next
  for (const listener of listeners) listener()
}

export const isManagedGuidebook = (guide?: Guide) =>
  !!guide && snapshot.books.some((book) => book.guide === guide)
