import { useEffect, useRef, useState } from 'react'
import { useGuidebookIndex } from './useGuidebookIndex'
import { downloadGuidebook } from './guidebook-api'
import { cities } from './catalog'

export default function GuidebookSearch({
  query,
  onOpen,
  showEmpty = false,
}: {
  query: string
  onOpen: (id: string) => void
  showEmpty?: boolean
}) {
  const catalog = useGuidebookIndex()
  const { index } = catalog
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const active = useRef(true)
  const latestQuery = useRef(query)
  latestQuery.current = query
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const q = query.trim().toLocaleLowerCase()
  if (!q) return null
  const books = index.books.filter(
    (book) =>
      !cities.some((city) => city.id === book.id) &&
      [book.name, book.english, book.country]
        .join(' ')
        .toLocaleLowerCase()
        .includes(q),
  )
  if (!books.length && !error && !showEmpty) return null
  return (
    <section className="guidebook-search" aria-label="받을 수 있는 도시 가이드">
      <div className="detail-section-heading">
        <h2>도시 가이드 받기</h2>
        <button
          type="button"
          className="text-button"
          disabled={!!busy || catalog.checking}
          onClick={async () => {
            setBusy('index')
            setError('')
            try {
              await catalog.refresh()
            } catch {
              setError('목록을 확인하지 못했어요. 다시 시도해 주세요.')
            } finally {
              setBusy('')
            }
          }}
        >
          목록 새로고침
        </button>
      </div>
      {books.map((book) => (
        <article className="guidebook-row" key={book.id}>
          <div>
            <strong>{book.name}</strong>
            <p>
              {book.country} · {book.placeCount}곳 · 내려받아 이용
            </p>
          </div>
          <button
            type="button"
            className="button primary small"
            aria-label={`${book.name} 가이드 받기`}
            disabled={!!busy || book.minBuild > __JIDO_APP_INFO__.build}
            onClick={async () => {
              setBusy(book.id)
              setError('')
              try {
                await downloadGuidebook(book)
                if (active.current && latestQuery.current === query)
                  onOpen(book.id)
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : '가이드를 받지 못했어요. 다시 시도해 주세요.',
                )
              } finally {
                setBusy('')
              }
            }}
          >
            {busy === book.id
              ? '받는 중…'
              : book.minBuild > __JIDO_APP_INFO__.build
                ? '앱 업데이트 필요'
                : '가이드 받기'}
          </button>
        </article>
      ))}
      {!books.length && (
        <p className="muted">이 검색어로 받을 수 있는 추가 도시가 없어요.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
