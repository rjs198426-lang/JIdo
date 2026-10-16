import { ChevronRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDraftFields } from './form-draft'
import { dateAt, formatDate } from './store'
import {
  currencies,
  currencyStep,
  expenseSchema,
  tripSchema,
  stopDetails,
  type Currency,
  type Expense,
  type Trip,
} from './travel-model'
import { expenseCategoryOptions, splitEvenly } from './finance'
import {
  expenseCategoryFor,
  expensePreferences,
  rememberExpense,
} from './expense-context'

export default function QuickExpense({
  trip,
  day,
  stopId,
  onSave,
  onClose,
}: {
  trip: Trip
  day: number
  stopId?: string
  onSave: (expense: Expense) => void
  onClose: () => void
}) {
  const stop = trip.days[day]?.find((item) => item.id === stopId),
    members = trip.members || [],
    preference = expensePreferences(trip, day)
  const draft = useDraftFields(
    `jido-draft:quick-expense:${trip.id}:${day}:${stopId || 'general'}`,
    {
      amount: '',
      currency: preference.currency,
      payerId: preference.payerId,
      payer: trip.travelers === 1 ? '나' : '',
      title: stop ? stopDetails(stop).name : '지출',
      date: dateAt(trip.startDate, day),
      category: expenseCategoryFor(stop),
      note: '',
      paymentMethod: '카드' as NonNullable<Expense['paymentMethod']>,
      direction: 'expense' as 'expense' | 'refund',
      splitMode: 'none',
      participants: members.map((member) => member.id),
      shares: {} as Record<string, string>,
    },
    {},
    (state) =>
      !!(
        state.amount.trim() ||
        state.note.trim() ||
        state.title !== (stop ? stopDetails(stop).name : '지출') ||
        state.date !== dateAt(trip.startDate, day) ||
        state.category !== expenseCategoryFor(stop) ||
        state.currency !== preference.currency ||
        state.payerId !== preference.payerId ||
        state.payer !== (trip.travelers === 1 ? '나' : '') ||
        state.paymentMethod !== '카드' ||
        state.direction !== 'expense' ||
        state.splitMode !== 'none' ||
        Object.keys(state.shares).length
      ),
  )
  const [amount, setAmount] = draft.field('amount'),
    [currency, setCurrency] = draft.field('currency'),
    [payerId, setPayerId] = draft.field('payerId'),
    [payer, setPayer] = draft.field('payer')
  const [title, setTitle] = draft.field('title'),
    [date, setDate] = draft.field('date'),
    [category, setCategory] = draft.field('category'),
    [note, setNote] = draft.field('note')
  const [paymentMethod, setPaymentMethod] = draft.field('paymentMethod'),
    [direction, setDirection] = draft.field('direction'),
    [splitMode, setSplitMode] = draft.field('splitMode'),
    [participants, setParticipants] = draft.field('participants'),
    [shares, setShares] = draft.field('shares')
  const [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  function save(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    if (splitMode !== 'none' && (!participants.length || !payerId))
      return setError('분담할 동행인과 결제자를 선택하세요.')
    const splits =
      splitMode === 'none'
        ? undefined
        : splitMode === 'even'
          ? splitEvenly(Number(amount), currency, participants)
          : participants.map((memberId) => ({
              memberId,
              amount: Number(shares[memberId] || 0),
            }))
    const parsed = expenseSchema.safeParse({
      id: crypto.randomUUID(),
      title: title.trim(),
      amount: Number(amount),
      currency,
      date,
      category,
      payer:
        members.find((member) => member.id === payerId)?.name || payer.trim(),
      payerId: payerId || undefined,
      paymentMethod,
      direction,
      splits,
      note,
      stopId: stop?.id,
      reservationId: stop?.reservationId,
    })
    if (!parsed.success)
      return setError('지출 이름·날짜·금액과 통화별 소수 자릿수를 확인하세요.')
    if (
      !tripSchema.safeParse({
        ...trip,
        expenses: [...(trip.expenses || []), parsed.data],
      }).success
    )
      return setError('분담 합계·결제자와 지출 한도를 확인하세요.')
    setSaving(true)
    try {
      onSave(parsed.data)
      rememberExpense(trip, parsed.data)
      draft.clear()
    } catch (reason) {
      setSaving(false)
      setError(
        reason instanceof Error && /[가-힣]/.test(reason.message)
          ? reason.message
          : '저장하지 못했어요. 기기 여유 공간을 확인하세요.',
      )
    }
  }
  return (
    <form
      className="modal-body quick-expense"
      onSubmit={save}
      onInvalidCapture={(event) => {
        const details = (event.target as HTMLElement).closest('details')
        if (details) details.open = true
      }}
    >
      <p className="quick-expense-context">
        {title} · {formatDate(date)}
      </p>
      <div className="quick-expense-core">
        <label className="field">
          금액
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
          통화
          <select
            aria-label="지출 통화"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
          >
            {currencies.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {members.length ? (
        <label className="field">
          결제한 사람
          <select
            aria-label="결제한 사람"
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="field">
          결제한 사람
          <input
            maxLength={80}
            value={payer}
            onChange={(event) => setPayer(event.target.value)}
            placeholder="선택 입력"
          />
        </label>
      )}
      <details className="quick-expense-details">
        <summary>
          상세 입력
          <ChevronRight size={16} aria-hidden="true" />
        </summary>
        <label className="field">
          지출 이름
          <input
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="field">
          지출 날짜
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="field">
          지출 분류
          <select
            aria-label="지출 분류"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as Expense['category'])
            }
          >
            {expenseCategoryOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label className="field">
            기록 유형
            <select
              aria-label="기록 유형"
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value as typeof direction)
              }
            >
              <option value="expense">지출</option>
              <option value="refund">환불</option>
            </select>
          </label>
          <label className="field">
            결제 수단
            <select
              aria-label="결제 수단"
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as typeof paymentMethod)
              }
            >
              {['카드', '현금', '기타'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        {members.length > 1 && (
          <label className="field">
            비용 분담
            <select
              aria-label="비용 분담"
              value={splitMode}
              onChange={(event) => setSplitMode(event.target.value)}
            >
              <option value="none">개인 경비 · 정산 제외</option>
              <option value="even">동행인 균등 분담</option>
              <option value="custom">동행인별 금액 지정</option>
            </select>
          </label>
        )}
        {splitMode !== 'none' && (
          <fieldset className="split-members">
            <legend>함께 부담할 사람</legend>
            {members.map((member) => (
              <div className="split-member" key={member.id}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`${member.name} 비용 분담`}
                    checked={participants.includes(member.id)}
                    onChange={(event) =>
                      setParticipants(
                        event.target.checked
                          ? [...participants, member.id]
                          : participants.filter((id) => id !== member.id),
                      )
                    }
                  />
                  {member.name}
                </label>
                {splitMode === 'custom' && participants.includes(member.id) && (
                  <input
                    aria-label={`${member.name} 부담 금액`}
                    type="number"
                    min={0}
                    step={currencyStep(currency)}
                    value={shares[member.id] || ''}
                    onChange={(event) =>
                      setShares({ ...shares, [member.id]: event.target.value })
                    }
                  />
                )}
              </div>
            ))}
          </fieldset>
        )}
        <label className="field">
          경비 메모
          <textarea
            maxLength={1000}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="quick-expense-actions">
        <button className="button outline" type="button" onClick={onClose}>
          닫기
        </button>
        <button className="button primary" type="submit" disabled={saving}>
          지출 저장
        </button>
      </div>
    </form>
  )
}
