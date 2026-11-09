import { useEffect, useSyncExternalStore } from 'react'
import {
  guidebookIndexSnapshot,
  subscribeGuidebookIndex,
  refreshGuidebookIndex,
} from './guidebook-index'

// Read the small public list when the library/discovery screen opens, never
// the user's query. Bodies still download only after an explicit selection.
export function useGuidebookIndex() {
  const state = useSyncExternalStore(
    subscribeGuidebookIndex,
    guidebookIndexSnapshot,
  )
  useEffect(() => {
    void refreshGuidebookIndex().catch(() => {})
    const online = () => {
      void refreshGuidebookIndex(true).catch(() => {})
    }
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [])
  return { ...state, refresh: () => refreshGuidebookIndex(true) }
}
