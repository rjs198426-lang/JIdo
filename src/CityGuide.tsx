import { useId, useState, type ReactNode } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Plane,
  BedDouble,
  CheckSquare,
  Lightbulb,
} from 'lucide-react'
import type { City } from './catalog'
import CityPhoto from './CityPhoto'
import GuidePlaces from './GuidePlaces'
import { practicalGuideById } from './practical-guides'

export type CityGuideTab = 'ready' | 'info' | 'tourism' | 'dining'
const tabs = [
  ['ready', '준비'],
  ['info', '정보'],
  ['tourism', '관광'],
  ['dining', '맛집'],
] as const
export default function CityGuide({
  city,
  initialTab = 'ready',
  onPlace,
  children,
  overviewOnly = false,
  onAdd,
}: {
  city: City
  initialTab?: CityGuideTab
  onPlace: (id: string) => void
  children: ReactNode
  overviewOnly?: boolean
  onAdd?: (id: string) => void
}) {
  const [tab, setTab] = useState<CityGuideTab>(initialTab)
  const id = useId()
  const profile = practicalGuideById.get(city.id)
  const article = (
    title: string,
    description: string,
    content: ReactNode,
    photo = false,
  ) => (
    <details className="city-guide-article" key={title}>
      <summary>
        <span className="city-guide-article-copy">
          <strong>{title}</strong>
          <span>{description}</span>
          <small>
            자세히 보기 <ArrowUpRight size={12} />
          </small>
        </span>
        {photo ? (
          <CityPhoto city={city} alt={`${city.name} 풍경`} />
        ) : (
          <span className="city-guide-article-symbol">
            {title.includes('공항') ? (
              <Plane size={26} />
            ) : title.includes('숙소') ? (
              <BedDouble size={26} />
            ) : title.includes('예약') ? (
              <CheckSquare size={26} />
            ) : title.includes('현장') ? (
              <Lightbulb size={26} />
            ) : (
              <BookOpen size={26} />
            )}
          </span>
        )}
      </summary>
      <div className="city-guide-article-body">{content}</div>
    </details>
  )
  const decisions = (items: { name: string; advice: string }[]) => (
    <dl>
      {items.map((item) => (
        <div key={item.name}>
          <dt>{item.name}</dt>
          <dd>{item.advice}</dd>
        </div>
      ))}
    </dl>
  )
  return (
    <section
      className="city-guide-editorial"
      aria-label={`${city.name} 둘러보기`}
    >
      <div className="city-guide-tabs" role="tablist" aria-label="도시 가이드">
        {tabs.map(([value, label], index) => (
          <button
            key={value}
            role="tab"
            id={`${id}-${value}`}
            aria-selected={tab === value}
            aria-controls={`${id}-panel`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1
              if (next < 0) return
              event.preventDefault()
              setTab(tabs[next][0])
              document.getElementById(`${id}-${tabs[next][0]}`)?.focus()
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {['taipei', 'hongkong', 'singapore', 'danang', 'guam', 'saipan'].includes(
        city.id,
      ) && (
        <p className="detail-footnote">
          방문 전 장소의 현재 운영 여부를 확인해 주세요.
        </p>
      )}
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
        className="city-guide-panel"
      >
        {tab === 'ready' && (
          <>
            <div className="city-guide-heading">
              <span>여행 준비</span>
              <h3>출발 전, 이것부터</h3>
              <p>예약부터 공항 이동까지, 필요한 내용만 펼쳐보세요.</p>
            </div>
            {profile ? (
              <>
                {article(
                  '예약하기 전에 확인',
                  '미리 정해두면 좋은 것과 예약할 때의 주의사항',
                  <ul>
                    {profile.before.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>,
                )}
                {article(
                  '공항에서 시내까지',
                  profile.arrival.map((item) => item.name).join(' · '),
                  decisions(profile.arrival),
                )}
                {article(
                  '숙소는 어디에 잡을까',
                  profile.bases.map((item) => item.name).join(' · '),
                  decisions(profile.bases),
                )}
                {article(
                  '현장에서 놓치기 쉬운 것',
                  '이동과 방문을 더 편하게 만드는 여행 팁',
                  <ul>
                    {profile.pitfalls.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>,
                )}
              </>
            ) : (
              <p>{city.description}</p>
            )}
          </>
        )}
        {tab === 'info' && (
          <>
            <div className="city-guide-heading">
              <span>도시 이야기</span>
              <h3>{city.name}, 미리 알아보기</h3>
              <p>{city.tagline}</p>
            </div>
            {article(
              `${city.name} 첫 여행`,
              '어떤 도시인지, 어떻게 둘러보면 좋은지',
              <p>{profile?.firstVisit || city.description}</p>,
              true,
            )}
            <dl className="city-guide-facts">
              {[
                ['공항·접근', city.flight],
                ['시차', city.timeDifference],
                ['추천 시기', city.season],
                ['통화', city.currency],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {profile &&
              article(
                '비가 오는 날의 여행',
                '날씨가 바뀌어도 즐길 수 있는 방법',
                <p>{profile.rainPlan}</p>,
              )}
          </>
        )}
        {(tab === 'tourism' || tab === 'dining') && (
          <>
            <GuidePlaces
              key={`${city.id}-${tab}`}
              cityId={city.id}
              initialCategory={tab === 'dining' ? '맛집' : '관광'}
              onOpen={onPlace}
              onAdd={onAdd}
            />
          </>
        )}
      </div>
      {(!overviewOnly || tab === 'ready' || tab === 'info') && children}
    </section>
  )
}
