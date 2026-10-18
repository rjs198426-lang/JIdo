import type { Page } from '@playwright/test'
// Explicit Google SDK response models: no live Maps/Routes traffic in regression tests.
export async function googleMapsFixture(page: Page) {
  await page.route('https://**', (route) => route.abort())
  await page.addInitScript(() => {
    const w = window as any
    w.googleCalls = []
    w.googleRequestsPending = []
    w.googleDelay = false
    w.googleRouteFailure = false
    w.googleMapFailure = false
    let overlayIndex = 0
    class MapFixture {
      element: HTMLElement
      root: HTMLElement
      constructor(element: HTMLElement) {
        if (w.googleMapFailure)
          throw new Error('Google 지도에 연결할 수 없습니다.')
        this.element = element
        this.root = document.createElement('div')
        this.root.className = 'google-map-fixture'
        this.root.style.cssText = 'position:relative;height:100%;width:100%'
        const attribution = document.createElement('span')
        attribution.className = 'google-attribution-fixture'
        attribution.textContent = 'Google Maps'
        attribution.style.cssText = 'position:absolute;bottom:0;left:0'
        this.root.append(attribution)
        element.replaceChildren(this.root)
        overlayIndex = 0
      }
      fitBounds(bounds: unknown) {
        w.lastGoogleBounds = bounds
      }
      setCenter(point: unknown) {
        w.lastGoogleCenter = point
      }
      setZoom() {}
      panTo(point: unknown) {
        w.lastGoogleCenter = point
      }
      unbindAll() {
        this.root.remove()
      }
    }
    class OverlayFixture {
      map: MapFixture | null = null
      index = overlayIndex++
      setMap(map: MapFixture | null) {
        if (this.map) (this as any).onRemove()
        this.map = map
        if (map) {
          ;(this as any).onAdd()
          ;(this as any).draw()
        }
      }
      getPanes() {
        return { overlayMouseTarget: this.map!.root }
      }
      getProjection() {
        return {
          fromLatLngToDivPixel: () => ({
            x: 35 + (this.index % 4) * 55,
            y: 60 + Math.floor(this.index / 4) * 60,
          }),
        }
      }
      static preventMapHitsAndGesturesFrom() {}
    }
    class PolylineFixture {
      element = document.createElement('div')
      constructor(options: any) {
        this.element.className = 'google-route-fixture'
        options.map.root.append(this.element)
      }
      setMap(map: MapFixture | null) {
        if (!map) this.element.remove()
      }
    }
    class LatLngFixture {
      constructor(
        public lat: number,
        public lng: number,
      ) {}
    }
    w.google = {
      maps: {
        importLibrary: async (name: string) => {
          if (name === 'maps')
            return {
              Map: MapFixture,
              OverlayView: OverlayFixture,
              Polyline: PolylineFixture,
            }
          if (name === 'core') return { LatLng: LatLngFixture }
          if (name === 'routes')
            return {
              Route: {
                computeRoutes: async (request: any) => {
                  w.googleCalls.push(request)
                  if (w.googleRouteFailure) throw new Error('REQUEST_DENIED')
                  const response = {
                    routes: [
                      {
                        durationMillis:
                          request.travelMode === 'WALKING'
                            ? 750000
                            : request.travelMode === 'TRANSIT'
                              ? 1320000
                              : 540000,
                        path: [
                          { ...request.origin, altitude: 0 },
                          { ...request.destination, altitude: 0 },
                        ],
                        warnings:
                          request.travelMode === 'WALKING'
                            ? ['보행 경로를 확인하세요.']
                            : [],
                      },
                    ],
                  }
                  return w.googleDelay
                    ? new Promise((resolve) =>
                        w.googleRequestsPending.push(() => resolve(response)),
                      )
                    : response
                },
              },
            }
          throw new Error('Unsupported fixture library')
        },
      },
    }
  })
}
