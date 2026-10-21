import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import sharp from 'sharp'
const root = path.resolve(import.meta.dirname, '..'),
  dist = path.join(root, 'dist')
async function files(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory()
          ? files(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat()
}
const entries = await files(dist)
for (const file of entries) {
  const relative = path.relative(dist, file)
  if (
    /AdminApp|admin\.html|(?:^|\/)admin-|SUIT|HiKR|Laundry|noto-sans-kr/i.test(
      relative,
    )
  )
    throw new Error(`Non-client asset in release: ${relative}`)
  if (
    /\.(js|css)$/.test(file) &&
    /\/api\/admin|AdminApp-/.test(await readFile(file, 'utf8'))
  )
    throw new Error(`Administrator code in client release: ${relative}`)
}
const fonts = entries.filter((p) => /\.(woff2?|ttf|otf)$/.test(p))
if (
  fonts.length !== 1 ||
  path.basename(fonts[0]) !== 'PretendardVariable.woff2'
)
  throw new Error('Release must embed only Pretendard Variable.')
const audit = JSON.parse(
  await readFile(path.join(dist, 'image-optimizations.json'), 'utf8'),
)
for (const photo of audit.images) {
  const bytes = await readFile(path.join(dist, photo.file)),
    metadata = await sharp(bytes).metadata()
  if (
    metadata.format !== 'webp' ||
    Math.max(metadata.width, metadata.height) > 1280 ||
    metadata.exif ||
    metadata.xmp ||
    metadata.icc ||
    metadata.iptc
  )
    throw new Error(`Unoptimized image: ${photo.file}`)
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
  if (
    sha(bytes) !== photo.sha256 ||
    sha(await readFile(path.join(root, 'public', photo.source))) !==
      photo.originalSha256
  )
    throw new Error(`Image provenance mismatch: ${photo.file}`)
  if (entries.includes(path.join(dist, photo.source)))
    throw new Error(`Original image duplicated: ${photo.source}`)
}
const report = {
  assets: entries.length,
  bytes: (await Promise.all(entries.map((p) => stat(p)))).reduce(
    (n, s) => n + s.size,
    0,
  ),
  fontFiles: fonts.length,
  fontBytes: (await stat(fonts[0])).size,
  images: audit.images.length,
  originalImageBytes: audit.images.reduce((n, p) => n + p.originalBytes, 0),
  imageBytes: audit.images.reduce((n, p) => n + p.bytes, 0),
  adminFiles: 0,
  metadataFiles: 0,
}
await mkdir(path.join(root, 'artifacts'), { recursive: true })
await writeFile(
  path.join(root, 'artifacts/client-build-audit.json'),
  JSON.stringify(report, null, 2) + '\n',
)
console.log(JSON.stringify(report))
