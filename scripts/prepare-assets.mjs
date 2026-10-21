// Build-only derivatives: source photos and research hashes stay unchanged.
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rm,
} from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import sharp from 'sharp'
const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, '.runtime/public-assets')
const cache = path.join(root, '.runtime/image-cache')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const options = {
  maxEdge: 1280,
  quality: 82,
  effort: 6,
  encoder: sharp.versions.sharp,
}
await mkdir(cache, { recursive: true })
await rm(path.join(output, 'public'), { recursive: true, force: true })
const map = {},
  audit = []
async function walk(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) {
      await walk(path.join(directory, entry.name), relative)
      continue
    }
    if (
      relative.startsWith('fonts/') &&
      !/^fonts\/Pretendard(?:Variable\.woff2|-source\.json)$/.test(relative)
    )
      continue
    if (
      relative.startsWith('licenses/') &&
      ![
        'licenses/Pretendard-OFL.txt',
        'licenses/leaflet.txt',
        'licenses/travel-data.txt',
      ].includes(relative)
    )
      continue
    const original = path.join(directory, entry.name)
    let target = relative
    if (/^images\/.*\.(jpg|jpeg|png)$/i.test(relative)) {
      const source = await readFile(original),
        originalSha256 = sha(source)
      const fingerprint = sha(
        Buffer.from(originalSha256 + JSON.stringify(options)),
      )
      target = relative.replace(
        /\.(jpg|jpeg|png)$/i,
        `-${fingerprint.slice(0, 12)}.webp`,
      )
      const cached = path.join(cache, fingerprint + '.webp')
      try {
        await readFile(cached)
      } catch {
        // No crop/enlargement. Correct orientation; strip EXIF/XMP/ICC/GainMap.
        await sharp(source)
          .rotate()
          .resize({
            width: options.maxEdge,
            height: options.maxEdge,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: options.quality, effort: options.effort })
          .toFile(cached)
      }
      const bytes = await readFile(cached),
        metadata = await sharp(bytes).metadata()
      if (metadata.exif || metadata.xmp || metadata.icc || metadata.iptc)
        throw new Error(`Metadata remained: ${relative}`)
      map['/' + relative] = '/' + target
      audit.push({
        source: '/' + relative,
        file: '/' + target,
        originalSha256,
        sha256: sha(bytes),
        originalBytes: source.length,
        bytes: bytes.length,
        width: metadata.width,
        height: metadata.height,
        technicalChanges:
          'Orientation correction, proportional resize (max 1280px), WebP encoding, metadata removal; no cropping.',
      })
      await mkdir(path.dirname(path.join(output, 'public', target)), {
        recursive: true,
      })
      await copyFile(cached, path.join(output, 'public', target))
      continue
    }
    if (relative.startsWith('images/')) map['/' + relative] = '/' + relative
    await mkdir(path.dirname(path.join(output, 'public', target)), {
      recursive: true,
    })
    await copyFile(original, path.join(output, 'public', target))
  }
}
await walk(path.join(root, 'public'))
await writeFile(path.join(output, 'image-map.json'), JSON.stringify(map))
await writeFile(
  path.join(output, 'public/image-optimizations.json'),
  JSON.stringify({ schemaVersion: 1, options, images: audit }, null, 2) + '\n',
)
console.log(
  `Prepared ${audit.length} photos: ${audit.reduce((n, p) => n + p.originalBytes, 0)} → ${audit.reduce((n, p) => n + p.bytes, 0)} bytes; originals preserved.`,
)
