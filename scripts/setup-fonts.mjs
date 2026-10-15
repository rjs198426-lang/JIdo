// Keep the body font private to local builds; its license allows app embedding.
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('../', import.meta.url)
const metadata = JSON.parse(
  await readFile(
    new URL('public/fonts/LaundryGothic-source.json', root),
    'utf8',
  ),
)
const target = new URL(`public${metadata.file}`, root)
const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex')
try {
  const existing = await readFile(target)
  if (checksum(existing) !== metadata.sha256)
    throw new Error(
      'LaundryGothic checksum mismatch; restore the unmodified Regular webfont.',
    )
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  const response = await fetch(metadata.downloadUrl, {
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok)
    throw new Error(
      `LaundryGothic download failed (${response.status}); obtain the Regular webfont from ${metadata.officialUrl} and place it in public/fonts/LaundryGothic-Regular.woff`,
    )
  const bytes = Buffer.from(await response.arrayBuffer())
  if (
    bytes.toString('ascii', 0, 4) !== 'wOFF' ||
    checksum(bytes) !== metadata.sha256
  )
    throw new Error(
      'Downloaded LaundryGothic font failed integrity validation.',
    )
  await mkdir(new URL('public/fonts/', root), { recursive: true })
  const temporary = new URL(`${target.href}.download`)
  await writeFile(temporary, bytes)
  await rename(temporary, target)
}
