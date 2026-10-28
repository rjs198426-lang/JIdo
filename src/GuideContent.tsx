import PracticalGuide from './PracticalGuide'
import { practicalGuideById, type CourseSelection } from './practical-guides'
import { japanGuideById } from './japan-guides'
import { ExternalLink } from 'lucide-react'
import type { Guide } from './guide-schema'

export default function GuideContent({
  guide,
  cityId,
  onCourse,
  onPlace,
  compact = false,
  library = false,
}: {
  compact?: boolean
  library?: boolean
  guide?: Guide
  cityId?: string
  onCourse?: (course: CourseSelection) => void
  onPlace?: (id: string) => void
}) {
  // Version 1.13 removed cached narrative. Empty cache records must not hide
  // restored bundled guidance; city/place records still resolve personal trips.
  guide = guide?.sections.length || guide?.sources.length ? guide : undefined
  const basic = cityId ? japanGuideById.get(cityId) : undefined
  const practical = cityId ? practicalGuideById.has(cityId) : false
  if (!guide && !basic && !practical) return null
  return (
    <div className="guide-content">
      {practical &&
        cityId &&
        (compact ? (
          <details className="city-guide-more simple-options">
            <summary>추천 코스·블로그 후기</summary>
            <PracticalGuide
              cityId={cityId}
              onCourse={onCourse}
              onPlace={onPlace}
            />
          </details>
        ) : (
          <PracticalGuide
            cityId={cityId}
            onCourse={onCourse}
            onPlace={onPlace}
          />
        ))}
      {basic && !guide && (
        <a
          className="text-button"
          href={basic.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          일본정부관광국 공식 안내 <ExternalLink size={14} />
        </a>
      )}
      {guide && (
        <div className="guide-custom-content">
          {guide.sections.map((section) =>
            library ? (
              <details className="city-guide-article" key={section.id}>
                <summary>
                  <strong>{section.title}</strong>
                </summary>
                <p className="guidebook-section-body">{section.body}</p>
              </details>
            ) : (
              <section key={section.id}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </section>
            ),
          )}
          {guide && guide.sources.length > 0 && (
            <section className="guide-sources">
              <h3>참고 출처</h3>
              {guide.sources.map((source, index) => (
                <a
                  key={`${source.url}-${index}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>
                    {source.title}
                    <small>자료 확인일 · {source.accessedAt}</small>
                  </span>
                  <ExternalLink size={14} />
                </a>
              ))}
              <p className="detail-footnote">
                가이드 게시일 ·{' '}
                {guide.publishedAt?.slice(0, 10) || '저장된 가이드'}
                <br />
                운영 시간과 요금은 방문 전 공식 안내를 확인해 주세요.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
