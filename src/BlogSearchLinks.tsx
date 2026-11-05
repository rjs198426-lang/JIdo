import { ExternalLink } from 'lucide-react'
import type { BlogSearch } from './blog-search'

export default function BlogSearchLinks({
  searches,
}: {
  searches: BlogSearch[]
}) {
  return (
    <details className="blog-search-options">
      <summary>주제별 블로그 검색</summary>
      <div
        className="blog-search-topics"
        role="group"
        aria-label="주제별 블로그 검색"
      >
        {searches.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.label}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ))}
      </div>
    </details>
  )
}
