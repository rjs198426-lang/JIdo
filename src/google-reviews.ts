import { loadGoogleLibrary } from './google-sdk'
import { googleMapsLink, mapsSearch } from './google-maps'
import type { PlaceIdentity } from './place-mention-ranking'
import type { GoogleReviewEvidence } from './google-review-evidence'

export async function fetchGoogleReviews(
  place: PlaceIdentity,
  googlePlaceId: string,
): Promise<GoogleReviewEvidence> {
  if (!navigator.onLine)
    throw new Error('인터넷에 연결한 뒤 다시 확인해 주세요.')
  if (!googlePlaceId || googlePlaceId.length > 300)
    throw new Error('Google 장소를 다시 선택해 주세요.')
  const { Place } = await loadGoogleLibrary('places')
  const details = new Place({ id: googlePlaceId, requestedLanguage: 'ko' })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      details.fetchFields({
        fields: [
          'id',
          'reviews',
          'userRatingCount',
          'googleMapsURI',
          'attributions',
        ],
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('Google 리뷰 확인이 지연됩니다. 다시 시도해 주세요.'),
            ),
          15000,
        )
      }),
    ])
    if (details.id !== googlePlaceId)
      throw new Error('Google 장소 연결을 다시 확인해 주세요.')
    const fallback = new URL(mapsSearch(place.name))
    fallback.searchParams.set('query_place_id', googlePlaceId)
    return {
      place: { id: place.id, cityId: place.cityId, name: place.name },
      googlePlaceId,
      checkedAt: new Date().toISOString(),
      // Places (New) returns a relevance sample, never a complete latest-first list.
      ordering: 'relevance',
      mapsUrl: googleMapsLink(details.googleMapsURI || '') || fallback.href,
      ...(Number.isSafeInteger(details.userRatingCount) &&
      details.userRatingCount! >= 0
        ? { totalRatingCount: details.userRatingCount! }
        : {}),
      attributions: (details.attributions || []).flatMap((item) =>
        item.provider
          ? [
              {
                provider: item.provider,
                ...(safeHttps(item.providerURI || '')
                  ? { url: safeHttps(item.providerURI || '') }
                  : {}),
              },
            ]
          : [],
      ),
      reviews: (details.reviews || []).flatMap((review) => {
        const time = review.publishTime
        const publishedAt =
          time instanceof Date && Number.isFinite(time.getTime())
            ? time.toISOString()
            : undefined
        const authorUrl =
          googleMapsLink(review.authorAttribution?.uri || '') || undefined
        const url = googleMapsLink(review.googleMapsURI || '') || undefined
        const id =
          url || (authorUrl && publishedAt ? `${authorUrl}#${publishedAt}` : '')
        if (!id) return []
        return [
          {
            id,
            publishedAt,
            author:
              review.authorAttribution?.displayName || 'Google 지도 사용자',
            authorUrl,
            url,
            ...(review.rating !== null &&
            Number.isFinite(review.rating) &&
            review.rating >= 1 &&
            review.rating <= 5
              ? { rating: review.rating }
              : {}),
          },
        ]
      }),
    }
  } finally {
    clearTimeout(timer)
  }
}

function safeHttps(raw: string) {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : undefined
  } catch {
    return
  }
}
