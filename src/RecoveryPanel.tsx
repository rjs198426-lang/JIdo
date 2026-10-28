import { useState } from 'react'
import { Download, Check } from 'lucide-react'
import { downloadBlob, NativeBackup } from './full-backup'
import { isAndroid } from './attachment-storage'
import type { RecoveryRecord } from './store'

export default function RecoveryPanel({
  records,
  onAcknowledge,
}: {
  records: RecoveryRecord[]
  onAcknowledge: (id: string) => boolean
}) {
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function exportOriginal(record: RecoveryRecord) {
    setBusy(record.id)
    setMessage('')
    setError('')
    try {
      if (isAndroid()) {
        const result = await NativeBackup.saveDocument({
          text: record.raw,
          format: 'recovery',
        })
        setMessage(
          result.cancelled
            ? '원본 저장을 취소했어요. 앱의 원본은 그대로 보관돼요.'
            : '복구 원본 파일을 저장했어요.',
        )
      } else {
        downloadBlob(
          new Blob([record.raw], { type: 'application/json' }),
          'JDo-recovery-original.json',
        )
        setMessage(
          '원본 파일 다운로드를 요청했어요. 내려받은 파일을 확인해 주세요.',
        )
      }
    } catch {
      setError(
        '원본 파일을 저장하지 못했어요. 앱의 원본은 그대로 보관돼요. 다시 시도해 주세요.',
      )
    } finally {
      setBusy('')
    }
  }
  return (
    <div className="modal-body recovery-panel">
      <p>
        읽을 수 있는 기록은 유지했어요. 원본 내보내기로 읽지 못한 내용까지
        파일로 보관할 수 있어요.
      </p>
      <p className="muted">
        원본에는 개인정보와 읽지 못한 내용이 포함될 수 있어요. 본인만 보관해
        주세요. 사진·첨부 파일은 변경하지 않았어요.
      </p>
      <p className="muted">
        원본은 기록 내용만 담은 복구 확인용 파일이에요. 사진·첨부 파일은 이
        파일에 포함되지 않고 기기에 그대로 남아요. 읽지 못한 기록은 일반 전체
        백업과 별도로 원본 파일도 보관해 주세요.
      </p>
      {records.map((record, index) => (
        <section
          className="recovery-record"
          key={record.id}
          aria-label={`복구 기록 ${index + 1}`}
        >
          <h3>복구 기록 {index + 1}</h3>
          <p>
            {record.preserved
              ? '원본 사본을 기기에 보관했어요.'
              : '원본 사본을 따로 보관하지 못했어요. 원본 파일을 먼저 내보내 주세요.'}
          </p>
          <p>복구 당시 읽은 여행 {record.keptTrips}개</p>
          {record.unreadable && (
            <p>
              전체 기록 형식을 읽지 못했어요. 원본 파일을 먼저 보관해 주세요.
            </p>
          )}
          {record.excludedTrips !== null && record.excludedTrips > 0 && (
            <p>목록에서 제외된 여행 {record.excludedTrips}개</p>
          )}
          {!!record.excludedCities && (
            <p>목록에서 제외된 저장 도시 {record.excludedCities}개</p>
          )}
          {!!record.excludedPlaces && (
            <p>목록에서 제외된 저장 장소 {record.excludedPlaces}개</p>
          )}
          <div className="recovery-actions">
            <button
              className="button primary"
              disabled={!!busy}
              onClick={() => void exportOriginal(record)}
            >
              <Download size={16} />
              원본 파일 내보내기
            </button>
            {!record.acknowledged ? (
              <button
                className="button outline"
                disabled={!!busy}
                onClick={() => {
                  setError('')
                  if (!onAcknowledge(record.id))
                    setError(
                      '확인 상태를 저장하지 못했어요. 기기 저장 공간을 확인해 주세요.',
                    )
                }}
              >
                <Check size={16} />
                확인했어요
              </button>
            ) : (
              <span className="muted">확인 완료 · 원본 보관 중</span>
            )}
          </div>
        </section>
      ))}
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
