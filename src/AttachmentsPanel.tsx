import { createContext, useContext, useEffect, useRef, useState } from 'react'
import AttachmentCheck from './AttachmentCheck'
import { attachmentConnection } from './trip-search'
import type { Trip } from './travel-model'
import {
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  X,
  Download,
} from 'lucide-react'
import {
  attachmentSchema,
  attachmentAccept,
  fileMime,
  formatFileSize,
  type Attachment,
} from './attachment-schema'
import {
  attachmentText,
  attachmentUrl,
  deleteStoredAttachment,
  isAndroid,
  NativeAttachments,
  storeBrowserFile,
} from './attachment-storage'

type Value = {
  files: Attachment[]
  add: (files: Attachment[]) => void
  remove: (id: string) => void
  isShared: (id: string) => boolean
  coverFor: (id: string) => string | undefined
  setCover: (stopId: string, id: string) => void
}
export const AttachmentsContext = createContext<Value | null>(null)
export default function AttachmentsPanel({
  reservationId,
  expenseId,
  stopId,
  imagesOnly = false,
  all = false,
  readOnly = false,
  trip,
}: {
  reservationId?: string
  expenseId?: string
  stopId?: string
  imagesOnly?: boolean
  all?: boolean
  readOnly?: boolean
  trip?: Trip
}) {
  const context = useContext(AttachmentsContext)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('전체'),
    [remove, setRemove] = useState<Attachment | null>(null),
    [preview, setPreview] = useState<Attachment | null>(null)
  const input = useRef<HTMLInputElement>(null),
    active = useRef(true),
    lock = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  if (!context) return null
  const files = context.files.filter(
    (file) =>
      (all ||
        (stopId
          ? file.stopId === stopId
          : reservationId
            ? file.reservationId === reservationId
            : expenseId
              ? file.expenseId === expenseId
              : !file.stopId && !file.reservationId && !file.expenseId)) &&
      (!imagesOnly || file.mimeType.startsWith('image/')) &&
      (!all ||
        category === '전체' ||
        (category === '예약' && !!file.reservationId) ||
        (category === '장소' && !!file.stopId) ||
        (category === '영수증' && !!file.expenseId) ||
        (category === '공용' &&
          !file.stopId &&
          !file.reservationId &&
          !file.expenseId)) &&
      file.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()),
  )
  const limit = Math.max(0, Math.min(10, 300 - context.files.length))
  if (readOnly && !files.length) return null
  async function attach(browserFiles?: FileList) {
    if (!context || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    const imported: Attachment[] = [],
      errors: string[] = []
    try {
      if (isAndroid()) {
        const result = await NativeAttachments.pickFiles({ limit, imagesOnly })
        for (const file of result.files)
          imported.push(attachmentSchema.parse(file))
        errors.push(...result.errors)
      } else {
        const selected = Array.from(browserFiles || [])
        if (selected.length > limit)
          errors.push(`한 번에 최대 ${limit}개를 첨부할 수 있습니다.`)
        for (const file of selected.slice(0, limit)) {
          try {
            if (imagesOnly && !fileMime(file)?.startsWith('image/'))
              throw new Error(file.name + ': 사진 파일을 선택하세요.')
            imported.push(await storeBrowserFile(file))
          } catch (error) {
            errors.push((error as Error).message)
          }
        }
      }
      if (imported.length)
        context.add(
          imported.map((file) => ({
            ...file,
            reservationId,
            expenseId,
            stopId,
          })),
        )
    } catch (error) {
      errors.push((error as Error).message || '자료를 첨부하지 못했습니다.')
    } finally {
      lock.current = false
      if (active.current) {
        setBusy(false)
        setError(errors.join('\n'))
      }
      if (input.current) input.current.value = ''
    }
  }
  async function open(file: Attachment) {
    setError('')
    if (
      isAndroid() &&
      file.storage === 'android' &&
      !file.mimeType.startsWith('image/') &&
      !file.mimeType.startsWith('text/')
    ) {
      try {
        await NativeAttachments.openFile({ id: file.id })
      } catch (error) {
        setError((error as Error).message)
      }
    } else setPreview(file)
  }
  return (
    <section
      className={`attachments-panel ${all ? 'attachment-library' : ''}`}
      aria-label={
        stopId
          ? '장소 사진'
          : reservationId
            ? '예약 첨부 자료'
            : expenseId
              ? '경비 첨부 자료'
              : '여행 첨부 자료'
      }
    >
      <div className="attachment-heading">
        <h4>
          <Paperclip size={17} />
          {imagesOnly ? '장소 사진' : all ? '여행 자료 보관함' : '첨부 자료'}
          {files.length > 0 && <span>{files.length}</span>}
        </h4>
        {!readOnly && (
          <button
            className="button outline small"
            type="button"
            disabled={busy || limit === 0}
            onClick={() =>
              isAndroid() ? void attach() : input.current?.click()
            }
          >
            <Paperclip size={15} />
            {busy ? '저장 중…' : imagesOnly ? '사진 추가' : '파일 첨부'}
          </button>
        )}
      </div>
      {!readOnly && !isAndroid() && (
        <input
          ref={input}
          hidden
          type="file"
          multiple
          accept={imagesOnly ? 'image/*,.heic,.heif' : attachmentAccept}
          aria-label="첨부할 자료 파일"
          onChange={(event) => {
            if (event.target.files) void attach(event.target.files)
          }}
        />
      )}
      {all && context.files.length > 0 && (
        <input
          className="attachment-search"
          aria-label="첨부 자료 검색"
          placeholder="파일 이름 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {busy && <p role="status">선택한 자료를 기기에 저장하고 있어요.</p>}
      {all && context.files.length > 0 && (
        <>
          <div
            className="journey-filter-row"
            role="group"
            aria-label="자료 분류"
          >
            {['전체', '예약', '장소', '영수증', '공용'].map((name) => (
              <button
                type="button"
                key={name}
                className="button outline small"
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <AttachmentCheck files={context.files} />
        </>
      )}
      {error && (
        <p className="form-error attachment-error" role="alert">
          {error}
        </p>
      )}
      <div className="attachment-list">
        {files.map((file) => (
          <article key={file.id} data-attachment-id={file.id} tabIndex={-1}>
            <button
              className="attachment-open"
              type="button"
              aria-label={`${file.name} 자료 열기`}
              onClick={() => void open(file)}
            >
              {file.mimeType.startsWith('image/') ? (
                <ImageIcon size={20} />
              ) : (
                <FileText size={20} />
              )}
              <span>
                <strong>{file.name}</strong>
                <small>
                  {formatFileSize(file.size)}
                  {all && file.reservationId
                    ? ' · 예약 자료'
                    : all && file.expenseId
                      ? ' · 영수증'
                      : ''}
                </small>
                {all && <small>{attachmentConnection(file, trip)}</small>}
              </span>
            </button>
            {!readOnly && imagesOnly && stopId && (
              <button
                type="button"
                className="photo-cover-button"
                aria-label={`${file.name} 대표 사진으로 사용`}
                aria-pressed={
                  (context.coverFor(stopId) || files[0]?.id) === file.id
                }
                onClick={() => context.setCover(stopId, file.id)}
              >
                대표 사진
              </button>
            )}
            {!readOnly && (
              <button
                className="icon-button"
                type="button"
                aria-label={`${file.name} 첨부 삭제`}
                disabled={busy}
                onClick={() => setRemove(file)}
              >
                <Trash2 size={16} />
              </button>
            )}
          </article>
        ))}
      </div>
      {all && !files.length && (query.trim() || category !== '전체') && (
        <p className="workspace-empty">조건에 맞는 자료가 없어요.</p>
      )}
      {remove && (
        <div className="attachment-remove" role="alert">
          <p>{remove.name} 첨부를 삭제할까요?</p>
          <div className="row-actions">
            <button
              className="button outline small"
              type="button"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              취소
            </button>
            <button
              className="button danger small"
              type="button"
              disabled={busy}
              onClick={async () => {
                if (lock.current) return
                lock.current = true
                setBusy(true)
                setError('')
                try {
                  if (!context.isShared(remove.id))
                    await deleteStoredAttachment(remove)
                  context.remove(remove.id)
                  if (active.current) setRemove(null)
                } catch (error) {
                  if (active.current) setError((error as Error).message)
                } finally {
                  lock.current = false
                  if (active.current) setBusy(false)
                }
              }}
            >
              첨부 삭제
            </button>
          </div>
        </div>
      )}
      {preview && (
        <AttachmentPreview file={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  )
}
function AttachmentPreview({
  file,
  onClose,
}: {
  file: Attachment
  onClose: () => void
}) {
  const [url, setUrl] = useState(''),
    [text, setText] = useState(''),
    [truncated, setTruncated] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement as HTMLElement | null
    element?.showModal()
    return () => {
      element?.close()
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    let cancelled = false,
      revoke = () => {}
    void (async () => {
      try {
        if (file.mimeType.startsWith('text/')) {
          const result = await attachmentText(file)
          if (!cancelled) {
            setText(result.text)
            setTruncated(result.truncated)
          }
        } else {
          const result = await attachmentUrl(file)
          revoke = result.revoke
          if (cancelled) result.revoke()
          else setUrl(result.url)
        }
      } catch (error) {
        if (!cancelled) setError((error as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      revoke()
    }
  }, [file])
  async function download() {
    try {
      if (isAndroid() && file.storage === 'android') {
        await NativeAttachments.openFile({ id: file.id, external: true })
        return
      }
      const result = await attachmentUrl(file)
      const anchor = document.createElement('a')
      anchor.href = result.url
      anchor.download = file.name
      anchor.click()
      setTimeout(result.revoke, 1000)
    } catch (error) {
      setError((error as Error).message)
    }
  }
  return (
    <dialog
      className="attachment-preview"
      ref={dialog}
      aria-label={`${file.name} 미리보기`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="attachment-preview-heading">
        <h3>{file.name}</h3>
        <button
          className="icon-button"
          type="button"
          aria-label="자료 미리보기 닫기"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      {loading && <p role="status">자료 여는 중…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading &&
        !error &&
        (file.mimeType.startsWith('text/') ? (
          <>
            <pre>{text}</pre>
            {truncated && <p>앞부분 100KB를 표시합니다.</p>}
          </>
        ) : file.mimeType.startsWith('image/') ? (
          <img
            className="attachment-image"
            src={url}
            alt={file.name}
            onError={() =>
              setError(
                '사진 미리보기를 지원하지 않습니다. 다른 앱으로 열어 주세요.',
              )
            }
          />
        ) : file.mimeType === 'application/pdf' ? (
          <iframe title={`${file.name} PDF`} src={url} />
        ) : (
          <p>문서 파일을 내려받아 지원하는 앱에서 열어 주세요.</p>
        ))}
      <div className="attachment-preview-actions">
        <button
          className="button outline small"
          type="button"
          onClick={() => void download()}
        >
          <Download size={16} />
          {isAndroid() ? '다른 앱에서 열기' : '파일 저장'}
        </button>
      </div>
    </dialog>
  )
}
