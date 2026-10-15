import rawGuides from './expanded-guides.json' with { type: 'json' }
import {
  citySchema,
  placeSchema,
  sectionSchema,
  sourceSchema,
} from './guide-schema.ts'

// Public archived traveler-guide material; source edition is shown explicitly.
export const expandedGuides = rawGuides.map((guide) => ({
  city: citySchema.parse(guide.city),
  places: guide.places.map((place) => placeSchema.parse(place)),
  sections: guide.sections.map((section) => sectionSchema.parse(section)),
  sources: guide.sources.map((source) => sourceSchema.parse(source)),
}))
export const expandedGuideById = new Map(
  expandedGuides.map((guide) => [guide.city.id, guide]),
)
