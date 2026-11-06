import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { runDriveSync, type SyncCache } from '../src/sync-engine'
import {
  canonicalSnapshot,
  emptySyncSnapshot,
  stableJson,
  syncCommitSchema,
  syncHash,
  parseSyncSnapshot,
  type SyncSnapshot,
  type SyncFile,
} from '../src/sync-model'
import { mergeSyncSnapshots } from '../src/sync-merge'
import { tripSchema } from '../src/travel-model'
import type { SyncDrive, DriveObject } from '../src/sync-drive'
import type { SyncLocal } from '../src/sync-local'

const trip = () =>
  tripSchema.parse({
    id: 'sync-trip',
    title: '동기화할 괌 여행',
    cityId: 'guam',
    startDate: '2026-12-22',
    endDate: '2026-12-23',
    travelers: 1,
    days: [
      [
        {
          id: 'first-stop',
          placeId: 'guam-tumon-beach',
          time: '',
          note: '보존할 메모',
        },
      ],
      [],
    ],
    checklist: [],
    expenses: [],
    reservations: [],
    attachments: [],
  })
const snapshot = () => {
  const s = emptySyncSnapshot()
  s.store.trips = [trip()]
  return s
}
class Space {
  objects: DriveObject[] = []
  bodies = new Map<string, string>()
  bytes = new Map<string, Uint8Array>()
}
class MockDrive implements SyncDrive {
  account = {
    id: 'test-account',
    email: 'sync@example.test',
    name: '테스트 계정',
  }
  files = new Map<string, Uint8Array>()
  writes = 0
  downloads = 0
  failDownload = false
  beforeWrite?: () => Promise<void>
  constructor(readonly space: Space) {}
  async connect() {
    return this.account
  }
  async list() {
    return structuredClone(this.space.objects)
  }
  async read(id: string) {
    return this.space.bodies.get(id)!
  }
  async write(id: string, parents: string[], body: string) {
    if (this.beforeWrite) await this.beforeWrite()
    const object: DriveObject = {
      fileId: randomUUID(),
      id,
      parents,
      sha256: await syncHash(body),
      kind: 'commit-v1',
    }
    this.space.objects.push(object)
    this.space.bodies.set(object.fileId, body)
    this.writes++
    return object
  }
  async inspect(file: any) {
    const bytes = this.files.get(file.id)
    if (!bytes) throw new Error('원본 파일 없음')
    return { ...file, sha256: await syncHash(bytes) }
  }
  async upload(file: SyncFile) {
    const bytes = this.files.get(file.id)!
    if ((await syncHash(bytes)) !== file.sha256) throw new Error('원본 변경')
    const object: DriveObject = {
      fileId: randomUUID(),
      id: file.id,
      sha256: file.sha256,
      kind: 'blob-v1',
      parents: [],
    }
    this.space.objects.push(object)
    this.space.bytes.set(object.fileId, bytes)
    return object
  }
  async download(file: SyncFile, object: DriveObject) {
    if (this.failDownload) throw new Error('다운로드 실패')
    const bytes = this.space.bytes.get(object.fileId)!
    if ((await syncHash(bytes)) !== file.sha256)
      throw new Error('파일 해시 불일치')
    this.files.set(file.id, bytes)
    this.downloads++
    return true
  }
  cancel() {}
  async revoke() {}
}
class Device implements SyncLocal, SyncCache {
  data: SyncSnapshot
  records = new Map<string, unknown>()
  id = randomUUID()
  applyFailure = false
  constructor(
    readonly drive: MockDrive,
    data = emptySyncSnapshot(),
  ) {
    this.data = structuredClone(data)
  }
  capture() {
    return structuredClone(this.data)
  }
  async get(key: string) {
    return structuredClone(this.records.get(key))
  }
  async put(key: string, value: unknown) {
    this.records.set(key, structuredClone(value))
  }
  async checkpoint(account: string, value: unknown) {
    await this.put(account + '/checkpoint', value)
  }
  async apply(
    data: SyncSnapshot,
    expected: SyncSnapshot,
    account: string,
    checkpoint: unknown,
  ) {
    expect(stableJson(this.data)).toBe(stableJson(expected))
    if (this.applyFailure) throw new Error('저장 실패')
    this.data = structuredClone(data)
    await this.checkpoint(account, checkpoint)
  }
  async sync(options: Partial<Parameters<typeof runDriveSync>[0]> = {}) {
    return runDriveSync({
      drive: this.drive,
      local: this,
      device: this.id,
      storage: this,
      ...options,
    })
  }
}

test('두 기기는 전체 여행·개인 장소·즐겨찾기를 합치고 변경 없는 재동기화는 중복 게시하지 않음', async () => {
  const space = new Space(),
    a = new Device(new MockDrive(space), snapshot()),
    b = new Device(new MockDrive(space))
  a.data.store.savedCities = ['guam']
  a.data.store.placeLibrary = { entries: [], hidden: ['public:guam-gun-beach'] }
  await a.sync()
  await b.sync()
  expect(b.data).toEqual(canonicalSnapshot(a.data))
  const writes = a.drive.writes
  await a.sync()
  expect(a.drive.writes).toBe(writes)
  b.data.store.savedCities.push('kyoto')
  await b.sync()
  await a.sync()
  expect(a.data.store.savedCities).toEqual(['guam', 'kyoto'])
})

test('같은 여행의 다른 필드와 서로 다른 일정 메모는 자동 병합하고 기존 방문 시각을 보존', () => {
  const base = snapshot(),
    l = structuredClone(base),
    r = structuredClone(base)
  l.store.trips[0].title = '왼쪽 제목'
  r.store.trips[0].days[0][0].note = '오른쪽 메모'
  const merged = mergeSyncSnapshots(base, l, r)
  expect(merged.conflicts).toEqual([])
  expect(merged.snapshot.store.trips[0].title).toBe('왼쪽 제목')
  expect(merged.snapshot.store.trips[0].days[0][0]).toMatchObject({
    time: '',
    note: '오른쪽 메모',
  })
})

test('오프라인에서 같은 필드를 바꾸면 선택 전 저장하지 않고 선택 뒤 다른 필드도 보존', async () => {
  const space = new Space(),
    a = new Device(new MockDrive(space), snapshot()),
    b = new Device(new MockDrive(space))
  await a.sync()
  await b.sync()
  a.data.store.trips[0].title = 'A 제목'
  b.data.store.trips[0].title = 'B 제목'
  b.data.store.trips[0].days[0][0].note = 'B 메모'
  await a.sync()
  const before = b.capture(),
    result = await b.sync()
  expect(result.conflicts).toHaveLength(1)
  expect(b.data).toEqual(before)
  await b.sync({
    choices: { [result.conflicts[0].key]: 'remote' },
    expectedConflictToken: result.conflictToken,
  })
  await a.sync()
  expect(b.data.store.trips[0].title).toBe('A 제목')
  expect(a.data.store.trips[0].days[0][0].note).toBe('B 메모')
})

test('충돌 확인 뒤 기기나 Drive 내용이 다시 바뀌면 예전 선택을 재사용하지 않음', async () => {
  const space = new Space(),
    a = new Device(new MockDrive(space), snapshot()),
    b = new Device(new MockDrive(space))
  await a.sync()
  await b.sync()
  a.data.store.trips[0].title = 'A'
  b.data.store.trips[0].title = 'B'
  await a.sync()
  const first = await b.sync()
  b.data.store.trips[0].title = 'B 최신'
  const second = await b.sync({
    choices: { [first.conflicts[0].key]: 'remote' },
    expectedConflictToken: first.conflictToken,
  })
  expect(second.conflicts[0].local).toBe('B 최신')
  expect(b.data.store.trips[0].title).toBe('B 최신')
})

test('삭제는 다른 기기의 오래된 사본으로 되살리지 않으며 삭제와 수정이 겹치면 확인', async () => {
  const space = new Space(),
    a = new Device(new MockDrive(space), snapshot()),
    b = new Device(new MockDrive(space))
  await a.sync()
  await b.sync()
  a.data.store.trips = []
  await a.sync()
  await b.sync()
  expect(b.data.store.trips).toEqual([])
  const base = snapshot(),
    l = structuredClone(base),
    r = structuredClone(base)
  l.store.trips = []
  r.store.trips[0].title = '수정된 여행'
  expect(mergeSyncSnapshots(base, l, r).conflicts).toHaveLength(1)
})

test('동시 저장은 두 불변 헤드를 남기고 다음 동기화에서 양쪽 변경을 합침', async () => {
  const space = new Space(),
    a = new Device(new MockDrive(space), snapshot()),
    b = new Device(new MockDrive(space))
  await a.sync()
  await b.sync()
  a.data.store.trips[0].title = 'A 제목'
  b.data.store.trips[0].days[0][0].note = 'B 메모'
  let waiting = 0,
    release!: () => void
  const barrier = new Promise<void>((r) => {
    release = r
  })
  const wait = async () => {
    if (++waiting === 2) release()
    await barrier
  }
  a.drive.beforeWrite = wait
  b.drive.beforeWrite = wait
  await Promise.all([a.sync(), b.sync()])
  a.drive.beforeWrite = undefined
  b.drive.beforeWrite = undefined
  const referenced = new Set(
    space.objects
      .filter((o) => o.kind === 'commit-v1')
      .flatMap((o) => o.parents),
  )
  expect(
    space.objects.filter(
      (o) => o.kind === 'commit-v1' && !referenced.has(o.id),
    ),
  ).toHaveLength(2)
  await a.sync()
  await b.sync()
  expect(a.data).toEqual(b.data)
  expect(a.data.store.trips[0]).toMatchObject({
    title: 'A 제목',
    days: [[{ note: 'B 메모' }], []],
  })
})

test('사진·영수증 바이트와 해시가 도착한 뒤에만 전체 기록을 적용하고 실패 시 원본 보존', async () => {
  const space = new Space(),
    a = new Device(new MockDrive(space), snapshot()),
    b = new Device(new MockDrive(space)),
    id = randomUUID(),
    bytes = new TextEncoder().encode('private-file-fixture')
  const file = {
    id,
    name: '가족사진.png',
    mimeType: 'image/png' as const,
    size: bytes.length,
    createdAt: '2026-11-06T00:00:00Z',
    storage: 'browser' as const,
  }
  a.data.photos['city:guam'] = file
  a.data.store.trips[0].attachments = [{ ...file, stopId: 'first-stop' }]
  a.data.store.trips[0].days[0][0].photoId = id
  a.drive.files.set(id, bytes)
  await a.sync()
  b.drive.failDownload = true
  const before = b.capture()
  await expect(b.sync()).rejects.toThrow('다운로드 실패')
  expect(b.data).toEqual(before)
  b.drive.failDownload = false
  await b.sync()
  expect(b.drive.files.get(id)).toEqual(bytes)
  expect(b.data.photos['city:guam'].id).toBe(id)
  expect(b.data.store.trips[0].days[0][0].photoId).toBe(id)
})

test('손상된 파일·동기화 본문·기준 기록은 적용하지 않고 다른 Google 계정 접근을 중단', async () => {
  const space = new Space(),
    a = new Device(new MockDrive(space), snapshot()),
    b = new Device(new MockDrive(space))
  await a.sync()
  const item = space.objects.find((o) => o.kind === 'commit-v1')!
  space.bodies.set(item.fileId, '{}')
  await expect(b.sync()).rejects.toThrow('손상')
  expect(b.data.store.trips).toEqual([])
  await expect(
    a.sync({
      expectedAccount: {
        id: 'different-account',
        email: 'other@example.test',
        name: '다른 계정',
      },
    }),
  ).rejects.toThrow('다른 Google 계정')
  const cleanSpace = new Space(),
    c = new Device(new MockDrive(cleanSpace), snapshot())
  await c.sync()
  await c.put('test-account/checkpoint', { commitId: 'broken', snapshot: {} })
  await expect(c.sync()).rejects.toThrow('기준 기록')
})

test('다운로드 중 발생한 새 수정과 연결 해제 후 늦은 응답은 기기 기록을 덮어쓰지 않음', async () => {
  const space = new Space(),
    a = new Device(new MockDrive(space), snapshot()),
    b = new Device(new MockDrive(space))
  await a.sync()
  let active = true
  b.drive.beforeWrite = async () => {
    active = false
  }
  b.data.store.savedCities = ['kyoto']
  await expect(b.sync({ isActive: () => active })).rejects.toThrow('중단')
  expect(b.data.store.trips).toEqual([])
  const c = new Device(new MockDrive(space))
  c.applyFailure = true
  await expect(c.sync()).rejects.toThrow('저장 실패')
  expect(c.data.store.trips).toEqual([])
})

test('여행 날짜 변경과 일정 편집, 서로 다른 재정렬은 묵시적으로 날짜·순서를 바꾸지 않음', () => {
  const base = snapshot(),
    l = structuredClone(base),
    r = structuredClone(base)
  l.store.trips[0].startDate = '2026-12-23'
  l.store.trips[0].endDate = '2026-12-24'
  r.store.trips[0].days[0][0].note = '수정'
  expect(mergeSyncSnapshots(base, l, r).conflicts).toHaveLength(1)
  base.store.trips[0].days[0] = ['a', 'b', 'c'].map((id) => ({
    id,
    placeId: 'guam-tumon-beach',
    time: '',
    note: '',
  }))
  const a = structuredClone(base),
    b = structuredClone(base)
  a.store.trips[0].days[0].reverse()
  b.store.trips[0].days[0] = [
    b.store.trips[0].days[0][1],
    b.store.trips[0].days[0][0],
    b.store.trips[0].days[0][2],
  ]
  expect(
    mergeSyncSnapshots(base, a, b).conflicts.some(
      (c) => c.path.at(-1) === '$order',
    ),
  ).toBe(true)
})

test('알 수 없는 최상위 자료나 토큰·GPS를 동기화 스키마에 넣을 수 없음', () => {
  const commit = {
    format: 'jido-drive-sync-v1',
    minBuild: 81,
    id: randomUUID(),
    parents: [],
    createdAt: new Date().toISOString(),
    device: randomUUID(),
    snapshot: snapshot(),
    files: [],
  }
  expect(
    syncCommitSchema.safeParse({ ...commit, accessToken: 'must-not-sync' })
      .success,
  ).toBe(false)
  expect(
    syncCommitSchema.safeParse({
      ...commit,
      snapshot: { ...commit.snapshot, gps: { lat: 1, lng: 2 } },
    }).success,
  ).toBe(false)
})

test('내려받은 가이드와 개인 작성 본문·이전 장소를 보존하며 다른 버전의 필드를 버리지 않음', async () => {
  const manifest = JSON.parse(readFileSync('guidebooks/manifest.json', 'utf8')),
    entry = manifest.books.find((b: any) => b.id === 'book-hanoi'),
    guide = JSON.parse(readFileSync('guidebooks/' + entry.file, 'utf8'))
  const data = snapshot()
  data.books = [{ id: entry.id, revision: entry.revision, guide }]
  data.retainedPlaces = guide.places
  data.catalog.available = [
    {
      ...guide,
      city: { ...guide.city, description: '내가 작성한 개인 가이드 설명' },
    },
  ]
  data.catalog.retained = structuredClone(data.catalog.available)
  data.catalog.usingServer = true
  const space = new Space(),
    a = new Device(new MockDrive(space), data),
    b = new Device(new MockDrive(space))
  await a.sync()
  await b.sync()
  expect(b.data.books[0].revision).toBe(entry.revision)
  expect(b.data.catalog.available[0].city.description).toBe(
    '내가 작성한 개인 가이드 설명',
  )
  expect(b.data.retainedPlaces.map((p) => p.id)).toEqual(
    guide.places.map((p: any) => p.id),
  )
  const future = snapshot() as any
  future.store.trips[0].days[0][0].futurePersonalField =
    '보존해야 할 다음 버전 기록'
  expect(() => parseSyncSnapshot(future)).toThrow('최신 버전')
})

async function settings(page: Page) {
  await page
    .locator('.bottom-nav:visible, .desktop-nav:visible')
    .getByRole('button', { name: '설정', exact: true })
    .click()
  return page.getByRole('region', { name: 'Google Drive 동기화', exact: true })
}
test('미연결 기기는 외부 요청 없이 사용할 수 있고 좁은 화면에서 연결·안내를 제공', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  const requests: string[] = []
  page.on('request', (r) => {
    if (/googleapis.com.*drive/.test(r.url())) requests.push(r.url())
  })
  await page.goto('/')
  const panel = await settings(page)
  await expect(
    panel.getByRole('button', { name: 'Google 계정 연결', exact: true }),
  ).toBeVisible()
  await panel
    .getByRole('button', { name: 'Google 계정 연결', exact: true })
    .click()
  await expect(panel).toContainText('Android 앱')
  expect(requests).toEqual([])
  expect(await panel.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(
    true,
  )
})

test('앱 시작 전 부분 적용 저널은 원본으로 복구하고 완료 표시 후의 새 수정은 유지', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(async (initial) => {
    const keys = [
      'jido-travel-v1',
      'jido-personal-photos-v1',
      'jdo-guide-catalog-v1',
      'jdo-guidebooks-v1',
    ]
    const before = Object.fromEntries(
      keys.map((k) => [k, localStorage.getItem(k)]),
    )
    before['jido-travel-v1'] = JSON.stringify(initial)
    const after = {
        ...before,
        'jido-travel-v1': JSON.stringify({ ...initial, trips: [] }),
      },
      id = crypto.randomUUID()
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('jido-drive-sync-v1', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('records')
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction('records', 'readwrite')
        tx.objectStore('records').put(
          { id, before, after, complete: false },
          'journal',
        )
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
    localStorage.setItem('jido-travel-v1', after['jido-travel-v1']!)
    localStorage.setItem('jido-sync-transaction-v1', id + '|pending')
  }, snapshot().store)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'J★Do 홈', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].title,
    ),
  ).toBe('동기화할 괌 여행')
  await page.evaluate(async () => {
    const keys = [
        'jido-travel-v1',
        'jido-personal-photos-v1',
        'jdo-guide-catalog-v1',
        'jdo-guidebooks-v1',
      ],
      before = Object.fromEntries(
        keys.map((k) => [k, localStorage.getItem(k)]),
      ),
      after = { ...before },
      id = crypto.randomUUID()
    const data = JSON.parse(after['jido-travel-v1']!)
    data.trips[0].title = '완료 후 새 수정'
    localStorage.setItem('jido-travel-v1', JSON.stringify(data))
    await new Promise<void>((resolve) => {
      const r = indexedDB.open('jido-drive-sync-v1', 1)
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction('records', 'readwrite')
        tx.objectStore('records').put(
          { id, before, after, complete: false },
          'journal',
        )
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
      }
    })
    localStorage.setItem('jido-sync-transaction-v1', id + '|applied')
  })
  await page.reload()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].title,
    ),
  ).toBe('완료 후 새 수정')
})

// The Google HTTP service and Android account chooser are simulated. Contexts
// below still have independent browser storage, files and running React apps.
async function fakeGoogle(
  context: BrowserContext,
  space: Map<string, { metadata: any; bytes: Buffer }>,
  sessions: Map<string, any>,
  initial: SyncSnapshot,
) {
  await context.addInitScript(
    ({ initial }) => {
      if (!sessionStorage.getItem('sync-seeded')) {
        sessionStorage.setItem('sync-seeded', 'yes')
        localStorage.setItem('jido-travel-v1', JSON.stringify(initial.store))
        localStorage.setItem(
          'jido-personal-photos-v1',
          JSON.stringify(initial.photos),
        )
      }
      localStorage.setItem('jdo-content-auto-v1', 'false')
      const w = window as any
      const blobs = async (id: string, blob?: Blob) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const r = indexedDB.open('jido-attachments-v1', 1)
          r.onupgradeneeded = () => r.result.createObjectStore('files')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        try {
          return await new Promise<Blob | undefined>((resolve, reject) => {
            const tx = db.transaction('files', blob ? 'readwrite' : 'readonly'),
              store = tx.objectStore('files'),
              r = blob ? store.put(blob, id) : store.get(id)
            tx.oncomplete = () => resolve(blob || r.result)
            tx.onerror = () => reject(tx.error)
          })
        } finally {
          db.close()
        }
      }
      const digest = async (bytes: ArrayBuffer) =>
        Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      w.CapacitorCustomPlatform = { name: 'android' }
      w.Capacitor = {
        PluginHeaders: [
          {
            name: 'GoogleDriveSync',
            methods: [
              'authorize',
              'cancel',
              'revoke',
              'inspectFile',
              'uploadFile',
              'downloadFile',
            ].map((name) => ({ name, rtype: 'promise' })),
          },
          {
            name: 'Attachments',
            methods: ['getUri', 'checkFile'].map((name) => ({
              name,
              rtype: 'promise',
            })),
          },
        ],
        nativePromise: async (plugin: string, method: string, options: any) => {
          if (plugin === 'GoogleDriveSync' && method === 'authorize')
            return { accessToken: 'fixture-token-not-a-real-credential' }
          if (
            plugin === 'GoogleDriveSync' &&
            ['cancel', 'revoke'].includes(method)
          )
            return {}
          if (plugin === 'Attachments') {
            const blob = await blobs(options.id)
            if (!blob) throw new Error('원본 자료 없음')
            return method === 'getUri'
              ? { uri: URL.createObjectURL(blob) }
              : { size: blob.size }
          }
          if (plugin === 'GoogleDriveSync' && method === 'inspectFile') {
            const blob = await blobs(options.id)
            if (!blob) throw new Error('원본 자료 없음')
            return {
              size: blob.size,
              sha256: await digest(await blob.arrayBuffer()),
            }
          }
          if (plugin === 'GoogleDriveSync' && method === 'uploadFile') {
            const blob = await blobs(options.id)
            if (!blob) throw new Error('원본 자료 없음')
            const init = await fetch(
              'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
              {
                method: 'POST',
                headers: {
                  Authorization: 'Bearer ' + options.accessToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: 'fixture-file',
                  parents: ['appDataFolder'],
                  appProperties: {
                    'jido-app': 'jido-sync',
                    'jido-kind': 'blob-v1',
                    logicalId: options.id,
                    sha256: options.sha256,
                  },
                }),
              },
            )
            const uploaded = await fetch(init.headers.get('Location')!, {
              method: 'PUT',
              headers: { Authorization: 'Bearer ' + options.accessToken },
              body: blob,
            })
            return uploaded.json()
          }
          if (plugin === 'GoogleDriveSync' && method === 'downloadFile') {
            const file = JSON.parse(options.attachment),
              response = await fetch(
                'https://www.googleapis.com/drive/v3/files/' +
                  options.fileId +
                  '?alt=media',
                { headers: { Authorization: 'Bearer ' + options.accessToken } },
              ),
              bytes = await response.arrayBuffer()
            if (
              bytes.byteLength !== file.size ||
              (await digest(bytes)) !== options.sha256
            )
              throw new Error('자료가 손상됐어요. 기존 기록은 그대로예요.')
            const previous = await blobs(file.id)
            if (
              previous &&
              (await digest(await previous.arrayBuffer())) !== options.sha256
            )
              throw new Error('파일 번호 충돌')
            if (!previous)
              await blobs(file.id, new Blob([bytes], { type: file.mimeType }))
            return { created: !previous }
          }
          throw new Error('No fixture file operation: ' + method)
        },
      }
    },
    { initial },
  )
  await context.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method()
    if (!request.headers().authorization?.startsWith('Bearer fixture-token'))
      return route.fulfill({ status: 401, body: '{}' })
    if (url.pathname === '/drive/v3/about')
      return route.fulfill({
        json: {
          user: {
            permissionId: 'fixture-user',
            emailAddress: 'same-account@example.test',
            displayName: '테스트',
          },
        },
      })
    if (url.pathname === '/drive/v3/files' && method === 'GET')
      return route.fulfill({
        json: {
          files: [...space.entries()].map(([id, f]) => ({
            id,
            appProperties: f.metadata.appProperties,
          })),
        },
      })
    if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const id = randomUUID()
      sessions.set(id, JSON.parse(request.postData()!))
      return route.fulfill({
        status: 200,
        headers: {
          Location:
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=' +
            id,
          'Access-Control-Expose-Headers': 'Location',
        },
        body: '',
      })
    }
    if (url.pathname === '/upload/drive/v3/files' && method === 'PUT') {
      const id = 'file_' + randomUUID(),
        metadata = sessions.get(url.searchParams.get('upload_id')!)
      space.set(id, { metadata, bytes: request.postDataBuffer()! })
      return route.fulfill({ json: { id } })
    }
    if (url.pathname.startsWith('/drive/v3/files/')) {
      const file = space.get(url.pathname.split('/').at(-1)!)
      return file
        ? route.fulfill({
            body: file.bytes,
            contentType: 'application/octet-stream',
          })
        : route.fulfill({ status: 404, body: '{}' })
    }
    return route.fulfill({ status: 400, body: '{}' })
  })
}
test('독립된 두 기기의 실제 화면에서 계정 연결·초기 가져오기·오프라인 수정 병합·연결 해제', async ({
  browser,
}) => {
  const a = await browser.newContext({ viewport: { width: 393, height: 851 } }),
    b = await browser.newContext({ viewport: { width: 393, height: 851 } }),
    space = new Map(),
    sessions = new Map()
  try {
    await fakeGoogle(a, space, sessions, snapshot())
    await fakeGoogle(b, space, sessions, emptySyncSnapshot())
    const pa = await a.newPage(),
      pb = await b.newPage()
    await Promise.all([
      pa.goto('http://127.0.0.1:5192'),
      pb.goto('http://127.0.0.1:5192'),
    ])
    const sa = await settings(pa),
      sb = await settings(pb)
    await sa
      .getByRole('button', { name: 'Google 계정 연결', exact: true })
      .click()
    await expect(sa.getByRole('status')).toHaveText('동기화됐어요.')
    await sb
      .getByRole('button', { name: 'Google 계정 연결', exact: true })
      .click()
    await expect(sb.getByRole('status')).toHaveText('동기화됐어요.')
    expect(
      await pb.evaluate(
        () =>
          JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].title,
      ),
    ).toBe('동기화할 괌 여행')
    await sa.getByRole('checkbox', { name: '앱을 열면 자동 동기화' }).uncheck()
    await sb.getByRole('checkbox', { name: '앱을 열면 자동 동기화' }).uncheck()
    await a.setOffline(true)
    await b.setOffline(true)
    await pa.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('jido-travel-v1')!)
      data.trips[0].title = '기기 A의 여행명'
      localStorage.setItem('jido-travel-v1', JSON.stringify(data))
    })
    await pb.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('jido-travel-v1')!)
      data.trips[0].days[0][0].note = '기기 B의 새 메모'
      localStorage.setItem('jido-travel-v1', JSON.stringify(data))
    })
    await a.setOffline(false)
    await b.setOffline(false)
    await Promise.all([pa.reload(), pb.reload()])
    const first = await settings(pa),
      second = await settings(pb)
    await first
      .getByRole('button', { name: '지금 동기화', exact: true })
      .click()
    await expect(first.getByRole('status')).toHaveText('동기화됐어요.')
    await second
      .getByRole('button', { name: '지금 동기화', exact: true })
      .click()
    await expect(second.getByRole('status')).toHaveText('동기화됐어요.')
    await first
      .getByRole('button', { name: '지금 동기화', exact: true })
      .click()
    await expect(first.getByRole('status')).toHaveText('동기화됐어요.')
    for (const p of [pa, pb]) {
      const data = await p.evaluate(() =>
        JSON.parse(localStorage.getItem('jido-travel-v1')!),
      )
      expect(data.trips[0].title).toBe('기기 A의 여행명')
      expect(data.trips[0].days[0][0].note).toBe('기기 B의 새 메모')
      expect(
        (await p.evaluate(() => JSON.stringify(localStorage))).includes(
          'fixture-token',
        ),
      ).toBe(false)
    }
    // A later edit of the same field must be resolved through the UI.
    for (const [p, title] of [
      [pa, '확인할 A 제목'],
      [pb, '확인할 B 제목'],
    ] as const)
      await p.evaluate((title) => {
        const data = JSON.parse(localStorage.getItem('jido-travel-v1')!)
        data.trips[0].title = title
        localStorage.setItem('jido-travel-v1', JSON.stringify(data))
      }, title)
    await Promise.all([pa.reload(), pb.reload()])
    await settings(pa)
    await settings(pb)
    await first
      .getByRole('button', { name: '지금 동기화', exact: true })
      .click()
    await expect(first.getByRole('status')).toHaveText('동기화됐어요.')
    await second
      .getByRole('button', { name: '지금 동기화', exact: true })
      .click()
    await expect(second).toContainText('서로 다른 내용 확인')
    await second
      .locator('fieldset label')
      .filter({ hasText: '확인할 A 제목' })
      .getByRole('radio')
      .check()
    await second
      .getByRole('button', { name: '선택한 내용으로 동기화', exact: true })
      .click()
    await expect(second.getByRole('status')).toHaveText('동기화됐어요.')
    expect(
      await pb.evaluate(
        () =>
          JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].title,
      ),
    ).toBe('확인할 A 제목')
    const count = space.size
    await second.getByRole('button', { name: '연결 해제', exact: true }).click()
    await second
      .locator('.drive-sync-confirm')
      .getByRole('button', { name: '연결 해제', exact: true })
      .click()
    await expect(
      second.getByRole('button', { name: 'Google 계정 연결', exact: true }),
    ).toBeVisible()
    expect(space.size).toBe(count)
    expect(
      await pb.evaluate(
        () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.length,
      ),
    ).toBe(1)
  } finally {
    await a.close()
    await b.close()
  }
})

test('두 기기의 사진·일정 사진·첨부는 해시 검증 후 나타나며 손상 파일은 부분 적용하지 않음', async ({
  browser,
}) => {
  const a = await browser.newContext({ viewport: { width: 393, height: 851 } }),
    b = await browser.newContext({ viewport: { width: 393, height: 851 } }),
    space = new Map<string, { metadata: any; bytes: Buffer }>(),
    sessions = new Map()
  const data = snapshot(),
    id = randomUUID(),
    bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5+7S8AAAAASUVORK5CYII=',
      'base64',
    )
  const file = {
    id,
    name: '동기화 시험 사진.png',
    mimeType: 'image/png' as const,
    size: bytes.length,
    createdAt: '2026-11-06T00:00:00Z',
    storage: 'android' as const,
  }
  data.photos['city:guam'] = file
  data.store.trips[0].attachments = [file]
  data.store.trips[0].days[0][0].photoId = id
  try {
    await fakeGoogle(a, space, sessions, data)
    await fakeGoogle(b, space, sessions, emptySyncSnapshot())
    const pa = await a.newPage(),
      pb = await b.newPage()
    await Promise.all([
      pa.goto('http://127.0.0.1:5192'),
      pb.goto('http://127.0.0.1:5192'),
    ])
    await pa.evaluate(
      async ({ id, bytes }) =>
        new Promise<void>((resolve, reject) => {
          const r = indexedDB.open('jido-attachments-v1', 1)
          r.onupgradeneeded = () => r.result.createObjectStore('files')
          r.onsuccess = () => {
            const db = r.result,
              tx = db.transaction('files', 'readwrite')
            tx.objectStore('files').put(
              new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
              id,
            )
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error)
          }
        }),
      { id, bytes: [...bytes] },
    )
    const sa = await settings(pa),
      sb = await settings(pb)
    await sa
      .getByRole('button', { name: 'Google 계정 연결', exact: true })
      .click()
    await expect(sa.getByRole('status')).toHaveText('동기화됐어요.')
    const blob = [...space.values()].find(
        (v) => v.metadata.appProperties['jido-kind'] === 'blob-v1',
      )!,
      original = blob.bytes
    blob.bytes = Buffer.from('damaged')
    await sb
      .getByRole('button', { name: 'Google 계정 연결', exact: true })
      .click()
    await expect(sb.getByRole('status')).toContainText('자료가 손상')
    expect(
      await pb.evaluate(
        () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.length,
      ),
    ).toBe(0)
    expect(
      await pb.evaluate(() =>
        JSON.parse(localStorage.getItem('jido-personal-photos-v1')!),
      ),
    ).toEqual({})
    blob.bytes = original
    await pb.evaluate(() => {
      const w = window as any
      w.failCloudStore = true
      const write = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key === 'jido-travel-v1' && w.failCloudStore)
          throw new DOMException('fixture quota', 'QuotaExceededError')
        return write.call(this, key, value)
      }
    })
    await sb.getByRole('button', { name: '지금 동기화', exact: true }).click()
    await expect(sb.getByRole('status')).toContainText('기기에 저장하지 못')
    expect(
      await pb.evaluate(
        () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.length,
      ),
    ).toBe(0)
    expect(
      await pb.evaluate(() =>
        JSON.parse(localStorage.getItem('jido-personal-photos-v1')!),
      ),
    ).toEqual({})
    expect(
      await pb.evaluate(() => localStorage.getItem('jido-sync-transaction-v1')),
    ).toBeNull()
    await pb.evaluate(() => {
      ;(window as any).failCloudStore = false
    })
    await sb.getByRole('button', { name: '지금 동기화', exact: true }).click()
    await expect(sb.getByRole('status')).toHaveText('동기화됐어요.')
    const stored = await pb.evaluate(() => ({
      store: JSON.parse(localStorage.getItem('jido-travel-v1')!),
      photos: JSON.parse(localStorage.getItem('jido-personal-photos-v1')!),
    }))
    expect(stored.photos['city:guam']).toMatchObject({ id, storage: 'android' })
    expect(stored.store.trips[0].days[0][0].photoId).toBe(id)
    const downloaded = await pb.evaluate(
      async (id) =>
        new Promise<number[]>((resolve) => {
          const r = indexedDB.open('jido-attachments-v1', 1)
          r.onsuccess = () => {
            const db = r.result,
              q = db.transaction('files').objectStore('files').get(id)
            q.onsuccess = async () => {
              const blob = q.result as Blob
              resolve([...new Uint8Array(await blob.arrayBuffer())])
              db.close()
            }
          }
        }),
      id,
    )
    expect(downloaded).toEqual([...bytes])
    // The lineage index itself is checked, not just HTTP200 or the body bytes.
    const commit = [...space.values()].find(
      (v) => v.metadata.appProperties['jido-kind'] === 'commit-v1',
    )!
    commit.metadata.appProperties.lineage = '0'.repeat(64)
    const before = await pb.evaluate(() =>
      localStorage.getItem('jido-travel-v1'),
    )
    await sb.getByRole('button', { name: '지금 동기화', exact: true }).click()
    await expect(sb.getByRole('status')).toContainText('색인이 손상')
    expect(
      await pb.evaluate(() => localStorage.getItem('jido-travel-v1')),
    ).toBe(before)
  } finally {
    await a.close()
    await b.close()
  }
})
