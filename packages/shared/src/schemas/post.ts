import { z } from 'zod'

/**
 * Post creation schema
 */
export const createPostSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください').max(200, 'タイトルは200文字以内である必要があります'),
  content: z.string().min(1, '本文を入力してください'),
  thumbnailUrl: z.string().url('有効なURLを入力してください').nullish(),
  categoryId: z.number().int().positive(),
  tags: z.array(z.string()).max(10, 'タグは10個までです').optional(),
  isAnonymous: z.boolean().default(false),
  status: z.enum(['draft', 'published']).default('draft'),
})

export type CreatePostInput = z.infer<typeof createPostSchema>

/**
 * Post update schema
 */
export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  thumbnailUrl: z.string().url().nullish(),
  categoryId: z.number().int().positive().optional(),
  tags: z.array(z.string()).max(10).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

export type UpdatePostInput = z.infer<typeof updatePostSchema>

/**
 * Post filter schema
 */
export const postFilterSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  tag: z.string().optional(),
  authorId: z.number().int().positive().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export type PostFilterInput = z.infer<typeof postFilterSchema>
