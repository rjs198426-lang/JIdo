import { useState, type ChangeEvent } from 'react'
import { Copy, Download, Upload } from 'lucide-react'
import { z } from 'zod'
import { getCity, getPlace } from './catalog'
import {
  tripSchema,
  tripDestinations,
  stopDetails,
  type Trip,
} from './travel-model'
import { dateAt, formatDate } from './store'
import { placeCoordinates, placeMapQuery } from './place-location'

// Backups carry their own place descriptions, so a removed guide cannot break a restored trip.
export function portableTrip(trip: Trip): Trip {
  const destinations = tripDestinations(trip).map(({ id, name, country }) => ({
    id,
    name,
    country,
  }))
  const days = trip.days.map((stops) =>
    stops.map((stop) => {
      const { photoId: _photo, ...portableStop } = stop
      if (stop.custom) return portableStop
      const place = getPlace(stop.placeId)!
      const source = tripDestinations(trip).find(
        (item) => item.guideCityId === place.cityId,
      )
      let destination = destinations.find((item) => item.id === source?.id)
      if (!destination) {
        const city = getCity(place.cityId)!
        destination = { id: city.id, name: city.name, country: city.country }
        if (!destinations.some((item) => item.id === destination!.id))
          destinations.push(destination)
      }
      return {
        ...portableStop,
        custom: {
          name: place.name,
          kind:
            place.category === '바·공연' ? ('기타' as const) : place.category,
          catalogPlaceId: place.id,
          coordinates: placeCoordinates(place),
          address: place.address,
          link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeMapQuery(place))}`,
          destinationId: destination.id,
        },
      }
    }),
  )
  const { attachments: _files, ...portable } = trip
  return { ...portable, cityId: `personal-${trip.id}`, destinations, days }
}
const backupSchema = z.object({
  format: z.literal('jdo-trips'),
  version: z.literal(1),
  trips: z.array(tripSchema).min(1).max(500),
})
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function TravelBackup({
  trips,
  activeTrip,
  onRestore,
}: {
  trips: Trip[]
  activeTrip?: Trip
  onRestore: (trips: Trip[]) => void
}) {
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<Trip[] | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [exportText, setExportText] = useState('')
  const backup = () =>
    JSON.stringify(
      { format: 'jdo-trips', version: 1, trips: trips.map(portableTrip) },
      null,
      2,
    )
  const inspect = (text: string) => {
    setInput(text)
    setPreview(null)
    setError('')
    setMessage('')
    if (text.length > 5 * 1024 * 1024)
      return setError('백업은 5MB 이하로 가져와 주세요.')
    try {
      const parsed = backupSchema.safeParse(JSON.parse(text))
      if (!parsed.success) throw new Error()
      setPreview(parsed.data.trips)
    } catch {
      setError(
        '유효한 J★Do 여행 백업이 아니에요. 기존 여행은 변경하지 않았어요.',
      )
    }
  }
  async function file(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    if (selected.size > 5 * 1024 * 1024) {
      setError('백업은 5MB 이하로 가져와 주세요.')
      setPreview(null)
      return
    }
    try {
      inspect(await selected.text())
    } catch {
      setError('파일을 읽을 수 없어요.')
      setPreview(null)
    }
    event.target.value = ''
  }
  async function copy(text: string) {
    setExportText(text)
    try {
      await navigator.clipboard.writeText(text)
      setMessage('복사했어요. 파일이나 메모 앱에 보관하세요.')
    } catch {
      setMessage('아래 내용을 길게 눌러 선택하고 복사하세요.')
    }
  }
  function itineraryText(trip: Trip) {
    return [
      `${trip.title} · J★Do`,
      `${trip.startDate} ~ ${trip.endDate}`,
      tripDestinations(trip)
        .map((item) => `${item.name} (${item.country})`)
        .join(' → '),
      '',
      ...trip.days.flatMap((stops, index) => [
        `DAY ${index + 1} · ${formatDate(dateAt(trip.startDate, index))}`,
        ...stops.map(
          (stop) =>
            `${stop.time} ${stopDetails(stop).name}${stop.note ? ` — ${stop.note}` : ''}`,
        ),
        '',
      ]),
    ].join('\n')
  }
  return (
    <div className="modal-body backup-panel">
      <h3>내 여행을 기기 밖에도 보관하세요</h3>
      <p className="workspace-hint">
        여행 경로·일정·메모·예약·준비물·경비를 함께 백업해요. 저장한 여행지
        목록은 포함되지 않아요. 예약 번호가 들어 있으므로 본인이 관리하는 곳에
        보관하세요.
      </p>
      <p className="workspace-hint">
        첨부 파일은 기기에 저장되며 이 일정 JSON 백업에는 포함되지 않습니다.
      </p>
      <div className="backup-actions">
        <button
          disabled={!trips.length}
          className="button primary"
          onClick={() => void copy(backup())}
        >
          <Copy size={17} />
          전체 여행 백업 복사
        </button>
        <button
          disabled={!trips.length}
          className="button outline"
          onClick={() => {
            const text = backup()
            setExportText(text)
            download(text, 'jdo-trips-backup.json')
            setMessage('다운로드가 지원되지 않으면 백업 복사를 이용하세요.')
          }}
        >
          <Download size={17} />
          백업 파일 저장
        </button>
      </div>
      {activeTrip && (
        <button
          className="text-button"
          onClick={() => void copy(itineraryText(activeTrip))}
        >
          현재 여행 일정 텍스트 복사 <Copy size={15} />
        </button>
      )}
      {exportText && (
        <label className="field backup-export">
          내보낼 내용
          <textarea
            readOnly
            aria-label="내보낸 여행 내용"
            value={exportText}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
      <hr />
      <h3>여행 백업 가져오기</h3>
      <label className="field file-field">
        <Upload size={17} />
        백업 파일 선택
        <input
          aria-label="여행 백업 파일"
          type="file"
          accept=".json,application/json"
          onChange={(event) => void file(event)}
        />
      </label>
      <label className="field">
        백업 내용 붙여넣기
        <textarea
          value={input}
          maxLength={5 * 1024 * 1024}
          onChange={(event) => {
            setInput(event.target.value)
            setPreview(null)
            setError('')
          }}
          placeholder="복사해 둔 J★Do 여행 백업을 붙여넣으세요"
        />
      </label>
      <button
        className="button outline"
        disabled={!input.trim()}
        onClick={() => inspect(input)}
      >
        백업 내용 확인
      </button>
      {preview && (
        <div className="restore-preview">
          <strong>{preview.length}개 여행을 확인했어요</strong>
          <ul>
            {preview.slice(0, 10).map((trip, index) => (
              <li key={index}>
                {trip.title} · {trip.days.length}일
              </li>
            ))}
          </ul>
          <p>기존 여행은 유지하고 복사본으로 추가해요.</p>
          <button
            className="button primary"
            disabled={trips.length + preview.length > 500}
            onClick={() => {
              onRestore(
                preview.map((trip) => ({ ...trip, id: crypto.randomUUID() })),
              )
              setPreview(null)
              setInput('')
              setMessage('여행 복사본을 가져왔어요.')
            }}
          >
            여행 복사본 가져오기
          </button>
          {trips.length + preview.length > 500 && (
            <p role="alert">여행은 최대 500개까지 보관할 수 있어요.</p>
          )}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="workspace-hint">
          {message}
        </p>
      )}
    </div>
  )
}
