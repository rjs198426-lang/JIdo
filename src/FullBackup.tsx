import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { type Trip } from './travel-model'
import { type Attachment, formatFileSize } from './attachment-schema'
import { isAndroid } from './attachment-storage'
import { personalPhotosSnapshot } from './personal-photos'
import {
  cleanupBackupFiles,
  discardBackup,
  exportFullBackup,
  inspectFullBackup,
  restoreBackupFiles,
  type BackupPreview,
} from './full-backup'

export default function FullBackup({
  trips,
  onRestore,
}: {
  trips: Trip[]
  onRestore: (trips: Trip[], photos: Record<string, Attachment>) => void
}) {
  const [preview, setPreview] = useState<BackupPreview>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null),
    current = useRef<BackupPreview>(undefined),
    alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      void discardBackup(current.current)
    }
  }, [])
  const show = (next: BackupPreview | undefined) => {
    current.current = next
    setPreview(next)
  }
  async function inspect(file?: File) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await discardBackup(current.current)
      show(undefined)
      const result = await inspectFullBackup(file)
      if (!alive.current) {
        await discardBackup(result)
        return
      }
      show(result)
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error && /[가-힣]/.test(reason.message)
            ? reason.message
            : '백업 파일의 형식과 내용을 확인해 주세요.',
        )
    } finally {
      if (alive.current) setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  async function restore() {
    if (!preview) return
    setBusy(true)
    setError('')
    let files: Attachment[] = []
    try {
      if (trips.length + preview.manifest.trips.length > 500)
        throw new Error('여행은 최대 500개까지 보관할 수 있어요.')
      const result = await restoreBackupFiles(preview)
      files = result.created
      if (!alive.current) {
        await cleanupBackupFiles(files)
        return
      }
      onRestore(result.trips, result.photos)
      files = []
      await discardBackup(preview)
      show(undefined)
      setMessage('여행·사진·자료를 복사본으로 복원했어요.')
    } catch (reason) {
      if (!(reason instanceof Error && reason.cause === 'keep-files'))
        await cleanupBackupFiles(files)
      if (alive.current)
        setError(
          reason instanceof Error && /[가-힣]/.test(reason.message)
            ? reason.message
            : '복원 내용을 저장하지 못했어요. 기기 여유 공간을 확인하세요.',
        )
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  return (
    <section className="full-backup" aria-label="사진·자료 포함 전체 백업">
      <h3>사진·자료 포함 전체 백업</h3>
      <p className="workspace-hint">
        예약 번호·개인 사진·첨부 자료를 포함합니다. 본인이 보관할 파일로
        저장하세요.
      </p>
      <div className="backup-actions">
        <button
          className="button primary"
          disabled={
            busy ||
            (!trips.length && !Object.keys(personalPhotosSnapshot()).length)
          }
          onClick={async () => {
            setBusy(true)
            setError('')
            setMessage('')
            try {
              const result = await exportFullBackup(trips)
              if (alive.current)
                setMessage(
                  result.cancelled
                    ? '백업 저장을 취소했어요.'
                    : '사진·자료 포함 백업 파일을 저장했어요.',
                )
            } catch (reason) {
              if (alive.current)
                setError(
                  reason instanceof Error && /[가-힣]/.test(reason.message)
                    ? reason.message
                    : '백업을 저장하지 못했어요.',
                )
            } finally {
              if (alive.current) setBusy(false)
            }
          }}
        >
          <Download size={17} />
          전체 백업 저장
        </button>
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            isAndroid() ? void inspect() : input.current?.click()
          }
        >
          <Upload size={17} />
          전체 백업 불러오기
        </button>
        <input
          hidden
          ref={input}
          type="file"
          accept=".zip,application/zip"
          aria-label="사진·자료 포함 백업 파일"
          onChange={(event) => void inspect(event.target.files?.[0])}
        />
      </div>
      {busy && <p role="status">백업 파일 처리 중…</p>}
      {preview && (
        <div className="restore-preview">
          <strong>
            {preview.manifest.trips.length}개 여행 ·{' '}
            {preview.manifest.files.length}개 파일 ·{' '}
            {formatFileSize(
              preview.manifest.files.reduce((sum, file) => sum + file.size, 0),
            )}
          </strong>
          <ul>
            {preview.manifest.trips.slice(0, 10).map((trip) => (
              <li key={trip.id}>
                {trip.title} · {trip.days.length}일
              </li>
            ))}
          </ul>
          <p>기존 여행과 대표 사진은 유지하고 복사본을 추가합니다.</p>
          <button
            className="button primary"
            disabled={
              busy || trips.length + preview.manifest.trips.length > 500
            }
            onClick={() => void restore()}
          >
            사진·자료까지 복원
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              void discardBackup(preview)
              show(undefined)
            }}
          >
            복원 취소
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
