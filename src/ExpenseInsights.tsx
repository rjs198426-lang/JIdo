import { useState } from 'react'
import { convertedTotal, currencyTotals } from './finance'
import {
  categoryRows,
  expenseBreakdown,
  memberSpending,
} from './expense-insights'
import { money, type Trip } from './travel-model'
import { formatDate } from './store'
export default function ExpenseInsights({
  trip,
  onFilter,
}: {
  trip: Trip
  onFilter: (change: {
    date?: string
    category?: string
    payment?: string
    currency?: string
  }) => void
}) {
  const expenses = trip.expenses || [],
    conversion = convertedTotal(trip)
  const [person, setPerson] = useState(trip.members?.[0]?.id || '')
  const selected = trip.members?.some((member) => member.id === person)
    ? person
    : trip.members?.[0]?.id || ''
  const spending = memberSpending(trip, selected),
    categories = categoryRows(trip)
  return (
    <>
      <div className="stat-cards">
        <article>
          <span>여행 {trip.days.length}일 기준 하루 평균</span>
          <strong>
            {conversion.missing.length
              ? '환율 입력 필요'
              : money(conversion.total / trip.days.length, conversion.currency)}
          </strong>
        </article>
        <article>
          <span>단순 1인당 평균 · {trip.travelers}명</span>
          <strong>
            {conversion.missing.length
              ? '환율 입력 필요'
              : money(conversion.total / trip.travelers, conversion.currency)}
          </strong>
          <small>실제 분담 금액은 사람별 부담에서 확인</small>
        </article>
      </div>
      <h4>분류별 순지출</h4>
      <div className="stat-list expense-chart">
        {currencyTotals(expenses).map(({ currency }) => {
          const rows = categories
            .filter((row) => row.currency === currency)
            .sort((a, b) => b.total - a.total)
          const largest = Math.max(1, ...rows.map((row) => Math.abs(row.total)))
          return (
            <section key={currency} aria-label={`${currency} 분류별 지출`}>
              <h5>{currency}</h5>
              {rows.map((row) => (
                <button
                  type="button"
                  key={row.category}
                  onClick={() => onFilter({ category: row.category, currency })}
                  aria-label={`${row.category} ${currency} 지출 내역 보기`}
                >
                  <span>{row.category}</span>
                  <strong>{money(row.total, currency)}</strong>
                  <span
                    className={`expense-chart-track ${row.total < 0 ? 'is-refund' : ''}`}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: `${(Math.abs(row.total) / largest) * 100}%`,
                      }}
                    />
                  </span>
                </button>
              ))}
            </section>
          )
        })}
        {!expenses.length && (
          <p className="workspace-empty">
            지출을 기록하면 분류별 사용 금액이 보여요.
          </p>
        )}
      </div>
      <h4>날짜별 순지출</h4>
      <div className="stat-list expense-drilldown">
        {expenseBreakdown(expenses, 'date')
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((row) => (
            <button
              key={row.label}
              onClick={() => onFilter({ date: row.label })}
            >
              <span>
                {formatDate(row.label)} · {row.count}건
              </span>
              <strong>
                {row.totals
                  .map((item) => money(item.total, item.currency))
                  .join(' · ')}
              </strong>
            </button>
          ))}
      </div>
      <h4>결제수단별 순지출</h4>
      <div className="stat-list expense-drilldown">
        {expenseBreakdown(expenses, 'paymentMethod').map((row) => (
          <button
            key={row.label}
            onClick={() => onFilter({ payment: row.label })}
          >
            <span>
              {row.label} · {row.count}건
            </span>
            <strong>
              {row.totals
                .map((item) => money(item.total, item.currency))
                .join(' · ')}
            </strong>
          </button>
        ))}
      </div>
      {!!trip.members?.length && (
        <section className="member-spending" aria-label="사람별 실제 부담">
          <h4>사람별 실제 부담</h4>
          <label className="field">
            확인할 사람
            <select
              value={selected}
              onChange={(event) => setPerson(event.target.value)}
            >
              {trip.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <dl>
            <div>
              <dt>직접 결제 · 환불 반영</dt>
              <dd>
                {spending.paid
                  .map((item) => money(item.total, item.currency))
                  .join(' · ') || '기록 없음'}
              </dd>
            </div>
            <div>
              <dt>실제 부담 · 개인+공동 분담</dt>
              <dd>
                {spending.share
                  .map((item) => money(item.total, item.currency))
                  .join(' · ') || '기록 없음'}
              </dd>
            </div>
          </dl>
          <p className="workspace-hint">
            공동 경비는 지정한 분담액, 개인 경비는 결제자에게 반영합니다. 송금은
            부담액에 더하지 않습니다.
            {spending.unassigned > 0
              ? ` 결제자 미지정 ${spending.unassigned}건은 제외됩니다.`
              : ''}
          </p>
        </section>
      )}
    </>
  )
}
