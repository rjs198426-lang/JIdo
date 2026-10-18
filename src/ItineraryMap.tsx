import { useEffect, useRef, useState } from 'react'
import { loadGoogleLibrary } from './google-sdk'
import type { RoutePoint } from './route-map-model'
import type { GoogleRoute } from './google-routes'

export default function ItineraryMap({
  points,
  routes,
  selectedId,
  onSelect,
}: {
  points: RoutePoint[]
  routes: GoogleRoute[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const canvas = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const current = useRef({ points, routes, selectedId, onSelect })
  current.current = { points, routes, selectedId, onSelect }
  const [ready, setReady] = useState(0)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const hasPoints = points.length > 0
  useEffect(() => {
    const fail = () => setError('Google 지도 인증 설정을 확인해야 합니다.')
    window.addEventListener('jido:google-auth-error', fail)
    return () => window.removeEventListener('jido:google-auth-error', fail)
  }, [])
  const normalize = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180
  function fitAll() {
    const all = current.current.points
    if (!map.current || !all.length) return
    if (all.length === 1) {
      map.current.setCenter({ lat: all[0].lat, lng: normalize(all[0].lng) })
      map.current.setZoom(15)
    } else
      map.current.fitBounds(
        {
          north: Math.max(...all.map((p) => p.lat)),
          south: Math.min(...all.map((p) => p.lat)),
          west: normalize(Math.min(...all.map((p) => p.lng))),
          east: normalize(Math.max(...all.map((p) => p.lng))),
        },
        36,
      )
  }
  useEffect(() => {
    if (!canvas.current || !hasPoints) return
    let active = true
    let instance: google.maps.Map | undefined
    setReady(0)
    setError('')
    void loadGoogleLibrary('maps')
      .then(({ Map: GoogleMap }) => {
        if (!active || !canvas.current) return
        instance = new GoogleMap(canvas.current, {
          center: {
            lat: current.current.points[0].lat,
            lng: normalize(current.current.points[0].lng),
          },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
          clickableIcons: false,
          keyboardShortcuts: true,
        })
        map.current = instance
        fitAll()
        setReady((n) => n + 1)
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Google 지도를 불러오지 못했어요.',
          )
      })
    return () => {
      active = false
      map.current = null
      instance?.unbindAll()
      if (instance) canvas.current?.replaceChildren()
    }
  }, [hasPoints, retry])
  const geometry = points.map((p) => `${p.stopId}:${p.lat}:${p.lng}`).join('|')
  useEffect(() => {
    fitAll()
  }, [geometry, ready])
  useEffect(() => {
    if (!map.current || !ready) return
    let active = true
    const pins: google.maps.OverlayView[] = []
    void Promise.all([loadGoogleLibrary('maps'), loadGoogleLibrary('core')])
      .then(([{ OverlayView }, { LatLng }]) => {
        if (!active || !map.current) return
        for (const point of points) {
          const button = document.createElement('button')
          button.className = `itinerary-map-pin google-map-pin${selectedId === point.stopId ? ' selected' : ''}`
          button.type = 'button'
          const number = document.createElement('span')
          number.textContent = String(point.number)
          button.append(number)
          button.setAttribute(
            'aria-label',
            `${point.number}번 ${point.name} 선택`,
          )
          button.setAttribute(
            'aria-pressed',
            String(selectedId === point.stopId),
          )
          button.onclick = () => current.current.onSelect(point.stopId)
          class Pin extends OverlayView {
            onAdd() {
              this.getPanes()?.overlayMouseTarget.append(button)
            }
            draw() {
              const pixel = this.getProjection().fromLatLngToDivPixel(
                new LatLng(point.lat, normalize(point.lng)),
              )
              if (pixel) {
                button.style.left = `${pixel.x}px`
                button.style.top = `${pixel.y}px`
              }
            }
            onRemove() {
              button.remove()
            }
          }
          const pin = new Pin()
          // Prevent marker taps/keyboard events from also panning the base map.
          OverlayView.preventMapHitsAndGesturesFrom(button)
          pin.setMap(map.current)
          pins.push(pin)
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : '장소 번호를 표시하지 못했어요.',
          )
      })
    return () => {
      active = false
      pins.forEach((pin) => pin.setMap(null))
    }
  }, [points, selectedId, ready])
  useEffect(() => {
    const point = points.find((p) => p.stopId === selectedId)
    if (point) map.current?.panTo({ lat: point.lat, lng: normalize(point.lng) })
  }, [selectedId, ready])
  useEffect(() => {
    if (!map.current || !ready) return
    let active = true
    const lines: google.maps.Polyline[] = []
    void loadGoogleLibrary('maps')
      .then(({ Polyline }) => {
        if (!active || !map.current) return
        for (const route of routes) {
          if (route.path.length < 2) continue
          lines.push(
            new Polyline({
              map: map.current,
              path: route.path,
              strokeColor: '#087b70',
              strokeWeight: 5,
              strokeOpacity: 0.9,
              clickable: false,
            }),
          )
        }
      })
      .catch(() => {})
    return () => {
      active = false
      lines.forEach((line) => line.setMap(null))
    }
  }, [routes, ready])
  return (
    <figure className="itinerary-map" aria-label="일정 순서 Google 지도">
      {hasPoints ? (
        <>
          <div
            className="itinerary-map-canvas"
            ref={canvas}
            aria-label="장소 Google 지도"
          />
          {error ? (
            <div className="google-map-status" role="status">
              <p>{error}</p>
              <button
                className="button outline small"
                onClick={() => setRetry((n) => n + 1)}
              >
                다시 연결
              </button>
            </div>
          ) : !map.current ? (
            <p className="google-map-status" role="status">
              Google 지도 여는 중…
            </p>
          ) : (
            <button className="map-fit button outline small" onClick={fitAll}>
              전체 동선
            </button>
          )}
        </>
      ) : (
        <div className="map-no-position">표시할 위치가 없습니다</div>
      )}
      <figcaption>
        Google Maps · 일정 번호
        {routes.some((route) => route.path.length > 1)
          ? '와 계산된 구간 경로'
          : ''}
      </figcaption>
    </figure>
  )
}
