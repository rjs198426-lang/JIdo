import { registerPlugin } from '@capacitor/core'
import {
  browserBlob,
  isAndroid,
  putSyncedBrowserFile,
} from './attachment-storage'
import type { Attachment } from './attachment-schema'
import { syncHash, stableJson, type SyncFile } from './sync-model'

const scope = 'https://www.googleapis.com/auth/drive.appdata'
const native = registerPlugin<{
  authorize(value: {
    interactive: boolean
    email?: string
    selectAccount?: boolean
  }): Promise<{ accessToken: string }>
  cancel(): Promise<void>
  revoke(value: { email: string }): Promise<void>
  inspectFile(value: { id: string }): Promise<{ size: number; sha256: string }>
  uploadFile(value: {
    id: string
    sha256: string
    accessToken: string
  }): Promise<{ id: string }>
  downloadFile(value: {
    fileId: string
    sha256: string
    attachment: string
    accessToken: string
  }): Promise<{ created: boolean }>
}>('GoogleDriveSync')
export type SyncAccount = { id: string; email: string; name: string }
export type DriveObject = {
  fileId: string
  id: string
  sha256: string
  kind: 'commit-v1' | 'blob-v1'
  parents: string[]
}
export interface SyncDrive {
  connect(interactive: boolean, email?: string): Promise<SyncAccount>
  list(): Promise<DriveObject[]>
  read(fileId: string): Promise<string>
  write(id: string, parents: string[], body: string): Promise<DriveObject>
  inspect(file: Attachment): Promise<SyncFile>
  upload(file: SyncFile): Promise<DriveObject>
  download(file: SyncFile, object: DriveObject): Promise<boolean>
  cancel(): void
  revoke(email: string): Promise<void>
}
const driveId = (value: string) => {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(value))
    throw new Error('Drive 파일 번호를 확인하지 못했어요.')
  return value
}
export class GoogleSyncDrive implements SyncDrive {
  private accessToken = ''
  private controller = new AbortController()
  private run = 0
  async connect(interactive: boolean, email?: string) {
    if (!isAndroid())
      throw new Error('Google Drive 연결은 Android 앱에서 사용할 수 있어요.')
    this.controller = new AbortController()
    const generation = ++this.run
    const result = await native.authorize({
      interactive,
      email,
      selectAccount: interactive && !email,
    })
    if (generation !== this.run) throw new Error('동기화가 중단됐어요.')
    this.accessToken = result.accessToken
    const about = (await this.json(
      'https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress,displayName)',
    )) as {
      user?: {
        permissionId?: string
        emailAddress?: string
        displayName?: string
      }
    }
    if (
      generation !== this.run ||
      !about.user?.permissionId ||
      !about.user.emailAddress
    )
      throw new Error('Google 계정을 확인하지 못했어요.')
    return {
      id: about.user.permissionId,
      email: about.user.emailAddress,
      name: about.user.displayName || about.user.emailAddress,
    }
  }
  private async response(url: string, options: RequestInit = {}) {
    if (!this.accessToken) throw new Error('Google 계정을 다시 연결해 주세요.')
    const response = await fetch(url, {
      ...options,
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.any([
        this.controller.signal,
        AbortSignal.timeout(60000),
      ]),
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    })
    if (!response.ok) {
      if (response.status === 401) {
        this.accessToken = ''
        throw new Error('Google 계정을 다시 연결해 주세요.')
      }
      throw new Error(
        response.status === 403
          ? 'Google Drive 권한·저장 용량과 프로젝트 설정을 확인해 주세요.'
          : response.status === 429
            ? 'Drive 요청이 많아요. 잠시 후 다시 시도해 주세요.'
            : `Google Drive와 연결하지 못했어요. (${response.status})`,
      )
    }
    return response
  }
  private async bytes(response: Response, limit: number) {
    if (Number(response.headers.get('content-length')) > limit)
      throw new Error('동기화 자료가 너무 커요.')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Drive 응답을 읽지 못했어요.')
    const parts: Uint8Array[] = []
    let length = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.length
        if (length > limit) throw new Error('동기화 자료가 너무 커요.')
        parts.push(value)
      }
    } finally {
      await reader.cancel().catch(() => {})
    }
    const result = new Uint8Array(length)
    let offset = 0
    for (const part of parts) {
      result.set(part, offset)
      offset += part.length
    }
    return result
  }
  private async json(url: string, options?: RequestInit) {
    return JSON.parse(
      new TextDecoder().decode(
        await this.bytes(await this.response(url, options), 2 * 1024 * 1024),
      ),
    )
  }
  async list() {
    const result: DriveObject[] = []
    let pageToken: string | undefined
    do {
      const query = new URLSearchParams({
        spaces: 'appDataFolder',
        q: "trashed=false and appProperties has { key='jido-app' and value='jido-sync' }",
        pageSize: '1000',
        fields: 'nextPageToken,files(id,appProperties)',
        ...(pageToken ? { pageToken } : {}),
      })
      const page = await this.json(
        'https://www.googleapis.com/drive/v3/files?' + query,
      )
      if (!Array.isArray(page.files) || page.files.length > 1000)
        throw new Error('Drive 파일 목록을 확인하지 못했어요.')
      for (const file of page.files) {
        const props = file.appProperties || {},
          kind = props['jido-kind']
        const id = kind === 'commit-v1' ? props.commitId : props.logicalId
        if (
          !/^[a-f0-9-]{36}$/i.test(id || '') ||
          !/^[a-f0-9]{64}$/.test(props.sha256 || '') ||
          !['commit-v1', 'blob-v1'].includes(kind)
        )
          throw new Error(
            'Drive 동기화 목록이 손상됐어요. 기존 기록은 그대로예요.',
          )
        const parents = Object.keys(props)
          .filter((k) => /^p\d+$/.test(k))
          .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
          .map((k) => props[k] as string)
        if (
          kind === 'commit-v1' &&
          (await syncHash(
            stableJson({ id, parents, sha256: props.sha256 }),
          )) !== props.lineage
        )
          throw new Error(
            'Drive 이력 색인이 손상됐어요. 기존 기록은 그대로예요.',
          )
        result.push({
          fileId: driveId(file.id),
          id,
          sha256: props.sha256,
          kind,
          parents,
        })
      }
      if (result.length > 20000)
        throw new Error('동기화 이력이 너무 많아요. 기존 기록을 유지했어요.')
      pageToken = page.nextPageToken
      if (
        pageToken &&
        (typeof pageToken !== 'string' || pageToken.length > 4096)
      )
        throw new Error('Drive 목록을 확인하지 못했어요.')
    } while (pageToken)
    return result
  }
  async read(fileId: string) {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      await this.bytes(
        await this.response(
          'https://www.googleapis.com/drive/v3/files/' +
            driveId(fileId) +
            '?alt=media',
        ),
        10 * 1024 * 1024,
      ),
    )
  }
  private async create(metadata: Record<string, unknown>, bytes: Blob) {
    const session = await this.response(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/octet-stream',
          'X-Upload-Content-Length': String(bytes.size),
        },
        body: JSON.stringify(metadata),
      },
    )
    const returnedLocation = session.headers.get('location')
    if (!returnedLocation)
      throw new Error('Drive 업로드 주소를 확인하지 못했어요.')
    const location = new URL(returnedLocation)
    if (
      location.origin !== 'https://www.googleapis.com' ||
      location.pathname !== '/upload/drive/v3/files' ||
      location.username ||
      location.password ||
      location.hash
    )
      throw new Error('Drive 업로드 주소를 확인하지 못했어요.')
    const response = await this.json(location.href, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    })
    return driveId(response.id)
  }
  async write(
    id: string,
    parents: string[],
    body: string,
  ): Promise<DriveObject> {
    if (new TextEncoder().encode(body).byteLength > 10 * 1024 * 1024)
      throw new Error('동기화 정보는10MB 이하로 보관해 주세요.')
    const sha256 = await syncHash(body)
    const appProperties = {
      'jido-app': 'jido-sync',
      'jido-kind': 'commit-v1',
      commitId: id,
      sha256,
      lineage: await syncHash(stableJson({ id, parents, sha256 })),
      ...Object.fromEntries(parents.map((p, i) => ['p' + i, p])),
    }
    const fileId = await this.create(
      {
        name: 'JDo-sync-' + id + '.json',
        parents: ['appDataFolder'],
        appProperties,
      },
      new Blob([body], { type: 'application/json' }),
    )
    const returned = await this.read(fileId)
    if ((await syncHash(returned)) !== sha256)
      throw new Error('Drive 저장 확인에 실패했어요. 기기 기록은 보존했어요.')
    return { fileId, id, parents, sha256, kind: 'commit-v1' }
  }
  async inspect(file: Attachment): Promise<SyncFile> {
    if (file.storage === 'android') {
      const value = await native.inspectFile({ id: file.id })
      if (value.size !== file.size) throw new Error('원본 자료 크기가 달라요.')
      return { ...file, sha256: value.sha256 }
    }
    const blob = await browserBlob(file)
    if (blob.size !== file.size) throw new Error('원본 자료 크기가 달라요.')
    return {
      ...file,
      sha256: await syncHash(new Uint8Array(await blob.arrayBuffer())),
    }
  }
  async upload(file: SyncFile): Promise<DriveObject> {
    let fileId: string
    if (file.storage === 'android')
      fileId = (
        await native.uploadFile({
          id: file.id,
          sha256: file.sha256,
          accessToken: this.accessToken,
        })
      ).id
    else {
      const blob = await browserBlob(file)
      if (
        blob.size !== file.size ||
        (await syncHash(new Uint8Array(await blob.arrayBuffer()))) !==
          file.sha256
      )
        throw new Error('원본 자료가 변경됐어요. 다시 동기화해 주세요.')
      fileId = await this.create(
        {
          name: 'JDo-file-' + file.id + '-' + file.sha256,
          parents: ['appDataFolder'],
          appProperties: {
            'jido-app': 'jido-sync',
            'jido-kind': 'blob-v1',
            logicalId: file.id,
            sha256: file.sha256,
          },
        },
        blob,
      )
    }
    return {
      fileId: driveId(fileId),
      id: file.id,
      sha256: file.sha256,
      kind: 'blob-v1',
      parents: [],
    }
  }
  async download(file: SyncFile, object: DriveObject) {
    if (isAndroid())
      return (
        await native.downloadFile({
          fileId: object.fileId,
          sha256: file.sha256,
          attachment: JSON.stringify({ ...file, storage: 'android' }),
          accessToken: this.accessToken,
        })
      ).created
    const bytes = await this.bytes(
      await this.response(
        'https://www.googleapis.com/drive/v3/files/' +
          driveId(object.fileId) +
          '?alt=media',
      ),
      file.size,
    )
    if (bytes.length !== file.size || (await syncHash(bytes)) !== file.sha256)
      throw new Error('Drive 자료가 손상됐어요.')
    return putSyncedBrowserFile(
      file,
      new Blob([new Uint8Array(bytes)], { type: file.mimeType }),
      file.sha256,
    )
  }
  cancel() {
    this.run++
    this.accessToken = ''
    this.controller.abort()
    if (isAndroid()) void native.cancel().catch(() => {})
  }
  async revoke(email: string) {
    this.cancel()
    if (isAndroid()) await native.revoke({ email })
  }
}
export const googleDriveScope = scope
