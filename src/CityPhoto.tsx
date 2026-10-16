import { useEffect, useState } from 'react'
import type { City } from './catalog'
import {
  personalPhotoKey,
  usePersonalPhoto,
  usePhotoUrl,
} from './personal-photos'
export default function CityPhoto({
  city,
  alt,
  className,
}: {
  city: City
  alt?: string
  className?: string
}) {
  const photo = usePersonalPhoto(personalPhotoKey('city', city.id)),
    own = usePhotoUrl(photo)
  const [failed, setFailed] = useState('')
  useEffect(() => setFailed(''), [photo?.id, city.image])
  const source = own && own !== failed ? own : city.image
  return (
    <img
      src={source}
      className={className}
      alt={alt || `${city.name}의 풍경`}
      loading="lazy"
      onError={() => {
        if (source === own) setFailed(own)
      }}
    />
  )
}
