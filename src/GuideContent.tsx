import PracticalGuide from './PracticalGuide'
import { practicalGuideById, type CourseSelection } from './practical-guides'
import { japanGuideById } from './japan-guides'
import { expandedGuideById } from './expanded-guides'
import { resortGuideById } from './resort-guides'
import { ExternalLink } from 'lucide-react'
import type { Guide } from './guide-schema'

export default function GuideContent({
  guide,
  cityId,
  onCourse,
  onPlace,
}: {
  guide?: Guide
  cityId?: string
  onCourse?: (course: CourseSelection) => void
  onPlace?: (id: string) => void
}) {
  const basic = cityId ? japanGuideById.get(cityId) : undefined
  const expanded = cityId ? expandedGuideById.get(cityId) : undefined
  const resort = cityId ? resortGuideById.get(cityId) : undefined
  const practical = cityId ? practicalGuideById.has(cityId) : false
  if (!guide && !basic && !expanded && !resort && !practical) return null
  return (
    <div className="guide-content">
      {practical && cityId && (
        <PracticalGuide cityId={cityId} onCourse={onCourse} onPlace={onPlace} />
      )}
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
      <details className="guide-background" open={!!guide || !practical}>
        <summary>상세 안내·기존 자료</summary>
        {(
          guide?.sections ||
          expanded?.sections ||
          resort?.sections ||
          basic?.sections ||
          []
        ).map((section) => (
          <section key={section.id}>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </section>
        ))}
        {!guide && resort && (
          <section className="guide-sources">
            <h3>공식 안내</h3>
            {resort.references.map((reference) => (
              <a
                key={reference.url}
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {reference.title}
                <ExternalLink size={14} />
              </a>
            ))}
            <p className="detail-footnote">{resort.researchStatus}</p>
          </section>
        )}
        {!guide && expanded && (
          <section className="guide-sources">
            <h3>참고 출처</h3>
            {expanded.sources.map((source) => (
              <a
                key={source.url}
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
          </section>
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
      </details>
    </div>
  )
}
