import bundledIndex from '../guidebooks/manifest.json'
import {
  guidebookIndexSchema,
  GUIDEBOOK_INDEX_MAX_BYTES,
  type GuidebookIndex,
} from './guidebook-schema'
import { fetchGuidebookIndex } from './guidebook-api'

export const GUIDEBOOK_INDEX_CACHE_KEY = 'jdo-guidebook-index-v1'
export const GUIDEBOOK_INDEX_CHECK_INTERVAL = 24 * 60 * 60 * 1000
const bundled = guidebookIndexSchema.parse(bundledIndex)
type State = {
  index: GuidebookIndex
  checkedAt: string | null
  checking: boolean
  error: string
  cacheWarning: string
}
function initial(): State {
  const state: State = {
    index: bundled,
    checkedAt: null,
    checking: false,
    error: '',
    cacheWarning: '',
  }
  try {
    const raw = localStorage.getItem(GUIDEBOOK_INDEX_CACHE_KEY)
    if (
      !raw ||
      new TextEncoder().encode(raw).byteLength >
        GUIDEBOOK_INDEX_MAX_BYTES + 1024
    )
      return state
    const saved = JSON.parse(raw)
    const index = guidebookIndexSchema.parse(saved.index)
    const checked =
      typeof saved.checkedAt === 'string' ? Date.parse(saved.checkedAt) : NaN
    if (
      saved.schemaVersion !== 1 ||
      !Number.isFinite(checked) ||
      checked > Date.now() + 300000 ||
      Date.parse(index.updatedAt) < Date.parse(bundled.updatedAt)
    )
      return state
    return { ...state, index, checkedAt: saved.checkedAt }
  } catch {
    // This cache contains only public metadata. Leave malformed bytes intact;
    // personal guidebooks, drafts and travel records are independent stores.
    return state
  }
}
let state = initial()
let pending: Promise<void> | undefined
let attemptedAt = 0
const listeners = new Set<() => void>()
export const guidebookIndexSnapshot = () => state
export const subscribeGuidebookIndex = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
function update(changes: Partial<State>) {
  state = { ...state, ...changes }
  for (const listener of listeners) listener()
}
export function refreshGuidebookIndex(force = false): Promise<void> {
  if (pending) return pending
  const checked = state.checkedAt ? Date.parse(state.checkedAt) : 0
  if (
    !force &&
    ((checked && Date.now() - checked < GUIDEBOOK_INDEX_CHECK_INTERVAL) ||
      (attemptedAt && Date.now() - attemptedAt < 60000))
  )
    return Promise.resolve()
  attemptedAt = Date.now()
  update({ checking: true, error: '' })
  pending = (async () => {
    try {
      const fresh = await fetchGuidebookIndex()
      if (Date.parse(fresh.updatedAt) < Date.parse(state.index.updatedAt))
        throw new Error(
          '이전 목록이 응답되어 확인한 최신 목록을 유지했어요. 잠시 후 다시 확인해 주세요.',
        )
      const checkedAt = new Date().toISOString()
      let cacheWarning = ''
      try {
        localStorage.setItem(
          GUIDEBOOK_INDEX_CACHE_KEY,
          JSON.stringify({ schemaVersion: 1, index: fresh, checkedAt }),
        )
      } catch {
        cacheWarning =
          '새 목록은 확인했지만 기기에 보관하지 못했어요. 다음에 다시 확인할 수 있어요.'
      }
      update({ index: fresh, checkedAt, error: '', cacheWarning })
    } catch (e) {
      const error =
        e instanceof Error && e.message.startsWith('이전 목록')
          ? e.message
          : '목록을 확인하지 못했어요. 준비된 목록과 저장한 가이드북은 계속 이용할 수 있어요.'
      update({ error })
      throw new Error(error)
    } finally {
      update({ checking: false })
      pending = undefined
    }
  })()
  return pending
}
