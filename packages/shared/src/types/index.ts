/**
 * User type
 */
export interface User {
  id: number
  email: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  role: 'user' | 'moderator' | 'admin'
  createdAt: Date
  updatedAt: Date
}

/**
 * Public user type (without sensitive data)
 */
export interface PublicUser {
  id: number
  displayName: string
  bio: string | null
  avatarUrl: string | null
  createdAt: Date
}

/**
 * Post type
 */
export interface Post {
  id: number
  title: string
  content: string
  thumbnailUrl: string | null
  categoryId: number
  authorId: number | null // null for anonymous posts
  status: 'draft' | 'published' | 'archived'
  viewCount: number
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

/**
 * Post with relations
 */
export interface PostWithRelations extends Post {
  author: PublicUser | null
  category: Category
  tags: Tag[]
}

/**
 * Category type
 */
export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
}

/**
 * Tag type
 */
export interface Tag {
  id: number
  name: string
  slug: string
}

/**
 * Comment type
 */
export interface Comment {
  id: number
  postId: number
  authorId: number | null
  content: string
  isAnonymous: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
  }
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
