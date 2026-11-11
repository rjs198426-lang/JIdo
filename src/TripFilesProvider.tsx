import type { ReactNode } from 'react'
import { AttachmentsContext } from './AttachmentsPanel'
import type { Trip } from './travel-model'
import { SAVE_ERROR_MESSAGE } from './store'
import { selectTripCover, tripCover } from './trip-photos'

export default function TripFilesProvider({
  trip,
  onChange,
  isShared,
  children,
}: {
  trip: Trip
  onChange: (change: (current: Trip) => Trip) => boolean | void
  isShared: (id: string) => boolean
  children: ReactNode
}) {
  const commit = (change: (current: Trip) => Trip) => {
    if (onChange(change) === false) throw new Error(SAVE_ERROR_MESSAGE)
  }
  return (
    <AttachmentsContext.Provider
      value={{
        files: trip.attachments || [],
        add: (files) =>
          commit((current) => {
            const additions = files.filter(
              (file) =>
                !current.attachments?.some((known) => known.id === file.id),
            )
            if (
              additions.some(
                (file) =>
                  file.stopId &&
                  !current.days.flat().some((stop) => stop.id === file.stopId),
              )
            )
              throw new Error(
                '사진을 추가할 일정이 없어졌어요. 다시 확인해 주세요.',
              )
            const next = [...(current.attachments || []), ...additions]
            if (next.length > 300)
              throw new Error('여행 자료는 최대 300개까지 보관할 수 있어요.')
            return { ...current, attachments: next }
          }),
        remove: (id) =>
          commit((current) => ({
            ...current,
            attachments: current.attachments?.filter((file) => file.id !== id),
            days: current.days.map((day) =>
              day.map((stop) =>
                stop.photoId === id ? { ...stop, photoId: undefined } : stop,
              ),
            ),
          })),
        isShared,
        coverFor: (stopId) =>
          stopId
            ? trip.days.flat().find((stop) => stop.id === stopId)?.photoId
            : tripCover(trip)?.id,
        setCover: (stopId, id) =>
          commit((current) => {
            if (!stopId)
              return {
                ...current,
                attachments: selectTripCover(current.attachments || [], id),
              }
            if (
              !current.attachments?.some(
                (file) =>
                  file.id === id &&
                  file.stopId === stopId &&
                  file.mimeType.startsWith('image/'),
              )
            )
              throw new Error('장소 사진을 다시 선택해 주세요.')
            return {
              ...current,
              days: current.days.map((day) =>
                day.map((stop) =>
                  stop.id === stopId ? { ...stop, photoId: id } : stop,
                ),
              ),
            }
          }),
      }}
    >
      {children}
    </AttachmentsContext.Provider>
  )
}
