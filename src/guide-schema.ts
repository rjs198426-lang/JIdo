import { z } from 'zod'
import { reviewSourceSchema } from './review-source.ts'

export const guideRegions = [
  '일본',
  '동남아',
  '유럽',
  '휴양지',
  '중동',
  '동아시아',
  '북미',
  '남미',
  '아프리카',
  '오세아니아',
  '남아시아',
  '중앙아시아',
  '기타',
] as const
const text = (max: number) => z.string().trim().max(max)
const required = (max: number) => text(max).min(1, '필수 내용을 입력하세요.')
const id = required(100).regex(/^[a-zA-Z0-9:_-]+$/)
const httpsUrl = required(1000).refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}, 'https://로 시작하는 출처 링크를 입력하세요.')
const image = text(1000).refine(
  (value) =>
    /^\/images\/[a-zA-Z0-9_-]+\.(svg|jpg|jpeg|png|webp)$/.test(value) ||
    httpsUrl.safeParse(value).success,
  '앱 이미지 경로나 HTTPS 이미지 주소를 입력하세요.',
)
const photoCreditSchema = z.object({
  file: image,
  author: text(1500),
  license: required(100),
  licenseUrl: httpsUrl,
  sourceUrl: httpsUrl,
  verifiedAt: text(10),
})
export const citySchema = z.object({
  id,
  name: required(80),
  english: text(100),
  country: required(80),
  region: z.enum(guideRegions),
  image,
  photoCredit: photoCreditSchema.optional(),
  tagline: required(150),
  description: required(5000),
  tags: z.array(required(30)).max(8),
  flight: required(200),
  currency: required(200),
  timeDifference: required(200),
  season: required(200),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})
export const placeSchema = z.object({
  id,
  cityId: id,
  name: required(120),
  english: text(150),
  category: z.enum(['관광', '맛집', '카페', '숙소', '바·공연']),
  image,
  photoCredit: photoCreditSchema.optional(),
  description: required(3000),
  address: required(300),
  duration: required(100),
  cost: required(300),
  tip: required(1500),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  area: text(100).optional(),
  reviewSources: z.array(reviewSourceSchema).max(5).optional(),
  osmPlaceId: z
    .string()
    .regex(/^(node|way|relation)\/\d+$/)
    .optional(),
})
export const sectionSchema = z.object({
  id,
  title: required(100),
  body: required(8000),
})
export const sourceSchema = z.object({
  title: required(150),
  url: httpsUrl,
  accessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
export const guideSchema = z
  .object({
    id,
    scope: z.enum(['country', 'city']),
    city: citySchema,
    places: z.array(placeSchema).max(100),
    sections: z.array(sectionSchema).max(20),
    sources: z.array(sourceSchema).max(30),
    status: z.enum(['draft', 'published']),
    requestId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    publishedAt: z.string().nullable(),
  })
  .superRefine((guide, context) => {
    if (guide.city.id !== guide.id)
      context.addIssue({
        code: 'custom',
        message: '가이드와 여행지 ID가 일치해야 합니다.',
        path: ['city', 'id'],
      })
    if (
      new Set(guide.places.map((place) => place.id)).size !==
      guide.places.length
    )
      context.addIssue({
        code: 'custom',
        message: '장소 ID가 중복되었습니다.',
        path: ['places'],
      })
    if (guide.places.some((place) => place.cityId !== guide.id))
      context.addIssue({
        code: 'custom',
        message: '장소의 여행지 ID가 다릅니다.',
        path: ['places'],
      })
  })
export const requestSchema = z.object({
  country: required(80),
  city: text(80),
  notes: text(1000),
})
export type Guide = z.infer<typeof guideSchema>
// Historical stops are retained even when later revisions recommend different places.
export const archivedGuideSchema = guideSchema.safeExtend({
  places: z.array(placeSchema).max(10000),
})
export interface GuideRequest {
  id: string
  country: string
  city: string
  notes: string
  status: 'requested' | 'researching' | 'draft' | 'published'
  createdAt: string
  guideId: string | null
}
export function blankGuide(
  country = '',
  city = '',
  requestId: string | null = null,
): Guide {
  const guideId = `guide-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  return {
    id: guideId,
    scope: city ? 'city' : 'country',
    status: 'draft',
    requestId,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    city: {
      id: guideId,
      country,
      name: city || country,
      english: '',
      region: '기타',
      image: '/images/guide-placeholder.svg',
      tagline: '',
      description: '',
      tags: [],
      flight: '출발지와 도착지에 따라 다름',
      currency: '조사 후 입력',
      timeDifference: '지역과 계절에 따라 확인 필요',
      season: '조사 후 입력',
      accent: '#e7f1ef',
    },
    places: [],
    sections: [],
    sources: [],
  }
}
