import { useState } from 'react'
export default function DurationInput({
  value,
  label,
  onChange,
}: {
  value?: number
  label: string
  onChange: (value: number | undefined) => void
}) {
  const [draft, setDraft] = useState<string>()
  const raw = draft ?? (value === undefined ? '' : String(value))
  const invalid =
    raw !== '' &&
    (!Number.isInteger(Number(raw)) || Number(raw) < 5 || Number(raw) > 1440)
  return (
    <span className="duration-input">
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        type="number"
        inputMode="numeric"
        min={5}
        max={1440}
        step={1}
        value={raw}
        onBlur={() => setDraft(undefined)}
        onChange={(event) => {
          const next = event.target.value,
            number = Number(next)
          setDraft(next)
          if (!next) onChange(undefined)
          else if (Number.isInteger(number) && number >= 5 && number <= 1440)
            onChange(number)
        }}
      />
      {invalid && <small>5~1440분으로 입력하세요.</small>}
    </span>
  )
}
