import type { PlaceIdentity } from './place-mention-ranking'
import { isRecentPublication } from './blog-recency.ts'

export type GoogleReview = {
  id: string
  publishedAt?: string
  updatedAt?: string
  author: string
  authorUrl?: string
  url?: string
  rating?: number
}
export type GoogleReviewEvidence = {
  place: PlaceIdentity
  googlePlaceId: string
  checkedAt: string
  ordering: 'relevance' | 'newest'
  reviews: GoogleReview[]
  totalRatingCount?: number
  mapsUrl: string
  attributions: { provider: string; url?: string }[]
}
export const googleReviewKey = (place: PlaceIdentity) =>
  JSON.stringify([place.id, place.cityId, place.name])

function validDay(value: string | undefined, today: Date) {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    )
  )
    return
  const date = new Date(value)
  const day = value.slice(0, 10)
  const midnight = new Date(`${day}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(midnight.getTime()) ||
    midnight.toISOString().slice(0, 10) !== day ||
    date.getTime() > today.getTime()
  )
    return
  return date.toISOString().slice(0, 10)
}

export function googleReviewMetrics(
  evidence: GoogleReviewEvidence | undefined,
  place: PlaceIdentity,
  today = new Date(),
) {
  const age = evidence
    ? today.getTime() - Date.parse(evidence.checkedAt)
    : Infinity
  if (
    !evidence ||
    googleReviewKey(evidence.place) !== googleReviewKey(place) ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 10 * 60_000
  )
    return {
      state: 'unverified' as const,
      recent: [] as GoogleReview[],
      count: 0,
    }
  const seen = new Set<string>()
  let incomplete = false
  const dated = evidence.reviews.flatMap((review) => {
    if (!review.id) {
      incomplete = true
      return []
    }
    if (seen.has(review.id)) return []
    seen.add(review.id)
    const published = validDay(review.publishedAt, today)
    // A check date, visit month or relative label never renews a review.
    if (!published) {
      incomplete = true
      return []
    }
    const updated = validDay(review.updatedAt, today)
    const day = updated && updated >= published ? updated : published
    return [{ review, day }]
  })
  const recent = dated
    .filter((item) => isRecentPublication(item.day, 1, today))
    .map((item) => item.review)
  return {
    state: recent.length
      ? ('recent' as const)
      : evidence.ordering === 'newest' && dated.length && !incomplete
        ? ('inactive' as const)
        : ('unverified' as const),
    recent,
    // All-time userRatingCount is not a count of this year's reviews.
    count: recent.length,
  }
}
