import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'postcss'

// Scale type, not the page: card padding, icons and touch targets keep their size.
// Source sizes remain the 0.54 baseline, including responsive clamps and tokens.
const compactTypography: Plugin = {
  postcssPlugin: 'jido-compact-typography',
  OnceExit(root) {
    root.walkDecls('font-size', (declaration) => {
      const file = declaration.source?.input.file?.replaceAll('\\', '/') || ''
      if (!file.includes('/src/') || /\/admin\.css(?:$|\?)/.test(file)) return
      const value = declaration.value.trim()
      // Relative glyphs (e.g. the logo star) already inherit the scaled parent.
      if (
        /^(?:0|[\d.]+(?:em|%)|inherit|initial|unset|revert(?:-layer)?)$/.test(
          value,
        )
      )
        return
      declaration.value = `calc(0.8 * (${value}))`
    })
  },
}

const androidBuild = readFileSync(
  new URL('./android/app/build.gradle', import.meta.url),
  'utf8',
)
const version = androidBuild.match(/^\s*versionName\s+"([^"]+)"/m)?.[1]
const build = androidBuild.match(/^\s*versionCode\s+(\d+)/m)?.[1]
if (!version || !build)
  throw new Error(
    'Android versionName and versionCode are required for app information.',
  )

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [compactTypography] } },
  define: {
    __JIDO_APP_INFO__: JSON.stringify({ version, build: Number(build) }),
  },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
