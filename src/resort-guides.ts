import rawGuides from './resort-guides.json' with { type: 'json' }
import { citySchema, placeSchema } from './guide-schema.ts'

// Stable city/place records remain so existing personal trips can resolve IDs.
export const resortGuides = rawGuides.map((guide) => ({
  city: citySchema.parse(guide.city),
  places: guide.places.map((place) => placeSchema.parse(place)),
}))
export const resortGuideById = new Map(
  resortGuides.map((item) => [item.city.id, item]),
)
