import { useState } from 'react'
import { MAX_TRAVELERS } from './travel-model'

// Saved trips keep the total headcount so existing splits and backups stay valid.
export default function CompanionCount({
  travelers,
  onChange,
}: {
  travelers: number
  onChange: (total: number) => void
}) {
  const count = travelers - 1
  const [custom, setCustom] = useState(count > 10)
  const [input, setInput] = useState(String(count > 10 ? count : 11))
  return (
    <>
      <label className="field">
        함께하는 인원 <span className="optional">나 제외</span>
        <select
          value={custom ? 'custom' : count}
          onChange={(event) => {
            const direct = event.target.value === 'custom'
            setCustom(direct)
            if (direct) {
              setInput(String(count > 10 ? count : 11))
              onChange((count > 10 ? count : 11) + 1)
            } else onChange(Number(event.target.value) + 1)
          }}
        >
          {Array.from({ length: 11 }, (_, number) => (
            <option key={number} value={number}>
              {number}명{number === 0 ? ' · 나 혼자' : ''}
            </option>
          ))}
          <option value="custom">11명 이상 직접 입력</option>
        </select>
      </label>
      {custom && (
        <label className="field">
          동행 인원 직접 입력
          <input
            type="number"
            inputMode="numeric"
            required
            min={11}
            max={MAX_TRAVELERS - 1}
            step={1}
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              const value = event.target.valueAsNumber
              if (
                Number.isInteger(value) &&
                value >= 11 &&
                value < MAX_TRAVELERS
              )
                onChange(value + 1)
            }}
          />
        </label>
      )}
    </>
  )
}
