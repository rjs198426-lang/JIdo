/** Shared links stay intact: short URLs cannot reveal a place name offline. */
export function googleMapsLink(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null
    const valid =
      url.hostname === 'maps.app.goo.gl' ||
      (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/')) ||
      ([
        'www.google.com',
        'google.com',
        'maps.google.com',
        'www.google.co.kr',
        'maps.google.co.kr',
      ].includes(url.hostname) &&
        (/^\/maps(?:\/|$)/.test(url.pathname) ||
          url.hostname.startsWith('maps.')))
    return valid ? url.href : null
  } catch {
    return null
  }
}
export function parseMapsShare(text: string) {
  const raw = text.match(/https:\/\/[^\s<>"']+/)?.[0]?.replace(/[)。,]+$/, '')
  const link = raw && googleMapsLink(raw)
  if (!link) throw new Error('구글 지도의 공유 링크를 붙여넣어 주세요.')
  const url = new URL(link)
  const sharedName = text
    .replace(raw!, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0]
  const pathName = url.pathname.match(/\/maps\/place\/([^/]+)/)?.[1]
  let decoded = ''
  try {
    decoded = pathName ? decodeURIComponent(pathName.replace(/\+/g, ' ')) : ''
  } catch {
    /* A malformed label is optional. */
  }
  const query = url.searchParams.get('query') || url.searchParams.get('q') || ''
  const name =
    sharedName ||
    decoded ||
    (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(query) ? '' : query)
  return { link, name: name.slice(0, 160) }
}
export function mapsSearch(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
