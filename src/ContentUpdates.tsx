import {
  checkContent,
  setAutomaticContent,
  useContentRelease,
} from './content-release'
export default function ContentUpdates() {
  const state = useContentRelease()
  return (
    <section className="content-updates" aria-label="여행 정보 업데이트">
      <h3>여행 정보</h3>
      <p>정보 배포일 {state.date.slice(0, 10)}</p>
      <button
        type="button"
        className="text-button"
        disabled={state.checking}
        onClick={() => void checkContent()}
      >
        {state.checking ? '확인 중…' : '새 정보 확인'}
      </button>
      <label>
        <input
          type="checkbox"
          checked={state.automatic}
          onChange={(e) => setAutomaticContent(e.target.checked)}
        />
        하루 한 번 자동 확인
      </label>
      {state.message && <p role="status">{state.message}</p>}
    </section>
  )
}
