import { guidebooksSnapshot, subscribeGuidebooks } from './guidebook-store'
import { currentPlaceCategory } from './category-balance'
import { useState, useSyncExternalStore } from 'react'
import {
  cities as embeddedCities,
  places as embeddedPlaces,
  regions as bundledRegions,
  reviewedPlaceIds,
  type Region,
} from './data'
import { guideSchema, archivedGuideSchema, type Guide } from './guide-schema'
import { fetchGuides } from './guide-api'
import { currentPlaceName } from './place-names'
import { withBlogNotes } from './blog-place-notes'
import { retiredBlogImages } from './blog-recency'
import {
  publicContent,
  retainedPublicContent,
  subscribePublicContent,
} from './content-release'
let bundledCities = publicContent()?.catalog.cities || embeddedCities
// Old public catalog releases can still contain placeholders for newly bundled
// venue photos. Upgrade those paths only; authored/custom images remain intact.
function withEmbeddedPhoto(value: (typeof embeddedPlaces)[number]) {
  const embedded = embeddedPlaces.find((place) => place.id === value.id)
  const oldPaths = new Set([
    '/images/kyoto.jpg',
    '/images/bali.jpg',
    '/images/bangkok.jpg',
    '/images/santorini.jpg',
    '/images/dubai.jpg',
    '/images/maldives.jpg',
    '/images/place-placeholder.svg',
    '/images/guide-placeholder.svg',
  ])
  if (
    embedded?.photoCredit &&
    (oldPaths.has(value.image) || retiredBlogImages.has(value.image))
  )
    return {
      ...value,
      image: embedded.image,
      photoCredit: embedded.photoCredit,
    }
  return value
}
let bundledPlaces = (publicContent()?.catalog.places || embeddedPlaces).map(
  withEmbeddedPhoto,
)
export { categoryOptions } from './data'
export type { City, Place, Region } from './data'

const CACHE_KEY = 'jdo-guide-catalog-v1'
type Catalog = { available: Guide[]; retained: Guide[]; usingServer: boolean }
let snapshot: Catalog = { available: [], retained: [], usingServer: false }
try {
  const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  if (saved && Array.isArray(saved.available) && Array.isArray(saved.retained))
    snapshot = {
      usingServer: saved.usingServer ?? true,
      available: saved.available.map((item: unknown) =>
        guideSchema.parse(item),
      ),
      retained: saved.retained.map((item: unknown) =>
        archivedGuideSchema.parse(item),
      ),
    }
} catch {
  /* Bundled guides remain available when cache is missing. */
}
const listeners = new Set<() => void>()
export let cities = [...bundledCities]
export let places = [...bundledPlaces]
export let regions: Region[] = [...bundledRegions]
const cityRegistry = new Map(
  [...embeddedCities, ...retainedPublicContent().cities, ...bundledCities].map(
    (city) => [city.id, city],
  ),
)
const placeRegistry = new Map(
  [...embeddedPlaces, ...retainedPublicContent().places, ...bundledPlaces].map(
    (place) => [place.id, place],
  ),
)
// Older bundled guide caches used one city photo for every venue. Upgrade only
// those known assets; preserve user-authored guide content and custom photos.
const legacyImages = new Set([
  '/images/kyoto.jpg',
  '/images/bali.jpg',
  '/images/bangkok.jpg',
  '/images/santorini.jpg',
  '/images/dubai.jpg',
  '/images/maldives.jpg',
  '/images/place-placeholder.svg',
  '/images/guide-placeholder.svg',
])
function currentPhoto<
  T extends {
    id: string
    image: string
    photoCredit?: (typeof bundledPlaces)[number]['photoCredit']
  },
>(value: T, bundled: T | undefined): T {
  if (bundled && retiredBlogImages.has(value.image))
    return { ...value, image: bundled.image, photoCredit: bundled.photoCredit }
  const credit = bundled?.photoCredit
  if (credit && (legacyImages.has(value.image) || value.image === credit.file))
    return { ...value, image: credit.file, photoCredit: credit }
  return value
}
function currentPlace(value: (typeof bundledPlaces)[number]) {
  const bundled = bundledPlaces.find((place) => place.id === value.id)
  value = currentPlaceCategory(currentPlaceName(value, bundled))
  const updated = withBlogNotes(currentPhoto(value, bundled))
  if (
    bundled?.reviewSources?.length &&
    !value.reviewSources?.length &&
    value.name === bundled.name &&
    value.cityId === bundled.cityId &&
    (legacyImages.has(value.image) || value.image === bundled.photoCredit?.file)
  )
    return withBlogNotes({
      ...updated,
      area: bundled.area,
      reviewSources: bundled.reviewSources,
      lat: bundled.lat,
      lng: bundled.lng,
      osmPlaceId: bundled.osmPlaceId,
    })
  return updated
}
function rebuild() {
  // Update lookups as well as recommendation lists; existing stops use IDs.
  for (const city of bundledCities) cityRegistry.set(city.id, city)
  for (const place of bundledPlaces) placeRegistry.set(place.id, place)
  const books = guidebooksSnapshot()
  for (const place of books.retainedPlaces) placeRegistry.set(place.id, place)
  for (const { guide } of books.books) {
    cityRegistry.set(guide.id, guide.city)
    for (const place of guide.places) placeRegistry.set(place.id, place)
  }
  for (const guide of snapshot.retained) {
    cityRegistry.set(
      guide.id,
      currentPhoto(
        guide.city,
        bundledCities.find((city) => city.id === guide.id),
      ),
    )
    for (const place of guide.places)
      placeRegistry.set(place.id, currentPlace(place))
  }
  const availableCities = new Map(bundledCities.map((city) => [city.id, city]))
  const availablePlaces = new Map(
    bundledPlaces.map((place) => [place.id, place]),
  )
  for (const { guide } of books.books) {
    availableCities.set(guide.id, guide.city)
    for (const place of guide.places) availablePlaces.set(place.id, place)
  }
  for (const guide of snapshot.available) {
    const city = currentPhoto(
      guide.city,
      bundledCities.find((city) => city.id === guide.id),
    )
    availableCities.set(guide.id, city)
    cityRegistry.set(guide.id, city)
    // Updated guides replace their current recommendations, while registry retains past stops.
    for (const [id, place] of availablePlaces)
      if (place.cityId === guide.id && !reviewedPlaceIds.has(id))
        availablePlaces.delete(id)
    for (const place of guide.places) {
      const updated = currentPlace(place)
      availablePlaces.set(place.id, updated)
      placeRegistry.set(place.id, updated)
    }
  }
  cities = [...availableCities.values()]
  places = [...availablePlaces.values()]
  regions = [
    ...new Set<Region>([
      ...bundledRegions,
      ...cities.map((city) => city.region),
    ]),
  ]
}
rebuild()
subscribePublicContent(() => {
  const content = publicContent()
  if (!content) return
  bundledCities = content.catalog.cities
  bundledPlaces = content.catalog.places.map(withEmbeddedPhoto)
  for (const city of content.retainedCities) cityRegistry.set(city.id, city)
  for (const place of content.retainedPlaces) placeRegistry.set(place.id, place)
  rebuild()
  snapshot = { ...snapshot }
  for (const listener of listeners) listener()
})
export const getCity = (id: string) => cityRegistry.get(id)
export const getPlace = (id: string) => placeRegistry.get(id)
export const getGuide = (id: string) =>
  snapshot.available.find((guide) => guide.id === id) ||
  snapshot.retained.find((guide) => guide.id === id) ||
  guidebooksSnapshot().books.find((book) => book.guide.id === id)?.guide
subscribeGuidebooks(() => {
  rebuild()
  snapshot = { ...snapshot }
  for (const listener of listeners) listener()
})
export function installGuides(guides: Guide[]) {
  const retained = new Map(snapshot.retained.map((guide) => [guide.id, guide]))
  for (const guide of guides) {
    const previous = retained.get(guide.id)
    const knownPlaces = new Map(
      previous?.places.map((place) => [place.id, place]) || [],
    )
    for (const place of guide.places) knownPlaces.set(place.id, place)
    retained.set(guide.id, { ...guide, places: [...knownPlaces.values()] })
  }
  snapshot = {
    available: guides,
    retained: [...retained.values()],
    usingServer: true,
  }
  rebuild()
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot))
  } catch {
    /* Current-session catalog still works when storage is full. */
  }
  for (const listener of listeners) listener()
}
let refreshInProgress: Promise<Guide[]> | null = null
export function refreshGuides() {
  if (!refreshInProgress)
    refreshInProgress = fetchGuides()
      .then((guides) => {
        installGuides(guides)
        return guides
      })
      .finally(() => {
        refreshInProgress = null
      })
  return refreshInProgress
}
export function useGuideCatalog() {
  const catalog = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
  )
  const [syncState, setSyncState] = useState<
    'idle' | 'loading' | 'online' | 'cached'
  >('idle')
  const refresh = async () => {
    setSyncState('loading')
    try {
      const guides = await refreshGuides()
      setSyncState('online')
      return guides
    } catch (error) {
      setSyncState('cached')
      throw error
    }
  }
  return { catalog, syncState, refresh }
}
