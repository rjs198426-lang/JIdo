import entries from './place-blogs.json' with { type: 'json' }
import type { Place } from './data'
import { isRecentBlog } from './blog-recency.ts'

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
  const found = entries.filter(
    (entry) =>
      isRecentBlog(entry) &&
      entry.places.some(
        (match) =>
          match.id === place.id &&
          match.name === place.name &&
          match.cityId === place.cityId,
      ),
  )
  // Legacy reviewSources have only a check date, not a publication date.
  // Use verified, dated entries rather than presenting undated links as recent.
  return found
}
