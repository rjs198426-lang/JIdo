import { createContext } from 'react'
import type { RegisteredPlace } from './registered-places'
export const PlaceLibraryContext = createContext<
  | {
      entries: RegisteredPlace[]
      hiddenPublicIds: Set<string>
      create: (cityId?: string, kind?: string) => void
      open: (entry: RegisteredPlace) => void
    }
  | undefined
>(undefined)
