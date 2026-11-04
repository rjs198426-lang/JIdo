import { useEffect, useRef, useState } from 'react'
import { googleMapsConfigured, loadGoogleLibrary } from './google-sdk'
import { routePoints } from './route-map-model'
import {
  activeDayStops,
  placeSignature,
  transferFor,
} from './transfer-planning'
import type { Stop, Trip } from './travel-model'
import { routeDeparture } from './route-time'
export type TravelMode = 'walking' | 'transit' | 'driving'
export const travelModes: Record<TravelMode, string> = {
  walking: '도보',
  transit: '대중교통',
  driving: '자동차',
}
export type GoogleRoute = {
  minutes: number
  path: google.maps.LatLngLiteral[]
  warnings: string[]
  departureAt?: string
  checkedAt: string
}
type RouteState = { pending?: boolean; value?: GoogleRoute; error?: string }
export function googleRouteKey(
  previous: Stop,
  stop: Stop,
  mode: TravelMode,
  departure?: Date,
) {
  return JSON.stringify([
    previous.id,
    stop.id,
    placeSignature(previous),
    placeSignature(stop),
    mode,
    departure?.toISOString() || null,
  ])
}
export async function computeGoogleRoute(
  previous: Stop,
  stop: Stop,
  mode: TravelMode,
  departure?: Date,
): Promise<GoogleRoute> {
  const origin = routePoints([previous])[0],
    destination = routePoints([stop])[0]
  if (!origin || !destination)
    throw new Error('두 장소의 위치를 추가하면 자동 계산할 수 있어요.')
  if (!navigator.onLine)
    throw new Error('인터넷에 연결하면 이동시간을 계산할 수 있어요.')
  if (departure && mode !== 'walking') {
    const offset = +departure - Date.now()
    if (
      (mode === 'driving' && offset < 0) ||
      (mode === 'transit' &&
        (offset < -7 * 86400000 || offset > 100 * 86400000))
    )
      throw new Error('선택한 날짜는 이동시간 조회 범위를 벗어나요.')
  }
  const { Route } = await loadGoogleLibrary('routes')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const response = await Promise.race([
      Route.computeRoutes({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode:
          mode === 'walking'
            ? 'WALKING'
            : mode === 'transit'
              ? 'TRANSIT'
              : 'DRIVING',
        ...(mode === 'driving'
          ? { routingPreference: 'TRAFFIC_AWARE_OPTIMAL' as const }
          : {}),
        ...(departure && mode !== 'walking'
          ? { departureTime: departure }
          : {}),
        fields: ['durationMillis', 'path', 'warnings'],
        language: 'ko',
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Google 이동시간 계산이 지연됩니다. 다시 시도해 주세요.',
              ),
            ),
          20000,
        )
      }),
    ])
    const route = response.routes?.[0]
    const duration = route?.durationMillis
    if (duration == null || !Number.isFinite(duration) || duration < 0)
      throw new Error('선택한 이동수단의 경로를 찾지 못했어요.')
    const minutes = Math.ceil(duration / 60000)
    if (minutes > 1440)
      throw new Error('하루를 넘는 이동입니다. 날짜별 일정을 나눠 주세요.')
    return {
      minutes,
      departureAt: mode !== 'walking' ? departure?.toISOString() : undefined,
      path:
        route?.path?.map((point) => ({ lat: point.lat, lng: point.lng })) || [],
      warnings: route?.warnings || [],
      checkedAt: new Date().toISOString(),
    }
  } catch (error) {
    if (
      error instanceof Error &&
      /계산|경로|이동|지도|일정|날짜/.test(error.message)
    )
      throw error
    throw new Error(
      'Google 이동시간을 가져오지 못했어요. 연결·API 설정 또는 이동수단을 확인해 주세요.',
    )
  } finally {
    clearTimeout(timer)
  }
}
export function useGoogleRoutes(
  trip: Trip,
  day: number,
  enabled: boolean,
  onUpdate?: (trip: Trip) => boolean | void,
) {
  const [states, setStates] = useState<Record<string, RouteState>>({})
  const [revision, setRevision] = useState(0)
  // Results live only in this trip's mounted view; no Google route content goes into backups.
  const requests = useRef(
    new Map<string, { at: number; value: Promise<GoogleRoute> }>(),
  )
  const modeFor = (previous: Stop, stop: Stop): TravelMode =>
    (stop.routePreference?.fromStopId === previous.id
      ? stop.routePreference.mode
      : undefined) ||
    transferFor(previous, stop)?.mode ||
    'walking'
  const stops = activeDayStops(trip, day)
  const jobs = stops.slice(1).map((stop, i) => ({
    previous: stops[i],
    stop,
    mode: modeFor(stops[i], stop),
    departure: routeDeparture(trip, day, stops[i]),
  }))
  const signature = JSON.stringify(
    jobs.map((job) =>
      googleRouteKey(job.previous, job.stop, job.mode, job.departure),
    ),
  )
  useEffect(() => {
    if (!enabled || !googleMapsConfigured()) return
    let active = true
    void (async () => {
      for (const { previous, stop, mode, departure } of jobs) {
        if (!active) break
        const key = googleRouteKey(previous, stop, mode, departure)
        setStates((old) => ({ ...old, [key]: { pending: true } }))
        let request = requests.current.get(key)
        if (!request || Date.now() - request.at > 5 * 60000) {
          request = {
            at: Date.now(),
            value: computeGoogleRoute(previous, stop, mode, departure),
          }
          requests.current.set(key, request)
        }
        try {
          const value = await request.value
          if (active) setStates((old) => ({ ...old, [key]: { value } }))
        } catch (error) {
          if (active)
            setStates((old) => ({
              ...old,
              [key]: {
                error:
                  error instanceof Error
                    ? error.message
                    : '이동시간 계산에 실패했어요.',
              },
            }))
        }
      }
    })()
    return () => {
      active = false
    }
    // Endpoint identities, transport and local departure time invalidate cached requests.
  }, [signature, enabled, revision])
  const retry = () => {
    requests.current.clear()
    setRevision((n) => n + 1)
  }
  useEffect(() => {
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])
  return {
    configured: googleMapsConfigured(),
    modeFor,
    stateFor: (previous: Stop, stop: Stop) =>
      states[
        googleRouteKey(
          previous,
          stop,
          modeFor(previous, stop),
          routeDeparture(trip, day, previous),
        )
      ],
    setMode: (previous: Stop, stop: Stop, mode: TravelMode) =>
      onUpdate?.({
        ...trip,
        days: trip.days.map((items, index) =>
          index === day
            ? items.map((item) =>
                item.id === stop.id
                  ? {
                      ...item,
                      routePreference: { fromStopId: previous.id, mode },
                    }
                  : item,
              )
            : items,
        ),
      }),
    retry,
  }
}
export type GoogleRouting = ReturnType<typeof useGoogleRoutes>
