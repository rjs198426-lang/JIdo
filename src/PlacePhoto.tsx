import { useContext, useEffect, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
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
        file.stopId === stop.id &&
        file.mimeType.startsWith('image/'),
    ) || []
  const own = files.find((file) => file.id === stop?.photoId) || files[0]
  const catalog =
    place ||
    (stop?.custom
      ? getPlace(stop.custom.catalogPlaceId || '')
      : getPlace(stop?.placeId || ''))
  const [url, setUrl] = useState(''),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true,
      revoke = () => {}
    setUrl('')
    setFailed(false)
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
  const source = own
    ? url
    : catalog &&
        (catalog.photoCredit ||
          catalog.image !== getCity(catalog.cityId)?.image)
      ? catalog.image
      : undefined
  if (source && !failed && source !== '/images/place-placeholder.svg')
    return (
      <img
        className={className}
        src={source}
        alt={alt || catalog?.name || stop?.custom?.name || '장소 사진'}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  return (
    <span
      className={`place-photo-empty ${className}`}
      role="img"
      aria-label={`${alt || catalog?.name || stop?.custom?.name || '장소'} 사진 없음`}
    >
      <ImageIcon size={26} />
    </span>
  )
}
