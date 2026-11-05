import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getCity, type Place } from './catalog'
import { searchGooglePlaces, type GooglePlace } from './google-places'
import { fetchGoogleReviews } from './google-reviews'
import { googleReviewMetrics } from './google-review-evidence'
import {
  googleReviewGeneration,
  googleReviewRevision,
  googleReviewsForPlace,
  setGoogleReviewEvidence,
  subscribeGoogleReviews,
} from './google-review-store'
import { mapsSearch } from './google-maps'

export default function GooglePlaceReviews({ place }: { place: Place }) {
  useSyncExternalStore(subscribeGoogleReviews, googleReviewRevision)
  const [candidates, setCandidates] = useState<GooglePlace[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const request = useRef(0)
  const busy = useRef(false)
  const active = useRef(true)
  const evidence = googleReviewsForPlace(place)
  const recent = googleReviewMetrics(evidence, place).recent
  useEffect(() => {
    active.current = true
    const discard = () => {
      request.current++
      busy.current = false
      setCandidates([])
      setLoading(false)
      setMessage('')
    }
    const visibility = () => {
      if (document.hidden) discard()
    }
    const authenticationFailure = () => {
      discard()
      setMessage('Google 지도 연결 설정을 확인해 주세요.')
    }
    window.addEventListener('pagehide', discard)
    window.addEventListener('jido:google-auth-error', authenticationFailure)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      active.current = false
      request.current++
      window.removeEventListener('pagehide', discard)
      window.removeEventListener(
        'jido:google-auth-error',
        authenticationFailure,
      )
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [place.id, place.cityId, place.name])

  async function check(selected?: GooglePlace) {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setMessage('')
    const token = ++request.current
    const generation = googleReviewGeneration()
    const current = () =>
      active.current &&
      request.current === token &&
      generation === googleReviewGeneration() &&
      !document.hidden
    try {
      const googleId = selected?.id || evidence?.googlePlaceId
      if (!googleId) {
        const city = getCity(place.cityId)
        const found = await searchGooglePlaces(
          `${city?.english || city?.name || ''} ${place.english || place.name} ${place.address}`,
        )
        if (!current()) return
        setCandidates(found.slice(0, 5))
        if (!found.length) setMessage('일치하는 Google 장소를 찾지 못했어요.')
      } else {
        const found = await fetchGoogleReviews(place, googleId)
        if (!current()) return
        if (setGoogleReviewEvidence(found, generation)) setCandidates([])
      }
    } catch {
      if (current())
        setMessage(
          navigator.onLine
            ? 'Google 리뷰를 확인하지 못했어요. 다시 시도해 주세요.'
            : '인터넷에 연결한 뒤 다시 확인해 주세요.',
        )
    } finally {
      if (request.current === token) {
        busy.current = false
        if (active.current) setLoading(false)
      }
    }
  }

  return (
    <section className="google-place-reviews" aria-label="Google 지도 리뷰">
      <div className="detail-section-heading">
        <h3>Google 지도 리뷰</h3>
        <button
          className="button outline small"
          type="button"
          disabled={loading}
          onClick={() => void check()}
          title="선택한 장소의 Google 리뷰를 조회합니다. Google API 이용요금이 발생할 수 있습니다."
        >
          {loading ? '확인 중…' : evidence ? '다시 확인' : 'Google 리뷰 확인'}
        </button>
      </div>
      <p className="muted">최근 1년 리뷰만 정렬에 반영해요.</p>
      {message && <p role="status">{message}</p>}
      {candidates.length > 0 && (
        <div
          className="google-review-candidates"
          role="group"
          aria-label="리뷰를 확인할 Google 장소 선택"
        >
          <p>같은 장소인지 확인해 주세요.</p>
          <small>Google Maps</small>
          {candidates.map((candidate) => (
            <div key={candidate.id}>
              <button
                type="button"
                className="button outline"
                disabled={loading}
                onClick={() => void check(candidate)}
              >
                <strong>{candidate.name}</strong>
                <span>{candidate.address}</span>
              </button>
              {candidate.attributions.map((source, index) => (
                <small key={index}>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.provider}
                    </a>
                  ) : (
                    source.provider
                  )}
                </small>
              ))}
            </div>
          ))}
        </div>
      )}
      {evidence && (
        <div className="google-review-result">
          <p>
            <strong>Google Maps</strong> ·{' '}
            {recent.length
              ? `최근 1년 확인된 리뷰 ${recent.length}개`
              : '최근 리뷰 확인 필요'}
          </p>
          {evidence.totalRatingCount !== undefined && (
            <small>
              전체 기간 평가 {evidence.totalRatingCount.toLocaleString()}개 ·
              최근 1년 수치와 달라요.
            </small>
          )}
          {!recent.length && (
            <p role="status">
              최근 1년 리뷰를 받지 못했어요. 최신 리뷰가 없는지는 Google
              지도에서 확인해 주세요.
            </p>
          )}
          <ul>
            {recent.map((review) => (
              <li key={review.id}>
                {review.authorUrl ? (
                  <a
                    href={review.authorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {review.author}
                  </a>
                ) : (
                  <span>{review.author}</span>
                )}
                <span>
                  {(review.updatedAt || review.publishedAt)?.slice(0, 10)}
                  {review.rating !== undefined ? ` · ★ ${review.rating}` : ''}
                </span>
                {review.url && (
                  <a
                    href={review.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    리뷰 원문 ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
          <small>
            Google 관련도순 최대 5개 표본 · 최근 1년 전체 리뷰 수는 아니에요.
          </small>
          <small>확인 {evidence.checkedAt.slice(0, 10)}</small>
          {evidence.attributions.map((source, index) => (
            <small key={index}>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.provider}
                </a>
              ) : (
                source.provider
              )}
            </small>
          ))}
        </div>
      )}
      <a
        className="text-button"
        href={
          evidence?.mapsUrl ||
          mapsSearch(`${getCity(place.cityId)?.name || ''} ${place.name}`)
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        Google 지도에서 리뷰 보기 ↗
      </a>
    </section>
  )
}
