import { useState, type ReactNode } from 'react'
import {
  usePhotoUrl,
  usePersonalPhoto,
  personalPhotoKey,
} from './personal-photos'
import { tripCover } from './trip-photos'
import { tripCity, type Trip } from './travel-model'

export default function TripPhoto({
  trip,
  className = '',
  fallback,
}: {
  trip: Trip
  className?: string
  fallback?: ReactNode
}) {
  const legacyPersonal = usePersonalPhoto(
    personalPhotoKey('city', tripCity(trip).id),
  )
  const file = tripCover(trip) || legacyPersonal,
    url = usePhotoUrl(file)
  const [failed, setFailed] = useState('')
  return url && url !== failed ? (
    <img
      src={url}
      className={className}
      alt={`${trip.title} 내 사진`}
      decoding="async"
      onError={() => setFailed(url)}
    />
  ) : (
    fallback || null
  )
}
