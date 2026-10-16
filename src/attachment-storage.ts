import { Capacitor, registerPlugin } from '@capacitor/core'
import {
  attachmentSchema,
  fileMime,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
} from './attachment-schema'
export const NativeAttachments = registerPlugin<{
  pickFiles(options: {
    limit: number
    imagesOnly?: boolean
  }): Promise<{ files: Attachment[]; errors: string[] }>
  getUri(options: { id: string }): Promise<{ uri: string }>
  checkFile(options: { id: string }): Promise<{ size: number }>
  readText(options: {
    id: string
  }): Promise<{ text: string; truncated: boolean }>
  openFile(options: { id: string; external?: boolean }): Promise<void>
  deleteFile(options: { id: string }): Promise<void>
}>('Attachments')
export const isAndroid = () => Capacitor.getPlatform() === 'android'
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('jido-attachments-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('자료 저장소를 열 수 없습니다.'))
  })
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await database()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('files', mode),
        request = action(tx.objectStore('files'))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () =>
        reject(
          new Error('자료를 저장하지 못했습니다. 기기 여유 공간을 확인하세요.'),
        )
      tx.onabort = () => reject(new Error('자료 저장이 취소되었습니다.'))
    })
  } finally {
    db.close()
  }
}
export async function storeBrowserFile(file: File): Promise<Attachment> {
  if (!file.size) throw new Error(`${file.name}: 빈 파일은 첨부할 수 없습니다.`)
  if (file.size > MAX_ATTACHMENT_BYTES)
    throw new Error(`${file.name}: 파일은 25MB 이하로 첨부하세요.`)
  const mimeType = fileMime(file)
  if (!mimeType) throw new Error(`${file.name}: 지원하지 않는 파일 형식입니다.`)
  const attachment = attachmentSchema.parse({
    id: crypto.randomUUID(),
    name:
      file.name
        .replace(/[\u0000-\u001f]/g, '')
        .trim()
        .slice(0, 200) || '첨부 자료',
    mimeType,
    size: file.size,
    createdAt: new Date().toISOString(),
    storage: 'browser',
  })
  await transaction('readwrite', (store) =>
    store.put(new Blob([file], { type: mimeType }), attachment.id),
  )
  return attachment
}
export async function browserBlob(file: Attachment): Promise<Blob> {
  const blob = await transaction<Blob | undefined>('readonly', (store) =>
    store.get(file.id),
  )
  if (!(blob instanceof Blob))
    throw new Error('자료가 없습니다. 다시 첨부해 주세요.')
  return blob
}
export async function checkStoredAttachment(file: Attachment) {
  let size: number
  if (file.storage === 'android') {
    if (!isAndroid()) throw new Error('다른 Android 기기에 저장된 자료입니다.')
    size = (await NativeAttachments.checkFile({ id: file.id })).size
  } else {
    const blob = await browserBlob(file)
    await blob.slice(0, 1).arrayBuffer()
    size = blob.size
  }
  if (!Number.isInteger(size) || size <= 0)
    throw new Error('빈 파일이거나 자료를 읽을 수 없어요.')
  if (size !== file.size)
    throw new Error('저장된 파일 크기가 기록과 달라요. 원본을 확인하세요.')
}
export async function attachmentUrl(
  file: Attachment,
): Promise<{ url: string; revoke: () => void }> {
  if (file.storage === 'android') {
    if (!isAndroid())
      throw new Error('Android 기기에 저장된 자료입니다. 다시 첨부해 주세요.')
    const { uri } = await NativeAttachments.getUri({ id: file.id })
    return { url: Capacitor.convertFileSrc(uri), revoke: () => {} }
  }
  const url = URL.createObjectURL(await browserBlob(file))
  return { url, revoke: () => URL.revokeObjectURL(url) }
}
export async function attachmentText(file: Attachment) {
  if (file.storage === 'android') {
    if (!isAndroid())
      throw new Error('Android 기기에 저장된 자료입니다. 다시 첨부해 주세요.')
    return NativeAttachments.readText({ id: file.id })
  }
  const blob = await browserBlob(file)
  return {
    text: await blob.slice(0, 100000).text(),
    truncated: blob.size > 100000,
  }
}
export async function deleteStoredAttachment(file: Attachment) {
  if (file.storage === 'android') {
    if (!isAndroid()) return
    await NativeAttachments.deleteFile({ id: file.id })
  } else await transaction('readwrite', (store) => store.delete(file.id))
}
