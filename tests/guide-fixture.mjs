export function fixtureGuide(
  request = { id: null, country: '오스트리아', city: '빈' },
  suffix = '',
) {
  const id = `guide-vienna${suffix}`
  const now = new Date().toISOString()
  return {
    id,
    scope: request.city ? 'city' : 'country',
    status: 'draft',
    requestId: request.id,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    city: {
      id,
      name: request.city || request.country,
      english: 'VIENNA',
      country: request.country,
      region: '유럽',
      image: '/images/guide-placeholder.svg',
      tagline: '테스트용 문화 여행 가이드',
      description: '게시와 동기화를 검증하기 위한 예시 여행지 소개입니다.',
      tags: ['문화 여행'],
      flight: '출발편 확인',
      currency: '유로 · EUR',
      timeDifference: '계절별 확인',
      season: '방문 시기 확인',
      accent: '#e7f1ef',
    },
    places: [
      {
        id: `${id}:stephansdom`,
        cityId: id,
        name: '슈테판 대성당',
        english: 'Stephansdom',
        category: '관광',
        image: '/images/guide-placeholder.svg',
        description: '기능 검증용 예시 장소입니다.',
        address: 'Stephansplatz, Vienna',
        duration: '약 1시간',
        cost: '공식 안내 확인',
        tip: '방문 전 운영 시간을 확인하세요.',
        lat: 48.2085,
        lng: 16.3731,
      },
    ],
    sections: [
      {
        id: 'transport',
        title: '교통 준비',
        body: '이 내용은 자동화 테스트를 위한 예시입니다. 실제 여행 자료가 아닙니다.',
      },
    ],
    sources: [
      {
        title: '빈 관광청 (테스트 출처)',
        url: 'https://www.wien.info/en',
        accessedAt: now.slice(0, 10),
      },
    ],
  }
}
