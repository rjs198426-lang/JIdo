import type { Attachment } from './attachment-schema'

export const ATTACHMENT_PURPOSE_BUILD = 88

export function isPhotoAttachment(file: Attachment) {
  return (
    file.mimeType.startsWith('image/') &&
    (file.purpose === 'photo' ||
      (file.purpose === undefined && !file.reservationId && !file.expenseId))
  )
}

export function documentAttachments(files: Attachment[] = []) {
  return files.filter((file) => !isPhotoAttachment(file))
}

export function hasAttachmentPurpose(files: Attachment[]) {
  return files.some((file) => file.purpose !== undefined)
}
