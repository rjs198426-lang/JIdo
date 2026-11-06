import { useState } from 'react'
import { Cloud, RefreshCw } from 'lucide-react'
import type { DriveSyncState } from './useDriveSync'
import type { SyncChoices } from './sync-merge'

const describe = (value: unknown): string => {
  if (value === undefined) return '삭제됨'
  if (typeof value === 'string')
    return value.length > 150 ? value.slice(0, 150) + '…' : value || '비어 있음'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '사용' : '사용 안 함'
  if (Array.isArray(value)) return `${value.length}개 항목`
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    return String(v.title || v.name || v.description || '변경된 기록').slice(
      0,
      150,
    )
  }
  return '비어 있음'
}
const field = (path: string[]) =>
  path.includes('expenses')
    ? '지출'
    : path.includes('reservations')
      ? '예약'
      : path.includes('checklist')
        ? '준비물'
        : path.includes('days')
          ? '일정'
          : path.includes('photos')
            ? '대표 사진'
            : path.includes('placeLibrary')
              ? '개인 장소'
              : path.includes('catalog')
                ? '개인 가이드'
                : path.includes('trips')
                  ? '여행'
                  : '저장 목록'
export default function DriveSyncSettings({ sync }: { sync: DriveSyncState }) {
  const [choices, setChoices] = useState<SyncChoices>({}),
    [confirm, setConfirm] = useState(false)
  const busy = sync.phase === 'syncing'
  return (
    <section
      className="settings-group drive-sync"
      aria-label="Google Drive 동기화"
    >
      <h2>
        <Cloud size={21} aria-hidden="true" /> Google Drive 동기화
      </h2>
      <p>
        같은 Google 계정으로 내 기기의 여행·경비·예약·개인 장소·사진·첨부를 함께
        사용해요.
      </p>
      {!sync.enabled ? (
        <>
          <p>
            연결하면 이 자료를 Google Drive의 앱 전용 공간에 저장해요. 일반
            Drive 문서는 읽지 않아요. 인터넷이 없어도 기기 기록은 계속 사용할 수
            있어요.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void sync.connect()}
          >
            {busy ? '연결 중…' : 'Google 계정 연결'}
          </button>
        </>
      ) : (
        <>
          <p className="drive-sync-account">{sync.account?.email}</p>
          <label className="drive-sync-auto">
            <input
              type="checkbox"
              checked={sync.automatic}
              disabled={busy}
              onChange={(e) => sync.setAutomatic(e.target.checked)}
            />
            앱을 열면 자동 동기화
          </label>
          {sync.lastSyncedAt && (
            <small>
              마지막 확인 {new Date(sync.lastSyncedAt).toLocaleString('ko-KR')}
            </small>
          )}
          <div className="drive-sync-actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void sync.sync()}
            >
              <RefreshCw size={17} />
              {busy ? '동기화 중…' : '지금 동기화'}
            </button>
            <button
              className="button outline"
              disabled={busy}
              onClick={() => void sync.connect()}
            >
              다시 연결
            </button>
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            연결 해제
          </button>
          {confirm && (
            <div className="drive-sync-confirm">
              <p>
                자동 동기화를 끌까요? 기기와 Drive에 저장된 여행은 삭제하지
                않아요.
              </p>
              <div className="drive-sync-actions">
                <button
                  className="button outline"
                  onClick={() => setConfirm(false)}
                >
                  취소
                </button>
                <button
                  className="button outline"
                  onClick={() => {
                    setConfirm(false)
                    void sync.disconnect()
                  }}
                >
                  연결 해제
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {sync.message && (
        <p role="status" aria-live="polite">
          {sync.message}
        </p>
      )}
      {sync.conflicts.length > 0 && (
        <div className="drive-sync-conflicts">
          <h3>서로 다른 내용 확인</h3>
          <p>선택한 항목만 정하고 나머지 변경은 함께 유지해요.</p>
          {sync.conflicts.map((conflict, i) => (
            <fieldset key={conflict.key}>
              <legend>
                {field(conflict.path)} {i + 1}
              </legend>
              {(['local', 'remote'] as const).map((side) => (
                <label key={side}>
                  <input
                    type="radio"
                    name={'sync-conflict-' + i}
                    value={side}
                    checked={choices[conflict.key] === side}
                    onChange={() =>
                      setChoices((current) => ({
                        ...current,
                        [conflict.key]: side,
                      }))
                    }
                  />
                  <span>
                    <small>{side === 'local' ? '내용 1' : '내용 2'}</small>
                    <strong>{describe(conflict[side])}</strong>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
          <button
            className="button primary"
            disabled={busy || sync.conflicts.some((c) => !choices[c.key])}
            onClick={() => {
              const selected = Object.fromEntries(
                sync.conflicts.map((c) => [c.key, choices[c.key]]),
              )
              setChoices({})
              void sync.resolve(selected)
            }}
          >
            선택한 내용으로 동기화
          </button>
        </div>
      )}
      <details>
        <summary>연결 안내</summary>
        <p>
          다른 기기에도 같은 버전의 앱을 설치하고 동일한 Google 계정을
          연결하세요. 처음 연결할 때 양쪽 기록을 합치고, 서로 다른 내용은 선택할
          수 있어요. 사진과 첨부는 파일별로 확인한 뒤 적용해요.
        </p>
        <p>
          작성 중인 입력·현재 위치·기기 권한·알림·마지막 화면은 기기별로
          유지해요. 동기화는 앱을 보는 동안 진행하며, 기존 전체 ZIP 백업도 계속
          사용할 수 있어요.
        </p>
        <a
          href="https://github.com/rjs198426-lang/JIdo/blob/main/GOOGLE-DRIVE-SYNC.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google 프로젝트 설정·문제 해결
        </a>
      </details>
    </section>
  )
}
