import data from './guide-blogs.json' with { type: 'json' }
import { isRecentBlog } from './blog-recency.ts'

export interface GuideBlog {
  cityId: string
  title: string
  url: string
  platform: string
  author: string
  publishedAt?: string
  topic: string
  checkedAt: string
}

export const guideBlogs: readonly GuideBlog[] = data

export function blogsForCity(cityId: string) {
  return guideBlogs.filter(
    (post) => post.cityId === cityId && isRecentBlog(post),
  )
}
