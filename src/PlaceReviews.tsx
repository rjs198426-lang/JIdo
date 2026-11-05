import { ExternalLink } from 'lucide-react'
import { getCity, type Place } from './catalog'
import { blogsForPlace } from './place-blogs'
import GooglePlaceReviews from './GooglePlaceReviews'
import BlogSearchLinks from './BlogSearchLinks'
import { placeBlogSearches } from './blog-search'

export default function PlaceReviews({ place }: { place: Place }) {
  const posts = blogsForPlace(place)
  const guides = (place.reviewSources || []).filter(
    (source) => source.kind === 'traveler-guide',
  )
  const licenses = [
    ...new Set(guides.map((source) => source.license || 'CC BY-SA 4.0')),
  ]
  const city = getCity(place.cityId)?.name || ''
  const searches = placeBlogSearches(city, place)
  return (
    <>
      <GooglePlaceReviews
        key={`${place.cityId}:${place.id}:${place.name}`}
        place={place}
      />
      <section className="place-review-sources" aria-label="장소 블로그 후기">
        <h3>블로그·여행 후기</h3>
        <p className="place-blog-period">최근 3년 이내 작성된 글을 모았어요.</p>
        {posts.map((post) => (
          <a
            key={post.url}
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              <small>
                {post.platform}
                {post.author && ` · ${post.author}`}
              </small>
              <strong>{post.title}</strong>
              {post.topic && (
                <span className="place-blog-topic">{post.topic}</span>
              )}
              <small>
                {post.publishedAt && `${post.publishedAt} 작성 · `}
                자료 확인 {post.checkedAt}
              </small>
            </span>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        ))}
        <a
          className="place-blog-search"
          href={searches[0].url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {posts.length ? '이 장소 정보 더 찾기' : '이 장소 블로그 찾기'}
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        <BlogSearchLinks searches={searches.slice(1)} />
        {(guides.length > 0 || place.osmPlaceId) && (
          <details className="place-description-sources">
            <summary>설명 자료 출처</summary>
            {guides.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  <strong>{source.title}</strong>
                  <small>여행자 가이드 · 자료 확인 {source.checkedAt}</small>
                </span>
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            ))}
            {licenses.map((license) => (
              <small key={license}>
                <a
                  href={`https://creativecommons.org/licenses/by-sa/${license.endsWith('3.0') ? '3.0' : '4.0'}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Wikivoyage contributors · {license}
                </a>
              </small>
            ))}
            {place.osmPlaceId && (
              <small>
                <a
                  href={`https://www.openstreetmap.org/${place.osmPlaceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  위치 · © OpenStreetMap contributors · ODbL
                </a>
              </small>
            )}
          </details>
        )}
      </section>
    </>
  )
}
