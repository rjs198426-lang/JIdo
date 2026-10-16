import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw } from 'lucide-react'
import { attachmentSchema, type Attachment } from './attachment-schema'
import {
  attachmentUrl,
  deleteStoredAttachment,
  isAndroid,
  NativeAttachments,
  storeBrowserFile,
} from './attachment-storage'
import {
  personalPhotoKey,
  savePersonalPhoto,
  usePersonalPhoto,
} from './personal-photos'

export default function PersonalPhotoControl({
  kind,
  id,
  name,
}: {
  kind: 'city' | 'place'
  id: string
  name: string
}) {
  const key = personalPhotoKey(kind, id),
    photo = usePersonalPhoto(key)
  const input = useRef<HTMLInputElement>(null),
    locked = useRef(false),
    alive = useRef(true)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  async function pick(file?: File) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    let imported: Attachment | undefined
    try {
      if (isAndroid()) {
        const result = await NativeAttachments.pickFiles({
          limit: 1,
          imagesOnly: true,
        })
        if (result.files[0]) imported = attachmentSchema.parse(result.files[0])
        else if (result.errors.length) throw new Error(result.errors.join('\n'))
      } else if (file) imported = await storeBrowserFile(file)
      if (!imported) return
      if (
        !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
          imported.mimeType,
        )
      )
        throw new Error('JPG·PNG·WebP·GIF 사진을 선택해 주세요.')
      const source = await attachmentUrl(imported)
      try {
        const image = new Image()
        image.src = source.url
        await image.decode()
        if (!image.naturalWidth) throw new Error()
      } catch {
        throw new Error('사진을 열 수 없어요. 다른 사진을 선택해 주세요.')
      } finally {
        source.revoke()
      }
      await savePersonalPhoto(key, imported)
      imported = undefined
    } catch (reason) {
      if (imported) await deleteStoredAttachment(imported).catch(() => {})
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : '사진을 저장하지 못했어요.',
        )
    } finally {
      locked.current = false
      if (alive.current) setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div className="personal-photo-control">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        aria-label={`${name} 개인 사진 파일`}
        onChange={(event) => void pick(event.target.files?.[0])}
      />
      <button
        className="button outline small"
        type="button"
        disabled={busy}
        onClick={() => (isAndroid() ? void pick() : input.current?.click())}
      >
        <Camera size={16} />
        {busy ? '사진 저장 중' : photo ? '내 사진 바꾸기' : '내 사진 넣기'}
      </button>
      {photo && (
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => {
            setError('')
            void savePersonalPhoto(key).catch((reason: Error) =>
              setError(reason.message),
            )
          }}
        >
          <RotateCcw size={15} />
          기본 사진
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
