// Check publication dates, never the date we fetched a page.
export function isRecentBlog(
  post: { publishedAt?: string },
  today = new Date(),
): boolean {
  const published = post.publishedAt || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(published)) return false
  const date = new Date(`${published}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== published
  )
    return false
  const end = today.toISOString().slice(0, 10)
  const start = new Date(`${end}T00:00:00Z`)
  const month = start.getUTCMonth()
  start.setUTCFullYear(start.getUTCFullYear() - 3)
  if (start.getUTCMonth() !== month) start.setUTCDate(0)
  return published >= start.toISOString().slice(0, 10) && published <= end
}

export const retiredBlogImages = new Set([
  '/images/blog-osaka-tsutenkaku.jpg',
  '/images/blog-osaka-umeda-night.jpg',
  '/images/blog-sendai-train.jpg',
  '/images/blog-danang-banhxeo.jpg',
  '/images/blog-danang-table.jpg',
])
