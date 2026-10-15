import { Capacitor } from '@capacitor/core'
import { guideSchema, type Guide, type GuideRequest } from './guide-schema'

const URL_KEY = 'jdo-guide-server-url'
export function configuredApiUrl(): string {
  try {
    return (
      localStorage.getItem(URL_KEY) ||
      import.meta.env.VITE_GUIDE_API_URL ||
      (Capacitor.isNativePlatform() ? '' : '/api')
    )
  } catch {
    return (
      import.meta.env.VITE_GUIDE_API_URL ||
      (Capacitor.isNativePlatform() ? '' : '/api')
    )
  }
}
export function normalizeApiUrl(value: string) {
  if (value === '/api' && !Capacitor.isNativePlatform()) return value
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'HTTPS 서버 주소를 입력하세요. 예: https://guide.example.com/api',
    )
  return (
    url.toString().replace(/\/$/, '') +
    (url.pathname.replace(/\/$/, '') === '' ? '/api' : '')
  )
}
export function saveApiUrl(value: string) {
  const normalized = normalizeApiUrl(value.trim())
  localStorage.setItem(URL_KEY, normalized)
  return normalized
}
export async function api<T>(
  endpoint: string,
  options: RequestInit = {},
  base = configuredApiUrl(),
): Promise<T> {
  if (!base) throw new Error('가이드 서버를 먼저 연결해 주세요.')
  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    signal: options.signal || AbortSignal.timeout(15000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(
      result.error || '서버 요청을 처리하지 못했습니다.',
    ) as Error & { status: number }
    error.status = response.status
    throw error
  }
  return result as T
}
export async function fetchGuides(base = configuredApiUrl()): Promise<Guide[]> {
  const result = await api<{ schemaVersion: number; guides: unknown[] }>(
    '/guides',
    {},
    base,
  )
  if (
    result.schemaVersion !== 1 ||
    !Array.isArray(result.guides) ||
    result.guides.length > 1000
  )
    throw new Error('지원하지 않는 가이드 형식입니다.')
  return result.guides
    .map((value) => guideSchema.parse(value))
    .filter((guide) => guide.status === 'published')
}
export async function sendGuideRequest(
  country: string,
  city: string,
  notes: string,
) {
  return api<{ request: GuideRequest; duplicate?: boolean }>('/requests', {
    method: 'POST',
    body: JSON.stringify({ country, city, notes }),
  })
}
