import { useState, type FormEvent } from 'react'
import { useDraftFields } from './form-draft'
import { settlements } from './finance'
import {
  currencies,
  currencyStep,
  money,
  tripSchema,
  type Currency,
  type SettlementPayment,
  type Trip,
} from './travel-model'
import { formatDate, today } from './store'
import TravelMembers from './TravelMembers'
export default function SettlementPanel({
  trip,
  onUpdate,
}: {
  trip: Trip
  onUpdate: (trip: Trip) => boolean | void
}) {
  const members = trip.members || [],
    result = settlements(trip)
  const draft = useDraftFields(`jido-draft:settlement:${trip.id}`, {
    open: false,
    from: '',
    to: '',
    amount: '',
    currency: trip.baseCurrency || ('KRW' as Currency),
    date: today(),
    note: '',
  })
  const [open, setOpen] = draft.field('open'),
    [from, setFrom] = draft.field('from'),
    [to, setTo] = draft.field('to'),
    [amount, setAmount] = draft.field('amount'),
    [currency, setCurrency] = draft.field('currency'),
    [date, setDate] = draft.field('date'),
    [note, setNote] = draft.field('note')
  const [error, setError] = useState(''),
    [removed, setRemoved] = useState<SettlementPayment | null>(null),
    [message, setMessage] = useState('')
  const name = (id: string) =>
    members.find((person) => person.id === id)?.name || '동행인'
  function start(value?: {
    from: string
    to: string
    amount: number
    currency: Currency
  }) {
    if (open) {
      setMessage('작성 중인 송금 기록을 저장하거나 취소한 뒤 새로 기록하세요.')
      return
    }
    setFrom(value?.from || members[0]?.id || '')
    setTo(value?.to || members[1]?.id || '')
    setAmount(value ? String(value.amount) : '')
    setCurrency(value?.currency || trip.baseCurrency || 'KRW')
    setDate(today())
    setNote('')
    setError('')
    setMessage('')
    setOpen(true)
  }
  function save(event: FormEvent) {
    event.preventDefault()
    const payment: SettlementPayment = {
      id: crypto.randomUUID(),
      from,
      to,
      amount: Number(amount),
      currency,
      date,
      note: note.trim(),
    }
    const next = {
      ...trip,
      settlementPayments: [...(trip.settlementPayments || []), payment],
    }
    if (!tripSchema.safeParse(next).success)
      return setError(
        '서로 다른 동행인과 통화에 맞는 송금 금액·날짜를 확인하세요.',
      )
    try {
      if (onUpdate(next) === false) return
      draft.clear()
      setMessage('송금 기록을 저장했어요. 남은 정산 금액을 갱신했습니다.')
      setError('')
    } catch {
      setError('저장하지 못했어요. 기기 저장 공간을 확인해 주세요.')
    }
  }
  return (
    <div className="settlement-view">
      <TravelMembers trip={trip} onUpdate={onUpdate} />
      <div className="tool-heading">
        <h4>동행인 간 정산</h4>
        <button
          className="button outline small"
          disabled={members.length < 2}
          onClick={() => start()}
        >
          송금 기록 추가
        </button>
      </div>
      <p className="workspace-hint">
        실제로 주고받은 돈을 기록하면 남은 정산에서 차감돼요. 여행 지출 합계에는
        더하지 않습니다.
      </p>
      {open && (
        <form
          className="inline-form settlement-form"
          onSubmit={save}
          aria-label="송금 기록"
        >
          <div className="form-row">
            <label className="field">
              송금한 사람
              <select
                aria-label="송금한 사람"
                required
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              >
                {members.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              송금 받은 사람
              <select
                aria-label="송금 받은 사람"
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
              >
                {members.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              송금 금액
              <input
                required
                type="number"
                inputMode="decimal"
                min={currencyStep(currency)}
                max={1e9}
                step={currencyStep(currency)}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="field">
              송금 통화
              <select
                aria-label="송금 통화"
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value as Currency)
                }
              >
                {currencies.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            송금 날짜
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="field">
            송금 메모
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <p className="workspace-hint">
            이 버튼은 실제 송금을 실행하지 않습니다. 받은 사람·통화·금액을
            확인한 뒤 저장하세요.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-row">
            <button
              type="button"
              className="button outline"
              onClick={() => {
                draft.clear()
                setError('')
              }}
            >
              송금 기록 취소
            </button>
            <button className="button primary" type="submit">
              송금 기록 저장
            </button>
          </div>
        </form>
      )}
      {!result.groups.length && (
        <p className="workspace-empty">
          지출에서 결제자와 공동 분담을 지정하세요.
        </p>
      )}
      {result.groups.map((group) => (
        <section className="settlement-group" key={group.currency}>
          <h4>{group.currency} · 남은 정산</h4>
          {group.transfers.length ? (
            group.transfers.map((transfer) => (
              <div
                className="settlement-transfer"
                key={`${transfer.from}:${transfer.to}`}
              >
                <span>
                  {name(transfer.from)} → {name(transfer.to)}
                </span>
                <strong>{money(transfer.amount, group.currency)}</strong>
                <button
                  className="button outline small"
                  aria-label={`${name(transfer.from)}에서 ${name(transfer.to)} ${group.currency} 송금 기록`}
                  onClick={() =>
                    start({ ...transfer, currency: group.currency })
                  }
                >
                  송금 기록
                </button>
              </div>
            ))
          ) : (
            <p>서로 주고받을 금액이 없어요.</p>
          )}
          <details className="settlement-balances">
            <summary>사람별 남은 금액</summary>
            {group.balances.map((person) => (
              <div key={person.memberId}>
                <span>{name(person.memberId)}</span>
                <strong>
                  {person.amount > 0
                    ? '받을 돈'
                    : person.amount < 0
                      ? '보낼 돈'
                      : '정산 완료'}{' '}
                  {money(Math.abs(person.amount), group.currency)}
                </strong>
              </div>
            ))}
          </details>
        </section>
      ))}
      {result.excluded > 0 && (
        <p className="workspace-hint">
          개인 경비·분담 미지정 {result.excluded}건은 정산에서 제외됩니다.
        </p>
      )}
      {!!trip.settlementPayments?.length && (
        <section className="settlement-history" aria-label="송금 기록 내역">
          <h4>송금 기록 내역</h4>
          {[...trip.settlementPayments]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((item) => (
              <article key={item.id}>
                <div>
                  <small>{formatDate(item.date)}</small>
                  <strong>
                    {name(item.from)} → {name(item.to)} ·{' '}
                    {money(item.amount, item.currency)}
                  </strong>
                  {item.note && <p>{item.note}</p>}
                </div>
                <button
                  className="text-button"
                  aria-label={`${name(item.from)}에서 ${name(item.to)} ${item.currency} 송금 기록 삭제`}
                  onClick={() => {
                    if (
                      onUpdate({
                        ...trip,
                        settlementPayments: trip.settlementPayments?.filter(
                          (payment) => payment.id !== item.id,
                        ),
                      }) === false
                    )
                      return
                    setRemoved(item)
                    setMessage('')
                  }}
                >
                  기록 삭제
                </button>
              </article>
            ))}
        </section>
      )}
      {removed && (
        <div className="undo-strip" role="status">
          송금 기록을 삭제했어요.
          <button
            onClick={() => {
              if (
                onUpdate({
                  ...trip,
                  settlementPayments: [
                    ...(trip.settlementPayments || []),
                    removed,
                  ],
                }) === false
              )
                return
              setRemoved(null)
            }}
          >
            송금 기록 삭제 취소
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  )
}
