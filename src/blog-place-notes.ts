import curated from './curated-place-notes.json' with { type: 'json' }
import { z } from 'zod'
import notes from './blog-place-notes.json' with { type: 'json' }
import { reviewSourceSchema } from './review-source.ts'
import type { Place } from './data'

const updates = z
  .array(
    z.object({
      id: z.string().min(1),
      cityId: z.string().min(1),
      name: z.string().min(1),
      previousDescription: z.string(),
      previousTip: z.string(),
      description: z.string().min(1).max(5000),
      tip: z.string().min(1).max(2000),
      reviewSources: z.array(reviewSourceSchema).default([]),
    }),
  )
  .parse([...notes, ...curated])

// Upgrade unchanged built-in text only. Custom guide text, coordinates and photos survive.
export function withBlogNotes<T extends Place>(place: T): T {
  if (
    place.id === 'kyoto-review-3ad4fafd578f' &&
    place.cityId === 'kyoto' &&
    place.name === '쇼세이엔 정원'
  ) {
    place = {
      ...place,
      reviewSources: place.reviewSources?.filter(
        (source) =>
          source.url !== 'https://blog.naver.com/alrg0411/224439356860',
      ),
    }
  }
  const update = updates.find(
    (item) =>
      item.id === place.id &&
      item.cityId === place.cityId &&
      item.name === place.name,
  )
  if (!update) return place
  const urls = new Set(update.reviewSources.map((source) => source.url))
  return {
    ...place,
    description:
      place.description === update.previousDescription
        ? update.description
        : place.description,
    tip: place.tip === update.previousTip ? update.tip : place.tip,
    reviewSources: [
      ...update.reviewSources,
      ...(place.reviewSources || []).filter((source) => !urls.has(source.url)),
    ],
  }
}
