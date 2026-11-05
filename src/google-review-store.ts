import {
  googleReviewKey,
  type GoogleReviewEvidence,
} from './google-review-evidence.ts'
import type { PlaceIdentity } from './place-mention-ranking'

// Google content is transient display state, never a public dataset or a draft.
const evidence = new Map<string, GoogleReviewEvidence>()
const listeners = new Set<() => void>()
let revision = 0
let generation = 0
let expiry: ReturnType<typeof setTimeout> | undefined
const emit = () => {
  revision++
  for (const listener of listeners) listener()
}
function scheduleExpiry() {
  clearTimeout(expiry)
  if (typeof window === 'undefined' || !evidence.size) return
  const next = Math.min(
    ...[...evidence.values()].map(
      (value) => Date.parse(value.checkedAt) + 10 * 60_000,
    ),
  )
  expiry = setTimeout(
    () => {
      for (const [key, value] of evidence)
        if (Date.now() - Date.parse(value.checkedAt) >= 10 * 60_000)
          evidence.delete(key)
      emit()
      scheduleExpiry()
    },
    Math.max(1, next - Date.now()),
  )
}
export const googleReviewGeneration = () => generation
export const googleReviewRevision = () => revision
export const subscribeGoogleReviews = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function clearGoogleReviews() {
  generation++
  clearTimeout(expiry)
  if (evidence.size) {
    evidence.clear()
    emit()
  }
}
export function setGoogleReviewEvidence(
  value: GoogleReviewEvidence,
  expectedGeneration: number,
) {
  if (
    generation !== expectedGeneration ||
    (typeof document !== 'undefined' && document.hidden)
  )
    return false
  const age = Date.now() - Date.parse(value.checkedAt)
  if (!Number.isFinite(age) || age < 0 || age >= 10 * 60_000) return false
  evidence.set(googleReviewKey(value.place), value)
  while (evidence.size > 40) evidence.delete(evidence.keys().next().value!)
  scheduleExpiry()
  emit()
  return true
}
export function googleReviewsForPlace(place: PlaceIdentity) {
  const value = evidence.get(googleReviewKey(place))
  if (!value) return
  const age = Date.now() - Date.parse(value.checkedAt)
  if (!Number.isFinite(age) || age < 0 || age > 10 * 60_000) return
  return value
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', clearGoogleReviews)
  window.addEventListener('jido:google-auth-error', clearGoogleReviews)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearGoogleReviews()
  })
}
