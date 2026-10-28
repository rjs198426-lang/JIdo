import { useEffect, useRef, useState } from 'react'
import { getCity, getPlace } from './catalog'

import { tripSchema, type Trip } from './travel-model'
export type { Trip, Stop } from './travel-model'

export interface TravelStore {
  version: 1
  savedCities: string[]
  savedPlaces: string[]
  trips: Trip[]
}
export const STORAGE_KEY = 'jido-travel-v1'
const emptyStore: TravelStore = {
  version: 1,
  savedCities: [],
  savedPlaces: [],
  trips: [],
}
export function dayCount(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1
}
export function dateAt(start: string, offset: number) {
  const date = new Date(`${start}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export function formatDate(date: string, weekday = false) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    ...(weekday ? { weekday: 'short' as const } : {}),
    timeZone: 'UTC',
  })
}
export function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function isValidStore(value: unknown): value is TravelStore {
  if (!value || typeof value !== 'object') return false
  const data = value as TravelStore
  return (
    data.version === 1 &&
    Array.isArray(data.savedCities) &&
    data.savedCities.every((id) => typeof id === 'string' && !!getCity(id)) &&
    Array.isArray(data.savedPlaces) &&
    data.savedPlaces.every((id) => typeof id === 'string' && !!getPlace(id)) &&
    Array.isArray(data.trips) &&
    data.trips.length <= 500 &&
    new Set(data.trips.map((trip) => trip?.id)).size === data.trips.length &&
    data.trips.every((trip) => tripSchema.safeParse(trip).success)
  )
}
export const SAVE_ERROR_MESSAGE =
  '변경 사항을 저장하지 못했어요. 기기 저장 공간을 확인한 뒤 다시 저장해 주세요.'
export const RECOVERY_PREFIX = `${STORAGE_KEY}-recovery-v1:`
export type StoreUpdate = TravelStore | ((previous: TravelStore) => TravelStore)
export type SaveResult = boolean | void
export type RecoveryRecord = {
  id: string
  raw: string
  createdAt: string
  keptTrips: number
  excludedTrips: number | null
  excludedCities: number | null
  excludedPlaces: number | null
  unreadable: boolean
  acknowledged: boolean
  preserved: boolean
}

function salvage(raw: string) {
  let data: Partial<TravelStore> | null = null
  try {
    data = JSON.parse(raw)
  } catch {
    /* Keep the exact unreadable original for export. */
  }
  const ids = new Set<string>()
  const trips =
    data?.version === 1 && Array.isArray(data.trips)
      ? data.trips
          .filter((trip) => {
            if (!tripSchema.safeParse(trip).success || ids.has(trip.id))
              return false
            ids.add(trip.id)
            return true
          })
          .slice(0, 500)
      : []
  const cities =
    data?.version === 1 && Array.isArray(data.savedCities)
      ? [
          ...new Set(
            data.savedCities.filter(
              (id) => typeof id === 'string' && !!getCity(id),
            ),
          ),
        ]
      : []
  const places =
    data?.version === 1 && Array.isArray(data.savedPlaces)
      ? [
          ...new Set(
            data.savedPlaces.filter(
              (id) => typeof id === 'string' && !!getPlace(id),
            ),
          ),
        ]
      : []
  return {
    store: {
      version: 1 as const,
      trips,
      savedCities: cities,
      savedPlaces: places,
    },
    details: {
      keptTrips: trips.length,
      excludedTrips: Array.isArray(data?.trips)
        ? data.trips.length - trips.length
        : null,
      excludedCities: Array.isArray(data?.savedCities)
        ? data.savedCities.length - cities.length
        : null,
      excludedPlaces: Array.isArray(data?.savedPlaces)
        ? data.savedPlaces.length - places.length
        : null,
      unreadable: data?.version !== 1 || !Array.isArray(data?.trips),
    },
  }
}
function recoveryRecord(
  raw: string,
  id: string = crypto.randomUUID(),
): RecoveryRecord {
  return {
    id,
    raw,
    createdAt: new Date().toISOString(),
    ...salvage(raw).details,
    acknowledged: false,
    preserved: false,
  }
}
function readRecoveries(): RecoveryRecord[] {
  const records: RecoveryRecord[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(RECOVERY_PREFIX)) continue
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null')
      if (
        value &&
        typeof value.raw === 'string' &&
        typeof value.id === 'string' &&
        key === RECOVERY_PREFIX + value.id
      ) {
        const record = recoveryRecord(value.raw, value.id)
        records.push({
          ...record,
          ...Object.fromEntries(
            ['keptTrips', 'excludedTrips', 'excludedCities', 'excludedPlaces']
              .filter(
                (key) =>
                  (key !== 'keptTrips' && value[key] === null) ||
                  (Number.isSafeInteger(value[key]) && value[key] >= 0),
              )
              .map((key) => [key, value[key]]),
          ),
          unreadable:
            typeof value.unreadable === 'boolean'
              ? value.unreadable
              : record.unreadable,
          createdAt:
            typeof value.createdAt === 'string'
              ? value.createdAt
              : record.createdAt,
          acknowledged: value.acknowledged === true,
          preserved: true,
        })
      }
    } catch {
      /* Never overwrite an unreadable recovery file. */
    }
  }
  const legacy = localStorage.getItem(`${STORAGE_KEY}-recovery`)
  if (legacy && !records.some((record) => record.raw === legacy))
    records.push({
      ...recoveryRecord(
        legacy,
        records.some((record) => record.id === 'legacy')
          ? crypto.randomUUID()
          : 'legacy',
      ),
      preserved: true,
    })
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
function loadStore() {
  let raw: string | null = null
  let recoveries: RecoveryRecord[] = []
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    recoveries = readRecoveries()
    if (!raw)
      return {
        store: emptyStore,
        raw,
        recoveries,
        damaged: false,
        readError: false,
      }
    try {
      const value: unknown = JSON.parse(raw)
      if (isValidStore(value))
        return {
          store: value,
          raw,
          recoveries,
          damaged: false,
          readError: false,
        }
    } catch {
      /* Salvage valid records below, without writing during render. */
    }
    const record =
      recoveries.find((item) => item.raw === raw && !item.acknowledged) ||
      recoveryRecord(raw)
    if (!recoveries.includes(record)) recoveries = [record, ...recoveries]
    return {
      store: salvage(raw).store,
      raw,
      recoveries,
      damaged: true,
      readError: false,
    }
  } catch {
    return {
      store: emptyStore,
      raw,
      recoveries,
      damaged: false,
      readError: true,
    }
  }
}

export function useTravelStore() {
  const [initial] = useState(loadStore)
  const [store, renderStore] = useState(initial.store)
  const current = useRef(initial.store)
  const [recoveries, setRecoveries] = useState(initial.recoveries)
  const recoveryRef = useRef(initial.recoveries)
  const [storageError, setStorageError] = useState(initial.readError)
  const [saveError, setSaveError] = useState(
    initial.readError ? SAVE_ERROR_MESSAGE : '',
  )
  const originProtected = useRef(!initial.damaged)
  const durable = useRef(initial.raw)

  function writeRecovery(record: RecoveryRecord) {
    // Each damaged source gets its own key. A later recovery never replaces it.
    const saved = { ...record, preserved: true }
    localStorage.setItem(RECOVERY_PREFIX + record.id, JSON.stringify(saved))
    const next = [
      saved,
      ...recoveryRef.current.filter((item) => item.id !== record.id),
    ]
    recoveryRef.current = next
    setRecoveries(next)
  }
  function protectOriginal() {
    if (originProtected.current) return
    const record = recoveryRef.current.find((item) => item.raw === initial.raw)!
    const existing = localStorage.getItem(RECOVERY_PREFIX + record.id)
    let preserved =
      record.id === 'legacy' &&
      localStorage.getItem(`${STORAGE_KEY}-recovery`) === record.raw
    try {
      preserved ||= !!existing && JSON.parse(existing).raw === record.raw
    } catch {
      /* Preserve malformed copies too. */
    }
    if (!preserved) writeRecovery(record)
    originProtected.current = true
  }
  function failed(message = SAVE_ERROR_MESSAGE) {
    setStorageError(true)
    setSaveError(message)
    return false
  }
  useEffect(() => {
    if (!initial.damaged) return
    try {
      protectOriginal()
      // Do not overwrite a record changed by another window while starting.
      if (localStorage.getItem(STORAGE_KEY) === initial.raw) {
        const normalized = JSON.stringify(initial.store)
        localStorage.setItem(STORAGE_KEY, normalized)
        durable.current = normalized
      }
    } catch {
      failed(
        '복구 원본을 보관하거나 정상 기록을 저장하지 못했어요. 원본 내보내기 후 기기 저장 공간을 확인해 주세요.',
      )
    }
    // Initialization only; user updates are persisted synchronously below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setStore = (change: StoreUpdate): boolean => {
    if (initial.readError)
      return failed(
        '저장된 기록을 읽지 못해 변경을 막았어요. 앱을 다시 열어 기존 기록을 확인해 주세요.',
      )
    const next = typeof change === 'function' ? change(current.current) : change
    if (!isValidStore(next))
      return failed(
        '저장할 기록을 확인하지 못했어요. 입력 내용을 확인한 뒤 다시 저장해 주세요.',
      )
    try {
      protectOriginal()
      const disk = localStorage.getItem(STORAGE_KEY)
      const text = JSON.stringify(next)
      if (disk !== durable.current && disk !== text)
        return failed(
          '다른 화면에서 기록이 변경되었어요. 입력 내용을 보관한 뒤 앱을 다시 열어 주세요.',
        )
      if (disk !== text) localStorage.setItem(STORAGE_KEY, text)
      durable.current = text
      current.current = next
      renderStore(next)
      setStorageError(false)
      setSaveError('')
      return true
    } catch {
      return failed()
    }
  }
  const acknowledgeRecovery = (id: string): boolean => {
    const record = recoveryRef.current.find((item) => item.id === id)
    if (!record) return false
    try {
      // Finish a previously blocked normalization before marking the incident
      // confirmed; otherwise the unchanged damaged main file would re-alert.
      if (
        initial.damaged &&
        record.raw === initial.raw &&
        localStorage.getItem(STORAGE_KEY) === initial.raw
      ) {
        if (!setStore(current.current)) return false
      }
      writeRecovery({ ...record, acknowledged: true })
      return true
    } catch {
      return failed(
        '복구 확인을 저장하지 못했어요. 원본은 유지되며 다음 실행에서도 안내해 드려요.',
      )
    }
  }
  return {
    store,
    setStore,
    storageError,
    saveError,
    recoveries,
    acknowledgeRecovery,
  }
}
