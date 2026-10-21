import { readFileSync } from 'node:fs'
const images: Record<string, string> = JSON.parse(
  readFileSync(
    new URL('../.runtime/public-assets/image-map.json', import.meta.url),
    'utf8',
  ),
)
export const optimizedImage = (source: string) => images[source] || source
