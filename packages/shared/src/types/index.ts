/**
 * Wallet type (anonymous identity)
 */
export interface Wallet {
  id: string
  address: string
  balance: number
  createdAt: string
}

/**
 * Post type
 */
export interface Post {
  id: string
  content: string
  walletId: string
  createdAt: string
}

/**
 * Post with relations
 */
export interface PostWithRelations extends Post {
  wallet: {
    address: string
  }
  _count?: {
    transactions: number
  }
  transactions?: Transaction[]
}

/**
 * Transaction type (token transfer)
 */
export interface Transaction {
  id: string
  postId: string
  senderId: string
  amount: number
  createdAt: string
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
 * Paginated response for posts
 */
export interface PaginatedPostsResponse {
  posts: PostWithRelations[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Generic paginated response
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
