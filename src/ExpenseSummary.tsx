import { convertedTotal, currencyTotals } from './finance'
import { dateAt, formatDate } from './store'
import { money, type Trip } from './travel-model'
export default function ExpenseSummary({
  trip,
  day,
  onDate,
}: {
  trip: Trip
  day: number
  onDate: () => void
}) {
  const conversion = convertedTotal(trip),
    totals = currencyTotals(trip.expenses || [])
  const chosen = dateAt(trip.startDate, day),
    daily = currencyTotals(
      (trip.expenses || []).filter((item) => item.date === chosen),
    )
  const budget = trip.totalBudget,
    comparable = !conversion.missing.length
  const percent =
    budget && comparable
      ? Math.max(0, (conversion.total / budget) * 100)
      : undefined
  return (
    <>
      <div className="money-overview">
        <div>
          <span>{comparable ? '사용한 금액' : '통화별 사용 금액'}</span>
          <strong>
            {comparable
              ? money(conversion.total, conversion.currency)
              : totals
                  .map((item) => money(item.total, item.currency))
                  .join(' · ')}
          </strong>
        </div>
        {budget !== undefined && (
          <div>
            <>
              <span>전체 예산 {money(budget, conversion.currency)}</span>
              <strong
                className={
                  comparable && conversion.total > budget ? 'over-budget' : ''
                }
              >
                {comparable
                  ? `${conversion.total > budget ? '초과' : '남음'} ${money(Math.abs(budget - conversion.total), conversion.currency)}`
                  : '환율 입력 후 비교'}
              </strong>
              {comparable && (
                <>
                  <progress
                    aria-label="전체 예산 사용률"
                    max={budget || 1}
                    value={Math.max(0, Math.min(conversion.total, budget || 1))}
                  />
                  <small>
                    {percent !== undefined
                      ? `${Math.round(percent)}% 사용`
                      : conversion.total > 0
                        ? '예산 초과'
                        : '사용 없음'}
                  </small>
                </>
              )}
            </>
          </div>
        )}
      </div>
      <button
        className="expense-selected-day"
        onClick={onDate}
        aria-label="선택일 지출 내역 보기"
      >
        <span>{formatDate(chosen)} · 선택일 지출</span>
        <strong>
          {daily.map((item) => money(item.total, item.currency)).join(' · ') ||
            '기록 없음'}
        </strong>
        <span aria-hidden="true">›</span>
      </button>
    </>
  )
}
