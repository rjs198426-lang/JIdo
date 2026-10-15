// Test-only process: AI output is a fixture, never a live external API call.
import { createGuideServer } from '../server/app.mjs'
import { fixtureGuide } from './guide-fixture.mjs'

const { app, close } = createGuideServer({
  seed: false,
  researcher: async (request) => fixtureGuide(request),
})
const server = app.listen(0, '127.0.0.1', () =>
  process.stdout.write(JSON.stringify({ port: server.address().port }) + '\n'),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      close()
      process.exit(0)
    }),
  )
