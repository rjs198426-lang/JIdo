import { z } from 'zod'
import { tripSchema, tripDestinations, destinationForDay } from './travel-model'
import { getPlace } from './catalog'
import { places as embeddedPlaces } from './data'
import { placeCoordinates } from './place-location'
const embeddedIds = new Set(embeddedPlaces.map((p) => p.id))
import { placeLibrarySchema } from './personal-place-library'
import { attachmentSchema } from './attachment-schema'
import { guideSchema, placeSchema } from './guide-schema'

const ids = z.array(z.string().min(1).max(100)).max(10000)
export const syncStoreSchema = z
  .object({
    version: z.literal(1),
    savedCities: ids,
    savedPlaces: ids,
    trips: z.array(tripSchema).max(500),
    placeLibrary: placeLibrarySchema.optional(),
  })
  .strict()
export const syncFileSchema = attachmentSchema
  .extend({ sha256: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict()
export const syncSnapshotSchema = z
  .object({
    store: syncStoreSchema,
    photos: z
      .record(
        z.string().regex(/^(city|place):[a-zA-Z0-9_-]{1,100}$/),
        attachmentSchema,
      )
      .refine((v) => Object.keys(v).length <= 200),
    catalog: z
      .object({
        available: z.array(guideSchema).max(1000),
        retained: z.array(guideSchema).max(1000),
        usingServer: z.boolean(),
      })
      .strict(),
    books: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            revision: z.string().regex(/^[a-f0-9]{64}$/),
            guide: guideSchema,
          })
          .strict(),
      )
      .max(300),
    retainedPlaces: z.array(placeSchema).max(10000),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const entries of [
      v.store.trips,
      v.catalog.available,
      v.catalog.retained,
      v.books,
      v.retainedPlaces,
      ...v.store.trips.flatMap((t) => t.days),
    ])
      if (new Set(entries.map((e) => e.id)).size !== entries.length)
        ctx.addIssue({
          code: 'custom',
          message: '동기화 자료 번호가 중복됐어요.',
        })
    if (
      Object.values(v.photos).some((p) => !p.mimeType.startsWith('image/')) ||
      v.books.some(
        (b) =>
          b.id !== b.guide.id ||
          !/^book-[a-z0-9-]+$/.test(b.id) ||
          b.guide.scope !== 'city' ||
          b.guide.status !== 'published' ||
          !b.guide.city.timeZone ||
          b.guide.city.image !== '/images/guide-placeholder.svg' ||
          b.guide.places.some(
            (p) =>
              !p.id.startsWith(b.id + '-') ||
              p.image !== '/images/place-placeholder.svg',
          ),
      )
    )
      ctx.addIssue({
        code: 'custom',
        message: '사진·가이드 연결을 확인해 주세요.',
      })
    if (
      new TextEncoder().encode(
        JSON.stringify({
          schemaVersion: 1,
          books: v.books.map(({ id: _, ...b }) => b),
          retainedPlaces: v.retainedPlaces,
        }),
      ).byteLength >
      4 * 1024 * 1024
    )
      ctx.addIssue({
        code: 'custom',
        message: '가이드북 저장 용량을 초과했어요.',
      })
  })
export type SyncSnapshot = z.infer<typeof syncSnapshotSchema>
export type SyncFile = z.infer<typeof syncFileSchema>
export const syncCommitSchema = z
  .object({
    format: z.literal('jido-drive-sync-v1'),
    minBuild: z.literal(81),
    id: z.string().uuid(),
    parents: z.array(z.string().uuid()).max(32),
    createdAt: z.string().datetime(),
    device: z.string().uuid(),
    snapshot: syncSnapshotSchema,
    files: z.array(syncFileSchema).max(5000),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      new Set(v.parents).size !== v.parents.length ||
      v.parents.includes(v.id) ||
      new Set(v.files.map((f) => f.id)).size !== v.files.length
    )
      ctx.addIssue({
        code: 'custom',
        message: '동기화 이력을 확인하지 못했어요.',
      })
    const files = new Map(v.files.map((f) => [f.id, f]))
    const referenced = [
      ...v.snapshot.store.trips.flatMap((t) => t.attachments || []),
      ...Object.values(v.snapshot.photos),
    ]
    for (const f of referenced) {
      const known = files.get(f.id)
      if (!known || known.size !== f.size || known.mimeType !== f.mimeType)
        ctx.addIssue({
          code: 'custom',
          message: '동기화 파일 목록이 일치하지 않아요.',
        })
    }
    const available = new Set(referenced.map((f) => f.id))
    for (const stop of v.snapshot.store.trips.flatMap((t) => t.days.flat()))
      if (
        stop.photoId &&
        !files.get(stop.photoId)?.mimeType.startsWith('image/')
      )
        ctx.addIssue({
          code: 'custom',
          message: '일정 사진의 원본 자료가 없어요.',
        })
    if (v.files.some((f) => !available.has(f.id)))
      ctx.addIssue({
        code: 'custom',
        message: '연결되지 않은 동기화 파일이 있어요.',
      })
  })
export type SyncCommit = z.infer<typeof syncCommitSchema>
function knownFields(original: unknown, parsed: unknown): boolean {
  if (Array.isArray(original))
    return (
      Array.isArray(parsed) &&
      original.length === parsed.length &&
      original.every((v, i) => knownFields(v, parsed[i]))
    )
  if (original && typeof original === 'object')
    return (
      !!parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.entries(original).every(
        ([k, v]) =>
          v === undefined ||
          (Object.hasOwn(parsed, k) &&
            knownFields(v, (parsed as Record<string, unknown>)[k])),
      )
    )
  return true
}
export function parseSyncSnapshot(value: unknown): SyncSnapshot {
  const parsed = syncSnapshotSchema.parse(value)
  if (!knownFields(value, parsed))
    throw new Error(
      '다른 버전의 기록이 있어요. 모든 기기를 최신 버전으로 업데이트한 뒤 동기화해 주세요.',
    )
  return parsed
}
export function parseSyncCommit(value: unknown): SyncCommit {
  const parsed = syncCommitSchema.parse(value)
  if (!knownFields(value, parsed))
    throw new Error(
      '다른 버전의 동기화 자료예요. 모든 기기의 앱을 업데이트해 주세요.',
    )
  return parsed
}
export function emptySyncSnapshot(): SyncSnapshot {
  return {
    store: { version: 1, savedCities: [], savedPlaces: [], trips: [] },
    photos: {},
    catalog: { available: [], retained: [], usingServer: false },
    books: [],
    retainedPlaces: [],
  }
}
export function syncFiles(snapshot: SyncSnapshot) {
  const files = new Map<string, z.infer<typeof attachmentSchema>>()
  for (const f of [
    ...snapshot.store.trips.flatMap((t) => t.attachments || []),
    ...Object.values(snapshot.photos),
  ]) {
    const known = files.get(f.id)
    if (known && (known.size !== f.size || known.mimeType !== f.mimeType))
      throw new Error('같은 자료 번호의 파일 정보가 달라요.')
    files.set(f.id, f)
  }
  return [...files.values()]
}
export function canonicalSnapshot(snapshot: SyncSnapshot): SyncSnapshot {
  return parseSyncSnapshot({
    ...snapshot,
    store: {
      ...snapshot.store,
      trips: snapshot.store.trips.map((t) => ({
        ...t,
        destinations: t.destinations || tripDestinations(t),
        dayDestinationIds:
          t.dayDestinationIds || t.days.map(() => tripDestinations(t)[0].id),
        days: t.days.map((day, index) =>
          day.map((stop) => {
            if (stop.custom || embeddedIds.has(stop.placeId)) return stop
            const place = getPlace(stop.placeId)
            if (!place) return stop
            return {
              ...stop,
              custom: {
                name: place.name,
                kind: place.category,
                address: place.address,
                link: '',
                destinationId: destinationForDay(t, index).id,
                catalogPlaceId: place.id,
                coordinates: placeCoordinates(place),
              },
            }
          }),
        ),
        ...(t.attachments
          ? {
              attachments: t.attachments.map((f) => ({
                ...f,
                storage: 'browser',
              })),
            }
          : {}),
      })),
    },
    photos: Object.fromEntries(
      Object.entries(snapshot.photos).map(([key, f]) => [
        key,
        { ...f, storage: 'browser' },
      ]),
    ),
  })
}
export function stableJson(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stableJson(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
export async function syncHash(bytes: Uint8Array | string) {
  const input =
    typeof bytes === 'string'
      ? new TextEncoder().encode(bytes)
      : new Uint8Array(bytes)
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', input)),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
