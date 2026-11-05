import { z } from 'zod'
import { customPlaceSchema, destinationSchema, type Trip } from './travel-model'
import {
  registeredPlaces,
  registeredPlaceKey,
  sameDestination,
  type RegisteredPlace,
} from './registered-places'

const key = z.string().min(1).max(2000)
export const personalPlaceSchema = z
  .object({
    id: z.string().uuid(),
    custom: customPlaceSchema,
    destination: destinationSchema,
    description: z.string().max(1000),
    sourceKeys: z.array(key).max(100),
  })
  .strict()
  .refine((record) => record.custom.destinationId === record.destination.id)
export const placeLibrarySchema = z
  .object({
    entries: z
      .array(personalPlaceSchema)
      .max(1000)
      .refine(
        (entries) =>
          new Set(entries.map((entry) => entry.id)).size === entries.length,
      ),
    hidden: z.array(key).max(5000),
  })
  .strict()
export type PersonalPlace = z.infer<typeof personalPlaceSchema>
export type PlaceLibrary = z.infer<typeof placeLibrarySchema>
export const emptyPlaceLibrary = (): PlaceLibrary => ({
  entries: [],
  hidden: [],
})
const canonicalKey = (entry: RegisteredPlace) =>
  `${entry.destination.country.trim().toLocaleLowerCase()}:${entry.destination.name.trim().toLocaleLowerCase()}:${registeredPlaceKey(entry.custom)}`
const samePlace = (a: RegisteredPlace, b: RegisteredPlace) =>
  sameDestination(a.destination, b.destination) &&
  registeredPlaceKey(a.custom) === registeredPlaceKey(b.custom)
export const personalEntry = (record: PersonalPlace): RegisteredPlace => ({
  key: `owned:${record.id}`,
  personalId: record.id,
  custom: record.custom,
  destination: record.destination,
  description: record.description,
})
export function libraryPlaces(
  trips: Trip[],
  library = emptyPlaceLibrary(),
): RegisteredPlace[] {
  const hidden = new Set(library.hidden)
  const own = library.entries.map(personalEntry)
  return [
    ...own,
    ...registeredPlaces(trips).filter(
      (entry) =>
        !own.some(
          (item, i) =>
            samePlace(item, entry) ||
            library.entries[i].sourceKeys.includes(entry.key) ||
            library.entries[i].sourceKeys.includes(canonicalKey(entry)),
        ),
    ),
  ].filter(
    (entry) => !hidden.has(entry.key) && !hidden.has(canonicalKey(entry)),
  )
}
export function savePersonalPlace(
  library: PlaceLibrary | undefined,
  record: PersonalPlace,
  source?: RegisteredPlace,
): PlaceLibrary {
  const current = library || emptyPlaceLibrary()
  let entry = personalEntry(record)
  const equivalent = current.entries.filter(
    (item) => item.id === record.id || samePlace(personalEntry(item), entry),
  )
  const savedRecord = {
    ...record,
    id:
      equivalent.find((item) => item.id === record.id)?.id ||
      equivalent[0]?.id ||
      record.id,
  }
  entry = personalEntry(savedRecord)
  const sourceKeys = [
    ...new Set([
      ...record.sourceKeys,
      ...equivalent.flatMap((item) => item.sourceKeys),
      ...(source ? [source.key, canonicalKey(source)] : []),
    ]),
  ]
  const keys = new Set([entry.key, canonicalKey(entry), ...sourceKeys])
  return placeLibrarySchema.parse({
    entries: [
      ...current.entries.filter((item) => !equivalent.includes(item)),
      { ...savedRecord, sourceKeys },
    ],
    hidden: current.hidden.filter((key) => !keys.has(key)),
  })
}
export function removeLibraryPlace(
  library: PlaceLibrary | undefined,
  entry: RegisteredPlace | string,
): PlaceLibrary {
  const current = library || emptyPlaceLibrary()
  if (typeof entry === 'string')
    return placeLibrarySchema.parse({
      ...current,
      hidden: [...new Set([...current.hidden, `public:${entry}`])],
    })
  const record = current.entries.find((item) => item.id === entry.personalId)
  return placeLibrarySchema.parse({
    entries: current.entries.filter((item) => item.id !== entry.personalId),
    hidden: [
      ...new Set([
        ...current.hidden,
        entry.key,
        canonicalKey(entry),
        ...(record?.sourceKeys || []),
      ]),
    ],
  })
}
export function mergePlaceLibraries(
  current: PlaceLibrary | undefined,
  incoming: PlaceLibrary | undefined,
) {
  if (!incoming) return current
  let result = current || emptyPlaceLibrary()
  for (const record of incoming.entries)
    if (
      !result.entries.some(
        (item) =>
          item.id === record.id ||
          samePlace(personalEntry(item), personalEntry(record)),
      )
    )
      result = savePersonalPlace(result, record)
  const protectedKeys = new Set(
    (current?.entries || []).flatMap((record) => [
      personalEntry(record).key,
      canonicalKey(personalEntry(record)),
      ...record.sourceKeys,
    ]),
  )
  return placeLibrarySchema.parse({
    ...result,
    hidden: [
      ...new Set([
        ...result.hidden,
        ...incoming.hidden.filter((key) => !protectedKeys.has(key)),
      ]),
    ],
  })
}
