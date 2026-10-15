import { useState } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { getPlace } from './catalog'
import { practicalGuideById, type CourseSelection } from './practical-guides'

export default function PracticalGuide({
  cityId,
  onCourse,
  onPlace,
}: {
  cityId: string
  onCourse?: (course: CourseSelection) => void
  onPlace?: (id: string) => void
}) {
  const profile = practicalGuideById.get(cityId)
  const [tab, setTab] = useState('start')
  if (!profile) return null
  return (
    <section className="practical-guide" aria-label="자유여행 실전 가이드">
      {['taipei', 'hongkong', 'singapore', 'danang'].includes(cityId) && (
        <p className="guide-status">
          장소 목록은 2016년 보관본 기반 · 현재 운영 확인 필요
        </p>
      )}
      {['guam', 'saipan'].includes(cityId) && (
        <p className="guide-status">장소 위치·현재 운영 확인 필요</p>
      )}
      <div className="guide-tabs" role="tablist" aria-label="실전 가이드">
        {[
          ['start', '처음 가면'],
          ['courses', '지역별 코스'],
          ['ready', '예약·현장 팁'],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="tab"
            id={`practical-tab-${id}`}
            aria-controls="practical-panel"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id="practical-panel"
        role="tabpanel"
        aria-labelledby={`practical-tab-${tab}`}
      >
        {tab === 'start' && (
          <>
            <p className="guide-lead">{profile.firstVisit}</p>
            <h3>숙소는 어디에 잡을까</h3>
            <dl className="guide-decisions">
              {profile.bases.map((item) => (
                <div key={item.name}>
                  <dt>{item.name}</dt>
                  <dd>{item.advice}</dd>
                </div>
              ))}
            </dl>
            <h3>공항·시내 이동 고르기</h3>
            <dl className="guide-decisions">
              {profile.arrival.map((item) => (
                <div key={item.name}>
                  <dt>{item.name}</dt>
                  <dd>{item.advice}</dd>
                </div>
              ))}
            </dl>
            <h3>며칠을 잡을까</h3>
            <dl className="guide-decisions">
              {profile.timePlan.map((item) => (
                <div key={item.name}>
                  <dt>{item.name}</dt>
                  <dd>{item.advice}</dd>
                </div>
              ))}
            </dl>
            <button
              className="button outline full"
              type="button"
              onClick={() => setTab('courses')}
            >
              내 일정에 맞는 코스 보기 <ArrowRight size={16} />
            </button>
          </>
        )}
        {tab === 'courses' && (
          <div className="guide-courses">
            {profile.courses.map((course) => (
              <article className="guide-course" key={course.id}>
                <small>{course.pace}</small>
                <h3>{course.title}</h3>
                <p>{course.why}</p>
                <ol>
                  {course.placeIds.map((id) => {
                    const place = getPlace(id)
                    return (
                      place && (
                        <li key={id}>
                          <button
                            type="button"
                            aria-label={`코스 장소 ${place.name} 보기`}
                            onClick={() => onPlace?.(id)}
                          >
                            {place.name}
                          </button>
                        </li>
                      )
                    )
                  })}
                </ol>
                {onCourse && (
                  <button
                    type="button"
                    className="button primary full"
                    onClick={() => onCourse({ ...course, cityId })}
                  >
                    이 코스 일정에 담기 <ArrowRight size={16} />
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
        {tab === 'ready' && (
          <>
            <h3>예약하기 전에 확인</h3>
            <ul className="guide-advice">
              {profile.before.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <h3>현장에서 놓치기 쉬운 것</h3>
            <ul className="guide-advice">
              {profile.pitfalls.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <h3>비가 오거나 날씨가 나쁘면</h3>
            <p>{profile.rainPlan}</p>
          </>
        )}
      </div>
      <details className="guide-evidence">
        <summary>정보 확인·출처</summary>
        <p>{profile.researchNote}</p>
        {profile.sources.map((source) => (
          <a
            href={source.url}
            key={source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              {source.title}
              <small>
                {source.status === 'read'
                  ? '본문 확인'
                  : source.status === 'partial'
                    ? '상세 정보는 재확인 필요'
                    : '최신 본문 확인 못함'}{' '}
                · {source.checkedAt}
              </small>
            </span>
            <ExternalLink size={14} />
          </a>
        ))}
      </details>
    </section>
  )
}
