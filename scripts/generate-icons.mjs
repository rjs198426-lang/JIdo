import { chromium } from '@playwright/test'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(path.join(root, 'public/app-icon.svg'), 'utf8')
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
)
const page = await browser.newPage({ deviceScaleFactor: 1 })
await page.setContent(
  `<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`,
)
await page.setViewportSize({ width: 1024, height: 1024 })
await page.screenshot({
  path: path.join(
    root,
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  ),
})
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
for (const [density, size] of Object.entries(densities)) {
  await page.setViewportSize({ width: size, height: size })
  const directory = path.join(
    root,
    `android/app/src/main/res/mipmap-${density}`,
  )
  for (const file of ['ic_launcher.png', 'ic_launcher_round.png'])
    await page.screenshot({ path: path.join(directory, file) })
}
// A padded foreground keeps the symbol within Android's adaptive icon safe zone.
const foreground = svg
  .replace('<rect width="1024" height="1024" fill="#ffffff"/>', '')
  .replace('viewBox="0 0 1024 1024"', 'viewBox="-360 -360 1744 1744"')
await page.setContent(
  `<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${foreground}`,
)
for (const [density, size] of Object.entries(densities)) {
  await page.setViewportSize({
    width: (size * 108) / 48,
    height: (size * 108) / 48,
  })
  await page.screenshot({
    path: path.join(
      root,
      `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`,
    ),
    omitBackground: true,
  })
}
// Replace the generated framework launch artwork with a quiet J★Do launch screen.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#ffffff"/><g transform="translate(392 392) scale(.234375)">${svg.replace(/<\/?svg[^>]*>/g, '')}</g></svg>`
await page.setViewportSize({ width: 1024, height: 1024 })
await page.setContent(
  `<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${splash}`,
)
const splashBuffer = await page.screenshot()
const res = path.join(root, 'android/app/src/main/res')
for (const directory of await readdir(res)) {
  if (
    directory === 'drawable' ||
    directory.startsWith('drawable-land-') ||
    directory.startsWith('drawable-port-')
  )
    await writeFile(path.join(res, directory, 'splash.png'), splashBuffer)
}
const iosSplash = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')
for (const file of await readdir(iosSplash))
  if (file.endsWith('.png'))
    await writeFile(path.join(iosSplash, file), splashBuffer)
await browser.close()
console.log('Android and iOS J★Do icons and launch images generated.')
