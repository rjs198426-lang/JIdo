import { ExternalLink } from 'lucide-react'
import { getCity } from './catalog'
import { blogsForCity } from './guide-blogs'

export default function GuideBlogs({ cityId }: { cityId: string }) {
  const posts = blogsForCity(cityId)
  const name = getCity(cityId)?.name ?? cityId
  return (
    <section className="guide-blogs" aria-label={`${name} 블로그 후기`}>
      <div className="guide-blogs-heading">
        <h3>{name} 블로그 후기</h3>
        <span>{posts.length}편</span>
      </div>
      {posts.length > 0 ? (
        <ul className="guide-blog-list">
          {posts.map((post) => (
            <li key={post.url}>
              <a href={post.url} target="_blank" rel="noopener noreferrer">
                <span className="guide-blog-copy">
                  <small>
                    {post.platform} · {post.author}
                  </small>
                  <strong>{post.title}</strong>
                  <span>{post.topic}</span>
                  {post.publishedAt && (
                    <small>{post.publishedAt.slice(0, 4)}년 작성</small>
                  )}
                </span>
                <ExternalLink size={18} aria-label="외부 원문" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>아직 확인한 후기가 없어요.</p>
      )}
      <a
        className="button outline full guide-blog-search"
        href={`https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(`${name} 자유여행 후기`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {name} 후기 더 찾기 <ExternalLink size={16} aria-hidden="true" />
      </a>
      <details className="guide-blog-criteria">
        <summary>후기 선정 기준</summary>
        <p>
          여행 경험과 본문 링크를 확인한 글입니다. 협찬·예약 제휴 유도가 확인된
          글은 제외했으며 숨은 광고 여부는 보증하지 않습니다. 조회수·인기 순위는
          확인하지 않았습니다. 과거 요금·운영·입국 규정은 최신 공식 안내를
          확인하세요. 목록은 오프라인에서도 볼 수 있고 원문은 인터넷 연결이
          필요합니다.
        </p>
        {posts.length > 0 && (
          <small>원문 확인: {posts[0].checkedAt} · 게시 순위와 무관</small>
        )}
      </details>
    </section>
  )
}
