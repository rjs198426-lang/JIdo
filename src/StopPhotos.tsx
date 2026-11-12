import { useState } from 'react'
import AttachmentsPanel from './AttachmentsPanel'

// Closed itinerary cards should not read/decode every attachment in a long trip.
export default function StopPhotos({ stopId }: { stopId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <details
      className="stop-photos"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>장소 사진</summary>
      {open && <AttachmentsPanel stopId={stopId} imagesOnly />}
    </details>
  )
}
