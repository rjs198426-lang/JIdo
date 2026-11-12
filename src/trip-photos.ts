import type { Attachment } from './attachment-schema'
import type { Trip } from './travel-model'
import { isPhotoAttachment } from './attachment-purpose'

// General trip photos use the existing ordered attachment collection. Keeping
// the selected cover first preserves it in existing backups and Drive merges.
export function isTripPhoto(file: Attachment) {
  return (
    isPhotoAttachment(file) &&
    !file.stopId &&
    !file.reservationId &&
    !file.expenseId
  )
}
export function tripCover(trip: Trip) {
  return trip.attachments?.find(isTripPhoto)
}
export function selectTripCover(files: Attachment[], id: string) {
  const selected = files.find((file) => file.id === id && isTripPhoto(file))
  if (!selected) throw new Error('여행 사진을 다시 선택해 주세요.')
  return [selected, ...files.filter((file) => file.id !== id)]
}
