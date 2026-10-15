import test from 'node:test'
import assert from 'node:assert/strict'
import { generateResearchDraft } from './research.mjs'
import { fixtureGuide } from '../tests/guide-fixture.mjs'

const request = {
  id: 'request-vienna',
  country: '오스트리아',
  city: '빈',
  notes: '교통 안내',
}
function providerOutput(sourceUrl = 'https://www.wien.info/en') {
  const guide = fixtureGuide(request)
  const { id, name, country, image, accent, ...content } = guide.city
  return {
    status: 'completed',
    output: [
      {
        type: 'web_search_call',
        action: { sources: [{ url: 'https://www.wien.info/en', type: 'url' }] },
      },
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify({
              ...content,
              sections: guide.sections.map(({ title, body }) => ({
                title,
                body,
              })),
              places: guide.places.map(
                ({ id, cityId, image, ...place }) => place,
              ),
              sources: [{ title: '빈 관광청', url: sourceUrl }],
            }),
            annotations: [],
          },
        ],
      },
    ],
  }
}
test('research uses web search and keeps the API credential server-side', async () => {
  let payload
  const draft = await generateResearchDraft(request, {
    apiKey: 'test-only-not-a-real-key',
    fetcher: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses')
      assert.equal(
        options.headers.Authorization,
        'Bearer test-only-not-a-real-key',
      )
      payload = JSON.parse(options.body)
      return Response.json(providerOutput())
    },
  })
  assert.equal(payload.tools[0].type, 'web_search')
  assert.equal(payload.store, false)
  assert.equal(draft.status, 'draft')
  assert.equal(draft.city.country, '오스트리아')
  assert.equal(draft.sources[0].url, 'https://www.wien.info/en')
  assert.equal(
    JSON.stringify(draft).includes('test-only-not-a-real-key'),
    false,
  )
})
test('missing credentials, ungrounded sources and failed provider responses are rejected', async () => {
  await assert.rejects(
    () => generateResearchDraft(request, { apiKey: '' }),
    /GUIDE_AI_API_KEY/,
  )
  await assert.rejects(
    () =>
      generateResearchDraft(request, {
        apiKey: 'test-only',
        fetcher: async () =>
          Response.json(providerOutput('https://made-up.example/')),
      }),
    /실제 조회한 출처/,
  )
  await assert.rejects(
    () =>
      generateResearchDraft(request, {
        apiKey: 'test-only',
        fetcher: async () => new Response('{}', { status: 401 }),
      }),
    /인증/,
  )
  await assert.rejects(
    () =>
      generateResearchDraft(request, {
        apiKey: 'test-only',
        fetcher: async () =>
          Response.json({ status: 'incomplete', output: [] }),
      }),
    /완료되지/,
  )
})
