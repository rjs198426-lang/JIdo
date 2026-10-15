import books from './official-guidebooks.json' with { type: 'json' }
export const officialGuidebooks = books
export function officialGuidebooksForCity(cityId?: string) {
  return cityId ? books.filter((book) => book.cityIds.includes(cityId)) : []
}
