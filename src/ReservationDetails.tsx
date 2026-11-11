import type { Reservation } from './travel-model'
import { formatDate } from './store'
export default function ReservationDetails({ item }: { item: Reservation }) {
  const flight = item.kind === '항공' ? item.flight : undefined,
    stay = item.kind === '숙소' ? item.stay : undefined
  return (
    <div className="reservation-details">
      {flight && (
        <>
          <p className="flight-route">
            <strong>{flight.departureAirport || '출발 공항 미입력'}</strong>
            <span aria-hidden="true">→</span>
            <strong>{flight.arrivalAirport || '도착 공항 미입력'}</strong>
          </p>
          {(flight.airline || flight.number) && (
            <p>{[flight.airline, flight.number].filter(Boolean).join(' · ')}</p>
          )}
          <div className="flight-times">
            <p>
              <span>출발</span>
              <strong>
                {formatDate(item.date)} {item.time || '시간 미정'}
              </strong>
              <small>{flight.departureTimeZone || '시간대 미설정'}</small>
            </p>
            <p>
              <span>도착</span>
              <strong>
                {flight.arrivalDate
                  ? formatDate(flight.arrivalDate)
                  : '날짜 미정'}{' '}
                {flight.arrivalTime || '시간 미정'}
              </strong>
              <small>{flight.arrivalTimeZone || '시간대 미설정'}</small>
            </p>
          </div>
          {flight.terminal && <p>터미널 {flight.terminal}</p>}
          {flight.gate && <p>게이트 {flight.gate}</p>}
          {flight.seat && <p>좌석 {flight.seat}</p>}
          {flight.baggage && <p>수하물 {flight.baggage}</p>}
        </>
      )}
      {stay && (
        <>
          {stay.checkoutTime && <p>체크아웃 시간 {stay.checkoutTime}</p>}
          {stay.contact && <p>숙소 연락처 {stay.contact}</p>}
          {stay.room && <p>객실 {stay.room}</p>}
          {stay.guestName && <p>투숙자 {stay.guestName}</p>}
        </>
      )}
    </div>
  )
}
export function ReservationDetailsFields({
  value,
  onChange,
}: {
  value: Reservation
  onChange: (value: Reservation) => void
}) {
  const fields =
    value.kind === '항공'
      ? [
          ['airline', '항공사', 'text', 100],
          ['number', '편명', 'text', 50],
          ['departureAirport', '출발 공항', 'text', 160],
          ['arrivalAirport', '도착 공항', 'text', 160],
          ['arrivalDate', '도착 날짜', 'date', 10],
          ['arrivalTime', '도착 시간', 'time', 5],
          ['departureTimeZone', '출발 공항 시간대', 'text', 80],
          ['arrivalTimeZone', '도착 공항 시간대', 'text', 80],
          ['terminal', '출발 터미널', 'text', 100],
          ['gate', '탑승 게이트', 'text', 50],
          ['seat', '좌석', 'text', 50],
          ['baggage', '위탁·기내 수하물', 'text', 300],
        ]
      : value.kind === '숙소'
        ? [
            ['checkoutTime', '체크아웃 시간', 'time', 5],
            ['contact', '숙소 연락처', 'text', 200],
            ['room', '객실 유형', 'text', 200],
            ['guestName', '투숙자 이름', 'text', 100],
          ]
        : []
  const key = value.kind === '항공' ? 'flight' : 'stay',
    data = value[key] || {}
  if (!fields.length) return null
  const primary =
    value.kind === '항공'
      ? [
          'airline',
          'number',
          'departureAirport',
          'arrivalAirport',
          'arrivalDate',
          'arrivalTime',
        ]
      : ['checkoutTime', 'contact']
  const renderFields = (all: typeof fields) => (
    <div className="reservation-specific-grid">
      {all.map(([field, label, type, max]) => (
        <label className="field" key={field}>
          {label}
          <input
            type={String(type)}
            maxLength={Number(max)}
            value={String((data as Record<string, unknown>)[field] || '')}
            list={
              String(field).includes('TimeZone')
                ? 'reservation-time-zones'
                : undefined
            }
            placeholder={
              String(field).includes('TimeZone') ? '예: Asia/Seoul' : undefined
            }
            onChange={(event) =>
              onChange({
                ...value,
                [key]: { ...data, [field]: event.target.value || undefined },
              })
            }
          />
        </label>
      ))}
    </div>
  )
  return (
    <section className="reservation-specific-fields">
      <h4>{value.kind === '항공' ? '항공편 정보' : '호텔 정보'}</h4>
      {value.kind === '항공' && (
        <p className="muted">
          출발·도착은 각 공항의 현지 날짜와 시간으로 입력해 주세요. 시간대는
          아래 상세 정보에서 선택해요.
        </p>
      )}
      {renderFields(
        fields.filter(([field]) => primary.includes(String(field))),
      )}
      <details className="simple-options">
        <summary>
          {value.kind === '항공' ? '시간대·좌석·수하물' : '객실·투숙자'}{' '}
          <span>선택</span>
        </summary>
        {renderFields(
          fields.filter(([field]) => !primary.includes(String(field))),
        )}
      </details>
      <datalist id="reservation-time-zones">
        {[
          'Asia/Seoul',
          'Asia/Tokyo',
          'Asia/Bangkok',
          'Asia/Singapore',
          'Pacific/Guam',
          'Pacific/Saipan',
          'Europe/Paris',
          'Europe/London',
          'America/New_York',
          'America/Los_Angeles',
          'Pacific/Honolulu',
          'Australia/Sydney',
        ].map((zone) => (
          <option key={zone}>{zone}</option>
        ))}
      </datalist>
    </section>
  )
}
