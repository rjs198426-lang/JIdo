// Verify the pinned, original OFL body font used by offline Android builds.
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('../', import.meta.url)
const metadata = JSON.parse(
  await readFile(new URL('public/fonts/SUIT-source.json', root), 'utf8'),
)
const target = new URL(`public${metadata.file}`, root)
const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex')
try {
  const existing = await readFile(target)
  if (checksum(existing) !== metadata.sha256)
    throw new Error(
      'SUIT checksum mismatch; restore the unmodified variable webfont.',
    )
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  const response = await fetch(metadata.downloadUrl, {
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok)
    throw new Error(
      `SUIT download failed (${response.status}); obtain the variable webfont from ${metadata.officialUrl} and place it in public/fonts/SUIT-Variable.woff2`,
    )
  const bytes = Buffer.from(await response.arrayBuffer())
  if (
    bytes.toString('ascii', 0, 4) !== 'wOF2' ||
    checksum(bytes) !== metadata.sha256
  )
    throw new Error('Downloaded SUIT font failed integrity validation.')
  await mkdir(new URL('public/fonts/', root), { recursive: true })
  const temporary = new URL(`${target.href}.download`)
  await writeFile(temporary, bytes)
  await rename(temporary, target)
}
