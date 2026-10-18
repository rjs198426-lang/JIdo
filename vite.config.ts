import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

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
  define: {
    __JIDO_APP_INFO__: JSON.stringify({ version, build: Number(build) }),
  },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
