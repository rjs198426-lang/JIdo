import { registerPlugin } from '@capacitor/core'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { z } from 'zod'
import { attachmentSchema, type Attachment } from './attachment-schema'
import {
  browserBlob,
  storeBrowserFile,
  deleteStoredAttachment,
  isAndroid,
} from './attachment-storage'
import {
  personalPhotosSnapshot,
  replacePersonalPhotos,
} from './personal-photos'
import { portableTrip } from './TravelBackup'
import { tripSchema, type Trip } from './travel-model'
import type { TravelStore } from './store'

export const NativeBackup = registerPlugin<{
  saveDocument(options: {
    text: string
    format?: 'recovery'
  }): Promise<{ cancelled: boolean }>
  exportArchive(options: { manifest: string }): Promise<{ cancelled: boolean }>
  inspectArchive(): Promise<{
    cancelled?: boolean
    token?: string
    manifest?: string
  }>
  commitArchive(options: {
    token: string
  }): Promise<{ files: (Attachment & { sourceId: string })[] }>
  discardArchive(options: { token: string }): Promise<void>
}>('TravelBackup')
const fileSchema = attachmentSchema.extend({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
})
const manifestSchema = z.object({
  format: z.literal('jido-full-backup'),
  version: z.literal(1),
  createdAt: z.string().datetime(),
  trips: z.array(tripSchema).max(500),
  personalPhotos: z
    .record(
      z.string().regex(/^(city|place):[a-zA-Z0-9_-]{1,100}$/),
      attachmentSchema,
    )
    .refine((p) => Object.keys(p).length <= 200),
  files: z.array(fileSchema).max(5000),
})
export type FullManifest = z.infer<typeof manifestSchema>
export type BackupPreview = {
  manifest: FullManifest
  token?: string
  bytes?: Record<string, Uint8Array>
}
const BROWSER_LIMIT = 128 * 1024 * 1024
const digest = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
function validate(value: unknown) {
  const manifest = manifestSchema.parse(value)
  if (!manifest.trips.length && !Object.keys(manifest.personalPhotos).length)
    throw new Error('백업할 여행이나 사진이 없습니다.')
  const files = new Map(manifest.files.map((f) => [f.id, f]))
  const used = new Set<string>()
  if (files.size !== manifest.files.length)
    throw new Error('백업 자료 번호가 중복되었습니다.')
  const check = (file: Attachment) => {
    used.add(file.id)
    const actual = files.get(file.id)
    if (
      !actual ||
      actual.size !== file.size ||
      actual.mimeType !== file.mimeType
    )
      throw new Error('백업 자료의 연결·크기가 일치하지 않습니다.')
  }
  for (const photo of Object.values(manifest.personalPhotos)) {
    check(photo)
    if (!photo.mimeType.startsWith('image/'))
      throw new Error('대표 사진 형식이 올바르지 않습니다.')
  }
  for (const trip of manifest.trips) {
    for (const file of trip.attachments || []) check(file)
    for (const stop of trip.days.flat())
      if (
        stop.photoId &&
        !trip.attachments?.some(
          (file) =>
            file.id === stop.photoId && file.mimeType.startsWith('image/'),
        )
      )
        throw new Error('일정 대표 사진의 연결을 확인하세요.')
  }
  if (used.size !== files.size)
    throw new Error('연결되지 않은 백업 자료가 있습니다.')
  return manifest
}
export function fullManifest(trips: Trip[]) {
  const photos = personalPhotosSnapshot()
  const files = new Map<string, Attachment>()
  for (const file of [
    ...trips.flatMap((t) => t.attachments || []),
    ...Object.values(photos),
  ]) {
    const old = files.get(file.id)
    if (old && (old.size !== file.size || old.mimeType !== file.mimeType))
      throw new Error('같은 자료 번호의 파일 정보가 다릅니다.')
    files.set(file.id, file)
  }
  if (files.size > 5000)
    throw new Error('전체 백업에는 최대 5,000개 파일을 담을 수 있어요.')
  return {
    format: 'jido-full-backup' as const,
    version: 1 as const,
    createdAt: new Date().toISOString(),
    trips: trips.map((trip) => {
      const portable = portableTrip(trip)
      return {
        ...portable,
        cityId: trip.cityId,
        attachments: trip.attachments,
        days: portable.days.map((day, i) =>
          day.map((stop, j) => ({ ...stop, photoId: trip.days[i][j].photoId })),
        ),
      }
    }),
    personalPhotos: photos,
    files: [...files.values()],
  }
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
export async function exportFullBackup(trips: Trip[]) {
  const manifest = fullManifest(trips)
  if (isAndroid())
    return NativeBackup.exportArchive({ manifest: JSON.stringify(manifest) })
  if (manifest.files.reduce((n, f) => n + f.size, 0) > BROWSER_LIMIT)
    throw new Error(
      '브라우저 백업은 128MB 이하입니다. 큰 백업은 Android 앱에서 저장하세요.',
    )
  const entries: Record<string, Uint8Array> = {},
    files: FullManifest['files'] = []
  for (const file of manifest.files) {
    const blob = await browserBlob(file)
    if (blob.size !== file.size)
      throw new Error(`${file.name}: 자료 크기가 달라요.`)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    entries[`files/${file.id}`] = bytes
    files.push({ ...file, sha256: await digest(bytes) })
  }
  const final = validate({ ...manifest, files })
  entries['manifest.json'] = strToU8(JSON.stringify(final))
  const zip = zipSync(entries, { level: 0 })
  downloadBlob(
    new Blob([new Uint8Array(zip)], { type: 'application/zip' }),
    'JDo-full-backup.zip',
  )
  return { cancelled: false }
}
export async function inspectFullBackup(
  file?: File,
): Promise<BackupPreview | undefined> {
  if (isAndroid()) {
    const result = await NativeBackup.inspectArchive()
    if (result.cancelled) return
    if (!result.token || !result.manifest)
      throw new Error('백업을 읽지 못했습니다.')
    try {
      return {
        manifest: validate(JSON.parse(result.manifest)),
        token: result.token,
      }
    } catch (error) {
      await NativeBackup.discardArchive({ token: result.token }).catch(() => {})
      throw error
    }
  }
  if (!file) return
  if (file.size > BROWSER_LIMIT)
    throw new Error('브라우저에서는 128MB 이하의 백업을 선택하세요.')
  let size = 0,
    count = 0
  const names = new Set<string>()
  const bytes = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      if (
        names.has(entry.name) ||
        ++count > 5001 ||
        (!/^files\/[a-fA-F0-9-]{36}$/.test(entry.name) &&
          entry.name !== 'manifest.json')
      )
        throw new Error('백업 파일 경로가 올바르지 않습니다.')
      names.add(entry.name)
      size += entry.originalSize
      if (
        entry.originalSize >
          (entry.name === 'manifest.json'
            ? 10 * 1024 * 1024
            : 25 * 1024 * 1024) ||
        size > BROWSER_LIMIT
      )
        throw new Error('백업 압축 해제 크기가 너무 큽니다.')
      return true
    },
  })
  if (!bytes['manifest.json']) throw new Error('J★Do 전체 백업이 아닙니다.')
  const manifest = validate(JSON.parse(strFromU8(bytes['manifest.json'])))
  if (Object.keys(bytes).length !== manifest.files.length + 1)
    throw new Error('백업 파일 목록을 확인하세요.')
  for (const item of manifest.files) {
    const data = bytes[`files/${item.id}`]
    if (
      !data ||
      data.length !== item.size ||
      (await digest(data)) !== item.sha256
    )
      throw new Error(`${item.name}: 백업 자료가 손상됐어요.`)
  }
  return { manifest, bytes }
}
export async function restoreBackupFiles(preview: BackupPreview) {
  const created: Attachment[] = []
  try {
    const mapping = new Map<string, Attachment>()
    if (preview.token) {
      const response = await NativeBackup.commitArchive({
        token: preview.token,
      })
      for (const raw of response.files) {
        const file = attachmentSchema.parse(raw)
        created.push(file)
        if (mapping.has(raw.sourceId))
          throw new Error('복원 자료 번호가 중복되었습니다.')
        mapping.set(raw.sourceId, file)
      }
    } else {
      for (const old of preview.manifest.files) {
        const bytes = preview.bytes?.[`files/${old.id}`]
        if (!bytes) throw new Error('자료가 누락됐어요.')
        const file = await storeBrowserFile(
          new File([new Uint8Array(bytes)], old.name, { type: old.mimeType }),
        )
        created.push(file)
        mapping.set(old.id, file)
      }
    }
    if (
      mapping.size !== preview.manifest.files.length ||
      preview.manifest.files.some((file) => !mapping.has(file.id))
    )
      throw new Error('복원된 파일 목록이 다릅니다.')
    const mapFile = (file: Attachment) => {
      const restored = mapping.get(file.id)!
      if (restored.size !== file.size || restored.mimeType !== file.mimeType)
        throw new Error('복원된 자료 형식·크기가 다릅니다.')
      return {
        ...file,
        ...restored,
        name: file.name,
        createdAt: file.createdAt,
        reservationId: file.reservationId,
        expenseId: file.expenseId,
        stopId: file.stopId,
      }
    }
    const photos = Object.fromEntries(
      Object.entries(preview.manifest.personalPhotos).map(([key, file]) => [
        key,
        mapFile(file),
      ]),
    )
    const trips = preview.manifest.trips.map((trip) => {
      const attachments = (trip.attachments || []).map(mapFile)
      // Preserve private photos even when an old custom guide is no longer installed.
      const days = trip.days.map((day) =>
        day.map((stop) => {
          let photoId = stop.photoId ? mapping.get(stop.photoId)?.id : undefined
          if (!photoId && stop.custom?.catalogPlaceId) {
            const photo = photos[`place:${stop.custom.catalogPlaceId}`]
            if (photo) {
              const linked = { ...photo, stopId: stop.id }
              if (
                !attachments.some((file) => file.id === photo.id) &&
                attachments.length < 300
              )
                attachments.push(linked)
              if (attachments.some((file) => file.id === photo.id))
                photoId = photo.id
            }
          }
          return { ...stop, photoId }
        }),
      )
      return tripSchema.parse({
        ...trip,
        id: crypto.randomUUID(),
        days,
        attachments,
      })
    })
    return { trips, photos, created }
  } catch (error) {
    await cleanupBackupFiles(created)
    throw error
  }
}
export async function cleanupBackupFiles(files: Attachment[]) {
  for (const file of files) await deleteStoredAttachment(file).catch(() => {})
}
export async function discardBackup(preview?: BackupPreview) {
  if (preview?.token)
    await NativeBackup.discardArchive({ token: preview.token }).catch(() => {})
}
export function commitFullRestore(
  current: TravelStore,
  trips: Trip[],
  restoredPhotos: Record<string, Attachment>,
  persist: (next: TravelStore) => void = (next) =>
    localStorage.setItem('jido-travel-v1', JSON.stringify(next)),
): TravelStore {
  if (current.trips.length + trips.length > 500)
    throw new Error('여행은 최대 500개까지 보관할 수 있어요.')
  const before = personalPhotosSnapshot(),
    photos = { ...restoredPhotos, ...before }
  const next = { ...current, trips: [...current.trips, ...trips] }
  for (const trip of trips) tripSchema.parse(trip)
  let changed = false
  try {
    replacePersonalPhotos(photos)
    changed = true
    persist(next)
  } catch (error) {
    if (changed) {
      try {
        replacePersonalPhotos(before)
      } catch {
        throw new Error(
          '복원 중 저장 공간 오류가 발생했습니다. 복원 자료를 보존했으니 앱을 닫기 전에 저장 공간을 확인하세요.',
          { cause: 'keep-files' },
        )
      }
    }
    throw error
  }
  return next
}
