import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { routeSegments, type RoutePoint } from './route-map-model'

export default function ItineraryMap({
  points,
  selectedId,
  onSelect,
}: {
  points: RoutePoint[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const canvas = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, L.Marker>())
  const geometry = useRef('')
  const previousSelection = useRef(selectedId)
  const current = useRef({ points, onSelect })
  current.current = { points, onSelect }
  const [tileFailure, setTileFailure] = useState(false)
  const hasPoints = points.length > 0
  function fitAll() {
    const all = current.current.points
    if (!map.current || !all.length) return
    map.current.fitBounds(
      L.latLngBounds(all.map((point) => [point.lat, point.lng])),
      { padding: [38, 38], maxZoom: 16, animate: false },
    )
  }
  useEffect(() => {
    if (!canvas.current || !hasPoints) return
    const instance = L.map(canvas.current, {
      scrollWheelZoom: false,
      minZoom: 2,
      maxZoom: 19,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      zoomControl: false,
    })
    map.current = instance
    L.control
      .zoom({ zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' })
      .addTo(instance)
    instance.attributionControl.setPrefix(false)
    const tiles = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
        keepBuffer: 1,
        updateWhenIdle: true,
        updateWhenZooming: false,
      },
    )
    let loaded = 0,
      failed = 0
    tiles.on('loading', () => {
      loaded = 0
      failed = 0
    })
    tiles.on('tileload', () => {
      loaded++
    })
    tiles.on('tileerror', () => {
      failed++
      setTileFailure(true)
    })
    tiles.on('load', () => setTileFailure(failed > 0 && loaded === 0))
    tiles.addTo(instance)
    layers.current = L.layerGroup().addTo(instance)
    geometry.current = ''
    setTileFailure(false)
    const observer = new ResizeObserver(() =>
      instance.invalidateSize({ pan: false }),
    )
    observer.observe(canvas.current)
    return () => {
      observer.disconnect()
      instance.remove()
      map.current = null
      layers.current = null
      markers.current.clear()
    }
  }, [hasPoints])
  useEffect(() => {
    if (!map.current || !layers.current) return
    const group = layers.current
    group.clearLayers()
    markers.current.clear()
    for (const segment of routeSegments(points)) {
      L.polyline(
        segment.map((point) => [point.lat, point.lng]),
        { color: '#ffffff', weight: 8, opacity: 0.9, interactive: false },
      ).addTo(group)
      L.polyline(
        segment.map((point) => [point.lat, point.lng]),
        {
          color: '#087b70',
          weight: 4,
          opacity: 1,
          interactive: false,
          className: 'itinerary-route-line',
        },
      ).addTo(group)
    }
    for (const point of points) {
      const marker = L.marker([point.lat, point.lng], {
        title: `${point.number}. ${point.name}`,
        keyboard: true,
        icon: L.divIcon({
          className: 'itinerary-map-pin',
          html: `<span>${point.number}</span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      })
      // Icons are created on map load, which may happen after fitBounds.
      marker.on('add', () =>
        marker
          .getElement()
          ?.setAttribute('aria-label', `${point.number}번 ${point.name} 선택`),
      )
      marker.on('click', () => current.current.onSelect(point.stopId))
      marker.addTo(group)
      markers.current.set(point.stopId, marker)
    }
    const next = points
      .map((point) => `${point.stopId}:${point.lat}:${point.lng}`)
      .sort()
      .join('|')
    if (next !== geometry.current) {
      geometry.current = next
      fitAll()
    }
  }, [points, hasPoints])
  useEffect(() => {
    const target = selectedId && markers.current.get(selectedId)
    if (target && previousSelection.current !== selectedId)
      map.current?.panTo(target.getLatLng(), { animate: false })
    previousSelection.current = selectedId
    for (const [id, marker] of markers.current) {
      marker.getElement()?.classList.toggle('selected', id === selectedId)
      marker
        .getElement()
        ?.setAttribute('aria-pressed', String(id === selectedId))
      marker.setZIndexOffset(id === selectedId ? 1000 : 0)
    }
  }, [selectedId, points, hasPoints])
  return (
    <figure className="itinerary-map" aria-label="일정 순서 지도">
      {hasPoints ? (
        <>
          <div
            className="itinerary-map-canvas"
            ref={canvas}
            aria-label="장소 지도"
          />
          <button className="map-fit button outline small" onClick={fitAll}>
            전체 동선
          </button>
          {tileFailure && (
            <small className="map-connection-status" role="status">
              지도 배경 연결 안 됨
            </small>
          )}
        </>
      ) : (
        <div className="map-no-position">표시할 위치가 없습니다</div>
      )}
      <figcaption>방문 순서 · 직선 연결</figcaption>
    </figure>
  )
}
