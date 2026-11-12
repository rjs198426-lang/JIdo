import { useState } from 'react'

export const timeZones = [
  ['Asia/Seoul', '서울·인천 · 한국'],
  ['Asia/Tokyo', '도쿄·오사카 · 일본'],
  ['Pacific/Guam', '괌'],
  ['Pacific/Saipan', '사이판'],
  ['Pacific/Honolulu', '호놀룰루 · 하와이'],
  ['Asia/Taipei', '타이베이 · 대만'],
  ['Asia/Hong_Kong', '홍콩'],
  ['Asia/Bangkok', '방콕 · 태국'],
  ['Asia/Ho_Chi_Minh', '다낭·호찌민 · 베트남'],
  ['Asia/Singapore', '싱가포르'],
  ['Asia/Manila', '마닐라 · 필리핀'],
  ['Asia/Makassar', '발리 · 인도네시아'],
  ['Asia/Jakarta', '자카르타 · 인도네시아'],
  ['Asia/Dubai', '두바이'],
  ['Indian/Maldives', '몰디브'],
  ['Europe/Paris', '파리 · 프랑스'],
  ['Europe/Rome', '로마 · 이탈리아'],
  ['Europe/London', '런던 · 영국'],
  ['Europe/Athens', '아테네·산토리니 · 그리스'],
  ['Europe/Lisbon', '리스본 · 포르투갈'],
  ['Europe/Zurich', '취리히 · 스위스'],
  ['America/New_York', '뉴욕 · 미국 동부'],
  ['America/Chicago', '시카고 · 미국 중부'],
  ['America/Denver', '덴버 · 미국 산악'],
  ['America/Los_Angeles', '로스앤젤레스 · 미국 서부'],
  ['Australia/Sydney', '시드니 · 호주'],
  ['Australia/Perth', '퍼스 · 호주'],
  ['Pacific/Auckland', '오클랜드 · 뉴질랜드'],
] as const
export const timeZoneName = (zone?: string) =>
  timeZones.find((item) => item[0] === zone)?.[1] || zone || '시간대 미설정'
export default function TimeZoneField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (zone: string) => void
}) {
  const [manual, setManual] = useState(false)
  const isManual =
    manual || (!!value && !timeZones.some((item) => item[0] === value))
  return (
    <div className="field time-zone-field">
      <label>
        {label}
        <select
          aria-label={label}
          value={isManual ? '__manual' : value}
          onChange={(e) => {
            if (e.target.value === '__manual') setManual(true)
            else {
              setManual(false)
              onChange(e.target.value)
            }
          }}
        >
          <option value="">미설정</option>
          {timeZones.map(([zone, name]) => (
            <option key={zone} value={zone}>
              {name}
            </option>
          ))}
          <option value="__manual">다른 지역 직접 입력</option>
        </select>
      </label>
      {isManual && (
        <input
          aria-label={`${label} 직접 입력`}
          placeholder="시간대 이름 · 예: Europe/Madrid"
          maxLength={80}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
