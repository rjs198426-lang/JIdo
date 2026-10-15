import { BookOpen, ExternalLink } from 'lucide-react'
import { officialGuidebooksForCity } from './official-guidebooks'

export default function GuideContent({ cityId }: { cityId?: string }) {
  const books = officialGuidebooksForCity(cityId)
  return (
    <section className="official-guidebooks" aria-label="공식 가이드북">
      <h3>
        <BookOpen size={19} /> 공식 가이드북
      </h3>
      {books.length ? (
        <ul>
          {books.map((book) => (
            <li key={book.id}>
              <a href={book.url} target="_blank" rel="noopener noreferrer">
                <span>
                  <strong>{book.title}</strong>
                  <small>
                    {book.language} · {book.publisher}
                  </small>
                  <small>
                    {book.format}
                    {book.note ? ` · ${book.note}` : ''}
                  </small>
                </span>
                <ExternalLink size={18} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="guidebooks-unavailable">
          확인된 한국어·영어 공식 가이드북이 없습니다.
        </p>
      )}
    </section>
  )
}
