import entries from './place-blogs.json' with { type: 'json' }
import type { Place } from './data'

export interface PlaceBlog {
  title: string
  url: string
  platform: string
  author: string
  publishedAt?: string
  checkedAt: string
  topic: string
}

export function blogsForPlace(place: Place): PlaceBlog[] {
  const found = entries.filter((entry) =>
    entry.places.some(
      (match) =>
        match.id === place.id &&
        match.name === place.name &&
        match.cityId === place.cityId,
    ),
  )
  const known = new Set(found.map((entry) => entry.url))
  return [
    ...found,
    ...(place.reviewSources || [])
      .filter(
        (source) => source.kind === 'visit-review' && !known.has(source.url),
      )
      .map((source) => ({
        ...source,
        platform: source.url.includes('.tistory.com/')
          ? '티스토리'
          : source.url.includes('.naver.com/')
            ? '네이버 블로그'
            : '방문 후기',
        author: '',
        topic: '',
      })),
  ]
}
