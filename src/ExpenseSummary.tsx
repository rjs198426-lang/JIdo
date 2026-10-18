import { convertedTotal, currencyTotals } from './finance'
import { dateAt, formatDate } from './store'
import { money, type Trip } from './travel-model'
export default function ExpenseSummary({
  trip,
  day,
  onBudget,
  onDate,
}: {
  trip: Trip
  day: number
  onBudget: () => void
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
          <span>{comparable ? '총 순지출' : '환율 입력 필요'}</span>
          <strong>
            {comparable
              ? money(conversion.total, conversion.currency)
              : totals
                  .map((item) => money(item.total, item.currency))
                  .join(' · ')}
          </strong>
          {!comparable && (
            <>
              <small>
                전체 합계 환산 전 · {conversion.missing.join(' · ')} 환율 필요
              </small>
              <button className="text-button" onClick={onBudget}>
                환율 입력하기
              </button>
            </>
          )}
        </div>
        <div>
          {budget !== undefined ? (
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
          ) : (
            <>
              <span>전체 여행 예산</span>
              <strong>아직 설정하지 않았어요</strong>
              <button className="text-button" onClick={onBudget}>
                예산 설정하기
              </button>
            </>
          )}
        </div>
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
