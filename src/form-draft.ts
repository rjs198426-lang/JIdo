import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
const unsavedDrafts = new Set<symbol>()
export const hasUnsavedDrafts = () => unsavedDrafts.size > 0

// Form-only drafts never replace saved trip records. Restore known fields and types only.
export function useDraftFields<T extends object>(
  key: string,
  defaults: T,
  validators: Partial<{ [K in keyof T]: (value: unknown) => boolean }> = {},
  shouldPersist?: (state: T) => boolean,
) {
  const read = () => {
    try {
      const text = localStorage.getItem(key)
      if (!text || text.length > 64000) return defaults
      const raw: unknown = JSON.parse(text)
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults
      const next = { ...defaults }
      for (const field of Object.keys(defaults) as (keyof T)[]) {
        const value = (raw as T)[field],
          original = defaults[field]
        if (validators[field]) {
          if (validators[field]!(value)) next[field] = value
          continue
        }
        if (original === null) {
          if (value === null || typeof value === 'string') next[field] = value
          continue
        }
        if (Array.isArray(original)) {
          if (
            Array.isArray(value) &&
            value.length <= 100 &&
            value.every((v) => typeof v === 'string' && v.length <= 200)
          )
            next[field] = value
        } else if (original && typeof original === 'object') {
          if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            Object.entries(value).length <= 100 &&
            Object.entries(value).every(
              ([k, v]) =>
                !['__proto__', 'prototype', 'constructor'].includes(k) &&
                typeof v === 'string' &&
                v.length <= 100,
            )
          )
            next[field] = value
        } else if (
          (original === undefined &&
            (value === undefined || typeof value === 'string')) ||
          (typeof value === typeof original &&
            (typeof value !== 'number' || Number.isFinite(value)))
        ) {
          if (typeof value !== 'string' || value.length <= 10000)
            next[field] = value
        }
      }
      return next
    } catch {
      return defaults
    }
  }
  const [state, setState] = useState<T>(read)
  const [draftIdentity] = useState(() => Symbol(key))
  const previousDefaults = useRef(defaults)
  const defaultsText = JSON.stringify(defaults)
  useEffect(() => {
    const old = previousDefaults.current
    previousDefaults.current = defaults
    if (JSON.stringify(old) !== defaultsText)
      setState((value) =>
        JSON.stringify(value) === JSON.stringify(old) ? defaults : value,
      )
  }, [defaultsText])
  useEffect(() => {
    if (
      !key.startsWith('jido-view:') &&
      (shouldPersist
        ? shouldPersist(state)
        : JSON.stringify(state) !== defaultsText)
    )
      unsavedDrafts.add(draftIdentity)
    else unsavedDrafts.delete(draftIdentity)
    return () => {
      unsavedDrafts.delete(draftIdentity)
    }
  }, [key, state, defaultsText, draftIdentity])
  useEffect(() => {
    try {
      if (shouldPersist && !shouldPersist(state)) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* Saving a real record reports storage errors separately. */
    }
  }, [key, state])
  const field = <K extends keyof T>(
    name: K,
  ): [T[K], Dispatch<SetStateAction<T[K]>>] => [
    state[name],
    (value) =>
      setState((previous) => ({
        ...previous,
        [name]:
          typeof value === 'function'
            ? (value as (old: T[K]) => T[K])(previous[name])
            : value,
      })),
  ]
  const clear = () => {
    setState(defaults)
    try {
      localStorage.removeItem(key)
    } catch {
      /* Optional draft. */
    }
  }
  return { field, clear }
}
