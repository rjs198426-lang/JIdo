import { ExternalLink } from 'lucide-react'
import type { Place } from './catalog'

export default function PlaceReviews({ place }: { place: Place }) {
  if (!place.reviewSources?.length) return null
  const licenses = [
    ...new Set(
      place.reviewSources
        .filter((source) => source.kind === 'traveler-guide')
        .map((source) => source.license || 'CC BY-SA 4.0'),
    ),
  ]
  return (
    <section className="place-review-sources">
      <h3>여행 후기·여행자 자료</h3>
      {place.reviewSources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>
            <strong>{source.title}</strong>
            <small>
              {source.kind === 'visit-review'
                ? new URL(source.url).hostname.endsWith('.tistory.com')
                  ? '티스토리 방문 후기'
                  : new URL(source.url).hostname.endsWith('.naver.com')
                    ? '네이버 방문 후기'
                    : '방문 후기'
                : '여행자 가이드'}{' '}
              · 확인 {source.checkedAt}
            </small>
          </span>
          <ExternalLink size={15} />
        </a>
      ))}
      {licenses.map((license) => (
        <small key={license}>
          <a
            href={`https://creativecommons.org/licenses/by-sa/${license.endsWith('3.0') ? '3.0' : '4.0'}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikivoyage contributors · {license}
          </a>
        </small>
      ))}
      {place.osmPlaceId && (
        <small>
          <a
            href={`https://www.openstreetmap.org/${place.osmPlaceId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            위치 · © OpenStreetMap contributors · ODbL
          </a>
        </small>
      )}
    </section>
  )
}
