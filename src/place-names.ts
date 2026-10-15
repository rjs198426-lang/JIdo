import translations from './place-name-translations.json' with { type: 'json' }

type NamedPlace = { id: string; cityId: string; name: string }
const knownNames: Record<string, { previous: string; name: string }> =
  translations

// Upgrade only a known bundled name, never a user-renamed or unrelated place.
// Keep cached guide content, coordinates, photos and saved stop IDs intact.
export function currentPlaceName<T extends NamedPlace>(
  value: T,
  bundled?: NamedPlace,
): T {
  const translation = knownNames[value.id]
  if (
    translation &&
    bundled?.id === value.id &&
    bundled.cityId === value.cityId &&
    value.name === translation.previous
  )
    return { ...value, name: bundled.name }
  return value
}
