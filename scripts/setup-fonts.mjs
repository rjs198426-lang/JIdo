// Verify the pinned, original OFL variable font and license for offline builds.
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('../', import.meta.url)
const metadata = JSON.parse(
  await readFile(new URL('public/fonts/Pretendard-source.json', root), 'utf8'),
)
const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function ensureAsset(file, downloadUrl, sha256, isFont = false) {
  const target = new URL(`public${file}`, root)
  const validate = (bytes) =>
    checksum(bytes) === sha256 &&
    (!isFont || bytes.toString('ascii', 0, 4) === 'wOF2')
  try {
    const existing = await readFile(target)
    if (!validate(existing))
      throw new Error(
        `${metadata.family} integrity mismatch: ${file}; restore the unmodified official asset.`,
      )
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const response = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok)
      throw new Error(
        `${metadata.family} download failed (${response.status}); restore ${file} from ${metadata.officialUrl}.`,
      )
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!validate(bytes))
      throw new Error(`Downloaded ${file} failed integrity validation.`)
    await mkdir(new URL('.', target), { recursive: true })
    const temporary = new URL(`${target.href}.download`)
    await writeFile(temporary, bytes)
    await rename(temporary, target)
  }
}
await ensureAsset(metadata.file, metadata.downloadUrl, metadata.sha256, true)
await ensureAsset(
  metadata.licenseFile,
  metadata.licenseUrl,
  metadata.licenseSha256,
)
