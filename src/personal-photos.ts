import { useEffect, useState, useSyncExternalStore } from 'react'
import { attachmentSchema, type Attachment } from './attachment-schema'
import { attachmentUrl, deleteStoredAttachment } from './attachment-storage'

const KEY = 'jido-personal-photos-v1'
const listeners = new Set<() => void>()
let photos: Record<string, Attachment> = {}
try {
  const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '{}')
  if (raw && typeof raw === 'object' && !Array.isArray(raw))
    for (const [key, value] of Object.entries(raw).slice(0, 200)) {
      const parsed = attachmentSchema.safeParse(value)
      if (
        /^(city|place):[a-zA-Z0-9_-]{1,100}$/.test(key) &&
        parsed.success &&
        parsed.data.mimeType.startsWith('image/')
      )
        photos[key] = parsed.data
    }
} catch {
  /* Existing travel records use their own store. */
}
export function personalPhotoKey(kind: 'city' | 'place', id: string) {
  return `${kind}:${id}`
}
export function usePersonalPhoto(key: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => photos[key],
  )
}
export async function savePersonalPhoto(key: string, file?: Attachment) {
  if (!/^(city|place):[a-zA-Z0-9_-]{1,100}$/.test(key))
    throw new Error('사진을 적용할 여행지나 장소를 확인해 주세요.')
  if (file && !photos[key] && Object.keys(photos).length >= 200)
    throw new Error('개인 대표 사진은 최대 200곳까지 지정할 수 있어요.')
  const previous = photos[key]
  const next = { ...photos }
  if (file) next[key] = attachmentSchema.parse(file)
  else delete next[key]
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    throw new Error(
      '사진 정보를 저장하지 못했어요. 기기 여유 공간을 확인해 주세요.',
    )
  }
  photos = next
  for (const listener of listeners) listener()
  if (
    previous &&
    previous.id !== file?.id &&
    !Object.values(next).some((item) => item.id === previous.id)
  )
    await deleteStoredAttachment(previous).catch(() => {})
}
export function usePhotoUrl(file?: Attachment) {
  const [state, setState] = useState({ id: '', url: '' })
  useEffect(() => {
    let active = true,
      release = () => {}
    if (file)
      void attachmentUrl(file)
        .then((result) => {
          release = result.revoke
          if (active) setState({ id: file.id, url: result.url })
          else result.revoke()
        })
        .catch(() => {
          if (active) setState({ id: file.id, url: '' })
        })
    return () => {
      active = false
      release()
    }
  }, [file?.id])
  return file && state.id === file.id ? state.url : ''
}
