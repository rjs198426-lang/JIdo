import AttachmentsPanel from './AttachmentsPanel'
import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Download, Copy } from 'lucide-react'
import {
  currencies,
  currencyStep,
  tripSchema,
  money,
  type Trip,
  type Currency,
  type Expense,
} from './travel-model'
import {
  convertedTotal,
  currencyTotals,
  expenseCategoryOptions,
  expensesCsv,
  netExpense,
  settlements,
  splitEvenly,
} from './finance'
import { formatDate } from './store'
import TravelMembers from './TravelMembers'

export type ExpenseDraft = {
  title: string
  date: string
  category: Expense['category']
  stopId?: string
  reservationId?: string
  token: string
}
type Props = {
  trip: Trip
  onUpdate: (trip: Trip) => void
  initialExpense?: ExpenseDraft
}
export default function ExpenseManager({
  trip,
  onUpdate,
  initialExpense,
}: Props) {
  const expenses = trip.expenses || [],
    members = trip.members || []
  const [view, setView] = useState('지출'),
    [editing, setEditing] = useState<string | null>(null),
    [open, setOpen] = useState(false)
  const [title, setTitle] = useState(''),
    [amount, setAmount] = useState(''),
    [currency, setCurrency] = useState<Currency>(trip.baseCurrency || 'KRW'),
    [date, setDate] = useState(trip.startDate),
    [category, setCategory] = useState<Expense['category']>('식비'),
    [payer, setPayer] = useState(''),
    [payerId, setPayerId] = useState(''),
    [direction, setDirection] = useState<'expense' | 'refund'>('expense'),
    [paymentMethod, setPaymentMethod] =
      useState<NonNullable<Expense['paymentMethod']>>('카드'),
    [note, setNote] = useState(''),
    [stopId, setStopId] = useState<string | undefined>(),
    [reservationId, setReservationId] = useState<string | undefined>()
  const [splitMode, setSplitMode] = useState('none'),
    [participants, setParticipants] = useState<string[]>([]),
    [shares, setShares] = useState<Record<string, string>>({})
  const [budgetCurrency, setBudgetCurrency] = useState<Currency>('KRW'),
    [budget, setBudget] = useState(''),
    [error, setError] = useState(''),
    [removed, setRemoved] = useState<Expense | null>(null)
  const [filterDate, setFilterDate] = useState(''),
    [filterCategory, setFilterCategory] = useState('전체'),
    [filterCurrency, setFilterCurrency] = useState('전체'),
    [filterQuery, setFilterQuery] = useState('')
  const [base, setBase] = useState<Currency>(trip.baseCurrency || 'KRW'),
    [totalBudget, setTotalBudget] = useState(
      trip.totalBudget === undefined ? '' : String(trip.totalBudget),
    ),
    [rateCurrency, setRateCurrency] = useState<Currency>(
      (trip.baseCurrency || 'KRW') === 'EUR' ? 'USD' : 'EUR',
    ),
    [rate, setRate] = useState(''),
    [csv, setCsv] = useState(''),
    [message, setMessage] = useState('')
  const conversion = convertedTotal(trip)
  const totals = currencyTotals(expenses)
  const usedCurrencies = [
    ...new Set<Currency>([
      ...totals.map((item) => item.currency),
      ...(Object.keys(trip.budgets || {}) as Currency[]),
    ]),
  ]
  const visible = expenses.filter(
    (item) =>
      (!filterDate || item.date === filterDate) &&
      (filterCategory === '전체' || item.category === filterCategory) &&
      (filterCurrency === '전체' || item.currency === filterCurrency) &&
      item.title
        .toLocaleLowerCase()
        .includes(filterQuery.trim().toLocaleLowerCase()),
  )
  const settlement = settlements(trip)
  function reset() {
    setEditing(null)
    setTitle('')
    setAmount('')
    setDate(trip.startDate)
    setPayer('')
    setPayerId(members[0]?.id || '')
    setDirection('expense')
    setPaymentMethod('카드')
    setNote('')
    setStopId(undefined)
    setReservationId(undefined)
    setSplitMode('none')
    setParticipants(members.map((member) => member.id))
    setShares({})
    setError('')
  }
  useEffect(() => {
    if (!initialExpense) return
    reset()
    setTitle(initialExpense.title)
    setDate(initialExpense.date)
    setCategory(initialExpense.category)
    setStopId(initialExpense.stopId)
    setReservationId(initialExpense.reservationId)
    setOpen(true)
    setView('지출')
  }, [initialExpense])
  function save(event: FormEvent) {
    event.preventDefault()
    const splits =
      splitMode === 'none'
        ? undefined
        : splitMode === 'even'
          ? splitEvenly(Number(amount), currency, participants)
          : participants.map((memberId) => ({
              memberId,
              amount: Number(shares[memberId] || 0),
            }))
    if (splitMode !== 'none' && (!participants.length || !payerId))
      return setError('공동 경비의 결제자와 분담할 동행인을 선택하세요.')
    const nextExpense: Expense = {
      id: editing || crypto.randomUUID(),
      title: title.trim(),
      amount: Number(amount),
      currency,
      date,
      category,
      payer:
        members.find((member) => member.id === payerId)?.name || payer.trim(),
      payerId: payerId || undefined,
      direction,
      paymentMethod,
      splits,
      note,
      stopId,
      reservationId,
    }
    const next = {
      ...trip,
      expenses: editing
        ? expenses.map((item) => (item.id === editing ? nextExpense : item))
        : [...expenses, nextExpense],
    }
    const parsed = tripSchema.safeParse(next)
    if (!parsed.success)
      return setError(
        splitMode === 'custom'
          ? '부담 금액 합계와 통화별 소수 자릿수를 확인하세요.'
          : '지출 이름·날짜·금액과 분담 항목을 확인하세요.',
      )
    onUpdate(next)
    reset()
    setOpen(false)
  }
  const splitPreview =
    splitMode === 'even'
      ? splitEvenly(Number(amount) || 0, currency, participants)
      : participants.map((memberId) => ({
          memberId,
          amount: Number(shares[memberId] || 0),
        }))
  async function copyCsv() {
    const text = expensesCsv(trip)
    setCsv(text)
    try {
      await navigator.clipboard.writeText(text)
      setMessage('경비 CSV를 복사했어요.')
    } catch {
      setMessage('아래 CSV 내용을 선택해 복사하세요.')
    }
  }
  return (
    <section className="workspace-panel expense-manager">
      <div className="tool-heading">
        <h3>{trip.travelers > 1 ? '경비·정산' : '내 경비'}</h3>
        <button
          className="button primary small"
          onClick={() => {
            reset()
            setView('지출')
            setOpen(view === '지출' ? !open : true)
          }}
        >
          <Plus size={17} />
          지출 추가
        </button>
      </div>
      <div className="money-overview">
        <div>
          <span>
            {conversion.missing.length ? '환율 입력 필요' : '총 순지출'}
          </span>
          <strong>
            {conversion.missing.length
              ? conversion.missing.join(' · ')
              : money(conversion.total, conversion.currency)}
          </strong>
          {conversion.missing.length > 0 && (
            <small>
              환산된 금액 {money(conversion.total, conversion.currency)}
            </small>
          )}
        </div>
        {trip.totalBudget !== undefined && (
          <div>
            <span>
              전체 예산 {money(trip.totalBudget, conversion.currency)}
            </span>
            <strong
              className={
                !conversion.missing.length &&
                conversion.total > trip.totalBudget
                  ? 'over-budget'
                  : ''
              }
            >
              {conversion.missing.length
                ? '환율 입력 후 비교'
                : `${conversion.total > trip.totalBudget ? '초과' : '남음'} ${money(Math.abs(trip.totalBudget - conversion.total), conversion.currency)}`}
            </strong>
          </div>
        )}
      </div>
      <details className="currency-breakdown">
        <summary>통화별 지출·예산</summary>
        <div className="expense-totals">
          {usedCurrencies.map((value) => {
            const spent =
                totals.find((item) => item.currency === value)?.total || 0,
              limit = trip.budgets?.[value]
            return (
              <article key={value}>
                <span>{value} 사용 금액</span>
                <strong>{money(spent, value)}</strong>
                {limit !== undefined && (
                  <>
                    <small className={spent > limit ? 'over-budget' : ''}>
                      {spent > limit ? '예산 초과' : '남은 예산'}{' '}
                      {money(Math.abs(limit - spent), value)}
                    </small>
                    <progress
                      value={Math.max(0, Math.min(spent, limit))}
                      max={limit || 1}
                      aria-label={`${value} 예산 사용률`}
                    />
                  </>
                )}
              </article>
            )
          })}
        </div>
      </details>
      <div className="inner-tabs" role="tablist" aria-label="가계부 보기">
        {(trip.travelers > 1 || expenses.some((item) => item.splits)
          ? ['지출', '통계', '정산']
          : ['지출', '통계']
        ).map((value) => (
          <button
            role="tab"
            aria-selected={view === value}
            key={value}
            onClick={() => setView(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {view === '지출' && (
        <>
          {open && (
            <form className="inline-form expense-form" onSubmit={save}>
              <div className="form-row">
                <label className="field">
                  기록 유형
                  <select
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
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value as typeof paymentMethod,
                      )
                    }
                  >
                    {['카드', '현금', '기타'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                지출 이름
                <input
                  required
                  maxLength={160}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="식사, 교통, 입장권 등"
                />
              </label>
              <div className="form-row">
                <label className="field">
                  금액
                  <input
                    required
                    type="number"
                    min={currencyStep(currency)}
                    max={1e9}
                    step={currencyStep(currency)}
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                <label className="field">
                  통화
                  <select
                    aria-label="지출 통화"
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
              <div className="form-row">
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
              </div>
              {(trip.travelers > 1 || !!editing) &&
                (members.length ? (
                  <>
                    <label className="field">
                      {direction === 'refund'
                        ? '환불 받은 사람'
                        : '결제한 사람'}
                      <select
                        value={payerId}
                        onChange={(event) => setPayerId(event.target.value)}
                      >
                        <option value="">직접 입력</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!payerId && (
                      <label className="field">
                        결제자 이름
                        <input
                          maxLength={80}
                          value={payer}
                          onChange={(event) => setPayer(event.target.value)}
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <label className="field">
                    결제한 사람
                    <input
                      maxLength={80}
                      value={payer}
                      onChange={(event) => setPayer(event.target.value)}
                      placeholder="동행인을 등록하면 정산할 수 있어요"
                    />
                  </label>
                ))}
              {(trip.travelers > 1 || splitMode !== 'none') && (
                <label className="field">
                  비용 분담
                  <select
                    value={splitMode}
                    onChange={(event) => setSplitMode(event.target.value)}
                  >
                    <option value="none">개인 경비 · 정산 제외</option>
                    <option value="even" disabled={!members.length}>
                      동행인 균등 분담
                    </option>
                    <option value="custom" disabled={!members.length}>
                      동행인별 금액 지정
                    </option>
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
                          aria-label={`${member.name} 비용 분담`}
                          type="checkbox"
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
                      {participants.includes(member.id) &&
                        (splitMode === 'custom' ? (
                          <input
                            aria-label={`${member.name} 부담 금액`}
                            type="number"
                            min="0"
                            max={1e9}
                            step={currencyStep(currency)}
                            value={shares[member.id] || ''}
                            onChange={(event) =>
                              setShares({
                                ...shares,
                                [member.id]: event.target.value,
                              })
                            }
                          />
                        ) : (
                          <span>
                            {money(
                              splitPreview.find(
                                (item) => item.memberId === member.id,
                              )?.amount || 0,
                              currency,
                            )}
                          </span>
                        ))}
                    </div>
                  ))}
                  <small>
                    분담 합계{' '}
                    {money(
                      splitPreview.reduce((sum, item) => sum + item.amount, 0),
                      currency,
                    )}
                  </small>
                </fieldset>
              )}
              <details>
                <summary>지출 메모</summary>
                <label className="field">
                  경비 메모
                  <textarea
                    maxLength={1000}
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
              <div className="form-row">
                <button
                  className="button outline"
                  type="button"
                  onClick={() => {
                    reset()
                    setOpen(false)
                  }}
                >
                  취소
                </button>
                <button className="button primary" type="submit">
                  {editing ? '지출 수정 저장' : '지출 저장'}
                </button>
              </div>
            </form>
          )}
          <div className="tool-filters">
            <input
              aria-label="지출 검색"
              placeholder="지출 검색"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
            />
            <input
              aria-label="지출 날짜 필터"
              type="date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
            />
            <select
              aria-label="지출 분류 필터"
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
            >
              {['전체', ...expenseCategoryOptions].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="지출 통화 필터"
              value={filterCurrency}
              onChange={(event) => setFilterCurrency(event.target.value)}
            >
              {['전체', ...currencies].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            {(filterDate ||
              filterQuery ||
              filterCategory !== '전체' ||
              filterCurrency !== '전체') && (
              <button
                className="text-button"
                onClick={() => {
                  setFilterDate('')
                  setFilterQuery('')
                  setFilterCategory('전체')
                  setFilterCurrency('전체')
                }}
              >
                필터 초기화
              </button>
            )}
          </div>
          <div className="expense-list">
            {[...visible]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((item) => (
                <article key={item.id}>
                  <div>
                    <small>
                      {formatDate(item.date)} · {item.category} ·{' '}
                      {item.direction === 'refund'
                        ? '환불'
                        : item.paymentMethod || '지출'}
                      {item.payer
                        ? ` · ${members.find((member) => member.id === item.payerId)?.name || item.payer} ${item.direction === 'refund' ? '환불 받음' : '결제'}`
                        : ''}
                    </small>
                    <h4>{item.title}</h4>
                    <strong
                      className={
                        item.direction === 'refund' ? 'refund-amount' : ''
                      }
                    >
                      {item.direction === 'refund' ? '−' : ''}
                      {money(item.amount, item.currency)}
                    </strong>
                    {item.splits && (
                      <small>공동 경비 · {item.splits.length}명 분담</small>
                    )}
                    {item.note && <p>{item.note}</p>}
                    <AttachmentsPanel expenseId={item.id} />
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`${item.title} 지출 수정`}
                      onClick={() => {
                        setEditing(item.id)
                        setTitle(item.title)
                        setAmount(String(item.amount))
                        setCurrency(item.currency)
                        setDate(item.date)
                        setCategory(item.category)
                        setPayer(item.payer)
                        setPayerId(item.payerId || '')
                        setDirection(item.direction || 'expense')
                        setPaymentMethod(item.paymentMethod || '카드')
                        setNote(item.note || '')
                        setStopId(item.stopId)
                        setReservationId(item.reservationId)
                        setSplitMode(item.splits ? 'custom' : 'none')
                        setParticipants(
                          item.splits?.map((split) => split.memberId) ||
                            members.map((member) => member.id),
                        )
                        setShares(
                          Object.fromEntries(
                            item.splits?.map((split) => [
                              split.memberId,
                              String(split.amount),
                            ]) || [],
                          ),
                        )
                        setError('')
                        setOpen(true)
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${item.title} 지출 삭제`}
                      onClick={() => {
                        setRemoved(item)
                        onUpdate({
                          ...trip,
                          expenses: expenses.filter(
                            (current) => current.id !== item.id,
                          ),
                        })
                        if (editing === item.id) {
                          reset()
                          setOpen(false)
                        }
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {!visible.length && (
            <p className="workspace-empty">
              {expenses.length
                ? '이 조건에 맞는 지출이 없어요.'
                : '첫 지출을 추가하세요.'}
            </p>
          )}
          {removed && (
            <div className="undo-strip" role="status">
              지출을 삭제했어요.
              <button
                onClick={() => {
                  onUpdate({ ...trip, expenses: [...expenses, removed] })
                  setRemoved(null)
                }}
              >
                실행 취소
              </button>
            </div>
          )}
        </>
      )}
      {view === '통계' && (
        <div className="expense-statistics">
          <div className="stat-cards">
            <article>
              <span>여행 {trip.days.length}일 기준 하루 평균</span>
              <strong>
                {conversion.missing.length
                  ? '환율 입력 필요'
                  : money(
                      conversion.total / trip.days.length,
                      conversion.currency,
                    )}
              </strong>
            </article>
            <article>
              <span>1인당 평균 · {trip.travelers}명</span>
              <strong>
                {conversion.missing.length
                  ? '환율 입력 필요'
                  : money(
                      conversion.total / trip.travelers,
                      conversion.currency,
                    )}
              </strong>
            </article>
          </div>
          <h4>분류별 순지출</h4>
          <div className="stat-list">
            {currencies.flatMap((value) =>
              expenseCategoryOptions.flatMap((cat) => {
                const items = expenses.filter(
                  (item) => item.currency === value && item.category === cat,
                )
                return items.length
                  ? [
                      <div key={value + cat}>
                        <span>
                          {cat} · {value}
                        </span>
                        <strong>
                          {money(
                            items.reduce(
                              (sum, item) => sum + netExpense(item),
                              0,
                            ),
                            value,
                          )}
                        </strong>
                      </div>,
                    ]
                  : []
              }),
            )}
          </div>
          <h4>날짜별 순지출</h4>
          <div className="stat-list">
            {[...new Set(expenses.map((item) => item.date))]
              .sort()
              .flatMap((day) =>
                currencyTotals(
                  expenses.filter((item) => item.date === day),
                ).map((item) => (
                  <div key={day + item.currency}>
                    <span>
                      {formatDate(day)} · {item.currency}
                    </span>
                    <strong>{money(item.total, item.currency)}</strong>
                  </div>
                )),
              )}
          </div>
          <div className="row-actions">
            <button
              className="button outline small"
              onClick={() => void copyCsv()}
            >
              <Copy size={16} />
              CSV 복사
            </button>
            <button
              className="button outline small"
              onClick={() => {
                const text = expensesCsv(trip)
                setCsv(text)
                const url = URL.createObjectURL(
                  new Blob([text], { type: 'text/csv;charset=utf-8' }),
                )
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = 'jdo-expenses.csv'
                anchor.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
            >
              <Download size={16} />
              CSV 저장
            </button>
          </div>
          {message && <p role="status">{message}</p>}
          {csv && (
            <label className="field">
              경비 CSV
              <textarea
                readOnly
                value={csv}
                onFocus={(event) => event.target.select()}
              />
            </label>
          )}
        </div>
      )}
      {view === '정산' && (
        <div className="settlement-view">
          <TravelMembers trip={trip} onUpdate={onUpdate} />
          <h4>동행인 간 정산</h4>
          {!settlement.groups.length && (
            <p className="workspace-empty">
              지출에서 결제자와 공동 분담을 지정하세요.
            </p>
          )}
          {settlement.groups.map((group) => (
            <section className="settlement-group" key={group.currency}>
              <h4>{group.currency}</h4>
              {group.transfers.length ? (
                group.transfers.map((transfer, index) => (
                  <div className="settlement-transfer" key={index}>
                    <span>
                      {
                        members.find((member) => member.id === transfer.from)
                          ?.name
                      }{' '}
                      →{' '}
                      {
                        members.find((member) => member.id === transfer.to)
                          ?.name
                      }
                    </span>
                    <strong>{money(transfer.amount, group.currency)}</strong>
                  </div>
                ))
              ) : (
                <p>서로 주고받을 금액이 없어요.</p>
              )}
            </section>
          ))}
          {settlement.excluded > 0 && (
            <p className="workspace-hint">
              개인 경비·분담 미지정 {settlement.excluded}건은 정산에서
              제외됩니다.
            </p>
          )}
          <p className="workspace-hint">
            정산 금액은 통화별로 표시합니다. 실제 송금은 직접 진행하세요.
          </p>
        </div>
      )}
      <details className="rate-settings">
        <summary>환율·전체 예산</summary>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            setError('')
            const rates =
              base === (trip.baseCurrency || 'KRW')
                ? { ...trip.exchangeRates }
                : {}
            if (rate.trim()) rates[rateCurrency] = Number(rate)
            const next = {
              ...trip,
              baseCurrency: base,
              totalBudget: totalBudget.trim() ? Number(totalBudget) : undefined,
              exchangeRates: rates,
            }
            const parsed = tripSchema.safeParse(next)
            if (!parsed.success)
              return setError(
                '환율은 0보다 크게, 예산은 통화에 맞는 금액으로 입력하세요.',
              )
            onUpdate(next)
            setRate('')
            setMessage('환율과 전체 예산을 저장했어요.')
          }}
        >
          <div className="form-row">
            <label className="field">
              기준 통화
              <select
                value={base}
                onChange={(event) => {
                  const value = event.target.value as Currency
                  setBase(value)
                  if (value === rateCurrency)
                    setRateCurrency(currencies.find((item) => item !== value)!)
                  setRate('')
                }}
              >
                {currencies.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field">
              전체 여행 예산
              <input
                type="number"
                min="0"
                max={1e12}
                step={currencyStep(base)}
                value={totalBudget}
                onChange={(event) => setTotalBudget(event.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              환율 통화
              <select
                value={rateCurrency}
                onChange={(event) => {
                  setRateCurrency(event.target.value as Currency)
                  setRate('')
                }}
              >
                {currencies
                  .filter((value) => value !== base)
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
            <label className="field">
              1 {rateCurrency}당 {base}
              <input
                aria-label="환율 값"
                type="number"
                min="0.00000001"
                max={1e8}
                step="any"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                placeholder="직접 확인한 환율"
              />
            </label>
          </div>
          {base !== (trip.baseCurrency || 'KRW') && (
            <p className="workspace-hint">
              기준 통화를 바꾸면 기존 환율을 지우고 새로 입력합니다.
            </p>
          )}
          <button className="button outline" type="submit">
            환율·전체 예산 저장
          </button>
          <div className="rate-list">
            {Object.entries(trip.exchangeRates || {}).map(
              ([value, exchange]) => (
                <span key={value}>
                  1 {value} = {exchange} {trip.baseCurrency || 'KRW'}
                  <button
                    type="button"
                    aria-label={`${value} 환율 삭제`}
                    onClick={() => {
                      const next = { ...trip.exchangeRates }
                      delete next[value as Currency]
                      onUpdate({ ...trip, exchangeRates: next })
                    }}
                  >
                    ×
                  </button>
                </span>
              ),
            )}
          </div>
        </form>
      </details>
      <details className="budget-settings">
        <summary>통화별 예산 설정</summary>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            const value = Number(budget)
            if (
              !budget.trim() ||
              !Number.isFinite(value) ||
              value < 0 ||
              value > 1e12 ||
              Math.abs(
                value / currencyStep(budgetCurrency) -
                  Math.round(value / currencyStep(budgetCurrency)),
              ) > 0.0001
            )
              return setError('통화에 맞는 예산 금액을 입력하세요.')
            onUpdate({
              ...trip,
              budgets: { ...trip.budgets, [budgetCurrency]: value },
            })
            setBudget('')
            setError('')
          }}
        >
          <div className="form-row">
            <label className="field">
              예산 통화
              <select
                value={budgetCurrency}
                onChange={(event) =>
                  setBudgetCurrency(event.target.value as Currency)
                }
              >
                {currencies.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field">
              예산 금액
              <input
                required
                type="number"
                min="0"
                max={1e12}
                step={currencyStep(budgetCurrency)}
                inputMode="decimal"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </label>
          </div>
          <button className="button outline small" type="submit">
            예산 저장
          </button>
        </form>
      </details>
      {error && !(view === '지출' && open) && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
