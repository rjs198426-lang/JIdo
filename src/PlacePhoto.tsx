import { personalPhotoKey, usePersonalPhoto } from './personal-photos'
import { useContext, useEffect, useState } from 'react'
import {
  Image as ImageIcon,
  MapPin,
  Utensils,
  Coffee,
  BedDouble,
  Music,
} from 'lucide-react'
import { AttachmentsContext } from './AttachmentsPanel'
import { attachmentUrl } from './attachment-storage'
import type { Stop } from './travel-model'
import { getPlace, getCity, type Place } from './catalog'

export default function PlacePhoto({
  stop,
  place,
  className = '',
  alt,
}: {
  stop?: Stop
  place?: Place
  className?: string
  alt?: string
}) {
  const context = useContext(AttachmentsContext)
  const files =
    context?.files.filter(
      (file) =>
        !!stop?.id &&
        (file.stopId === stop.id || file.id === stop.photoId) &&
        file.mimeType.startsWith('image/'),
    ) || []
  const catalog =
    place ||
    (stop?.custom
      ? getPlace(stop.custom.catalogPlaceId || '')
      : getPlace(stop?.placeId || ''))
  const personal = usePersonalPhoto(
    personalPhotoKey(
      'place',
      catalog?.id || stop?.custom?.catalogPlaceId || '',
    ),
  )
  const own =
    files.find((file) => file.id === stop?.photoId) || files[0] || personal
  const [url, setUrl] = useState(''),
    [failed, setFailed] = useState(false),
    [fallbackFailed, setFallbackFailed] = useState(false)
  useEffect(() => {
    let active = true,
      revoke = () => {}
    setUrl('')
    setFailed(false)
    setFallbackFailed(false)
    if (own)
      void attachmentUrl(own)
        .then((result) => {
          revoke = result.revoke
          if (active) setUrl(result.url)
          else result.revoke()
        })
        .catch(() => {
          if (active) setFailed(true)
        })
    return () => {
      active = false
      revoke()
    }
  }, [own?.id, catalog?.image])
  const fallback =
    catalog &&
    (catalog.photoCredit || catalog.image !== getCity(catalog.cityId)?.image)
      ? catalog.image
      : undefined
  const source = own && !failed ? url : fallback
  if (source && !fallbackFailed && source !== '/images/place-placeholder.svg')
    return (
      <img
        className={className}
        src={source}
        alt={alt || catalog?.name || stop?.custom?.name || '장소 사진'}
        loading="lazy"
        onError={() =>
          own && source === url ? setFailed(true) : setFallbackFailed(true)
        }
      />
    )
  const EmptyIcon =
    (
      {
        관광: MapPin,
        맛집: Utensils,
        카페: Coffee,
        숙소: BedDouble,
        '바·공연': Music,
      } as Record<string, typeof ImageIcon>
    )[catalog?.category || stop?.custom?.kind || ''] || ImageIcon
  return (
    <span
      className={`place-photo-empty ${className}`}
      role="img"
      aria-label={`${alt || catalog?.name || stop?.custom?.name || '장소'} 사진 없음`}
    >
      <EmptyIcon size={26} />
    </span>
  )
}
