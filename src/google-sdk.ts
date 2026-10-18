type Libraries = {
  maps: google.maps.MapsLibrary
  core: google.maps.CoreLibrary
  routes: google.maps.RoutesLibrary
  places: google.maps.PlacesLibrary
}
type MapsWindow = Window & {
  google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } }
  __jdoMapsReady?: () => void
  gm_authFailure?: () => void
}
const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
let loading: Promise<void> | undefined
let authenticationError = ''
export function googleMapsConfigured() {
  return Boolean(key || (window as MapsWindow).google?.maps?.importLibrary)
}
export async function loadGoogleLibrary<K extends keyof Libraries>(
  name: K,
): Promise<Libraries[K]> {
  const target = window as MapsWindow
  if (authenticationError) throw new Error(authenticationError)
  if (!target.google?.maps?.importLibrary) {
    if (!key) throw new Error('Google 지도 연결이 아직 설정되지 않았습니다.')
    if (!loading)
      loading = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        const previousAuth = target.gm_authFailure
        let finished = false
        const finish = (error?: Error) => {
          if (finished) return
          finished = true
          clearTimeout(timer)
          delete target.__jdoMapsReady
          if (error) {
            target.gm_authFailure = previousAuth
            script.remove()
            reject(error)
          } else resolve()
        }
        const timer = window.setTimeout(
          () =>
            finish(
              new Error('Google 지도 연결이 지연됩니다. 다시 시도해 주세요.'),
            ),
          20000,
        )
        target.__jdoMapsReady = () => finish()
        target.gm_authFailure = () => {
          authenticationError = 'Google 지도 인증 설정을 확인해야 합니다.'
          window.dispatchEvent(new Event('jido:google-auth-error'))
          finish(new Error(authenticationError))
          previousAuth?.()
        }
        script.onerror = () =>
          finish(
            new Error(
              'Google 지도에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.',
            ),
          )
        script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, v: 'weekly', language: 'ko', loading: 'async', callback: '__jdoMapsReady' })}`
        script.async = true
        document.head.append(script)
      }).catch((error) => {
        loading = undefined
        throw error
      })
    await loading
  }
  if (!target.google?.maps?.importLibrary)
    throw new Error('Google 지도를 불러오지 못했습니다.')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      target.google.maps.importLibrary(name) as Promise<Libraries[K]>,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('Google 지도 연결이 지연됩니다. 다시 시도해 주세요.'),
            ),
          20000,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
