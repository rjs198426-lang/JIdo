import { createGuideServer } from './app.mjs'

const port = Number(process.env.GUIDE_PORT || 8787)
const host = process.env.GUIDE_HOST || '127.0.0.1'
const { app, close } = createGuideServer()
const server = app.listen(port, host, () => {
  console.log(`J★Do guide server listening on ${host}:${port}`)
  console.log(
    'First administrator setup code: .runtime/admin-setup-code (never committed or logged).',
  )
})
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      close()
      process.exit(0)
    }),
  )
