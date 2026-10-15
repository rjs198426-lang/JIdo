import rawGuides from './resort-guides.json' with { type: 'json' }
import { citySchema, placeSchema, sectionSchema } from './guide-schema.ts'

// Authored planning guides. Unknown coordinates are omitted, never filled
// with island centers. Official links are references, not claims of live checks.
export const resortGuides = rawGuides.map((guide) => ({
  city: citySchema.parse(guide.city),
  places: guide.places.map((place) => placeSchema.parse(place)),
  sections: guide.sections.map((section) => sectionSchema.parse(section)),
  references: guide.references,
  researchStatus: guide.researchStatus,
}))
export const resortGuideById = new Map(
  resortGuides.map((guide) => [guide.city.id, guide]),
)
