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
export function useTravelStore() {
  const canPersist = useRef(true)
  const [store, setStore] = useState<TravelStore>(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return emptyStore
      const parsed: unknown = JSON.parse(saved)
      if (isValidStore(parsed)) return parsed
      try {
        localStorage.setItem(`${STORAGE_KEY}-recovery`, saved)
      } catch {
        canPersist.current = false
      }
      // A damaged record must not erase other valid trips or saved places.
      const data = parsed as Partial<TravelStore> | null
      if (data?.version !== 1) return emptyStore
      const ids = new Set<string>()
      return {
        version: 1,
        savedCities: Array.isArray(data.savedCities)
          ? [
              ...new Set(
                data.savedCities.filter(
                  (id) => typeof id === 'string' && !!getCity(id),
                ),
              ),
            ]
          : [],
        savedPlaces: Array.isArray(data.savedPlaces)
          ? [
              ...new Set(
                data.savedPlaces.filter(
                  (id) => typeof id === 'string' && !!getPlace(id),
                ),
              ),
            ]
          : [],
        trips: Array.isArray(data.trips)
          ? data.trips
              .filter((trip) => {
                if (!tripSchema.safeParse(trip).success || ids.has(trip.id))
                  return false
                ids.add(trip.id)
                return true
              })
              .slice(0, 500)
          : [],
      }
    } catch {
      if (saved) {
        try {
          localStorage.setItem(`${STORAGE_KEY}-recovery`, saved)
        } catch {
          canPersist.current = false
        }
      }
      return emptyStore
    }
  })
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    if (!canPersist.current) {
      setStorageError(true)
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [store])
  return { store, setStore, storageError }
}
