import type { Attachment } from './attachment-schema'
import type { Trip } from './travel-model'

// General trip photos use the existing ordered attachment collection. Keeping
// the selected cover first preserves it in existing backups and Drive merges.
export function isTripPhoto(file: Attachment) {
  return (
    file.mimeType.startsWith('image/') &&
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
