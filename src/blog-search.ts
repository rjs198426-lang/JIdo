// Search links are discovery aids, never evidence or a count of mentions.
export interface BlogSearch {
  id: string
  label: string
  query: string
  url: string
}
type Subject = readonly [id: string, label: string, words: string]
const subjects: Record<string, readonly Subject[]> = {
  관광: [
    ['highlights', '볼거리·동선', '볼거리 산책 코스'],
    ['access', '가는 길', '가는법 교통 입장'],
    ['photo', '사진·전망', '사진 포인트 전망'],
    ['tips', '준비·주의', '혼잡 주의사항 준비물'],
  ],
  맛집: [
    ['menu', '메뉴·주문', '메뉴 추천 주문'],
    ['booking', '대기·예약', '웨이팅 예약'],
    ['access', '위치·주차', '위치 주차'],
    ['value', '가격·분위기', '가격 분위기'],
  ],
  카페: [
    ['menu', '커피·디저트', '커피 디저트 메뉴'],
    ['seats', '좌석·분위기', '좌석 분위기 전망'],
    ['booking', '혼잡·대기', '혼잡 웨이팅'],
    ['access', '위치·가는 길', '위치 가는법'],
  ],
  숙소: [
    ['rooms', '객실·시설', '객실 시설'],
    ['meals', '조식·식사', '조식 식당'],
    ['family', '가족·물놀이', '아이 수영장'],
    ['access', '체크인·이동', '체크인 공항 이동'],
  ],
  '바·공연': [
    ['show', '공연·분위기', '공연 분위기'],
    ['booking', '예약·좌석', '예약 좌석'],
    ['menu', '메뉴·복장', '메뉴 복장'],
    ['access', '귀가·교통', '귀가 교통'],
  ],
  쇼핑: [
    ['items', '살 것·기념품', '쇼핑리스트 기념품'],
    ['brands', '매장·브랜드', '매장 브랜드'],
    ['value', '가격·할인', '가격 할인 면세'],
    ['access', '동선·교통', '동선 교통'],
  ],
  체험: [
    ['booking', '예약·이용방법', '예약 이용방법'],
    ['packing', '준비물·복장', '준비물 복장'],
    ['family', '아이·참가조건', '아이 나이 참가조건'],
    ['safety', '날씨·주의사항', '날씨 안전 주의사항'],
  ],
  이동: [
    ['access', '노선·타는 곳', '노선 타는곳'],
    ['tickets', '승차권·환승', '승차권 환승'],
    ['luggage', '짐·이동 팁', '수하물 이동 팁'],
    ['tips', '운행·주의사항', '운행 주의사항'],
  ],
}
const citySubjects: readonly Subject[] = [
  ['course', '여행 동선', '자유여행 일정 동선'],
  ['stay', '숙소·동네', '숙소 위치 동네 비교'],
  ['food', '먹거리·카페', '맛집 카페 메뉴'],
  ['transport', '공항·교통', '공항 교통 이동'],
  ['shopping', '쇼핑·기념품', '쇼핑리스트 기념품'],
  ['preparation', '준비·현장 팁', '준비물 날씨 주의사항'],
]
const clean = (text: string) => text.trim().replace(/\s+/g, ' ')
export function blogSearchRange(today = new Date()) {
  const end = today.toISOString().slice(0, 10)
  const start = new Date(`${end}T00:00:00Z`)
  const month = start.getUTCMonth()
  start.setUTCFullYear(start.getUTCFullYear() - 3)
  if (start.getUTCMonth() !== month) start.setUTCDate(0)
  return { start: start.toISOString().slice(0, 10), end }
}
function search(
  id: string,
  label: string,
  query: string,
  today: Date,
): BlogSearch {
  const range = blogSearchRange(today)
  const params = new URLSearchParams({
    where: 'blog',
    query: clean(query),
    nso: `so:r,p:from${range.start.replaceAll('-', '')}to${range.end.replaceAll('-', '')},a:all`,
  })
  return {
    id,
    label,
    query: clean(query),
    url: `https://search.naver.com/search.naver?${params}`,
  }
}
export function placeBlogSearches(
  city: string,
  place: { name: string; category: string; english?: string },
  today = new Date(),
): BlogSearch[] {
  const region = clean(city),
    name = clean(place.name)
  const base =
    region && !name.startsWith(region) ? `${region} ${name}` : name || region
  const result = [search('all', '전체 정보', base, today)]
  for (const [id, label, words] of subjects[place.category] || subjects.관광)
    result.push(search(id, label, `${base} ${words}`, today))
  // A separate alias query broadens discovery without requiring both spellings.
  const alias =
    /퍼시픽\s*아일랜드|Pacific Islands? Club/i.test(name) && region === '괌'
      ? 'PIC'
      : clean(place.english || '')
  if (alias && alias.toLowerCase() !== name.toLowerCase())
    result.push(search('alias', '다른 이름으로', `${region} ${alias}`, today))
  return result
}
export function cityBlogSearches(
  city: string,
  today = new Date(),
): BlogSearch[] {
  return [
    search('all', '전체 여행 정보', `${clean(city)} 자유여행`, today),
    ...citySubjects.map(([id, label, words]) =>
      search(id, label, `${clean(city)} ${words}`, today),
    ),
  ]
}
