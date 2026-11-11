import {
  hasReservationDetails,
  RESERVATION_DETAILS_BUILD,
} from './reservation-compat'
import {
  canonicalSnapshot,
  emptySyncSnapshot,
  stableJson,
  syncCommitSchema,
  parseSyncCommit,
  syncSnapshotSchema,
  syncHash,
  syncFiles,
  type SyncCommit,
  type SyncSnapshot,
  type SyncFile,
} from './sync-model'
import {
  mergeSyncSnapshots,
  type SyncChoices,
  type SyncConflict,
} from './sync-merge'
import type { SyncDrive, DriveObject, SyncAccount } from './sync-drive'
import type { SyncLocal } from './sync-local'
import { syncDb, cacheSyncCommit } from './sync-db'

export type SyncCheckpoint = { commitId: string; snapshot: SyncSnapshot }
export type SyncEngineResult = {
  account: SyncAccount
  conflicts: SyncConflict[]
  checkpoint?: SyncCheckpoint
  unchanged?: boolean
  conflictToken?: string
}
export type SyncCache = {
  get: (key: string) => Promise<unknown>
  put: (key: string, value: unknown) => Promise<void>
}
const cache: SyncCache = {
  get: syncDb,
  put: async (key, value) => cacheSyncCommit(key, String(value)),
}
const prefixChoices = (choices: SyncChoices, prefix: string) =>
  Object.fromEntries(
    Object.entries(choices)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k.slice(prefix.length), v]),
  )
const prefixConflicts = (conflicts: SyncConflict[], prefix: string) =>
  conflicts.map((c) => ({ ...c, key: prefix + c.key }))

// Immutable commits form a DAG. Two simultaneous writers never replace each
// other's snapshot; the next sync sees both heads and merges their changes.
export async function runDriveSync({
  drive,
  local,
  expectedAccount,
  interactive = false,
  device,
  choices = {},
  forceFiles = false,
  storage = cache,
  isActive = () => true,
  onProgress = () => {},
  onAccount = () => {},
  expectedConflictToken,
}: {
  drive: SyncDrive
  local: SyncLocal
  expectedAccount?: SyncAccount
  interactive?: boolean
  device: string
  choices?: SyncChoices
  forceFiles?: boolean
  storage?: SyncCache
  isActive?: () => boolean
  onProgress?: (text: string) => void
  onAccount?: (account: SyncAccount) => void
  expectedConflictToken?: string
}): Promise<SyncEngineResult> {
  const active = () => {
    if (!isActive()) throw new Error('동기화가 중단됐어요.')
  }
  onProgress('Google 계정 확인 중')
  const account = await drive.connect(interactive, expectedAccount?.email)
  active()
  if (expectedAccount && account.id !== expectedAccount.id)
    throw new Error(
      '연결된 계정과 다른 Google 계정이에요. 기존 계정으로 다시 연결해 주세요.',
    )
  onAccount(account)
  const physical = local.capture(),
    initial = canonicalSnapshot(physical),
    objects = await drive.list()
  active()
  const commits = new Map<string, DriveObject>(),
    blobs = new Map<string, DriveObject>()
  for (const object of objects) {
    if (object.kind === 'commit-v1') {
      if (
        object.parents.length > 32 ||
        new Set(object.parents).size !== object.parents.length ||
        object.parents.some((p) => !/^[a-f0-9-]{36}$/i.test(p))
      )
        throw new Error('동기화 이력 연결을 확인하지 못했어요.')
      const known = commits.get(object.id)
      if (
        known &&
        (known.sha256 !== object.sha256 ||
          stableJson(known.parents) !== stableJson(object.parents))
      )
        throw new Error(
          '같은 번호의 동기화 이력이 서로 달라요. 기존 기록을 보존했어요.',
        )
      if (!known || known.fileId > object.fileId) commits.set(object.id, object)
    } else {
      const key = object.id + ':' + object.sha256,
        known = blobs.get(key)
      if (!known || known.fileId > object.fileId) blobs.set(key, object)
    }
  }
  const degrees = new Map(
      [...commits.values()].map((c) => [c.id, c.parents.length]),
    ),
    children = new Map<string, string[]>()
  for (const node of commits.values())
    for (const parent of node.parents) {
      if (!commits.has(parent))
        throw new Error(
          'Drive 동기화 이력이 일부 없어졌어요. 기기 원본은 그대로예요.',
        )
      children.set(parent, [...(children.get(parent) || []), node.id])
    }
  const roots = [...degrees].filter(([, n]) => n === 0).map(([id]) => id)
  for (let i = 0; i < roots.length; i++)
    for (const child of children.get(roots[i]) || []) {
      const next = degrees.get(child)! - 1
      degrees.set(child, next)
      if (next === 0) roots.push(child)
    }
  if (roots.length !== commits.size)
    throw new Error('동기화 이력이 순환하고 있어요. 기존 기록은 그대로예요.')
  const parents = new Set([...commits.values()].flatMap((c) => c.parents)),
    heads = [...commits.values()]
      .filter((c) => !parents.has(c.id))
      .sort((a, b) => a.id.localeCompare(b.id))
  if (commits.size && !heads.length)
    throw new Error('동기화 이력이 순환하고 있어요. 기기 자료는 그대로예요.')
  if (heads.length > 32)
    throw new Error(
      '아직 합치지 못한 기기 변경이 많아요. 기존 기록을 보존했어요.',
    )
  const conflictToken = await syncHash(
    stableJson({ initial, heads: heads.map((h) => [h.id, h.sha256]) }),
  )
  if (expectedConflictToken && conflictToken !== expectedConflictToken)
    choices = {}
  const loaded = new Map<string, SyncCommit>()
  async function read(object: DriveObject) {
    if (loaded.has(object.id)) return loaded.get(object.id)!
    const key = account.id + '/commit/' + object.id + '/' + object.sha256
    let body = await storage.get(key)
    const cached =
      typeof body === 'string' && (await syncHash(body)) === object.sha256
    if (typeof body !== 'string' || (await syncHash(body)) !== object.sha256)
      body = await drive.read(object.fileId)
    active()
    if (typeof body !== 'string' || (await syncHash(body)) !== object.sha256)
      throw new Error('Drive 동기화 정보가 손상됐어요. 기기 기록을 유지했어요.')
    const value = parseSyncCommit(JSON.parse(body))
    if (
      value.id !== object.id ||
      stableJson(value.parents) !== stableJson(object.parents)
    )
      throw new Error('Drive 동기화 이력 연결이 다릅니다.')
    loaded.set(value.id, value)
    // Large histories remain in Drive. Cache only small bodies; cache failure
    // cannot turn an unverified response into an accepted one.
    if (!cached && body.length < 256 * 1024)
      await storage.put(key, body).catch(() => {})
    return value
  }
  function ancestors(id: string) {
    const distances = new Map<string, number>(),
      queue: [string, number][] = [[id, 0]]
    for (let i = 0; i < queue.length; i++) {
      const [current, distance] = queue[i]
      if (distances.has(current)) continue
      if (distances.size > 20000) throw new Error('동기화 이력이 너무 큽니다.')
      const item = commits.get(current)
      if (!item)
        throw new Error(
          'Drive의 동기화 이력이 일부 없어졌어요. 기기 원본은 보존했어요.',
        )
      distances.set(current, distance)
      for (const parent of item.parents) {
        if (parent === id) throw new Error('동기화 이력이 순환하고 있어요.')
        queue.push([parent, distance + 1])
      }
    }
    return distances
  }
  const ancestry = heads.map((h) => ancestors(h.id))
  const common =
    heads.length > 1
      ? [...ancestry[0].keys()]
          .filter((id) => ancestry.every((a) => a.has(id)))
          .sort(
            (a, b) =>
              Math.max(...ancestry.map((c) => c.get(a)!)) -
                Math.max(...ancestry.map((c) => c.get(b)!)) ||
              a.localeCompare(b),
          )[0]
      : undefined
  // Drive.list validates the checksum of each small lineage header. Fetch
  // only complete heads and their common base, not years of old snapshots.
  for (const head of heads) await read(head)
  const cloudBase = common
    ? (await read(commits.get(common)!)).snapshot
    : emptySyncSnapshot()
  let remote = heads.length
    ? (await read(heads[0])).snapshot
    : emptySyncSnapshot()
  const cloudConflicts: SyncConflict[] = []
  for (const head of heads.slice(1)) {
    const prefix = 'cloud:' + head.id + ':'
    const result = mergeSyncSnapshots(
      cloudBase,
      remote,
      (await read(head)).snapshot,
      prefixChoices(choices, prefix),
    )
    remote = result.snapshot
    cloudConflicts.push(...prefixConflicts(result.conflicts, prefix))
  }
  if (cloudConflicts.length)
    return { account, conflicts: cloudConflicts, conflictToken }
  const saved = (await storage.get(account.id + '/checkpoint')) as
    SyncCheckpoint | undefined
  const validSaved =
    saved && typeof saved.commitId === 'string'
      ? syncSnapshotSchema.safeParse(saved.snapshot)
      : undefined
  if (saved !== undefined && !validSaved?.success)
    throw new Error(
      '동기화 기준 기록이 손상됐어요. 기기의 원본을 보존하기 위해 합치기를 멈췄어요.',
    )
  const base = validSaved?.success ? saved!.snapshot : emptySyncSnapshot()
  const result = heads.length
    ? mergeSyncSnapshots(
        base,
        initial,
        remote,
        prefixChoices(choices, 'device:'),
      )
    : { snapshot: initial, conflicts: [] }
  if (result.conflicts.length)
    return {
      account,
      conflicts: prefixConflicts(result.conflicts, 'device:'),
      conflictToken,
    }
  const target = canonicalSnapshot(result.snapshot)
  const files = new Map<string, SyncFile>()
  for (const commit of loaded.values())
    for (const file of commit.files) {
      const existing = files.get(file.id)
      if (existing && existing.sha256 !== file.sha256)
        throw new Error(
          '같은 자료 번호에 다른 파일이 있어요. 기존 파일을 보존했어요.',
        )
      files.set(file.id, file)
    }
  if (
    !forceFiles &&
    heads.length === 1 &&
    saved?.commitId === heads[0].id &&
    stableJson(initial) === stableJson(remote)
  )
    return {
      account,
      conflicts: [],
      checkpoint: { commitId: heads[0].id, snapshot: remote },
      unchanged: true,
    }
  const physicalFiles = new Map(syncFiles(physical).map((f) => [f.id, f])),
    finalFiles: SyncFile[] = []
  const needed = syncFiles(target)
  for (let i = 0; i < needed.length; i++) {
    active()
    onProgress(`사진·첨부 확인 ${i + 1}/${needed.length}`)
    const descriptor = needed[i],
      localFile = physicalFiles.get(descriptor.id),
      remoteFile = files.get(descriptor.id)
    let inspected: SyncFile | undefined
    if (localFile) {
      try {
        inspected = await drive.inspect(localFile)
      } catch (error) {
        if (!remoteFile) throw error
      }
    }
    if (inspected && remoteFile && inspected.sha256 !== remoteFile.sha256)
      throw new Error(
        '기기와 Drive에 같은 번호의 다른 파일이 있어요. 원본을 보존했어요.',
      )
    const file = inspected || remoteFile
    if (!file)
      throw new Error('사진·첨부 원본이 없습니다. 기기 기록은 그대로예요.')
    const key = file.id + ':' + file.sha256
    if (!blobs.has(key)) {
      if (!inspected)
        throw new Error('Drive에 연결된 사진·첨부 파일이 없습니다.')
      blobs.set(key, await drive.upload(inspected))
      active()
    }
    if (!inspected) {
      await drive.download(
        { ...file, ...descriptor, sha256: file.sha256 },
        blobs.get(key)!,
      )
      active()
    }
    finalFiles.push({ ...descriptor, sha256: file.sha256, storage: 'browser' })
  }
  active()
  if (stableJson(canonicalSnapshot(local.capture())) !== stableJson(initial))
    throw new Error(
      '동기화 중 기기 기록이 바뀌었어요. 최신 내용으로 다시 동기화해 주세요.',
    )
  let commitId =
    heads.length === 1 && stableJson(target) === stableJson(remote)
      ? heads[0].id
      : ''
  if (!commitId) {
    onProgress('Drive에 변경 저장 중')
    const commit = syncCommitSchema.parse({
      format: 'jido-drive-sync-v1',
      minBuild: hasReservationDetails(target.store.trips)
        ? RESERVATION_DETAILS_BUILD
        : 81,
      id: crypto.randomUUID(),
      parents: heads.map((h) => h.id),
      createdAt: new Date().toISOString(),
      device,
      snapshot: target,
      files: finalFiles,
    })
    await drive.write(commit.id, commit.parents, JSON.stringify(commit))
    active()
    commitId = commit.id
  }
  const checkpoint = { commitId, snapshot: target }
  onProgress('기기 기록에 적용 중')
  active()
  if (stableJson(target) !== stableJson(initial))
    await local.apply(target, physical, account.id, checkpoint, isActive)
  else await local.checkpoint(account.id, checkpoint)
  active()
  return { account, conflicts: [], checkpoint }
}
