import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cities, places } from '../src/data.ts'
import { guideSchema, requestSchema } from '../src/guide-schema.ts'
import { generateResearchDraft, researchConfigured } from './research.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const passwordHash = (password, salt) =>
  scryptSync(password, salt, 64).toString('hex')
const issue = (status, message) => Object.assign(new Error(message), { status })
const iso = () => new Date().toISOString()

export function createGuideServer({
  dataDirectory = process.env.GUIDE_DATA_DIR || path.join(root, '.runtime'),
  setupCode = process.env.GUIDE_SETUP_CODE,
  seed = true,
  serveStatic = true,
  secureCookies = process.env.GUIDE_SECURE_COOKIES === 'true',
  researcher = generateResearchDraft,
} = {}) {
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path.join(dataDirectory, 'guides.sqlite'))
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS guides (id TEXT PRIMARY KEY, status TEXT NOT NULL, document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, country TEXT NOT NULL, city TEXT NOT NULL, notes TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, guide_id TEXT);`)
  const getConfig = (key) =>
    db.prepare('SELECT value FROM config WHERE key=?').get(key)?.value
  const setConfig = (key, value) =>
    db
      .prepare('INSERT OR REPLACE INTO config(key,value) VALUES (?,?)')
      .run(key, value)
  if (!getConfig('adminPassword') && !getConfig('setupHash')) {
    const code = setupCode || randomBytes(24).toString('base64url')
    setConfig('setupHash', sha(code))
    if (!setupCode)
      writeFileSync(path.join(dataDirectory, 'admin-setup-code'), code + '\n', {
        mode: 0o600,
      })
  }
  if (seed && !getConfig('seeded')) {
    const now = iso()
    const insert = db.prepare(
      'INSERT OR IGNORE INTO guides(id,status,document) VALUES (?,?,?)',
    )
    for (const city of cities)
      insert.run(
        city.id,
        'published',
        JSON.stringify({
          id: city.id,
          scope: 'city',
          city,
          places: places.filter((place) => place.cityId === city.id),
          sections: [],
          sources: [],
          status: 'published',
          requestId: null,
          createdAt: now,
          updatedAt: now,
          publishedAt: now,
        }),
      )
    setConfig('seeded', '1')
  }
  const app = express()
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
    if (!req.path.startsWith('/api/admin')) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      if (req.method === 'OPTIONS') return res.sendStatus(204)
    } else if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
      // Browsers use the same-origin web/admin app. Reject cross-site mutations.
      const allowed = (
        process.env.GUIDE_ADMIN_ORIGINS ||
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
      ).split(',')
      const host = req.get('host')
      let ownOrigin = false
      try {
        ownOrigin = new URL(req.headers.origin).host === host
      } catch {}
      if (!ownOrigin && !allowed.includes(req.headers.origin))
        return res
          .status(403)
          .json({ error: '관리자 화면과 같은 출처에서 요청하세요.' })
    }
    next()
  })
  app.use(express.json({ limit: '512kb' }))
  const attempts = new Map()
  const throttle = (req, action, limit, period) => {
    const key = `${action}:${req.socket.remoteAddress}`
    const now = Date.now()
    if (attempts.size > 10000)
      for (const [key, entry] of attempts)
        if (entry.until < now) attempts.delete(key)
    const existing = attempts.get(key)
    const entry =
      existing && existing.until > now
        ? existing
        : { count: 0, until: now + period }
    entry.count++
    attempts.set(key, entry)
    if (entry.count > limit) throw issue(429, '잠시 후 다시 시도해 주세요.')
  }
  const authenticate = (req, res, next) => {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('jdo_admin='))
      ?.slice(10)
    const session =
      cookie &&
      db.prepare('SELECT expires FROM sessions WHERE hash=?').get(sha(cookie))
    if (!session || session.expires < Date.now())
      return res.status(401).json({ error: '관리자 로그인이 필요합니다.' })
    next()
  }
  const sessionCookie = (res, token, age = 43200) =>
    res.setHeader(
      'Set-Cookie',
      `jdo_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${age}${secureCookies ? '; Secure' : ''}`,
    )
  const login = (res) => {
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now())
    const token = randomBytes(32).toString('base64url')
    db.prepare('INSERT INTO sessions(hash,expires) VALUES (?,?)').run(
      sha(token),
      Date.now() + 43200000,
    )
    sessionCookie(res, token)
  }
  const document = (id) => {
    const row = db.prepare('SELECT document FROM guides WHERE id=?').get(id)
    if (!row) throw issue(404, '가이드를 찾을 수 없습니다.')
    return JSON.parse(row.document)
  }
  const requestRow = (row) => ({
    id: row.id,
    country: row.country,
    city: row.city,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    guideId: row.guide_id,
  })
  const saveGuide = (guide) => {
    db.prepare(
      'INSERT OR REPLACE INTO guides(id,status,document) VALUES (?,?,?)',
    ).run(guide.id, guide.status, JSON.stringify(guide))
    if (guide.requestId)
      db.prepare('UPDATE requests SET status=?,guide_id=? WHERE id=?').run(
        guide.status,
        guide.id,
        guide.requestId,
      )
  }
  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', app: 'J★Do', schemaVersion: 1 }),
  )
  app.get('/api/guides', (req, res) =>
    res.json({
      schemaVersion: 1,
      guides: db
        .prepare(
          "SELECT document FROM guides WHERE status='published' ORDER BY rowid",
        )
        .all()
        .map((row) => JSON.parse(row.document)),
    }),
  )
  app.post('/api/requests', (req, res) => {
    throttle(req, 'request', 10, 3600000)
    const parsed = requestSchema.safeParse(req.body)
    if (!parsed.success)
      throw issue(400, '국가, 도시와 요청 내용을 확인하세요.')
    const { country, city, notes } = parsed.data
    const existing = db
      .prepare(
        "SELECT * FROM requests WHERE lower(country)=lower(?) AND lower(city)=lower(?) AND status!='published' ORDER BY created_at DESC LIMIT 1",
      )
      .get(country, city)
    if (existing)
      return res.status(200).json({
        request: { ...requestRow(existing), notes: '' },
        duplicate: true,
      })
    const id = randomUUID(),
      createdAt = iso()
    db.prepare(
      'INSERT INTO requests(id,country,city,notes,status,created_at) VALUES (?,?,?,?,?,?)',
    ).run(id, country, city, notes, 'requested', createdAt)
    res.status(201).json({
      request: {
        id,
        country,
        city,
        notes: '',
        status: 'requested',
        createdAt,
        guideId: null,
      },
    })
  })
  app.get('/api/admin/status', (req, res) =>
    res.json({ configured: !!getConfig('adminPassword') }),
  )
  app.post('/api/admin/setup', (req, res) => {
    throttle(req, 'auth', 15, 900000)
    if (getConfig('adminPassword'))
      throw issue(409, '관리자 계정이 이미 설정되었습니다.')
    if (
      typeof req.body?.setupCode !== 'string' ||
      sha(req.body.setupCode) !== getConfig('setupHash')
    )
      throw issue(403, '초기 설정 코드를 확인하세요.')
    if (
      typeof req.body?.password !== 'string' ||
      req.body.password.length < 12 ||
      req.body.password.length > 128
    )
      throw issue(400, '관리자 비밀번호는 12~128자로 설정하세요.')
    const salt = randomBytes(16).toString('hex')
    setConfig('adminSalt', salt)
    setConfig('adminPassword', passwordHash(req.body.password, salt))
    db.prepare("DELETE FROM config WHERE key='setupHash'").run()
    login(res)
    res.json({ ok: true })
  })
  app.post('/api/admin/login', (req, res) => {
    throttle(req, 'auth', 15, 900000)
    const hash = getConfig('adminPassword'),
      salt = getConfig('adminSalt')
    if (
      !hash ||
      typeof req.body?.password !== 'string' ||
      req.body.password.length > 128 ||
      !timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(passwordHash(req.body.password, salt), 'hex'),
      )
    )
      throw issue(401, '비밀번호를 확인하세요.')
    login(res)
    res.json({ ok: true })
  })
  app.use('/api/admin', authenticate)
  app.post('/api/admin/logout', (req, res) => {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('jdo_admin='))
      ?.slice(10)
    if (cookie) db.prepare('DELETE FROM sessions WHERE hash=?').run(sha(cookie))
    sessionCookie(res, '', 0)
    res.json({ ok: true })
  })
  app.get('/api/admin/overview', (req, res) =>
    res.json({
      research: {
        configured: researchConfigured(),
        model: process.env.GUIDE_AI_MODEL || 'gpt-4.1',
      },
      guides: db
        .prepare('SELECT document FROM guides ORDER BY rowid DESC')
        .all()
        .map((row) => JSON.parse(row.document)),
      requests: db
        .prepare('SELECT * FROM requests ORDER BY created_at DESC')
        .all()
        .map(requestRow),
    }),
  )
  const researchJobs = new Set()
  app.post('/api/admin/requests/:id/research', async (req, res) => {
    const row = db
      .prepare('SELECT * FROM requests WHERE id=?')
      .get(req.params.id)
    if (!row) throw issue(404, '요청한 여행지를 찾을 수 없습니다.')
    if (researchJobs.has(row.id))
      throw issue(409, '이 여행지를 이미 조사하고 있습니다.')
    if (researchJobs.size >= 2)
      throw issue(429, '다른 가이드를 조사하고 있습니다. 잠시 후 시작하세요.')
    researchJobs.add(row.id)
    db.prepare("UPDATE requests SET status='researching' WHERE id=?").run(
      row.id,
    )
    try {
      const generated = await researcher(
        requestRow(row),
        row.guide_id ? { guideId: row.guide_id } : {},
      )
      const guide = guideSchema.parse({
        ...generated,
        requestId: row.id,
        status: 'draft',
        publishedAt: null,
      })
      const previous = db
        .prepare('SELECT status FROM guides WHERE id=?')
        .get(guide.id)
      setConfig('draft:' + guide.id, JSON.stringify(guide))
      if (!previous || previous.status !== 'published') saveGuide(guide)
      db.prepare(
        "UPDATE requests SET status='draft',guide_id=? WHERE id=?",
      ).run(guide.id, row.id)
      res.json({ guide })
    } catch (error) {
      db.prepare('UPDATE requests SET status=? WHERE id=?').run(
        row.status,
        row.id,
      )
      throw error
    } finally {
      researchJobs.delete(row.id)
    }
  })
  app.post('/api/admin/guides', (req, res) => {
    const parsed = guideSchema.safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({
        error: '가이드 내용을 확인하세요.',
        issues: parsed.error.issues.map((item) => ({
          path: item.path.join('.'),
          message: item.message,
        })),
      })
    const existing = db
      .prepare('SELECT document FROM guides WHERE id=?')
      .get(parsed.data.id)
    if (
      parsed.data.requestId &&
      !db
        .prepare('SELECT id FROM requests WHERE id=?')
        .get(parsed.data.requestId)
    )
      throw issue(400, '연결된 요청을 찾을 수 없습니다.')
    // Saving always creates a draft; a published version stays live until publish is pressed.
    const previous = existing && JSON.parse(existing.document)
    const guide = {
      ...parsed.data,
      status: 'draft',
      createdAt: previous?.createdAt || iso(),
      updatedAt: iso(),
      publishedAt: null,
    }
    // Preserve published data separately so edits do not silently withdraw it.
    setConfig('draft:' + guide.id, JSON.stringify(guide))
    if (!previous || previous.status !== 'published') saveGuide(guide)
    if (guide.requestId)
      db.prepare(
        "UPDATE requests SET status='draft',guide_id=? WHERE id=?",
      ).run(guide.id, guide.requestId)
    res.json({ guide })
  })
  app.get('/api/admin/guides/:id', (req, res) => {
    const draft = getConfig('draft:' + req.params.id)
    res.json({ guide: draft ? JSON.parse(draft) : document(req.params.id) })
  })
  app.post('/api/admin/guides/:id/publish', (req, res) => {
    const draft = getConfig('draft:' + req.params.id)
    const guide = draft ? JSON.parse(draft) : document(req.params.id)
    if (!guide.sources.length || !guide.sections.length)
      throw issue(
        400,
        '게시하려면 조사 본문과 출처를 각각 하나 이상 입력하세요.',
      )
    const published = {
      ...guide,
      status: 'published',
      updatedAt: iso(),
      publishedAt: iso(),
    }
    db.exec('BEGIN')
    try {
      saveGuide(published)
      db.prepare('DELETE FROM config WHERE key=?').run('draft:' + guide.id)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    res.json({ guide: published })
  })
  app.post('/api/admin/guides/:id/unpublish', (req, res) => {
    const guide = document(req.params.id)
    saveGuide({
      ...guide,
      status: 'draft',
      publishedAt: null,
      updatedAt: iso(),
    })
    res.json({ ok: true })
  })
  app.use('/api', (req, res) =>
    res.status(404).json({ error: '요청한 API를 찾을 수 없습니다.' }),
  )
  if (serveStatic && existsSync(path.join(root, 'dist/index.html'))) {
    app.use(express.static(path.join(root, 'dist')))
    app.get('/{*path}', (req, res) =>
      res.sendFile(path.join(root, 'dist/index.html')),
    )
  }
  app.use((error, req, res, next) => {
    const status = error.status || 500
    res.status(status).json({
      error:
        status >= 500
          ? '서버에서 처리하지 못했습니다. 잠시 후 다시 시도하세요.'
          : error.message,
    })
  })
  return { app, close: () => db.close() }
}
