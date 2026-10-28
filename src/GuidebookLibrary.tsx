import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BookOpen, Download, RefreshCw, Search } from 'lucide-react'
import bundledIndex from '../guidebooks/manifest.json'
import { guidebookIndexSchema, type GuidebookIndex } from './guidebook-schema'
import { fetchGuidebookIndex, downloadGuidebook } from './guidebook-api'
import {
  guidebooksSnapshot,
  guidebooksUnreadable,
  subscribeGuidebooks,
} from './guidebook-store'
export default function GuidebookLibrary({
  onOpen,
}: {
  onOpen: (id: string) => void
}) {
  const installed = useSyncExternalStore(
    subscribeGuidebooks,
    guidebooksSnapshot,
  )
  const [index, setIndex] = useState<GuidebookIndex>(() =>
    guidebookIndexSchema.parse(bundledIndex),
  )
  const [query, setQuery] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const books = index.books.filter((book) =>
    [book.name, book.english, book.country]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  )
  const countries = [...new Set(books.map((b) => b.country))]
  return (
    <div className="modal-body guidebook-library">
      <p>
        필요한 도시만 불러와요. 저장한 소개와 장소는 인터넷 없이도 볼 수 있어요.
      </p>
      <p className="muted">
        지도·외부 링크는 인터넷 연결이 필요해요. 사진은 추가 확인 후 보강해요.
      </p>
      <label className="input-search">
        <Search size={18} />
        <input
          aria-label="가이드북 나라·도시 검색"
          placeholder="나라 또는 도시"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="guidebook-library-status">
        <span>
          {index.books.length}개 도시 · 기기에 {installed.books.length}개 저장
        </span>
        <button
          className="text-button"
          disabled={!!busy}
          onClick={async () => {
            setBusy('index')
            setError('')
            setMessage('')
            try {
              const fresh = await fetchGuidebookIndex()
              if (active.current) {
                setIndex(fresh)
                setMessage('가이드북 목록을 확인했어요.')
              }
            } catch {
              if (active.current)
                setError(
                  '목록을 확인하지 못했어요. 준비된 목록과 저장한 가이드북은 계속 이용할 수 있어요.',
                )
            } finally {
              if (active.current) setBusy('')
            }
          }}
        >
          <RefreshCw size={15} />
          목록 새로고침
        </button>
      </div>
      {guidebooksUnreadable() && (
        <p role="alert">
          저장된 가이드북을 읽지 못했어요. 필요한 도시를 다시 불러와 주세요.
          여행 기록은 변경하지 않아요.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {countries.map((country) => (
        <section
          className="guidebook-country"
          key={country}
          aria-label={`${country} 가이드북`}
        >
          <h3>{country}</h3>
          {books
            .filter((b) => b.country === country)
            .map((book) => {
              const saved = installed.books.find((b) => b.guide.id === book.id),
                latest =
                  saved?.revision === book.revision ||
                  (!!saved &&
                    Date.parse(saved.guide.updatedAt) >
                      Date.parse(book.updatedAt))
              return (
                <article key={book.id} className="guidebook-row">
                  <div>
                    <strong>{book.name}</strong>
                    <p>{book.summary}</p>
                    <small>
                      장소 {book.placeCount}곳 · {book.updatedAt.slice(0, 10)}{' '}
                      정리
                    </small>
                  </div>
                  <div className="guidebook-row-actions">
                    {saved && (
                      <button
                        className="button outline small"
                        onClick={() => onOpen(book.id)}
                      >
                        <BookOpen size={15} />
                        열기
                      </button>
                    )}
                    {!latest ? (
                      <button
                        className="button primary small"
                        disabled={
                          !!busy || book.minBuild > __JIDO_APP_INFO__.build
                        }
                        onClick={async () => {
                          setBusy(book.id)
                          setError('')
                          setMessage('')
                          try {
                            await downloadGuidebook(book)
                            if (active.current)
                              setMessage(
                                `${book.name} 가이드북을 기기에 저장했어요.`,
                              )
                          } catch (e) {
                            if (active.current)
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : '가이드북을 불러오지 못했어요.',
                              )
                          } finally {
                            if (active.current) setBusy('')
                          }
                        }}
                      >
                        <Download size={15} />
                        {busy === book.id
                          ? '불러오는 중…'
                          : book.minBuild > __JIDO_APP_INFO__.build
                            ? '앱 업데이트 필요'
                            : saved
                              ? '업데이트'
                              : '불러오기'}
                      </button>
                    ) : (
                      <span className="guidebook-saved">기기에 저장됨</span>
                    )}
                  </div>
                </article>
              )
            })}
        </section>
      ))}
      {installed.books
        .filter(
          ({ guide }) =>
            !index.books.some((book) => book.id === guide.id) &&
            [guide.city.name, guide.city.country, guide.city.english]
              .join(' ')
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
        )
        .map(({ guide }) => (
          <article className="guidebook-row" key={guide.id}>
            <div>
              <strong>{guide.city.name}</strong>
              <p>{guide.city.country} · 기기에 저장한 가이드북</p>
            </div>
            <button
              className="button outline small"
              onClick={() => onOpen(guide.id)}
            >
              <BookOpen size={15} />
              열기
            </button>
          </article>
        ))}
      {!books.length && (
        <p>이 나라·도시의 가이드북은 아직 준비되지 않았어요.</p>
      )}
    </div>
  )
}
