import { useState, type FormEvent } from 'react'
import { Check, Globe2, RefreshCw, Send } from 'lucide-react'
import {
  configuredApiUrl,
  fetchGuides,
  normalizeApiUrl,
  saveApiUrl,
  sendGuideRequest,
} from './guide-api'
import { installGuides, refreshGuides } from './catalog'

export default function GuideConnection({
  initialCountry = '',
  initialCity = '',
}: {
  initialCountry?: string
  initialCity?: string
}) {
  const [url, setUrl] = useState(configuredApiUrl())
  const [country, setCountry] = useState(initialCountry)
  const [city, setCity] = useState(initialCity)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const connect = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const normalized = normalizeApiUrl(url.trim())
      const guides = await fetchGuides(normalized)
      saveApiUrl(normalized)
      installGuides(guides)
      setMessage(`${guides.length}개의 게시된 가이드를 불러왔어요.`)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '서버에 연결하지 못했어요.',
      )
    } finally {
      setBusy(false)
    }
  }
  const request = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await sendGuideRequest(
        country.trim(),
        city.trim(),
        notes.trim(),
      )
      setMessage(
        result.duplicate
          ? '이미 접수된 여행지예요. 관리자가 확인하고 있어요.'
          : '가이드 요청을 접수했어요. 조사 후 게시되면 앱에서 불러올 수 있어요.',
      )
      setNotes('')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '요청을 접수하지 못했어요.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="modal-body guide-connection">
      <div className="form-intro">
        <span className="small-icon">
          <Globe2 size={22} />
        </span>
        <div>
          <h3>여행 가이드를 계속 늘려가요</h3>
          <p>게시된 가이드를 불러오거나, 원하는 여행지를 요청하세요.</p>
        </div>
      </div>
      <form onSubmit={request}>
        <h3>어떤 여행지가 궁금하세요?</h3>
        <label className="field">
          국가
          <input
            required
            maxLength={80}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="예: 오스트리아"
          />
        </label>
        <label className="field">
          도시 <span className="optional">국가 전체 가이드는 비워두세요</span>
          <input
            maxLength={80}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="예: 빈"
          />
        </label>
        <label className="field">
          궁금한 내용
          <textarea
            maxLength={1000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="교통, 맛집, 여행 시기 등 알고 싶은 내용을 적어주세요."
            rows={3}
          />
        </label>
        <button className="button primary full" type="submit" disabled={busy}>
          <Send size={16} />
          가이드 요청 보내기
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="guide-success" role="status">
          <Check size={17} />
          {message}
        </p>
      )}
      <div className="guide-sync-actions">
        <button
          className="button outline full"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError('')
            setMessage('')
            try {
              const guides = await refreshGuides()
              setMessage(`${guides.length}개의 가이드가 최신 상태예요.`)
            } catch {
              setError(
                '가이드 서버에 연결하지 못했어요. 저장된 가이드는 계속 볼 수 있어요.',
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          <RefreshCw size={16} />새 가이드 확인하기
        </button>
      </div>
      <details className="server-settings">
        <summary>가이드 서버 연결 설정</summary>
        <form onSubmit={connect}>
          <label className="field">
            가이드 서버 주소
            <input
              required
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://guide.example.com/api"
            />
          </label>
          <button className="button outline full" disabled={busy}>
            연결 확인 후 저장
          </button>
          <p className="detail-footnote">
            관리자가 제공한 HTTPS 주소를 입력하세요. 연결이 끊겨도 이미 불러온
            가이드는 이 기기에서 볼 수 있어요.
          </p>
        </form>
      </details>
    </div>
  )
}
