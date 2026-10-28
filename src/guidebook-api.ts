import { guideSchema } from './guide-schema'
import {
  guidebookIndexSchema,
  guidebookEntrySchema,
  GUIDEBOOK_MAX_BYTES,
  GUIDEBOOK_INDEX_MAX_BYTES,
  type GuidebookEntry,
} from './guidebook-schema'
import { installGuidebook } from './guidebook-store'
export const GUIDEBOOK_BASE =
  'https://raw.githubusercontent.com/rjs198426-lang/JIdo/main/guidebooks/'
async function read(path: string, limit: number) {
  const response = await fetch(GUIDEBOOK_BASE + path, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal: AbortSignal.timeout(25000),
  })
  if (
    !response.ok ||
    Number(response.headers.get('content-length') || 0) > limit
  )
    throw new Error(
      '가이드북을 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',
    )
  if (!response.body) throw new Error('가이드북 내용을 읽지 못했어요.')
  const reader = response.body.getReader(),
    parts: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new Error('가이드북 파일이 너무 커요.')
      parts.push(value)
    }
  } catch (e) {
    await reader.cancel().catch(() => {})
    throw e
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.byteLength
  }
  return bytes
}
export async function fetchGuidebookIndex() {
  return guidebookIndexSchema.parse(
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await read('manifest.json', GUIDEBOOK_INDEX_MAX_BYTES),
      ),
    ),
  )
}
const pending = new Map<string, Promise<void>>()
export function downloadGuidebook(input: GuidebookEntry) {
  const entry = guidebookEntrySchema.parse(input)
  if (entry.minBuild > __JIDO_APP_INFO__.build)
    return Promise.reject(
      new Error('앱을 업데이트한 뒤 이 가이드북을 불러올 수 있어요.'),
    )
  const key = entry.id + ':' + entry.revision
  const existing = pending.get(key)
  if (existing) return existing
  const job = (async () => {
    const bytes = await read(entry.file, GUIDEBOOK_MAX_BYTES)
    if (bytes.byteLength !== entry.bytes)
      throw new Error('가이드북 파일 크기가 달라요. 목록을 새로 확인해 주세요.')
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    ]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
    if (digest !== entry.revision)
      throw new Error(
        '가이드북을 검증하지 못했어요. 기존 자료는 변경하지 않았어요.',
      )
    const guide = guideSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    )
    if (
      guide.id !== entry.id ||
      guide.city.name !== entry.name ||
      guide.city.country !== entry.country ||
      guide.places.length !== entry.placeCount ||
      guide.updatedAt !== entry.updatedAt
    )
      throw new Error('목록과 다른 가이드북입니다. 목록을 새로 확인해 주세요.')
    installGuidebook(guide, entry.revision)
  })().finally(() => pending.delete(key))
  pending.set(key, job)
  return job
}
