import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { createGuideServer } from './app.mjs'
import { fixtureGuide } from '../tests/guide-fixture.mjs'

async function fixture(t, options = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'jdo-api-test-'))
  const code = randomBytes(24).toString('hex')
  const { app, close } = createGuideServer({
    dataDirectory: directory,
    setupCode: code,
    seed: false,
    serveStatic: false,
    ...options,
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    close()
    rmSync(directory, { recursive: true })
  })
  let cookie = ''
  const send = async (
    route,
    body,
    method = body ? 'POST' : 'GET',
    authenticated = true,
    headers = {},
  ) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (response.headers.get('set-cookie'))
      cookie = response.headers.get('set-cookie').split(';')[0]
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    }
  }
  const login = async () => {
    const password = randomBytes(24).toString('hex')
    assert.equal(
      (await send('/api/admin/setup', { setupCode: code, password })).status,
      200,
    )
    return password
  }
  return { send, login, directory, base }
}

test('administrator authentication, setup protection, logout and CSRF', async (t) => {
  const { send, login } = await fixture(t)
  assert.equal((await send('/api/admin/overview')).status, 401)
  assert.equal(
    (
      await send('/api/admin/setup', {
        setupCode: 'incorrect',
        password: 'incorrect',
      })
    ).status,
    403,
  )
  const password = await login()
  assert.equal((await send('/api/admin/overview')).status, 200)
  assert.equal(
    (
      await send('/api/admin/guides', fixtureGuide(), 'POST', true, {
        Origin: 'https://other.example',
      })
    ).status,
    403,
  )
  assert.equal(
    (await send('/api/admin/setup', { setupCode: 'incorrect', password }))
      .status,
    409,
  )
  assert.equal((await send('/api/admin/logout', {})).status, 200)
  assert.equal((await send('/api/admin/overview')).status, 401)
  assert.equal(
    (await send('/api/admin/login', { password: 'incorrect' })).status,
    401,
  )
  assert.equal((await send('/api/admin/login', { password })).status, 200)
})

test('request -> draft -> publish; editing preserves the current published revision', async (t) => {
  const { send, login } = await fixture(t)
  const request = (
    await send('/api/requests', {
      country: '오스트리아',
      city: '빈',
      notes: '교통과 산책 코스',
    })
  ).body.request
  const duplicate = await send('/api/requests', {
    country: '오스트리아',
    city: '빈',
    notes: '다른 요청',
  })
  assert.equal(duplicate.body.duplicate, true)
  assert.equal(duplicate.body.request.notes, '')
  await login()
  const guide = fixtureGuide(request)
  assert.equal((await send('/api/admin/guides', guide)).status, 200)
  assert.equal((await send('/api/guides')).body.guides.length, 0)
  assert.equal(
    (await send(`/api/admin/guides/${guide.id}/publish`, {})).status,
    200,
  )
  assert.equal((await send('/api/guides')).body.guides[0].city.name, '빈')
  const updated = {
    ...guide,
    city: { ...guide.city, tagline: '수정한 새 초안' },
  }
  await send('/api/admin/guides', updated)
  assert.equal(
    (await send('/api/guides')).body.guides[0].city.tagline,
    guide.city.tagline,
  )
  assert.equal(
    (await send(`/api/admin/guides/${guide.id}`)).body.guide.city.tagline,
    '수정한 새 초안',
  )
  await send(`/api/admin/guides/${guide.id}/publish`, {})
  assert.equal(
    (await send('/api/guides')).body.guides[0].city.tagline,
    '수정한 새 초안',
  )
  assert.equal(
    (await send('/api/admin/overview')).body.requests[0].status,
    'published',
  )
  await send(`/api/admin/guides/${guide.id}/unpublish`, {})
  assert.equal((await send('/api/guides')).body.guides.length, 0)
})

test('invalid guides and unsupported source links cannot be published', async (t) => {
  const { send, login } = await fixture(t)
  await login()
  const guide = fixtureGuide()
  guide.sources = []
  await send('/api/admin/guides', guide)
  assert.equal(
    (await send(`/api/admin/guides/${guide.id}/publish`, {})).status,
    400,
  )
  guide.sources = [
    { title: 'unsafe', url: 'javascript:alert(1)', accessedAt: '2026-10-13' },
  ]
  assert.equal((await send('/api/admin/guides', guide)).status, 400)
  guide.sources = fixtureGuide().sources
  guide.places[0].cityId = 'other-city'
  assert.equal((await send('/api/admin/guides', guide)).status, 400)
  assert.equal(
    (await send('/api/requests', { country: '', city: '', notes: '' })).status,
    400,
  )
})

test('AI research stores only a draft and failed research restores the request state', async (t) => {
  const { send, login } = await fixture(t, {
    researcher: async (request) => {
      if (request.city === '실패')
        throw Object.assign(new Error('조사 실패'), { status: 502 })
      return fixtureGuide(request)
    },
  })
  await login()
  const request = (
    await send('/api/requests', {
      country: '오스트리아',
      city: '빈',
      notes: '',
    })
  ).body.request
  const researched = await send(
    `/api/admin/requests/${request.id}/research`,
    {},
  )
  assert.equal(researched.status, 200)
  assert.equal(researched.body.guide.status, 'draft')
  assert.equal((await send('/api/guides')).body.guides.length, 0)
  assert.equal(
    (await send('/api/admin/overview')).body.requests[0].status,
    'draft',
  )
  const failed = (
    await send('/api/requests', { country: '테스트', city: '실패', notes: '' })
  ).body.request
  assert.equal(
    (await send(`/api/admin/requests/${failed.id}/research`, {})).status,
    502,
  )
  assert.equal(
    (await send('/api/admin/overview')).body.requests.find(
      (item) => item.id === failed.id,
    ).status,
    'requested',
  )
})

test('saved guide data survives a new server instance', async (t) => {
  const { send, login, directory } = await fixture(t)
  await login()
  await send('/api/admin/guides', fixtureGuide())
  await send('/api/admin/guides/guide-vienna/publish', {})
  const second = createGuideServer({
    dataDirectory: directory,
    seed: false,
    serveStatic: false,
  })
  const server = second.app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/guides`,
    )
    assert.equal((await response.json()).guides[0].city.name, '빈')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    second.close()
  }
})
