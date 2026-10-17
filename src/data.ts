import balanced from './balanced-places.json' with { type: 'json' }
import { currentPlaceCategory } from './category-balance.ts'
import { placeCategories, type PlaceCategory } from './place-categories.ts'
export type { PlaceCategory } from './place-categories.ts'
import { verifiedVenueCoordinates } from './venue-coordinates.ts'
import { photoCredits, type PhotoCreditInfo } from './photo-credits.ts'
import { japanGuides } from './japan-guides.ts'
import { expandedGuides } from './expanded-guides.ts'
import { resortGuides } from './resort-guides.ts'
import researchedPlaces from './researched-places.json' with { type: 'json' }
import diningPlaces from './dining-places.json' with { type: 'json' }
import { placeSchema } from './guide-schema.ts'
import type { ReviewSource } from './review-source'
import { withBlogNotes } from './blog-place-notes.ts'
export type Region =
  | '전체'
  | '일본'
  | '동남아'
  | '유럽'
  | '휴양지'
  | '중동'
  | '동아시아'
  | '북미'
  | '남미'
  | '아프리카'
  | '오세아니아'
  | '남아시아'
  | '중앙아시아'
  | '기타'
export interface City {
  id: string
  name: string
  english: string
  country: string
  region: Region
  image: string
  photoCredit?: PhotoCreditInfo
  tagline: string
  description: string
  tags: string[]
  flight: string
  currency: string
  timeDifference: string
  season: string
  accent: string
}
export interface Place {
  id: string
  cityId: string
  name: string
  english: string
  category: PlaceCategory
  image: string
  photoCredit?: PhotoCreditInfo
  description: string
  address: string
  duration: string
  cost: string
  tip: string
  lat?: number
  lng?: number
  area?: string
  reviewSources?: ReviewSource[]
  osmPlaceId?: string
}
export const cities: City[] = [
  {
    id: 'kyoto',
    name: '교토',
    english: 'KYOTO · 京都',
    country: '일본',
    region: '일본',
    image: '/images/kyoto.jpg',
    tagline: '느리게 걸을수록, 더 좋아지는 도시',
    description:
      '오래된 골목과 고요한 사원, 작은 찻집이 기다리는 교토. 서두르지 않고 걷는 하루가 가장 특별한 여행이 됩니다.',
    tags: ['골목 산책', '문화 여행'],
    flight: '간사이·이타미공항에서 교토 이동',
    currency: '일본 엔 · JPY',
    timeDifference: '한국과 시차 없음',
    season: '3–5월, 10–11월',
    accent: '#dae8d5',
  },
  {
    id: 'bali',
    name: '발리',
    english: 'BALI',
    country: '인도네시아',
    region: '동남아',
    image: '/images/bali.jpg',
    tagline: '초록의 쉼표, 나를 위한 시간',
    description:
      '우붓의 푸른 풍경부터 바다에 내려앉는 석양까지. 자연과 일상 사이에서 나만의 여행 속도를 찾아보세요.',
    tags: ['자연 속 휴식', '선셋'],
    flight: '약 7시간',
    currency: '인도네시아 루피아 · IDR',
    timeDifference: '한국보다 1시간 느림',
    season: '5–9월',
    accent: '#d9ebe5',
  },
  {
    id: 'bangkok',
    name: '방콕',
    english: 'BANGKOK',
    country: '태국',
    region: '동남아',
    image: '/images/bangkok.jpg',
    tagline: '하루 종일 맛있고, 밤에는 더 빛나는',
    description:
      '황금빛 사원과 활기찬 시장, 향긋한 길거리 음식. 익숙한 듯 새로운 방콕에서 취향 가득한 하루를 보내세요.',
    tags: ['미식 여행', '야경'],
    flight: '약 5시간 40분',
    currency: '태국 바트 · THB',
    timeDifference: '한국보다 2시간 느림',
    season: '11–2월',
    accent: '#f4e5cf',
  },
  {
    id: 'santorini',
    name: '산토리니',
    english: 'SANTORINI',
    country: '그리스',
    region: '유럽',
    image: '/images/santorini.jpg',
    tagline: '파란 바다 위, 하얀 꿈 같은 하루',
    description:
      '에게해를 바라보는 하얀 마을, 돌길 끝에서 만나는 노을. 그저 풍경을 바라보는 것만으로도 충분한 여행.',
    tags: ['낭만 여행', '바다'],
    flight: '경유 필요',
    currency: '유로 · EUR',
    timeDifference: '한국보다 6–7시간 느림',
    season: '5–6월, 9–10월',
    accent: '#dbe9f5',
  },
  {
    id: 'dubai',
    name: '두바이',
    english: 'DUBAI',
    country: '아랍에미리트',
    region: '중동',
    image: '/images/dubai.jpg',
    tagline: '도시의 반짝임과 사막의 고요함',
    description:
      '하늘을 향한 스카이라인과 끝없이 펼쳐지는 사막. 서로 다른 두 풍경 사이에서 특별한 순간을 발견하세요.',
    tags: ['도시 여행', '사막'],
    flight: '약 10시간',
    currency: 'UAE 디르함 · AED',
    timeDifference: '한국보다 5시간 느림',
    season: '11–3월',
    accent: '#f0e0d0',
  },
  {
    id: 'maldives',
    name: '몰디브',
    english: 'MALDIVES',
    country: '몰디브',
    region: '휴양지',
    image: '/images/maldives.jpg',
    tagline: '아무것도 하지 않아도 좋은 여행',
    description:
      '투명한 바다와 부드러운 모래, 수평선 너머로 지는 해. 일상의 소음을 내려놓고 바다 가까이 머물러보세요.',
    tags: ['휴양', '허니문'],
    flight: '경유 필요',
    currency: '몰디브 루피야 · MVR',
    timeDifference: '한국보다 4시간 느림',
    season: '11–4월',
    accent: '#d7efef',
  },
]

export const places: Place[] = [
  {
    id: 'kiyomizu',
    cityId: 'kyoto',
    name: '기요미즈데라',
    english: 'Kiyomizu-dera',
    category: '관광',
    image: '/images/kyoto.jpg',
    description:
      '교토를 내려다보는 목조 무대와 사계절의 풍경. 사원으로 이어지는 산넨자카 골목도 함께 걸어보세요.',
    address: '교토시 히가시야마구 기요미즈 1-294',
    duration: '약 1시간 30분',
    cost: '입장료 별도 · 공식 안내 확인',
    tip: '이른 아침에 방문하면 한적하게 산책할 수 있어요.',
    lat: 34.9949,
    lng: 135.785,
  },
  {
    id: 'fushimi',
    cityId: 'kyoto',
    name: '후시미 이나리 신사',
    english: 'Fushimi Inari Taisha',
    category: '관광',
    image: '/images/kyoto.jpg',
    description:
      '산길을 따라 이어지는 붉은 도리이. 천천히 걸으며 교토만의 특별한 풍경을 만나보세요.',
    address: '교토시 후시미구 후카쿠사 야부노우치초 68',
    duration: '약 2시간',
    cost: '무료 · 특별 프로그램 제외',
    tip: '산길을 걷기 편한 신발과 물을 준비하세요.',
    lat: 34.9671,
    lng: 135.7727,
  },
  {
    id: 'nishiki',
    cityId: 'kyoto',
    name: '니시키 시장',
    english: 'Nishiki Market',
    category: '맛집',
    image: '/images/kyoto.jpg',
    description:
      '교토의 부엌이라 불리는 시장. 제철 음식과 작은 가게들을 둘러보며 좋아하는 맛을 찾아보세요.',
    address: '교토시 나카교구 니시키코지 거리',
    duration: '약 1시간',
    cost: '메뉴와 매장에 따라 다름',
    tip: '구입한 음식은 가게가 안내하는 장소에서 먹어요.',
    lat: 35.005,
    lng: 135.7649,
  },
  {
    id: 'gion',
    cityId: 'kyoto',
    name: '기온 시라카와 산책',
    english: 'Gion Shirakawa',
    category: '관광',
    image: '/images/kyoto.jpg',
    description:
      '작은 물길 옆으로 이어지는 버드나무와 전통 가옥. 교토의 차분한 저녁을 느껴보세요.',
    address: '교토시 히가시야마구 시라카와 주변',
    duration: '약 45분',
    cost: '무료',
    tip: '주민을 배려하고 사유지 촬영 제한 안내를 확인하세요.',
    lat: 35.0057,
    lng: 135.7746,
  },
  {
    id: 'kyoto-cafe',
    cityId: 'kyoto',
    name: '히가시야마 찻집 산책',
    english: 'Higashiyama Tea Walk',
    category: '카페',
    image: '/images/kyoto.jpg',
    description:
      '산넨자카 주변의 작은 찻집에서 말차 한 잔과 함께 잠시 쉬어가세요. 마음에 드는 가게를 직접 골라보는 코스예요.',
    address: '교토시 히가시야마구 산넨자카 주변',
    duration: '약 1시간',
    cost: '선택한 가게의 메뉴에 따라 다름',
    tip: '찻집 영업 시간과 대기 여부를 방문 전에 확인하세요.',
    lat: 34.998,
    lng: 135.7807,
  },
  {
    id: 'ubud',
    cityId: 'bali',
    name: '뜨갈랄랑 라이스 테라스',
    english: 'Tegallalang Rice Terrace',
    category: '관광',
    image: '/images/bali.jpg',
    description:
      '우붓 북쪽에 펼쳐지는 계단식 논. 초록 풍경 사이를 천천히 걸으며 자연을 느껴보세요.',
    address: 'Tegallalang, Gianyar, Bali',
    duration: '약 2시간',
    cost: '입장 구역과 활동별 비용 별도',
    tip: '아침 시간에 방문하고 미끄럽지 않은 신발을 준비하세요.',
    lat: -8.4312,
    lng: 115.2793,
  },
  {
    id: 'uluwatu',
    cityId: 'bali',
    name: '울루와뚜 사원',
    english: 'Uluwatu Temple',
    category: '관광',
    image: '/images/bali.jpg',
    description:
      '절벽 위에 자리한 사원과 끝없이 펼쳐진 인도양. 발리의 석양을 즐기기 좋은 장소예요.',
    address: 'Pecatu, South Kuta, Bali',
    duration: '약 2시간',
    cost: '입장 및 공연 비용 별도',
    tip: '사원의 복장 규정을 지키고 소지품을 잘 챙기세요.',
    lat: -8.8291,
    lng: 115.0849,
  },
  {
    id: 'ubud-market',
    cityId: 'bali',
    name: '우붓 시장',
    english: 'Ubud Art Market',
    category: '맛집',
    image: '/images/bali.jpg',
    description:
      '수공예품과 현지 먹거리를 둘러보며 우붓의 일상을 발견하는 시간.',
    address: 'Jl. Raya Ubud, Bali',
    duration: '약 1시간 30분',
    cost: '구매 품목에 따라 다름',
    tip: '작은 금액의 현금을 준비하면 편리해요.',
    lat: -8.5069,
    lng: 115.2625,
  },
  {
    id: 'ubud-coffee',
    cityId: 'bali',
    name: '우붓 카페 거리',
    english: 'Ubud Cafe Walk',
    category: '카페',
    image: '/images/bali.jpg',
    description:
      '우붓 중심가에서 취향에 맞는 카페를 찾아보세요. 커피 한 잔과 여행 기록을 남기는 여유.',
    address: 'Jl. Monkey Forest, Ubud, Bali',
    duration: '약 1시간',
    cost: '선택한 카페의 메뉴에 따라 다름',
    tip: '카페별 영업 시간은 방문 전에 확인하세요.',
    lat: -8.5125,
    lng: 115.2602,
  },
  {
    id: 'wat-arun',
    cityId: 'bangkok',
    name: '왓 아룬',
    english: 'Wat Arun',
    category: '관광',
    image: '/images/bangkok.jpg',
    description:
      '짜오프라야 강변에서 만나는 새벽의 사원. 섬세한 장식과 강 건너 풍경을 감상하세요.',
    address: '158 Wang Doem Road, Bangkok',
    duration: '약 1시간 30분',
    cost: '입장료 별도 · 공식 안내 확인',
    tip: '어깨와 무릎을 가리는 복장을 준비하세요.',
    lat: 13.7437,
    lng: 100.4889,
  },
  {
    id: 'grand-palace',
    cityId: 'bangkok',
    name: '방콕 왕궁',
    english: 'The Grand Palace',
    category: '관광',
    image: '/images/bangkok.jpg',
    description:
      '태국의 역사와 화려한 건축을 만나는 왕궁. 에메랄드 사원과 함께 둘러보세요.',
    address: 'Na Phra Lan Road, Bangkok',
    duration: '약 2시간',
    cost: '입장료 별도 · 공식 안내 확인',
    tip: '엄격한 복장 규정과 운영 시간을 확인하세요.',
    lat: 13.75,
    lng: 100.4913,
  },
  {
    id: 'yaowarat',
    cityId: 'bangkok',
    name: '야오와랏 야시장',
    english: 'Yaowarat Road',
    category: '맛집',
    image: '/images/bangkok.jpg',
    description:
      '해가 지면 더 활기차지는 차이나타운. 다양한 길거리 음식으로 나만의 미식 코스를 만들어보세요.',
    address: 'Yaowarat Road, Bangkok',
    duration: '약 2시간',
    cost: '메뉴에 따라 다름',
    tip: '현금을 준비하고 위생 상태를 확인해 가게를 선택하세요.',
    lat: 13.7397,
    lng: 100.5099,
  },
  {
    id: 'talat-noi',
    cityId: 'bangkok',
    name: '딸랏 너이 카페 산책',
    english: 'Talat Noi',
    category: '카페',
    image: '/images/bangkok.jpg',
    description:
      '오래된 골목 속 개성 있는 카페와 벽화. 방콕의 느긋한 오후를 만나보세요.',
    address: 'Talat Noi, Samphanthawong, Bangkok',
    duration: '약 1시간 30분',
    cost: '선택한 카페의 메뉴에 따라 다름',
    tip: '주택가에서는 주민의 일상을 배려해 주세요.',
    lat: 13.7345,
    lng: 100.5135,
  },
  {
    id: 'oia',
    cityId: 'santorini',
    name: '이아 마을',
    english: 'Oia Village',
    category: '관광',
    image: '/images/santorini.jpg',
    description:
      '하얀 집과 파란 돔이 어우러진 마을. 골목마다 펼쳐지는 에게해의 풍경을 즐겨보세요.',
    address: 'Oia, Santorini, Greece',
    duration: '약 3시간',
    cost: '마을 산책 무료',
    tip: '일몰 전에는 사람이 많아 여유 있게 도착하세요.',
    lat: 36.4618,
    lng: 25.3753,
  },
  {
    id: 'fira',
    cityId: 'santorini',
    name: '피라 마을',
    english: 'Fira',
    category: '관광',
    image: '/images/santorini.jpg',
    description: '절벽 위 산책길과 바다 전망을 따라 걷는 산토리니의 중심 마을.',
    address: 'Fira, Santorini, Greece',
    duration: '약 2시간',
    cost: '마을 산책 무료',
    tip: '돌길이 많으니 편한 신발을 신으세요.',
    lat: 36.4167,
    lng: 25.4322,
  },
  {
    id: 'ammoudi',
    cityId: 'santorini',
    name: '아무디 베이',
    english: 'Ammoudi Bay',
    category: '맛집',
    image: '/images/santorini.jpg',
    description: '이아 아래의 작은 항구에서 바다를 바라보며 즐기는 식사.',
    address: 'Ammoudi, Oia, Santorini',
    duration: '약 1시간 30분',
    cost: '선택한 식당의 메뉴에 따라 다름',
    tip: '계단 이동이 부담된다면 차량 접근 방법을 확인하세요.',
    lat: 36.4605,
    lng: 25.3701,
  },
  {
    id: 'burj',
    cityId: 'dubai',
    name: '부르즈 할리파',
    english: 'Burj Khalifa',
    category: '관광',
    image: '/images/dubai.jpg',
    description:
      '두바이의 스카이라인을 한눈에 담는 전망대. 방문 시간에 따라 도시의 표정이 달라져요.',
    address: '1 Sheikh Mohammed bin Rashid Blvd, Dubai',
    duration: '약 2시간',
    cost: '전망대 티켓 별도 · 공식 예약 확인',
    tip: '방문 시간과 전망대 층에 따라 요금이 달라요.',
    lat: 25.1972,
    lng: 55.2744,
  },
  {
    id: 'al-fahidi',
    cityId: 'dubai',
    name: '알 파히디 역사 지구',
    english: 'Al Fahidi Historical Neighbourhood',
    category: '관광',
    image: '/images/dubai.jpg',
    description:
      '바람탑과 좁은 골목에서 만나는 두바이의 옛 모습. 크릭 주변도 함께 둘러보세요.',
    address: 'Al Fahidi, Dubai',
    duration: '약 2시간',
    cost: '거리 산책 무료 · 시설별 비용 별도',
    tip: '한낮 더위를 피해 아침이나 늦은 오후에 걸어보세요.',
    lat: 25.2635,
    lng: 55.299,
  },
  {
    id: 'dubai-souk',
    cityId: 'dubai',
    name: '두바이 스파이스 수크',
    english: 'Dubai Spice Souk',
    category: '맛집',
    image: '/images/dubai.jpg',
    description:
      '향신료와 말린 과일의 향이 가득한 전통 시장. 아브라를 타고 크릭을 건너보세요.',
    address: 'Deira, Dubai',
    duration: '약 1시간',
    cost: '구매 품목과 교통편에 따라 다름',
    tip: '상품 가격과 단위를 확인한 뒤 구매하세요.',
    lat: 25.2678,
    lng: 55.2964,
  },
  {
    id: 'male',
    cityId: 'maldives',
    name: '말레 시내 산책',
    english: 'Male City',
    category: '관광',
    image: '/images/maldives.jpg',
    description:
      '몰디브의 수도에서 시장과 항구 주변을 둘러보며 섬의 일상을 만나보세요.',
    address: 'Male, Maldives',
    duration: '약 2시간',
    cost: '거리 산책 무료',
    tip: '이동 시간을 고려해 공항이나 숙소 복귀를 계획하세요.',
    lat: 4.1755,
    lng: 73.5093,
  },
  {
    id: 'hulhumale',
    cityId: 'maldives',
    name: '훌루말레 비치',
    english: 'Hulhumale Beach',
    category: '관광',
    image: '/images/maldives.jpg',
    description:
      '공항 가까이에서 만나는 긴 해변. 바다를 바라보며 가볍게 산책하기 좋아요.',
    address: 'Hulhumale, Maldives',
    duration: '약 1시간 30분',
    cost: '해변 산책 무료',
    tip: '공공 해변의 복장과 수영 규정을 확인하세요.',
    lat: 4.2169,
    lng: 73.5459,
  },
  {
    id: 'male-market',
    cityId: 'maldives',
    name: '말레 피시 마켓',
    english: 'Male Fish Market',
    category: '맛집',
    image: '/images/maldives.jpg',
    description:
      '말레 북쪽 항구 주변의 수산시장입니다. 현지 어획물 거래를 보고 가까운 로컬 마켓 산책을 이어갈 수 있습니다.',
    address: 'Boduthakurufaanu Magu, Male',
    duration: '약 45분',
    cost: '구매 품목에 따라 다름',
    tip: '작은 금액의 현금과 개인 장바구니를 준비하세요.',
    lat: 4.18004,
    lng: 73.5088,
  },
]

cities.push(...japanGuides.map((guide) => guide.city))
cities.push(...expandedGuides.map((guide) => guide.city))
cities.push(...resortGuides.map((guide) => guide.city))
places.push(...japanGuides.flatMap((guide) => guide.places))
places.push(...resortGuides.flatMap((guide) => guide.places))
// Only records reviewed against real source bodies belong in this file.
// Researched recommendations are bundled for offline search; retain existing IDs and saved stops.
export const reviewedPlaceIds = new Set<string>()
for (const raw of [
  ...researchedPlaces,
  ...diningPlaces,
  ...balanced,
  ...expandedGuides.flatMap((guide) => guide.places),
]) {
  const reviewed = placeSchema.parse(raw)
  if (
    !reviewed.reviewSources?.length ||
    !cities.some((city) => city.id === reviewed.cityId)
  )
    throw new Error('조사 장소에는 여행지와 확인한 후기 출처가 필요합니다.')
  if (reviewedPlaceIds.has(reviewed.id))
    throw new Error('조사 장소 ID가 중복되었습니다.')
  reviewedPlaceIds.add(reviewed.id)
  const index = places.findIndex((place) => place.id === reviewed.id)
  if (index >= 0 && places[index].cityId !== reviewed.cityId)
    throw new Error('기존 장소 ID를 다른 여행지에 사용할 수 없습니다.')
  if (index >= 0) places[index] = { ...places[index], ...reviewed }
  else places.push(reviewed)
}
for (let index = 0; index < places.length; index++) {
  const place = (places[index] = withBlogNotes(
    currentPlaceCategory(places[index]),
  ))
  const coordinate = verifiedVenueCoordinates[place.id]
  if (coordinate && !reviewedPlaceIds.has(place.id)) {
    place.lat = coordinate.lat
    place.lng = coordinate.lng
  }
  const credit = photoCredits[place.id]
  if (credit) {
    place.image = credit.file
    place.photoCredit = credit
  }
}
for (const city of cities) {
  const credit =
    photoCredits[`city-${city.id}`] ||
    places.find((place) => place.cityId === city.id && place.photoCredit)
      ?.photoCredit
  if (credit) {
    city.image = credit.file
    city.photoCredit = credit
  }
}

export const regions: Region[] = [
  '전체',
  '일본',
  '동남아',
  '유럽',
  '휴양지',
  '중동',
]
export const categoryOptions = ['전체', ...placeCategories] as const
export const getCity = (id: string) => cities.find((city) => city.id === id)
export const getPlace = (id: string) => places.find((place) => place.id === id)
