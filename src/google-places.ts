import { loadGoogleLibrary } from './google-sdk'
import { googlePlaceKind } from './place-categories'
import type { customPlaceKinds } from './place-categories'
import { googleMapsLink, mapsSearch } from './google-maps'

export type GooglePlace = {
  id: string
  name: string
  address: string
  link: string
  coordinates: { lat: number; lng: number }
  kind: (typeof customPlaceKinds)[number]
  attributions: { provider: string; url?: string }[]
}
type PlacesLibrary = Pick<google.maps.PlacesLibrary, 'Place'>
const loadPlaces = () => loadGoogleLibrary('places')
export async function searchGooglePlaces(
  query: string,
): Promise<GooglePlace[]> {
  if (!navigator.onLine) throw new Error('인터넷에 연결한 뒤 다시 찾아 주세요.')
  const library = await new Promise<PlacesLibrary>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('구글 연결이 지연됩니다. 다시 찾아 주세요.')),
      20000,
    )
    loadPlaces().then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const response = await Promise.race([
      library.Place.searchByText({
        textQuery: query,
        language: 'ko',
        maxResultCount: 20,
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'types',
          'googleMapsURI',
          'attributions',
        ],
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('검색이 지연됩니다. 다시 찾아 주세요.')),
          15000,
        )
      }),
    ])
    return (response.places || []).flatMap((place) => {
      const lat = place.location?.lat(),
        lng = place.location?.lng()
      if (
        !place.id ||
        !place.displayName ||
        lat === undefined ||
        lng === undefined ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      )
        return []
      const types = place.types || []
      const kind = googlePlaceKind(types)
      const fallback = new URL(mapsSearch(`${lat},${lng}`))
      fallback.searchParams.set('query_place_id', place.id)
      const attributions = (place.attributions || []).flatMap((item) => {
        if (!item.provider) return []
        let url: string | undefined
        try {
          const parsed = new URL(item.providerURI || '')
          if (
            parsed.protocol === 'https:' &&
            !parsed.username &&
            !parsed.password
          )
            url = parsed.href
        } catch {
          /* Optional attribution link. */
        }
        return [{ provider: item.provider, ...(url ? { url } : {}) }]
      })
      return [
        {
          id: place.id,
          name: place.displayName,
          address: place.formattedAddress || '',
          link: googleMapsLink(place.googleMapsURI || '') || fallback.href,
          coordinates: { lat, lng },
          kind,
          attributions,
        },
      ]
    })
  } finally {
    clearTimeout(timer)
  }
}
