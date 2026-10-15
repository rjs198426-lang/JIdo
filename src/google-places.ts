import { googleMapsLink, mapsSearch } from './google-maps'

export type GooglePlace = {
  id: string
  name: string
  address: string
  link: string
  coordinates: { lat: number; lng: number }
  kind: '관광' | '맛집' | '카페' | '숙소' | '이동' | '기타'
  attributions: { provider: string; url?: string }[]
}
type PlacesLibrary = Pick<google.maps.PlacesLibrary, 'Place'>
type MapsWindow = Window & {
  google?: {
    maps?: { importLibrary?: (name: string) => Promise<PlacesLibrary> }
  }
  __jdoMapsReady?: () => void
  gm_authFailure?: () => void
}
let loading: Promise<PlacesLibrary> | undefined
const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()

async function loadPlaces(): Promise<PlacesLibrary> {
  const target = window as MapsWindow
  if (target.google?.maps?.importLibrary)
    return target.google.maps.importLibrary('places')
  if (!key) throw new Error('구글 장소 검색 연결이 아직 설정되지 않았습니다.')
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const previousAuth = target.gm_authFailure
    let finished = false
    const finish = (error?: Error) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      delete target.__jdoMapsReady
      target.gm_authFailure = previousAuth
      if (error) {
        script.remove()
        reject(error)
      } else resolve()
    }
    const timer = window.setTimeout(
      () => finish(new Error('구글 연결이 지연됩니다. 다시 찾아 주세요.')),
      20000,
    )
    target.__jdoMapsReady = () => finish()
    target.gm_authFailure = () =>
      finish(new Error('구글 장소 검색 연결을 확인해야 합니다.'))
    script.onerror = () =>
      finish(
        new Error('구글에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.'),
      )
    const params = new URLSearchParams({
      key,
      libraries: 'places',
      v: 'weekly',
      language: 'ko',
      loading: 'async',
      callback: '__jdoMapsReady',
    })
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    document.head.append(script)
  })
    .then(() => {
      if (!target.google?.maps?.importLibrary)
        throw new Error('구글 장소 검색을 불러오지 못했습니다.')
      return target.google.maps.importLibrary('places')
    })
    .catch((error) => {
      loading = undefined
      throw error
    })
  return loading
}
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
      const kind = types.includes('cafe')
        ? '카페'
        : types.includes('restaurant')
          ? '맛집'
          : types.includes('lodging')
            ? '숙소'
            : types.some((type) =>
                  ['airport', 'train_station', 'transit_station'].includes(
                    type,
                  ),
                )
              ? '이동'
              : '관광'
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
