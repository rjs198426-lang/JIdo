import { ExternalLink } from 'lucide-react'
import photos from './blog-photos.json'
import './blog-photos.css'

export default function BlogPhotos({
  cityId,
  placeId,
  primaryImage,
}: {
  cityId: string
  placeId?: string
  primaryImage?: string
}) {
  const selected = photos.filter(
    (photo) =>
      photo.cityId === cityId &&
      (!placeId || photo.placeIds.includes(placeId)) &&
      photo.image !== primaryImage,
  )
  if (!selected.length) return null
  return (
    <section className="blog-photos" aria-label="사진으로 보는 여행지">
      <h3>사진으로 만나는 {placeId ? '이곳' : '여행지'}</h3>
      <div className="blog-photo-grid">
        {selected.map((photo) => (
          <figure key={photo.id}>
            <img src={photo.image} alt={photo.caption} loading="lazy" />
            <figcaption>
              <h4>{photo.caption}</h4>
              <p>{photo.description}</p>
              <a
                href={photo.photoCredit.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {photo.photoCredit.author} · {photo.publishedAt.slice(0, 4)}년
                글
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
