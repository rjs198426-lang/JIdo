import { useSyncExternalStore } from 'react'
import bundled from '../content/manifest.json' with { type: 'json' }
import { z } from 'zod'
import { citySchema, placeSchema } from './guide-schema'
import {
  contentManifestSchema,
  publicContentSchema,
  MAX_CONTENT_BYTES,
  type PublicContent,
} from './content-schema'

export const CONTENT_BASE =
  'https://raw.githubusercontent.com/rjs198426-lang/JIdo/main/content/'
export const CONTENT_CACHE_KEY = 'jdo-public-content-v1'
class ContentUpdateError extends Error {}
const AUTO_KEY = 'jdo-content-auto-v1',
  CHECK_KEY = 'jdo-content-check-v1'
const cacheSchema = z.object({
  manifest: contentManifestSchema,
  catalog: publicContentSchema,
  retainedCities: z.array(citySchema).max(1000),
  retainedPlaces: z.array(placeSchema).max(20000),
})
type ContentCache = z.infer<typeof cacheSchema>
let cache: ContentCache | undefined
let history: {
  cities: PublicContent['cities']
  places: PublicContent['places']
} = { cities: [], places: [] }
try {
  const saved = localStorage.getItem(CONTENT_CACHE_KEY)
  if (saved && saved.length <= MAX_CONTENT_BYTES * 3) {
    const parsed = cacheSchema.parse(JSON.parse(saved))
    if (parsed.manifest.minBuild <= __JIDO_APP_INFO__.build) {
      // Even a newer APK must retain old downloaded places referenced by trips.
      history = {
        cities: [...parsed.retainedCities, ...parsed.catalog.cities],
        places: [...parsed.retainedPlaces, ...parsed.catalog.places],
      }
      if (parsed.manifest.sequence > bundled.sequence) cache = parsed
    }
  }
} catch {
  /* A missing/corrupt cache never prevents the embedded guide from opening. */
}
let snapshot = {
  checking: false,
  automatic: true,
  message: '',
  date: cache?.manifest.publishedAt || bundled.publishedAt,
}
try {
  snapshot.automatic = localStorage.getItem(AUTO_KEY) !== 'false'
} catch {}
const listeners = new Set<() => void>(),
  catalogListeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}
export const publicContent = () => cache
export const retainedPublicContent = () => history
export function subscribePublicContent(listener: () => void) {
  catalogListeners.add(listener)
  return () => catalogListeners.delete(listener)
}

async function download(url: string, maximum: number) {
  const response = await fetch(url, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    cache: 'no-cache',
    signal: AbortSignal.timeout(12000),
  })
  if (
    !response.ok ||
    Number(response.headers.get('content-length') || 0) > maximum
  )
    throw new ContentUpdateError(
      '정보를 내려받지 못했어요. 저장된 정보는 계속 사용할 수 있어요.',
    )
  const reader = response.body?.getReader()
  if (!reader) throw new ContentUpdateError('정보 응답을 읽지 못했어요.')
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > maximum) {
        await reader.cancel()
        throw new ContentUpdateError('정보 파일이 너무 커서 적용하지 않았어요.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
let checking: Promise<void> | undefined
export function checkContent() {
  if (checking) return checking
  snapshot = { ...snapshot, checking: true, message: '' }
  emit()
  checking = (async () => {
    try {
      const manifest = contentManifestSchema.parse(
        JSON.parse(
          new TextDecoder().decode(
            await download(CONTENT_BASE + 'manifest.json', 4096),
          ),
        ),
      )
      const current = cache?.manifest || bundled
      if (manifest.minBuild > __JIDO_APP_INFO__.build)
        throw new ContentUpdateError(
          '새 여행 정보를 보려면 앱을 업데이트해 주세요.',
        )
      if (manifest.sequence <= current.sequence) {
        if (
          manifest.sequence === current.sequence &&
          manifest.revision !== current.revision
        )
          throw new ContentUpdateError(
            '정보 버전을 확인하지 못해 기존 정보를 유지했어요.',
          )
        snapshot = { ...snapshot, message: '저장된 여행 정보가 최신 상태예요.' }
        return
      }
      const bytes = await download(CONTENT_BASE + manifest.file, manifest.bytes)
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      )
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
      if (bytes.length !== manifest.bytes || digest !== manifest.revision)
        throw new ContentUpdateError(
          '정보 파일을 확인하지 못해 기존 정보를 유지했어요.',
        )
      const catalog = publicContentSchema.parse(
        JSON.parse(new TextDecoder().decode(bytes)),
      )
      const cityIds = new Set(catalog.cities.map((c) => c.id)),
        placeIds = new Set(catalog.places.map((p) => p.id))
      const oldCities = new Map(
        [
          ...history.cities,
          ...(cache?.retainedCities || []),
          ...(cache?.catalog.cities || []),
        ].map((c) => [c.id, c]),
      )
      const oldPlaces = new Map(
        [
          ...history.places,
          ...(cache?.retainedPlaces || []),
          ...(cache?.catalog.places || []),
        ].map((p) => [p.id, p]),
      )
      const next = cacheSchema.parse({
        manifest,
        catalog,
        retainedCities: [...oldCities.values()].filter(
          (c) => !cityIds.has(c.id),
        ),
        retainedPlaces: [...oldPlaces.values()].filter(
          (p) => !placeIds.has(p.id),
        ),
      })
      // Persist first: a quota/write failure cannot half-apply or overwrite a cache.
      try {
        localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(next))
      } catch {
        throw new ContentUpdateError(
          '저장 공간이 부족해 기존 여행 정보를 유지했어요.',
        )
      }
      cache = next
      snapshot = {
        ...snapshot,
        date: manifest.publishedAt,
        message: '새 여행 정보를 저장했어요. 인터넷이 끊겨도 볼 수 있어요.',
      }
      for (const listener of catalogListeners) listener()
    } catch (error) {
      snapshot = {
        ...snapshot,
        message:
          error instanceof ContentUpdateError
            ? error.message
            : '새 정보를 확인하지 못했어요. 저장된 정보는 계속 사용할 수 있어요.',
      }
    } finally {
      try {
        localStorage.setItem(CHECK_KEY, String(Date.now()))
      } catch {}
      snapshot = { ...snapshot, checking: false }
      checking = undefined
      emit()
    }
  })()
  return checking
}
export function setAutomaticContent(value: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, String(value))
  } catch {}
  snapshot = { ...snapshot, automatic: value }
  emit()
}
export function startContentUpdates() {
  const run = () => {
    let checkedAt = 0
    try {
      checkedAt = Number(localStorage.getItem(CHECK_KEY)) || 0
    } catch {}
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection
    if (
      snapshot.automatic &&
      navigator.onLine &&
      !connection?.saveData &&
      Date.now() - checkedAt >= 86400000
    )
      void checkContent()
  }
  const timer = window.setTimeout(run, 8000)
  window.addEventListener('online', run)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('online', run)
  }
}
export function useContentRelease() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
  )
}
