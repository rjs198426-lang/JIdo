import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ExternalLink,
  FileDown,
  Globe2,
  LogOut,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  Eye,
  Sparkles,
} from 'lucide-react'
import { api } from './guide-api'
import {
  blankGuide,
  guideRegions,
  guideSchema,
  type Guide,
  type GuideRequest,
} from './guide-schema'
import GuideContent from './GuideContent'
import './admin.css'

const ADMIN_API = '/api'
const statusNames = {
  requested: '조사 대기',
  researching: '조사 중',
  draft: '초안',
  published: '게시됨',
}
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : '처리하지 못했습니다. 다시 시도하세요.'
type Overview = {
  guides: Guide[]
  requests: GuideRequest[]
  research?: { configured: boolean; model: string }
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [setupCode, setSetupCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = async () => {
    try {
      const status = await api<{ configured: boolean }>(
        '/admin/status',
        {},
        ADMIN_API,
      )
      setConfigured(status.configured)
      setError('')
    } catch {
      setError(
        '가이드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.',
      )
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(
        configured ? '/admin/login' : '/admin/setup',
        { method: 'POST', body: JSON.stringify({ password, setupCode }) },
        ADMIN_API,
      )
      setPassword('')
      setSetupCode('')
      onLogin()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="admin-login">
      <a href="/" className="admin-brand">
        J<span>★</span>Do
      </a>
      <div className="admin-login-card">
        <span className="eyebrow">GUIDE STUDIO</span>
        <h1>
          {configured === false
            ? '가이드 관리 시작하기'
            : '가이드 관리자 로그인'}
        </h1>
        <p>여행지 요청을 확인하고, 조사한 가이드를 앱에 게시하세요.</p>
        {configured !== null && (
          <form onSubmit={submit}>
            {!configured && (
              <>
                <label className="field">
                  초기 설정 코드
                  <input
                    required
                    value={setupCode}
                    onChange={(event) => setSetupCode(event.target.value)}
                    type="password"
                    autoComplete="off"
                  />
                </label>
                <p className="admin-setup-help">
                  서버의 <code>.runtime/admin-setup-code</code> 파일에 있는
                  코드를 입력하세요. 처음 한 번만 필요합니다.
                </p>
              </>
            )}
            <label className="field">
              관리자 비밀번호
              <input
                required
                type="password"
                minLength={configured ? 1 : 12}
                maxLength={128}
                autoComplete={configured ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {!configured && (
              <p className="detail-footnote">
                12자 이상의 비밀번호를 설정해 주세요.
              </p>
            )}
            <button
              type="submit"
              className="button primary full"
              disabled={busy}
            >
              {busy ? '확인 중…' : configured ? '로그인' : '관리자 계정 만들기'}
            </button>
          </form>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {configured === null && (
          <button className="button outline full" onClick={() => void load()}>
            서버 연결 다시 확인
          </button>
        )}
        <a href="/" className="admin-back">
          <ArrowLeft size={14} />
          여행 앱으로 돌아가기
        </a>
      </div>
    </main>
  )
}

function Editor({
  initial,
  request,
  onSaved,
  onBack,
}: {
  initial: Guide
  request?: GuideRequest
  onSaved: (guide: Guide) => void
  onBack: () => void
}) {
  const [guide, setGuide] = useState(initial)
  const [tagText, setTagText] = useState(initial.city.tags.join(', '))
  const [tab, setTab] = useState<'basic' | 'sections' | 'places' | 'sources'>(
    'basic',
  )
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const cityChange = (key: keyof Guide['city'], value: string | string[]) =>
    setGuide((previous) => ({
      ...previous,
      city: { ...previous.city, [key]: value },
    }))
  const save = async (publish: boolean) => {
    setError('')
    setMessage('')
    const normalized = {
      ...guide,
      city: {
        ...guide.city,
        name: guide.scope === 'country' ? guide.city.country : guide.city.name,
      },
    }
    const parsed = guideSchema.safeParse(normalized)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const location = first.path[0]
      setTab(
        location === 'sections'
          ? 'sections'
          : location === 'places'
            ? 'places'
            : location === 'sources'
              ? 'sources'
              : 'basic',
      )
      setError(
        `입력 내용을 확인하세요 (${first.path.join('.')}). ${first.message}`,
      )
      return
    }
    setBusy(true)
    try {
      const result = await api<{ guide: Guide }>(
        '/admin/guides',
        { method: 'POST', body: JSON.stringify(parsed.data) },
        ADMIN_API,
      )
      setGuide(result.guide)
      onSaved(result.guide)
      if (publish) {
        const published = await api<{ guide: Guide }>(
          `/admin/guides/${guide.id}/publish`,
          { method: 'POST' },
          ADMIN_API,
        )
        setGuide(published.guide)
        onSaved(published.guide)
        setMessage(
          '가이드를 게시했습니다. 앱에서 업데이트하면 바로 볼 수 있어요.',
        )
      } else setMessage('초안을 저장했습니다. 앱에는 아직 반영되지 않습니다.')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const exportGuide = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(guide, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `${guide.id}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const field = (
    name: keyof Guide['city'],
    label: string,
    multiline = false,
    placeholder = '',
  ) => (
    <label className="field">
      {label}
      {multiline ? (
        <textarea
          rows={5}
          value={String(guide.city[name])}
          onChange={(event) => cityChange(name, event.target.value)}
          placeholder={placeholder}
          maxLength={5000}
        />
      ) : (
        <input
          value={String(guide.city[name])}
          onChange={(event) => cityChange(name, event.target.value)}
          placeholder={placeholder}
          maxLength={name === 'image' ? 1000 : 200}
        />
      )}
    </label>
  )
  return (
    <div className="guide-editor">
      <div className="editor-header">
        <div>
          <button className="text-button" onClick={onBack}>
            <ArrowLeft size={15} />
            가이드 목록
          </button>
          <h1>
            {guide.city.name || '새 여행 가이드'}
            <span className={`admin-status ${guide.status}`}>
              {statusNames[guide.status]}
            </span>
          </h1>
          <p>조사한 정보와 출처를 정리해 여행 가이드를 완성하세요.</p>
        </div>
        <div className="editor-actions">
          <button
            className="button outline small"
            onClick={() => setPreview(!preview)}
          >
            <Eye size={15} />
            {preview ? '편집하기' : '미리보기'}
          </button>
          <button
            className="button outline small"
            disabled={busy}
            onClick={() => void save(false)}
          >
            <Save size={15} />
            초안 저장
          </button>
          <button
            className="button primary small"
            disabled={busy}
            onClick={() => void save(true)}
          >
            <Send size={15} />
            앱에 게시
          </button>
        </div>
      </div>
      {request && (
        <div className="admin-request-note">
          <strong>
            {request.country}
            {request.city ? ` · ${request.city}` : ' 전체'} 가이드 요청
          </strong>
          <p>{request.notes || '특별한 요청 내용이 없습니다.'}</p>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="guide-success" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      {preview ? (
        <div className="admin-guide-preview">
          <div className="preview-title">
            <img src={guide.city.image} alt="여행지 대표 이미지" />
            <div>
              <span>{guide.city.country}</span>
              <h2>{guide.city.name || '여행지 이름'}</h2>
              <p>{guide.city.tagline}</p>
            </div>
          </div>
          <p className="city-intro">{guide.city.description}</p>
          <GuideContent cityId={guide.id} />
          <h3>추천 장소 {guide.places.length}곳</h3>
          {guide.places.map((place) => (
            <div key={place.id} className="preview-place">
              <strong>{place.name}</strong>
              <p>{place.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div
            className="admin-editor-tabs"
            role="tablist"
            aria-label="가이드 편집 항목"
          >
            {(
              [
                { id: 'basic', label: '여행지 기본 정보' },
                { id: 'sections', label: `조사 본문 ${guide.sections.length}` },
                { id: 'places', label: `추천 장소 ${guide.places.length}` },
                { id: 'sources', label: `출처 ${guide.sources.length}` },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="admin-editor-body">
            {tab === 'basic' && (
              <>
                <div className="admin-two-columns">
                  <label className="field">
                    가이드 종류
                    <select
                      value={guide.scope}
                      onChange={(event) =>
                        setGuide((previous) => ({
                          ...previous,
                          scope: event.target.value as Guide['scope'],
                        }))
                      }
                    >
                      <option value="city">도시 가이드</option>
                      <option value="country">국가 전체 가이드</option>
                    </select>
                  </label>
                  <label className="field">
                    지역
                    <select
                      value={guide.city.region}
                      onChange={(event) =>
                        cityChange('region', event.target.value)
                      }
                    >
                      {guideRegions.map((region) => (
                        <option key={region}>{region}</option>
                      ))}
                    </select>
                  </label>
                  {field('country', '국가', false, '예: 오스트리아')}
                  {guide.scope === 'city' &&
                    field('name', '도시', false, '예: 빈')}
                  {field('english', '영문 이름', false, 'VIENNA')}
                  {field(
                    'image',
                    '대표 이미지 주소',
                    false,
                    '/images/guide-placeholder.svg',
                  )}
                </div>
                {field(
                  'tagline',
                  '한 줄 소개',
                  false,
                  '이 여행지의 매력을 한 문장으로',
                )}
                {field(
                  'description',
                  '여행지 소개',
                  true,
                  '여행지의 특징과 여행 준비에 필요한 정보를 적어주세요.',
                )}
                <div className="admin-two-columns">
                  {field('flight', '항공·이동 안내')}
                  {field('currency', '통화')}
                  {field('timeDifference', '시차')}
                  {field('season', '추천 여행 시기')}
                </div>
                <label className="field">
                  여행 태그 <span className="optional">쉼표로 구분</span>
                  <input
                    value={tagText}
                    onChange={(event) => {
                      setTagText(event.target.value)
                      cityChange(
                        'tags',
                        event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      )
                    }}
                    placeholder="문화 여행, 미식, 산책"
                  />
                </label>
                <p className="detail-footnote">
                  대표 이미지를 따로 준비하지 않아도 기본 여행 이미지로 게시할
                  수 있습니다. 외부 이미지는 사용 가능한 HTTPS 주소를
                  입력하세요.
                </p>
              </>
            )}
            {tab === 'sections' && (
              <>
                <div className="admin-section-intro">
                  <h2>여행 전에 알아둘 이야기</h2>
                  <p>
                    교통, 숙소 지역, 여행 코스, 예절 등 조사한 내용을 주제별로
                    작성하세요.
                  </p>
                </div>
                {guide.sections.map((section, index) => (
                  <section className="admin-entry" key={section.id}>
                    <div className="admin-entry-heading">
                      <strong>본문 {index + 1}</strong>
                      <button
                        className="icon-button"
                        aria-label={`본문 ${index + 1} 삭제`}
                        onClick={() =>
                          setGuide((previous) => ({
                            ...previous,
                            sections: previous.sections.filter(
                              (item) => item.id !== section.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <label className="field">
                      본문 제목
                      <input
                        value={section.title}
                        maxLength={100}
                        onChange={(event) =>
                          setGuide((previous) => ({
                            ...previous,
                            sections: previous.sections.map((item) =>
                              item.id === section.id
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          }))
                        }
                        placeholder="예: 공항에서 시내로 이동하기"
                      />
                    </label>
                    <label className="field">
                      조사 내용
                      <textarea
                        rows={9}
                        maxLength={8000}
                        value={section.body}
                        onChange={(event) =>
                          setGuide((previous) => ({
                            ...previous,
                            sections: previous.sections.map((item) =>
                              item.id === section.id
                                ? { ...item, body: event.target.value }
                                : item,
                            ),
                          }))
                        }
                        placeholder="확인한 내용과 여행 팁을 적어주세요. 줄바꿈은 앱에서도 유지됩니다."
                      />
                    </label>
                  </section>
                ))}
                <button
                  className="button outline"
                  disabled={guide.sections.length >= 20}
                  onClick={() =>
                    setGuide((previous) => ({
                      ...previous,
                      sections: [
                        ...previous.sections,
                        { id: crypto.randomUUID(), title: '', body: '' },
                      ],
                    }))
                  }
                >
                  <Plus size={16} />
                  조사 본문 추가
                </button>
              </>
            )}
            {tab === 'places' && (
              <>
                <div className="admin-section-intro">
                  <h2>일정에 담을 추천 장소</h2>
                  <p>
                    추가한 장소는 앱에서 저장하고 여행 일정에 바로 넣을 수
                    있습니다.
                  </p>
                </div>
                {guide.places.map((place, index) => {
                  const change = (
                    key: keyof typeof place,
                    value: string | number,
                  ) =>
                    setGuide((previous) => ({
                      ...previous,
                      places: previous.places.map((item) =>
                        item.id === place.id ? { ...item, [key]: value } : item,
                      ),
                    }))
                  return (
                    <section className="admin-entry" key={place.id}>
                      <div className="admin-entry-heading">
                        <strong>
                          장소 {index + 1} · {place.name || '새 장소'}
                        </strong>
                        <button
                          className="icon-button"
                          aria-label={`장소 ${index + 1} 삭제`}
                          onClick={() =>
                            setGuide((previous) => ({
                              ...previous,
                              places: previous.places.filter(
                                (item) => item.id !== place.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="admin-two-columns">
                        <label className="field">
                          장소 이름
                          <input
                            value={place.name}
                            onChange={(event) =>
                              change('name', event.target.value)
                            }
                            maxLength={120}
                          />
                        </label>
                        <label className="field">
                          장소 종류
                          <select
                            value={place.category}
                            onChange={(event) =>
                              change('category', event.target.value)
                            }
                          >
                            <option>관광</option>
                            <option>맛집</option>
                            <option>카페</option>
                          </select>
                        </label>
                        <label className="field">
                          장소 영문 이름
                          <input
                            value={place.english}
                            onChange={(event) =>
                              change('english', event.target.value)
                            }
                            maxLength={150}
                          />
                        </label>
                        <label className="field">
                          장소 이미지
                          <input
                            value={place.image}
                            onChange={(event) =>
                              change('image', event.target.value)
                            }
                            maxLength={1000}
                          />
                        </label>
                      </div>
                      <label className="field">
                        장소 설명
                        <textarea
                          rows={4}
                          value={place.description}
                          onChange={(event) =>
                            change('description', event.target.value)
                          }
                          maxLength={3000}
                        />
                      </label>
                      <label className="field">
                        주소
                        <input
                          value={place.address}
                          onChange={(event) =>
                            change('address', event.target.value)
                          }
                          maxLength={300}
                        />
                      </label>
                      <div className="admin-two-columns">
                        <label className="field">
                          추천 체류 시간
                          <input
                            value={place.duration}
                            onChange={(event) =>
                              change('duration', event.target.value)
                            }
                            maxLength={100}
                          />
                        </label>
                        <label className="field">
                          비용 안내
                          <input
                            value={place.cost}
                            onChange={(event) =>
                              change('cost', event.target.value)
                            }
                            maxLength={300}
                          />
                        </label>
                        <label className="field">
                          위도
                          <input
                            type="number"
                            step="any"
                            min={-90}
                            max={90}
                            value={Number.isFinite(place.lat) ? place.lat : ''}
                            onChange={(event) =>
                              change(
                                'lat',
                                event.target.value
                                  ? Number(event.target.value)
                                  : NaN,
                              )
                            }
                          />
                        </label>
                        <label className="field">
                          경도
                          <input
                            type="number"
                            step="any"
                            min={-180}
                            max={180}
                            value={Number.isFinite(place.lng) ? place.lng : ''}
                            onChange={(event) =>
                              change(
                                'lng',
                                event.target.value
                                  ? Number(event.target.value)
                                  : NaN,
                              )
                            }
                          />
                        </label>
                      </div>
                      <label className="field">
                        방문 팁
                        <textarea
                          rows={3}
                          value={place.tip}
                          onChange={(event) =>
                            change('tip', event.target.value)
                          }
                          maxLength={1500}
                        />
                      </label>
                    </section>
                  )
                })}
                <button
                  className="button outline"
                  disabled={guide.places.length >= 100}
                  onClick={() =>
                    setGuide((previous) => ({
                      ...previous,
                      places: [
                        ...previous.places,
                        {
                          id: `${guide.id}:${crypto.randomUUID()}`,
                          cityId: guide.id,
                          name: '',
                          english: '',
                          category: '관광',
                          image: guide.city.image,
                          description: '',
                          address: '',
                          duration: '약 1시간',
                          cost: '방문 전 공식 안내 확인',
                          tip: '운영 시간과 예약 여부를 확인하세요.',
                          lat: NaN,
                          lng: NaN,
                        },
                      ],
                    }))
                  }
                >
                  <Plus size={16} />
                  추천 장소 추가
                </button>
              </>
            )}
            {tab === 'sources' && (
              <>
                <div className="admin-section-intro">
                  <h2>가이드의 참고 출처</h2>
                  <p>
                    공식 관광청, 교통기관, 관광지 공식 사이트 등 확인한 자료의
                    링크를 남겨주세요.
                  </p>
                </div>
                {guide.sources.map((source, index) => (
                  <section className="admin-entry" key={index}>
                    <div className="admin-entry-heading">
                      <strong>출처 {index + 1}</strong>
                      <button
                        className="icon-button"
                        aria-label={`출처 ${index + 1} 삭제`}
                        onClick={() =>
                          setGuide((previous) => ({
                            ...previous,
                            sources: previous.sources.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <label className="field">
                      자료 이름
                      <input
                        value={source.title}
                        maxLength={150}
                        onChange={(event) =>
                          setGuide((previous) => ({
                            ...previous,
                            sources: previous.sources.map((item, i) =>
                              i === index
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      출처 주소
                      <input
                        type="url"
                        placeholder="https://"
                        value={source.url}
                        maxLength={1000}
                        onChange={(event) =>
                          setGuide((previous) => ({
                            ...previous,
                            sources: previous.sources.map((item, i) =>
                              i === index
                                ? { ...item, url: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      자료 확인일
                      <input
                        type="date"
                        value={source.accessedAt}
                        onChange={(event) =>
                          setGuide((previous) => ({
                            ...previous,
                            sources: previous.sources.map((item, i) =>
                              i === index
                                ? { ...item, accessedAt: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                  </section>
                ))}
                <button
                  className="button outline"
                  disabled={guide.sources.length >= 30}
                  onClick={() =>
                    setGuide((previous) => ({
                      ...previous,
                      sources: [
                        ...previous.sources,
                        {
                          title: '',
                          url: '',
                          accessedAt: new Date().toISOString().slice(0, 10),
                        },
                      ],
                    }))
                  }
                >
                  <Plus size={16} />
                  출처 추가
                </button>
              </>
            )}
          </div>
        </>
      )}
      <div className="editor-footer">
        <span>
          최종 저장 · {guide.updatedAt.slice(0, 16).replace('T', ' ')}
        </span>
        <button className="text-button" onClick={exportGuide}>
          <FileDown size={15} />
          가이드 JSON 내보내기
        </button>
      </div>
    </div>
  )
}

export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [overview, setOverview] = useState<Overview>({
    guides: [],
    requests: [],
  })
  const [view, setView] = useState<'requests' | 'guides'>('requests')
  const [editor, setEditor] = useState<Guide | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)
  const upload = useRef<HTMLInputElement>(null)
  const load = async () => {
    try {
      setOverview(await api<Overview>('/admin/overview', {}, ADMIN_API))
      setLoggedIn(true)
      setError('')
    } catch (error) {
      if ((error as { status?: number }).status === 401) setLoggedIn(false)
      else setError(errorMessage(error))
    } finally {
      setCheckedSession(true)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const open = async (id: string) => {
    setBusy(true)
    try {
      const result = await api<{ guide: Guide }>(
        `/admin/guides/${id}`,
        {},
        ADMIN_API,
      )
      setEditor(result.guide)
      setError('')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const requestGuide = async (request: GuideRequest) => {
    if (request.guideId) await open(request.guideId)
    else setEditor(blankGuide(request.country, request.city, request.id))
  }
  const research = async (request: GuideRequest) => {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ guide: Guide }>(
        `/admin/requests/${request.id}/research`,
        { method: 'POST', signal: AbortSignal.timeout(180000) },
        ADMIN_API,
      )
      setEditor(result.guide)
      await load()
    } catch (error) {
      await load()
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const unpublish = async (guide: Guide) => {
    setBusy(true)
    try {
      await api(
        `/admin/guides/${guide.id}/unpublish`,
        { method: 'POST' },
        ADMIN_API,
      )
      await load()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  if (!checkedSession)
    return <p className="admin-loading">관리자 세션을 확인하고 있어요.</p>
  if (!loggedIn)
    return (
      <Login
        onLogin={() => {
          setLoggedIn(true)
          void load()
        }}
      />
    )
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          J<span>★</span>Do
        </a>
        <span className="admin-studio-label">GUIDE STUDIO</span>
        <nav aria-label="관리자 메뉴">
          <button
            className={view === 'requests' && !editor ? 'active' : ''}
            onClick={() => {
              setEditor(null)
              setView('requests')
            }}
          >
            <Globe2 size={18} />
            가이드 요청
            <span>
              {
                overview.requests.filter(
                  (request) => request.status !== 'published',
                ).length
              }
            </span>
          </button>
          <button
            className={view === 'guides' && !editor ? 'active' : ''}
            onClick={() => {
              setEditor(null)
              setView('guides')
            }}
          >
            <BookOpen size={18} />
            가이드 관리<span>{overview.guides.length}</span>
          </button>
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/" className="text-button">
            <ExternalLink size={14} />
            여행 앱 보기
          </a>
          <button
            className="text-button"
            onClick={async () => {
              await api('/admin/logout', { method: 'POST' }, ADMIN_API)
              setLoggedIn(false)
              setEditor(null)
            }}
          >
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {editor ? (
          <Editor
            key={editor.id}
            initial={editor}
            request={overview.requests.find(
              (request) => request.id === editor.requestId,
            )}
            onSaved={() => {
              void load()
            }}
            onBack={() => {
              setEditor(null)
              setView('guides')
              void load()
            }}
          />
        ) : (
          <>
            <div className="admin-page-heading">
              <div>
                <span className="eyebrow">
                  {view === 'requests'
                    ? 'FROM REQUEST TO ADVENTURE'
                    : 'PUBLISH A NEW DESTINATION'}
                </span>
                <h1>
                  {view === 'requests'
                    ? '어떤 여행지를 기다리고 있을까요?'
                    : '앱에 담을 여행 가이드'}
                </h1>
                <p>
                  {view === 'requests'
                    ? '접수된 국가·도시를 조사하고 출처와 함께 가이드로 만들어보세요.'
                    : '게시한 가이드는 앱에서 불러와 저장하고 일정에 추가할 수 있습니다.'}
                </p>
              </div>
              {view === 'requests' && (
                <div className="admin-research-info">
                  <Sparkles size={20} />
                  <div>
                    <strong>AI 조사 → 초안 작성 → 관리자 검토 → 앱 게시</strong>
                    <p>
                      {overview.research?.configured
                        ? 'AI가 웹에서 자료를 조사하고 출처와 함께 한국어 초안을 작성합니다. 작성된 내용은 확인 후 게시하세요.'
                        : 'AI 조사를 사용하려면 서버 환경 설정에 GUIDE_AI_API_KEY를 추가하세요. 키는 앱에 포함되지 않습니다.'}
                    </p>
                  </div>
                </div>
              )}
              <div className="editor-actions">
                <button
                  className="button outline small"
                  onClick={() => upload.current?.click()}
                >
                  <Upload size={15} />
                  JSON 가져오기
                </button>
                <button
                  className="button primary small"
                  onClick={() => setEditor(blankGuide('', '새 도시'))}
                >
                  <Plus size={16} />새 가이드
                </button>
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="admin-stats">
              <div>
                <span>조사를 기다리는 여행지</span>
                <strong>
                  {
                    overview.requests.filter(
                      (request) => request.status === 'requested',
                    ).length
                  }
                </strong>
              </div>
              <div>
                <span>작성 중인 가이드</span>
                <strong>
                  {
                    overview.guides.filter((guide) => guide.status === 'draft')
                      .length
                  }
                </strong>
              </div>
              <div>
                <span>앱에 게시한 가이드</span>
                <strong>
                  {
                    overview.guides.filter(
                      (guide) => guide.status === 'published',
                    ).length
                  }
                </strong>
              </div>
            </div>
            <div className="input-search admin-list-search">
              <Search size={18} />
              <input
                aria-label="관리할 여행지 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="국가 또는 도시로 찾기"
              />
            </div>
            {view === 'requests' ? (
              <div className="admin-list">
                {overview.requests
                  .filter((request) =>
                    `${request.country} ${request.city}`.includes(query),
                  )
                  .map((request) => (
                    <article className="admin-list-row" key={request.id}>
                      <span className="admin-destination-icon">
                        <Globe2 size={21} />
                      </span>
                      <div>
                        <h2>
                          {request.country}
                          {request.city ? ` · ${request.city}` : ' 전체 가이드'}
                        </h2>
                        <p>
                          {request.notes ||
                            '국가·도시 여행 가이드를 요청했어요.'}
                        </p>
                        <small>접수 · {request.createdAt.slice(0, 10)}</small>
                      </div>
                      <span className={`admin-status ${request.status}`}>
                        {statusNames[request.status]}
                      </span>
                      <div className="admin-row-actions">
                        <button
                          disabled={busy || !overview.research?.configured}
                          className="button primary small"
                          onClick={() => void research(request)}
                        >
                          <Sparkles size={14} />
                          {busy ? '조사 중…' : 'AI 조사·초안 작성'}
                        </button>
                        <button
                          disabled={busy}
                          className="button outline small"
                          onClick={() => void requestGuide(request)}
                        >
                          {request.guideId ? '가이드 이어서 작성' : '직접 작성'}
                        </button>
                      </div>
                    </article>
                  ))}
                {overview.requests.length === 0 && (
                  <div className="admin-empty">
                    <Globe2 size={36} />
                    <h2>아직 접수된 여행지가 없어요.</h2>
                    <p>
                      앱의 ‘가이드 요청·업데이트’에서 국가와 도시를 요청하면
                      여기에 표시됩니다.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="admin-list">
                {overview.guides
                  .filter((guide) =>
                    `${guide.city.country} ${guide.city.name}`.includes(query),
                  )
                  .map((guide) => (
                    <article className="admin-list-row" key={guide.id}>
                      <img src={guide.city.image} alt="" />
                      <div>
                        <h2>{guide.city.name}</h2>
                        <p>
                          {guide.city.country} ·{' '}
                          {guide.scope === 'city' ? '도시' : '국가'} 가이드 ·
                          추천 장소 {guide.places.length}곳
                        </p>
                        <small>
                          최종 수정 · {guide.updatedAt.slice(0, 10)}
                        </small>
                      </div>
                      <span className={`admin-status ${guide.status}`}>
                        {statusNames[guide.status]}
                      </span>
                      <div className="admin-row-actions">
                        <button
                          disabled={busy}
                          className="button outline small"
                          onClick={() => void open(guide.id)}
                        >
                          가이드 편집
                        </button>
                        {guide.status === 'published' && (
                          <button
                            disabled={busy}
                            className="text-button"
                            onClick={() => void unpublish(guide)}
                          >
                            게시 내리기
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </>
        )}
        <input
          ref={upload}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          aria-label="가이드 JSON 파일 가져오기"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            try {
              if (file.size > 512000)
                throw new Error('가이드 파일은 512KB 이하로 준비하세요.')
              const result = guideSchema.safeParse(
                JSON.parse(await file.text()),
              )
              if (!result.success)
                throw new Error(
                  '가이드 JSON 형식이 올바르지 않습니다. 내보낸 가이드 형식을 참고하세요.',
                )
              setEditor({
                ...result.data,
                requestId: null,
                status: 'draft',
                publishedAt: null,
              })
              setError('')
            } catch (error) {
              setError(errorMessage(error))
            } finally {
              event.target.value = ''
            }
          }}
        />
      </main>
    </div>
  )
}
