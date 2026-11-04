import mentions from './place-blogs.json' with { type: 'json' }
import searchSamples from './place-search-exposure.json' with { type: 'json' }
import { isRecentBlog } from './blog-recency.ts'

export type PlaceIdentity = { id: string; cityId: string; name: string }
export type MentionEvidence = {
  url: string
  publishedAt?: string
  places: PlaceIdentity[]
}
export type SearchSample = {
  cityId: string
  query: string
  observedAt: string
  results: { url: string; rank: number }[]
}

export const placeIdentityKey = (place: PlaceIdentity) =>
  JSON.stringify([place.id, place.cityId, place.name])

// A mobile link, tracking link and desktop link to one article count once.
// Preserve identity-bearing query parameters on other sites.
export function canonicalMentionUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return
    url.hash = ''
    if (['blog.naver.com', 'm.blog.naver.com'].includes(url.hostname)) {
      const path = url.pathname.match(/^\/([\w-]+)\/(\d+)\/?$/)
      const blog = path?.[1] || url.searchParams.get('blogId')
      const post = path?.[2] || url.searchParams.get('logNo')
      if (!blog || !/^[\w-]+$/.test(blog) || !post || !/^\d+$/.test(post))
        return
      return `https://blog.naver.com/${blog}/${post}`
    }
    if (url.hostname.endsWith('.tistory.com'))
      url.pathname = url.pathname.replace(/^\/m\//, '/')
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_.+|fbclid|gclid|ref|from|category|listStyle)$/i.test(key))
        url.searchParams.delete(key)
    url.searchParams.sort()
    url.pathname = url.pathname.replace(/\/$/, '') || '/'
    return url.href
  } catch {
    return
  }
}

function validPublicationDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

export function createPlaceDiscovery(
  evidence: readonly MentionEvidence[],
  samples: readonly SearchSample[] = [],
) {
  const byPlace = new Map<string, Map<string, Set<string>>>()
  for (const entry of evidence) {
    const url = canonicalMentionUrl(entry.url)
    if (!url || !validPublicationDay(entry.publishedAt)) continue
    for (const place of entry.places) {
      const key = placeIdentityKey(place)
      const articles = byPlace.get(key) || new Map<string, Set<string>>()
      const dates = articles.get(url) || new Set<string>()
      dates.add(entry.publishedAt)
      articles.set(url, dates)
      byPlace.set(key, articles)
    }
  }

  function metrics(place: PlaceIdentity, today = new Date()) {
    const end = today.toISOString().slice(0, 10)
    const articles = [...(byPlace.get(placeIdentityKey(place)) || [])]
      // Conflicting dates need review; selecting the newest would renew an old post.
      .flatMap(([url, dates]) =>
        dates.size === 1 ? [{ url, publishedAt: [...dates][0] }] : [],
      )
      .filter((post) => post.publishedAt <= end)
    const recent = articles.filter((post) => isRecentBlog(post, today))
    const urls = new Set(recent.map((post) => post.url))
    // Exposure is only the observed order of a city-wide search sample, not
    // impressions, review totals or a permanent Naver/Google popularity rank.
    const sample = samples
      .filter((sample) => {
        const observed = Date.parse(sample.observedAt)
        const age = today.getTime() - observed
        return (
          sample.cityId === place.cityId &&
          sample.query.trim() &&
          Number.isFinite(observed) &&
          age >= 0 &&
          age <= 30 * 86_400_000
        )
      })
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]
    const ranks =
      sample?.results.flatMap((result) => {
        const url = canonicalMentionUrl(result.url)
        return url &&
          urls.has(url) &&
          Number.isSafeInteger(result.rank) &&
          result.rank > 0
          ? [result.rank]
          : []
      }) || []
    return {
      state: recent.length
        ? ('recent' as const)
        : articles.length
          ? ('expired' as const)
          : ('unverified' as const),
      mentionCount: recent.length,
      searchRank: ranks.length ? Math.min(...ranks) : null,
      searchObservedAt: ranks.length ? sample!.observedAt : null,
    }
  }

  function list<T extends PlaceIdentity>(
    places: readonly T[],
    today = new Date(),
    preserve: (place: T) => boolean = () => false,
  ): T[] {
    return (
      places
        .map((place, index) => ({
          place,
          index,
          evidence: metrics(place, today),
        }))
        // Only known dated evidence can expire. A missing investigation is not zero mentions.
        .filter(
          ({ place, evidence }) =>
            evidence.state !== 'expired' || preserve(place),
        )
        .sort(
          (a, b) =>
            b.evidence.mentionCount - a.evidence.mentionCount ||
            (a.evidence.searchRank ?? Infinity) -
              (b.evidence.searchRank ?? Infinity) ||
            a.index - b.index,
        )
        .map(({ place }) => place)
    )
  }
  return { metrics, list }
}

export const placeDiscovery = createPlaceDiscovery(mentions, searchSamples)
