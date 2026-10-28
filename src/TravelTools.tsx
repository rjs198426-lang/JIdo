import { useDraftFields } from './form-draft'
import AttachmentsPanel from './AttachmentsPanel'
import {
  reservationNote,
  reservationPlaceKind,
  syncReservation,
} from './finance'
import { useState, type FormEvent } from 'react'
import { Check, Plus, Trash2, Pencil, ExternalLink, Ticket } from 'lucide-react'
import {
  currencies,
  currencyStep,
  destinationForDay,
  reservationSchema,
  money,
  type Trip,
  type Reservation,
} from './travel-model'
import { formatDate, dayCount, dateAt } from './store'

type Props = {
  trip: Trip
  onUpdate: (trip: Trip) => boolean | void
  day?: number
}
export { default as Checklist } from './PreparationChecklist'

export { default as Expenses } from './ExpenseManager'

export function Reservations({ trip, onUpdate, day = 0 }: Props) {
  const items = trip.reservations || []
  const blank = (): Reservation => ({
    id: crypto.randomUUID(),
    title: '',
    kind: '숙소',
    date: dateAt(trip.startDate, day),
    endDate: dateAt(trip.startDate, day + 1),
    time: '15:00',
    reference: '',
    address: '',
    link: '',
    note: '',
    status: 'pending',
  })
  const draft = useDraftFields(
    `jido-draft:reservation:${trip.id}`,
    { form: null as Reservation | null },
    {
      form: (value) => {
        if (value === null) return true
        if (!value || typeof value !== 'object') return false
        const item = value as Reservation
        return (
          [
            'id',
            'title',
            'date',
            'time',
            'reference',
            'address',
            'link',
            'note',
          ].every(
            (key) =>
              typeof item[key as keyof Reservation] === 'string' &&
              String(item[key as keyof Reservation]).length <= 2000,
          ) &&
          ['항공', '숙소', '교통', '체험', '기타'].includes(item.kind) &&
          (!item.status ||
            ['pending', 'confirmed', 'cancelled'].includes(item.status)) &&
          (item.cost === undefined ||
            (typeof item.cost === 'number' && Number.isFinite(item.cost))) &&
          (item.currency === undefined || currencies.includes(item.currency)) &&
          (item.endDate === undefined || typeof item.endDate === 'string')
        )
      },
    },
  )
  const [form, setForm] = draft.field('form')
  const [error, setError] = useState('')
  const [removed, setRemoved] = useState<Reservation | null>(null)
  const [filter, setFilter] = useState('전체')
  const [message, setMessage] = useState('')
  const set = (key: keyof Reservation, value: string | undefined) =>
    setForm((form) => (form ? { ...form, [key]: value } : null))
  function save(event: FormEvent) {
    event.preventDefault()
    if (form?.kind === '숙소' && (!form.endDate || form.endDate <= form.date))
      return setError('체크아웃 날짜는 체크인 다음 날 이후로 선택하세요.')
    const parsed = reservationSchema.safeParse({
      ...form,
      currency: form?.cost !== undefined ? form.currency || 'KRW' : undefined,
    })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    if (
      onUpdate(
        syncReservation(
          trip,
          items.find((item) => item.id === parsed.data.id),
          parsed.data,
        ),
      ) === false
    )
      return
    setForm(null)
    setError('')
  }
  return (
    <section className="workspace-panel">
      <div className="tool-heading">
        <div>
          <h3>예약 정보를 한곳에</h3>
        </div>
        <Ticket size={26} />
      </div>
      <button
        className="button primary"
        onClick={() => {
          setForm(blank())
          setError('')
        }}
      >
        <Plus size={17} />
        예약 정보 추가
      </button>
      <div className="tool-filters">
        <select
          aria-label="예약 상태 필터"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {['전체', '확인 필요', '확정', '취소'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <span>
          {items.filter((item) => item.status !== 'cancelled').length}건 · 확인
          필요{' '}
          {
            items.filter((item) => !item.status || item.status === 'pending')
              .length
          }
          건
        </span>
      </div>
      {message && <p role="status">{message}</p>}
      {form && (
        <form className="inline-form" onSubmit={save}>
          <label className="field">
            예약 이름
            <input
              required
              maxLength={160}
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="예: 파리 3박 숙소"
            />
          </label>
          <div className="form-row">
            <label className="field">
              예약 유형
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm({
                    ...form,
                    kind: event.target.value as Reservation['kind'],
                    endDate:
                      event.target.value === '숙소' && form.date
                        ? dateAt(form.date, 1)
                        : undefined,
                  })
                }
              >
                {['항공', '숙소', '교통', '체험', '기타'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field">
              예약 번호
              <input
                maxLength={200}
                value={form.reference}
                onChange={(event) => set('reference', event.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              이용 날짜
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) => {
                  const date = event.target.value
                  setForm({
                    ...form,
                    date,
                    endDate:
                      form.kind === '숙소' &&
                      date &&
                      (!form.endDate || form.endDate <= date)
                        ? dateAt(date, 1)
                        : form.endDate,
                  })
                }}
              />
            </label>
            <label className="field">
              이용 시간
              <input
                required
                type="time"
                value={form.time}
                onChange={(event) => set('time', event.target.value)}
              />
            </label>
          </div>
          <label className="field">
            {form.kind === '숙소' ? '체크아웃 날짜' : '이용 종료일'}
            <input
              type="date"
              required={form.kind === '숙소'}
              min={
                form.kind === '숙소' && form.date
                  ? dateAt(form.date, 1)
                  : form.date
              }
              value={form.endDate || ''}
              onChange={(event) =>
                set('endDate', event.target.value || undefined)
              }
            />
          </label>
          <label className="field">
            예약 상태
            <select
              value={form.status || 'pending'}
              onChange={(event) => set('status', event.target.value)}
            >
              <option value="pending">확인 필요</option>
              <option value="confirmed">확정</option>
              <option value="cancelled">취소</option>
            </select>
          </label>
          <details className="reservation-cost-fields">
            <summary>비용·결제일</summary>
            <div className="form-row">
              <label className="field">
                예약 비용
                <input
                  type="number"
                  min={currencyStep(form.currency || 'KRW')}
                  max={1e9}
                  step={currencyStep(form.currency || 'KRW')}
                  value={form.cost ?? ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      cost: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    })
                  }
                />
              </label>
              <label className="field">
                예약 비용 통화
                <select
                  value={form.currency || 'KRW'}
                  onChange={(event) => set('currency', event.target.value)}
                >
                  {currencies.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                결제일 · 미입력 시 이용일
                <input
                  type="date"
                  value={form.paymentDate || ''}
                  onChange={(event) =>
                    set('paymentDate', event.target.value || undefined)
                  }
                />
              </label>
            </div>
          </details>
          <label className="field">
            예약 장소·주소
            <input
              maxLength={500}
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
            />
          </label>
          <label className="field">
            예약 확인 링크
            <input
              type="url"
              maxLength={1500}
              value={form.link}
              onChange={(event) => set('link', event.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="field">
            예약 메모
            <textarea
              maxLength={2000}
              value={form.note}
              onChange={(event) => set('note', event.target.value)}
              placeholder="체크인 방법, 수하물 규정, 취소 기한"
            />
          </label>
          <AttachmentsPanel reservationId={form.id} />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-row">
            <button
              className="button outline"
              type="button"
              onClick={() => setForm(null)}
            >
              취소
            </button>
            <button className="button primary" type="submit">
              예약 정보 저장
            </button>
          </div>
        </form>
      )}
      {!items.length && !form && (
        <div className="workspace-empty">
          <Ticket size={32} />
          <p>
            공항에서 예약 번호를 찾느라 헤매지 않도록
            <br />
            여기에 미리 모아두세요.
          </p>
        </div>
      )}
      <div className="reservation-list">
        {[...items]
          .filter(
            (item) =>
              filter === '전체' ||
              (filter === '확인 필요' &&
                (!item.status || item.status === 'pending')) ||
              (filter === '확정' && item.status === 'confirmed') ||
              (filter === '취소' && item.status === 'cancelled'),
          )
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
          .map((item) => (
            <article key={item.id} data-reservation-id={item.id} tabIndex={-1}>
              <div className="reservation-date">
                <span>{item.kind}</span>
                <strong>{formatDate(item.date)}</strong>
                <span>{item.time}</span>
              </div>
              <div className="reservation-copy">
                <h4>{item.title}</h4>
                <AttachmentsPanel reservationId={item.id} />
                <select
                  className="reservation-status"
                  aria-label={`${item.title} 예약 상태`}
                  value={item.status || 'pending'}
                  onChange={(event) =>
                    onUpdate(
                      syncReservation(trip, item, {
                        ...item,
                        status: event.target.value as Reservation['status'],
                      }),
                    )
                  }
                >
                  <option value="pending">확인 필요</option>
                  <option value="confirmed">확정</option>
                  <option value="cancelled">취소</option>
                </select>
                {item.endDate && <p>이용 종료 {formatDate(item.endDate)}</p>}
                {item.cost !== undefined && item.currency && (
                  <p className="reservation-cost">
                    예약 비용 {money(item.cost, item.currency)}
                  </p>
                )}
                {item.reference && (
                  <p>
                    예약 번호 <strong>{item.reference}</strong>
                  </p>
                )}
                {item.address && <p>{item.address}</p>}
                {item.note && <p className="reservation-note">{item.note}</p>}
                {item.link && (
                  <a target="_blank" rel="noopener noreferrer" href={item.link}>
                    예약 확인 <ExternalLink size={14} />
                  </a>
                )}
                {item.reference && (
                  <button
                    className="text-button"
                    aria-label={`${item.title} 예약 번호 복사`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(item.reference)
                        setMessage('예약 번호를 복사했어요.')
                      } catch {
                        setMessage(`예약 번호: ${item.reference}`)
                      }
                    }}
                  >
                    예약 번호 복사
                  </button>
                )}
                {item.cost !== undefined && item.currency && (
                  <button
                    className="text-button"
                    aria-label={`${item.title} 지출로 기록`}
                    disabled={(trip.expenses || []).some(
                      (expense) => expense.reservationId === item.id,
                    )}
                    onClick={() => {
                      if (
                        (trip.expenses || []).some(
                          (expense) => expense.reservationId === item.id,
                        )
                      )
                        return
                      if (
                        onUpdate({
                          ...trip,
                          expenses: [
                            ...(trip.expenses || []),
                            {
                              id: crypto.randomUUID(),
                              title: item.title,
                              amount: item.cost!,
                              currency: item.currency!,
                              date: item.paymentDate || item.date,
                              category:
                                item.kind === '숙소'
                                  ? '숙박'
                                  : item.kind === '항공' || item.kind === '교통'
                                    ? '교통'
                                    : item.kind === '체험'
                                      ? '관광'
                                      : '기타',
                              payer: '',
                              reservationId: item.id,
                              direction: 'expense',
                            },
                          ],
                        }) === false
                      )
                        return
                      setMessage('가계부에 예약 비용을 기록했어요.')
                    }}
                  >
                    지출로 기록
                  </button>
                )}
                <details className="reservation-schedule-setting simple-options">
                  <summary>일정에 반영 설정</summary>{' '}
                  <button
                    className="text-button reservation-to-stop"
                    aria-label={`${item.title} 일정에 복사`}
                    disabled={
                      item.status === 'cancelled' ||
                      item.date < trip.startDate ||
                      item.date > trip.endDate ||
                      trip.days
                        .flat()
                        .some((stop) => stop.reservationId === item.id)
                    }
                    onClick={() => {
                      const day = dayCount(trip.startDate, item.date) - 1
                      if (
                        !trip.days[day] ||
                        trip.days
                          .flat()
                          .some((stop) => stop.reservationId === item.id)
                      )
                        return
                      if (
                        onUpdate({
                          ...trip,
                          days: trip.days.map((stops, index) =>
                            index === day
                              ? [
                                  ...stops,
                                  {
                                    id: crypto.randomUUID(),
                                    placeId: `custom-${crypto.randomUUID()}`,
                                    reservationId: item.id,
                                    time: item.time,
                                    note: reservationNote(item),
                                    custom: {
                                      name: item.title,
                                      kind: reservationPlaceKind(item.kind),
                                      address: item.address,
                                      link: item.link,
                                      destinationId: destinationForDay(
                                        trip,
                                        day,
                                      ).id,
                                    },
                                  },
                                ]
                              : stops,
                          ),
                        }) === false
                      )
                        return
                    }}
                  >
                    {trip.days
                      .flat()
                      .some((stop) => stop.reservationId === item.id)
                      ? '일정에 반영됨'
                      : item.date < trip.startDate || item.date > trip.endDate
                        ? '여행 기간 밖의 예약'
                        : '이 날짜의 일정에 반영'}{' '}
                    <Plus size={14} />
                  </button>
                </details>
              </div>
              <div className="row-actions">
                <button
                  className="icon-button"
                  aria-label={`${item.title} 예약 수정`}
                  onClick={() => {
                    setForm(item)
                    setError('')
                  }}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${item.title} 예약 삭제`}
                  onClick={() => {
                    setRemoved(item)
                    if (
                      onUpdate({
                        ...trip,
                        reservations: items.filter(
                          (current) => current.id !== item.id,
                        ),
                      }) === false
                    )
                      return
                    if (form?.id === item.id) setForm(null)
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
      </div>
      {removed && (
        <div className="undo-strip" role="status">
          예약 정보를 삭제했어요.
          <button
            onClick={() => {
              if (
                onUpdate({ ...trip, reservations: [...items, removed] }) ===
                false
              )
                return
              setRemoved(null)
            }}
          >
            실행 취소
          </button>
        </div>
      )}
    </section>
  )
}
