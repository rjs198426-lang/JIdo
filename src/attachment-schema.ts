import { z } from 'zod'
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const attachmentMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-hwp',
  'application/vnd.hancom.hwpx',
] as const
export const attachmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  mimeType: z.enum(attachmentMimeTypes),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  createdAt: z.string().datetime(),
  storage: z.enum(['android', 'browser']),
  reservationId: z.string().min(1).max(100).optional(),
  expenseId: z.string().min(1).max(100).optional(),
  stopId: z.string().min(1).max(100).optional(),
})
export type Attachment = z.infer<typeof attachmentSchema>
const extensions: Record<string, Attachment['mimeType']> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  hwp: 'application/x-hwp',
  hwpx: 'application/vnd.hancom.hwpx',
  md: 'text/plain',
}
export const attachmentAccept = [
  ...attachmentMimeTypes,
  ...Object.keys(extensions).map((ext) => '.' + ext),
].join(',')
export function fileMime(file: File) {
  const mime = file.type as Attachment['mimeType']
  return attachmentMimeTypes.includes(mime)
    ? mime
    : extensions[file.name.split('.').at(-1)?.toLowerCase() || '']
}
export function formatFileSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
}
