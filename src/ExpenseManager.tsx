import { expensePreferences, rememberExpense } from './expense-context'
import { useDraftFields } from './form-draft'
import AttachmentsPanel from './AttachmentsPanel'
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
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
  currencyTotals,
  expenseCategoryOptions,
  expensesCsv,
  splitEvenly,
} from './finance'
import { dateAt, formatDate } from './store'
import SettlementPanel from './SettlementPanel'
import ExpenseInsights from './ExpenseInsights'
import ExpenseSummary from './ExpenseSummary'
import { filterExpenses, expenseBreakdown } from './expense-insights'
import { saveExpenseCsv } from './expense-export'
import './expenses.css'

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
  day?: number
  focusExpenseId?: string
  onQuickAdd?: () => void
}
export default function ExpenseManager({
  trip,
  onUpdate,
  initialExpense,
  focusExpenseId,
  onQuickAdd,
  day = 0,
}: Props) {
  const expenses = trip.expenses || [],
    members = trip.members || []
  const draft = useDraftFields(`jido-draft:expense:${trip.id}`, {
    view: '지출',
    editing: null as string | null,
    open: false,
    title: '',
    amount: '',
    currency: expensePreferences(trip, day).currency,
    date: dateAt(trip.startDate, day),
    category: '식비' as Expense['category'],
    payer: '',
    payerId: '',
    direction: 'expense' as 'expense' | 'refund',
    paymentMethod: expensePreferences(trip, day).paymentMethod as
      NonNullable<Expense['paymentMethod']> | '',
    note: '',
    stopId: undefined as string | undefined,
    reservationId: undefined as string | undefined,
    splitMode: 'none',
    participants: [] as string[],
    shares: {} as Record<string, string>,
    appliedToken: '',
  })
  const [view, setView] = draft.field('view')
  const [editing, setEditing] = draft.field('editing')
  const [open, setOpen] = draft.field('open')
  const [title, setTitle] = draft.field('title')
  const [amount, setAmount] = draft.field('amount')
  const [currency, setCurrency] = draft.field('currency')
  const [date, setDate] = draft.field('date')
  const [category, setCategory] = draft.field('category')
  const [payer, setPayer] = draft.field('payer')
  const [payerId, setPayerId] = draft.field('payerId')
  const [direction, setDirection] = draft.field('direction')
  const [paymentMethod, setPaymentMethod] = draft.field('paymentMethod')
  const [note, setNote] = draft.field('note')
  const [stopId, setStopId] = draft.field('stopId')
  const [reservationId, setReservationId] = draft.field('reservationId')
  const [splitMode, setSplitMode] = draft.field('splitMode')
  const [participants, setParticipants] = draft.field('participants')
  const [shares, setShares] = draft.field('shares')
  const [appliedToken, setAppliedToken] = draft.field('appliedToken')
  const [budgetCurrency, setBudgetCurrency] = useState<Currency>('KRW'),
    [budget, setBudget] = useState(''),
    [error, setError] = useState(''),
    [removed, setRemoved] = useState<Expense | null>(null)
  const [filterDate, setFilterDate] = useState(''),
    [filterCategory, setFilterCategory] = useState('전체'),
    [filterCurrency, setFilterCurrency] = useState('전체'),
    [filterQuery, setFilterQuery] = useState('')
  const [filterPayment, setFilterPayment] = useState('전체'),
    [filterPayer, setFilterPayer] = useState('전체'),
    [filterDirection, setFilterDirection] = useState('전체'),
    [filtersOpen, setFiltersOpen] = useState(false)
  const expenseForm = useRef<HTMLFormElement>(null)
  function clearFilters() {
    setFilterDate('')
    setFilterCategory('전체')
    setFilterCurrency('전체')
    setFilterQuery('')
    setFilterPayment('전체')
    setFilterPayer('전체')
    setFilterDirection('전체')
  }
  function drillDown(change: {
    date?: string
    category?: string
    currency?: string
    payment?: string
  }) {
    clearFilters()
    setFilterDate(change.date || '')
    setFilterCategory(change.category || '전체')
    setFilterCurrency(change.currency || '전체')
    setFilterPayment(change.payment || '전체')
    setFiltersOpen(true)
    setView('지출')
  }
  useEffect(() => {
    if (open)
      expenseForm.current?.scrollIntoView({
        block: 'start',
        behavior: 'instant',
      })
  }, [open, editing])
  useEffect(() => {
    if (!focusExpenseId) return
    setView('지출')
    clearFilters()
    setFiltersOpen(false)
  }, [focusExpenseId])
  useEffect(() => {
    if (!focusExpenseId || view !== '지출') return
    const request = requestAnimationFrame(() => {
      const element = Array.from(
        document.querySelectorAll<HTMLElement>('[data-expense-id]'),
      ).find((item) => item.dataset.expenseId === focusExpenseId)
      element?.scrollIntoView({ block: 'center', behavior: 'instant' })
      element?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(request)
  }, [focusExpenseId, view])
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
  useEffect(
    () => setCsv(''),
    [
      filterDate,
      filterCategory,
      filterCurrency,
      filterQuery,
      filterPayment,
      filterPayer,
      filterDirection,
      view,
    ],
  )
  const totals = currencyTotals(expenses)
  const usedCurrencies = [
    ...new Set<Currency>([
      ...totals.map((item) => item.currency),
      ...(Object.keys(trip.budgets || {}) as Currency[]),
    ]),
  ]
  const filters = {
    date: filterDate,
    category: filterCategory,
    currency: filterCurrency,
    query: filterQuery,
    payment: filterPayment,
    payer: filterPayer,
    direction: filterDirection,
  }
  const visible = filterExpenses(trip, filters)
  const dayGroups = new Map(
    expenseBreakdown(visible, 'date').map((group) => [
      group.label,
      group.totals,
    ]),
  )
  const filtered = !!(
    filterDate ||
    filterQuery ||
    [
      filterCategory,
      filterCurrency,
      filterPayment,
      filterPayer,
      filterDirection,
    ].some((value) => value !== '전체')
  )
  function reset() {
    setEditing(null)
    setTitle('')
    setAmount('')
    setDate(dateAt(trip.startDate, day))
    setCurrency(expensePreferences(trip, day).currency)
    setPayer('')
    setPayerId(expensePreferences(trip, day).payerId)
    setDirection('expense')
    setPaymentMethod(expensePreferences(trip, day).paymentMethod)
    setNote('')
    setStopId(undefined)
    setReservationId(undefined)
    setSplitMode('none')
    setParticipants(members.map((member) => member.id))
    setShares({})
    setError('')
  }
  useEffect(() => {
    if (!initialExpense || initialExpense.token === appliedToken) return
    setAppliedToken(initialExpense.token)
    if (open && title.trim()) {
      setMessage('작성 중인 지출을 이어서 작성하세요.')
      return
    }
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
      paymentMethod: paymentMethod || undefined,
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
    rememberExpense(trip, nextExpense)
    reset()
    setOpen(false)
    clearFilters()
    setMessage(editing ? '지출을 수정했어요.' : '지출을 저장했어요.')
  }
  const splitPreview =
    splitMode === 'even'
      ? splitEvenly(Number(amount) || 0, currency, participants)
      : participants.map((memberId) => ({
          memberId,
          amount: Number(shares[memberId] || 0),
        }))
  async function copyCsv(items = expenses) {
    const text = expensesCsv({ ...trip, expenses: items })
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
        <div className="expense-add-actions">
          {onQuickAdd && (
            <button
              className="button primary small"
              onClick={() => {
                clearFilters()
                setView('지출')
                onQuickAdd()
              }}
            >
              빠른 기록
            </button>
          )}
          <button
            className="button outline small"
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
      </div>
      <ExpenseSummary
        trip={trip}
        day={day}
        onBudget={() => setView('예산')}
        onDate={() => drillDown({ date: dateAt(trip.startDate, day) })}
      />
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
          ? ['지출', '통계', '정산', '예산']
          : ['지출', '통계', '예산']
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
            <form
              ref={expenseForm}
              className="inline-form expense-form"
              onSubmit={save}
            >
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
                    aria-label="결제 수단"
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value as typeof paymentMethod,
                      )
                    }
                  >
                    <option value="">미지정</option>
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
              placeholder="이름·메모·결제자 검색"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
            />
            <button
              className="button outline small"
              aria-expanded={filtersOpen}
              aria-controls="expense-advanced-filters"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              필터{filtered ? ' · 적용 중' : ''}
            </button>
            <div
              id="expense-advanced-filters"
              className="expense-advanced-filters"
              hidden={!filtersOpen}
            >
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
              <select
                aria-label="지출 결제수단 필터"
                value={filterPayment}
                onChange={(event) => setFilterPayment(event.target.value)}
              >
                {['전체', '카드', '현금', '기타', '미지정'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <select
                aria-label="지출 결제자 필터"
                value={filterPayer}
                onChange={(event) => setFilterPayer(event.target.value)}
              >
                <option value="전체">결제자 전체</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
                <option value="미지정">결제자 미지정</option>
              </select>
              <select
                aria-label="지출 유형 필터"
                value={filterDirection}
                onChange={(event) => setFilterDirection(event.target.value)}
              >
                <option value="전체">지출·환불 전체</option>
                <option value="expense">지출만</option>
                <option value="refund">환불만</option>
              </select>
            </div>
            {filtered && (
              <button className="text-button" onClick={clearFilters}>
                필터 초기화
              </button>
            )}
          </div>
          <div className="expense-filter-summary" role="status">
            <span>
              {filtered ? '조회 내역' : '전체 내역'} {visible.length}건
            </span>
            <strong>
              {currencyTotals(visible)
                .map((item) => money(item.total, item.currency))
                .join(' · ') || '기록 없음'}
            </strong>
            {filtered && (
              <button
                className="text-button"
                onClick={() => void copyCsv(visible)}
              >
                조회 내역 CSV 복사
              </button>
            )}
          </div>
          {csv && filtered && (
            <label className="field">
              조회 내역 CSV
              <textarea
                readOnly
                value={csv}
                onFocus={(event) => event.target.select()}
              />
            </label>
          )}
          <div className="expense-list">
            {[...visible]
              .reverse()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((item, index, ordered) => (
                <Fragment key={item.id}>
                  {(index === 0 || ordered[index - 1].date !== item.date) && (
                    <div className="expense-day-heading">
                      <h4>{formatDate(item.date)}</h4>
                      <strong>
                        {dayGroups
                          .get(item.date)
                          ?.map((value) => money(value.total, value.currency))
                          .join(' · ')}
                      </strong>
                    </div>
                  )}
                  <article data-expense-id={item.id} tabIndex={-1}>
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
                      <details className="expense-receipts">
                        <summary aria-label={`${item.title} 영수증·자료`}>
                          영수증·자료
                          {trip.attachments?.some(
                            (file) => file.expenseId === item.id,
                          )
                            ? ` ${trip.attachments.filter((file) => file.expenseId === item.id).length}개`
                            : ' 추가'}
                        </summary>
                        <AttachmentsPanel expenseId={item.id} />
                      </details>
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
                          setPaymentMethod(item.paymentMethod || '')
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
                </Fragment>
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
          <ExpenseInsights trip={trip} onFilter={drillDown} />
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
                void saveExpenseCsv(text)
                  .then((result) =>
                    setMessage(
                      result.cancelled
                        ? 'CSV 저장을 취소했어요.'
                        : '경비 CSV를 저장했어요.',
                    ),
                  )
                  .catch(() =>
                    setMessage(
                      '파일 저장을 열지 못했어요. CSV 복사를 이용해 주세요.',
                    ),
                  )
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
      {view === '정산' && <SettlementPanel trip={trip} onUpdate={onUpdate} />}
      {view === '예산' && (
        <div
          className="expense-budget-panel"
          role="region"
          aria-label="예산·환율 설정"
        >
          <section className="rate-settings">
            <h4>환율·전체 예산</h4>
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
                  totalBudget: totalBudget.trim()
                    ? Number(totalBudget)
                    : undefined,
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
                    aria-label="기준 통화"
                    value={base}
                    onChange={(event) => {
                      const value = event.target.value as Currency
                      setBase(value)
                      setTotalBudget(
                        value === (trip.baseCurrency || 'KRW') &&
                          trip.totalBudget !== undefined
                          ? String(trip.totalBudget)
                          : '',
                      )
                      if (value === rateCurrency)
                        setRateCurrency(
                          currencies.find((item) => item !== value)!,
                        )
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
                  기준 통화를 바꿔 저장하면 기존 환율을 지웁니다. 전체 예산도 새
                  통화 금액으로 다시 입력하세요.
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
          </section>
          <section className="budget-settings">
            <h4>통화별 예산 설정</h4>
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
          </section>
        </div>
      )}
      {message && view !== '통계' && <p role="status">{message}</p>}
      {error && !(view === '지출' && open) && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
