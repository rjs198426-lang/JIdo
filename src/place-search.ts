import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { places } from './catalog'
import { searchGooglePlaces, type GooglePlace } from './google-places'
import { z } from 'zod'

export type PlaceSearchService = 'osm' | 'google'
export type SearchPlace = GooglePlace & { provider: PlaceSearchService }
export type SearchContext = {
  name: string
  country: string
  guideCityId?: string
}
const CACHE_KEY = 'jido-free-place-search-v1'
const SERVICE_KEY = 'jido-place-search-service'
const ENDPOINT = 'https://photon.komoot.io/api/'
const countries: Record<string, string> = {
  일본: 'JP',
  한국: 'KR',
  대한민국: 'KR',
  프랑스: 'FR',
  이탈리아: 'IT',
  영국: 'GB',
  독일: 'DE',
  스페인: 'ES',
  포르투갈: 'PT',
  그리스: 'GR',
  오스트리아: 'AT',
  스위스: 'CH',
  네덜란드: 'NL',
  벨기에: 'BE',
  체코: 'CZ',
  미국: 'US',
  '미국령 괌': 'GU',
  '북마리아나 제도': 'MP',
  캐나다: 'CA',
  멕시코: 'MX',
  호주: 'AU',
  뉴질랜드: 'NZ',
  태국: 'TH',
  베트남: 'VN',
  인도네시아: 'ID',
  싱가포르: 'SG',
  말레이시아: 'MY',
  필리핀: 'PH',
  중국: 'CN',
  대만: 'TW',
  인도: 'IN',
  몰디브: 'MV',
  아랍에미리트: 'AE',
  튀르키예: 'TR',
  터키: 'TR',
  이집트: 'EG',
}
type CacheEntry = { at: number; places: SearchPlace[] }
const cachedPlaceSchema = z
  .object({
    id: z
      .string()
      .max(100)
      .regex(/^(node|way|relation)\/[1-9]\d*$/),
    provider: z.literal('osm'),
    name: z.string().trim().min(1).max(160),
    address: z.string().max(500),
    link: z.string(),
    coordinates: z.object({
      lat: z.number().finite().min(-90).max(90),
      lng: z.number().finite().min(-180).max(180),
    }),
    kind: z.enum(['관광', '맛집', '카페', '숙소', '이동', '기타']),
    attributions: z
      .array(
        z.object({
          provider: z.literal('© OpenStreetMap contributors · ODbL'),
          url: z.literal('https://www.openstreetmap.org/copyright'),
        }),
      )
      .length(1),
  })
  .refine((place) => place.link === `https://www.openstreetmap.org/${place.id}`)
const cacheSchema = z.record(
  z.string(),
  z.object({
    at: z.number().finite().nonnegative(),
    places: z.array(cachedPlaceSchema).max(10),
  }),
)
let queue: Promise<unknown> = Promise.resolve()
let lastStarted = 0
const inflight = new Map<string, Promise<SearchPlace[]>>()
export function searchService(): PlaceSearchService {
  try {
    return localStorage.getItem(SERVICE_KEY) === 'google' ? 'google' : 'osm'
  } catch {
    return 'osm'
  }
}
export function saveSearchService(service: PlaceSearchService) {
  try {
    localStorage.setItem(SERVICE_KEY, service)
  } catch {
    /* Optional preference. */
  }
}
function cache(): Record<string, CacheEntry> {
  try {
    return cacheSchema.parse(
      JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'),
    )
  } catch {
    return {}
  }
}
export function photonPlaces(body: unknown): SearchPlace[] {
  const features = (body as { features?: unknown[] })?.features
  if (!Array.isArray(features))
    throw new Error('무료 검색 응답을 읽지 못했습니다.')
  const result = new Map<string, SearchPlace>()
  for (const item of features.slice(0, 30)) {
    const feature = item as {
      geometry?: { type?: string; coordinates?: unknown[] }
      properties?: Record<string, unknown>
    }
    const properties = feature?.properties,
      point = feature?.geometry
    const [lng, lat] = Array.isArray(point?.coordinates)
      ? point.coordinates
      : []
    const types: Record<string, string> = {
      N: 'node',
      W: 'way',
      R: 'relation',
      node: 'node',
      way: 'way',
      relation: 'relation',
    }
    const osmType = String(properties?.osm_type)
    const type = Object.hasOwn(types, osmType) ? types[osmType] : undefined
    const rawId = String(properties?.osm_id || '')
    if (
      !properties ||
      point?.type !== 'Point' ||
      !type ||
      !/^[1-9]\d{0,18}$/.test(rawId) ||
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180 ||
      typeof properties.name !== 'string' ||
      !properties.name.trim()
    )
      continue
    const id = `${type}/${rawId}`
    const strings = (keys: string[]) => [
      ...new Set(
        keys
          .map((key) => properties[key])
          .filter(
            (value): value is string =>
              typeof value === 'string' && !!value.trim(),
          ),
      ),
    ]
    const street = strings(['street', 'housenumber']).join(' ')
    const address = [
      street,
      ...strings(['postcode', 'city', 'district', 'state', 'country']),
    ]
      .filter(Boolean)
      .join(', ')
      .slice(0, 500)
    const value = String(properties.osm_value || '')
    const kind =
      value === 'cafe'
        ? '카페'
        : ['restaurant', 'fast_food', 'food_court'].includes(value)
          ? '맛집'
          : ['hotel', 'hostel', 'guest_house', 'motel'].includes(value)
            ? '숙소'
            : ['station', 'aerodrome', 'bus_station', 'halt'].includes(value)
              ? '이동'
              : '관광'
    result.set(id, {
      id,
      provider: 'osm',
      name: properties.name.trim().slice(0, 160),
      address,
      link: `https://www.openstreetmap.org/${id}`,
      coordinates: { lat, lng },
      kind,
      attributions: [
        {
          provider: '© OpenStreetMap contributors · ODbL',
          url: 'https://www.openstreetmap.org/copyright',
        },
      ],
    })
  }
  return [...result.values()].slice(0, 10)
}
async function freePlaces(
  query: string,
  context?: SearchContext,
): Promise<SearchPlace[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: '10',
    lang: 'en',
  })
  const country =
    context &&
    (countries[context.country] ||
      (/^[a-z]{2}$/i.test(context.country)
        ? context.country.toUpperCase()
        : ''))
  if (country) params.set('countrycode', country)
  const center = places.find(
    (place) =>
      place.cityId === context?.guideCityId &&
      typeof place.lat === 'number' &&
      typeof place.lng === 'number',
  )
  if (center) {
    params.set('lat', String(center.lat))
    params.set('lon', String(center.lng))
    params.set('zoom', '12')
  }
  const key = params.toString(),
    entries = cache(),
    saved = entries[key]
  if (
    saved &&
    Array.isArray(saved.places) &&
    (Date.now() - saved.at < 30 * 86400000 || !navigator.onLine)
  ) {
    // Validate cached data through the same boundary used for server results.
    return saved.places
  }
  if (!navigator.onLine)
    throw new Error(
      '인터넷 연결이 없습니다. 이전 검색이나 직접 입력으로 추가하세요.',
    )
  const existing = inflight.get(key)
  if (existing) return existing
  const task = queue.then(async () => {
    const delay = Math.max(0, 1100 - (Date.now() - lastStarted))
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    lastStarted = Date.now()
    let body: unknown
    if (Capacitor.getPlatform() === 'android') {
      const response = await CapacitorHttp.get({
        url: `${ENDPOINT}?${params}`,
        headers: {
          'User-Agent':
            'JidoTravel/1.0 (https://github.com/rjs198426-lang/JIdo)',
        },
        connectTimeout: 12000,
        readTimeout: 12000,
        responseType: 'json',
      })
      if (response.status < 200 || response.status >= 300)
        throw new Error(
          '무료 장소 검색에 연결할 수 없습니다. 잠시 후 다시 찾거나 직접 입력하세요.',
        )
      body =
        typeof response.data === 'string'
          ? JSON.parse(response.data)
          : response.data
    } else {
      const response = await fetch(`${ENDPOINT}?${params}`, {
        signal: AbortSignal.timeout(12000),
      })
      if (!response.ok)
        throw new Error(
          '무료 장소 검색에 연결할 수 없습니다. 잠시 후 다시 찾거나 직접 입력하세요.',
        )
      body = await response.json()
    }
    const found = photonPlaces(body),
      latest = cache()
    latest[key] = { at: Date.now(), places: found }
    const trimmed = Object.fromEntries(
      Object.entries(latest)
        .sort(([, a], [, b]) => b.at - a.at)
        .slice(0, 80),
    )
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed))
    } catch {
      /* Saving the selected stop remains available. */
    }
    return found
  })
  queue = task.catch(() => {})
  inflight.set(key, task)
  try {
    return await task
  } finally {
    inflight.delete(key)
  }
}
export async function findPlaces(
  query: string,
  service: PlaceSearchService,
  context?: SearchContext,
) {
  if (service === 'osm') return freePlaces(query, context)
  return (
    await searchGooglePlaces(
      context ? [context.name, context.country, query.trim()].join(' ') : query,
    )
  ).map((place) => ({ ...place, provider: 'google' as const }))
}
