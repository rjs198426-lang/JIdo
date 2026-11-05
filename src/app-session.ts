import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { z } from 'zod'
import { getCity, getPlace } from './catalog'
import type { Trip } from './travel-model'

export const SESSION_KEY = 'jido-last-screen-v1'
const text = z.string().max(200)
const day = z.number().int().min(0).max(89)
const dialogSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('personal-place'),
    personalId: z.string().uuid().optional(),
    draftId: text.optional(),
    cityId: text.optional(),
    kind: text.optional(),
    initialName: text.optional(),
  }),
  z.object({ type: z.literal('credits') }),
  z.object({ type: z.literal('reminders') }),
  z.object({ type: z.literal('nearby') }),
  z.object({ type: z.literal('recovery') }),
  z.object({ type: z.literal('guidebooks') }),
  z.object({ type: z.literal('backup') }),
  z.object({
    type: z.literal('city'),
    id: text,
    guideTab: z.enum(['ready', 'info', 'tourism', 'dining']).optional(),
  }),
  z.object({ type: z.literal('place'), id: text }),
  z.object({ type: z.literal('add'), placeId: text }),
  z.object({ type: z.literal('edit'), tripId: text }),
  z.object({ type: z.literal('picker'), tripId: text, day }),
  z.object({
    type: z.literal('expense'),
    tripId: text,
    day,
    stopId: text.optional(),
  }),
  z.object({
    type: z.literal('custom'),
    tripId: text,
    day,
    stopId: text.optional(),
    initialName: text.optional(),
  }),
  z.object({
    type: z.literal('create'),
    cityId: text.optional(),
    placeId: text.optional(),
    initialName: text.optional(),
    initialCountry: text.optional(),
    pendingPlaceName: text.optional(),
  }),
])
const schema = z.object({
  version: z.literal(1),
  page: z.enum(['home', 'trips', 'explore', 'settings']),
  tripLibrary: z.boolean(),
  activeTripId: text,
  day,
  query: text,
  region: text,
  category: text,
  exploreCity: text,
  exploreTab: z.enum(['cities', 'places']),
  placeLimit: z.number().int().min(24).max(10000),
  scroll: z.number().finite().min(0).max(10000000),
  modalScroll: z.array(z.number().finite().min(0).max(10000000)).max(10),
  detailCount: z.number().int().min(0).max(2000),
  openDetails: z.array(z.number().int().min(0).max(2000)).max(100),
  dialog: dialogSchema.nullable(),
})
export type AppSession = z.infer<typeof schema>
export function readAppSession(trips: Trip[]): AppSession | undefined {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw || raw.length > 16000) return
    const parsed = schema.safeParse(JSON.parse(raw))
    if (!parsed.success) return
    const s = parsed.data,
      trip = trips.find((t) => t.id === s.activeTripId)
    if (!trip) {
      s.activeTripId = ''
      s.day = 0
      if (s.page === 'trips') {
        s.tripLibrary = true
        s.scroll = 0
        s.modalScroll = []
      }
    } else s.day = Math.min(s.day, trip.days.length - 1)
    const d = s.dialog
    if (d && 'tripId' in d) {
      const target = trips.find((t) => t.id === d.tripId)
      if (
        !target ||
        ('day' in d && !target.days[d.day]) ||
        ('stopId' in d &&
          d.stopId &&
          !target?.days.flat().some((stop) => stop.id === d.stopId))
      )
        s.dialog = null
    }
    if (d?.type === 'city' && !getCity(d.id)) s.dialog = null
    if (d?.type === 'place' && !getPlace(d.id)) s.dialog = null
    if (d?.type === 'add' && !getPlace(d.placeId)) s.dialog = null
    return s
  } catch {
    return
  }
}
// Store navigation only. No location samples, route results, attachments or record copies.
function safeDialog(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'create' &&
    ('course' in value || 'registeredPlace' in value)
  )
    return null
  const parsed = dialogSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
export function useAppSession(
  state: Omit<
    AppSession,
    | 'version'
    | 'scroll'
    | 'modalScroll'
    | 'dialog'
    | 'detailCount'
    | 'openDetails'
  > & {
    dialog: unknown
  },
  initial?: AppSession,
) {
  const latest = useRef(state)
  latest.current = state
  const bootState = useRef(JSON.stringify(state))
  const restoring = useRef(!!initial)
  useLayoutEffect(() => {
    if (!initial) return
    let cancelled = false
    const restore = () => {
      if (cancelled) return
      if (JSON.stringify(latest.current) !== bootState.current) {
        restoring.current = false
        save()
        return
      }
      const details = document.querySelectorAll<HTMLDetailsElement>(
        'main details, .modal details',
      )
      if (details.length === initial.detailCount)
        details.forEach((el, i) => (el.open = initial.openDetails.includes(i)))
      window.scrollTo({ top: initial.scroll, behavior: 'instant' })
      document
        .querySelectorAll<HTMLElement>('.modal, .modal .modal-body')
        .forEach((el, i) => (el.scrollTop = initial.modalScroll[i] || 0))
      restoring.current = false
      save()
    }
    let frame = 0
    void document.fonts.ready.then(() => {
      if (!cancelled)
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(restore)
        })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [])
  const save = () => {
    if (restoring.current) return
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...latest.current,
          version: 1,
          dialog: safeDialog(latest.current.dialog),
          scroll: window.scrollY,
          detailCount: document.querySelectorAll('main details, .modal details')
            .length,
          openDetails: Array.from(
            document.querySelectorAll<HTMLDetailsElement>(
              'main details, .modal details',
            ),
          )
            .flatMap((el, i) => (el.open ? [i] : []))
            .slice(0, 100),
          modalScroll: Array.from(
            document.querySelectorAll<HTMLElement>(
              '.modal, .modal .modal-body',
            ),
            (el) => el.scrollTop,
          ).slice(0, 10),
        }),
      )
    } catch {
      /* Navigation storage must not block travel editing. */
    }
  }
  useEffect(save, [state])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const scroll = () => {
      clearTimeout(timer)
      timer = setTimeout(save, 120)
    }
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('toggle', scroll, true)
    window.addEventListener('pagehide', save)
    window.addEventListener('jido:launcher-open', save)
    document.addEventListener('visibilitychange', save)
    const native = Capacitor.isNativePlatform()
      ? NativeApp.addListener('appStateChange', save)
      : undefined
    return () => {
      clearTimeout(timer)
      void native?.then((handle) => handle.remove())
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('toggle', scroll, true)
      window.removeEventListener('pagehide', save)
      window.removeEventListener('jido:launcher-open', save)
      document.removeEventListener('visibilitychange', save)
    }
  }, [])
}
