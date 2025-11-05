import { z } from 'zod'

/**
 * User registration schema
 */
export const registerUserSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上である必要があります'),
  displayName: z.string().min(1, '表示名を入力してください').max(50, '表示名は50文字以内である必要があります'),
})

export type RegisterUserInput = z.infer<typeof registerUserSchema>

/**
 * User login schema
 */
export const loginUserSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(1, 'パスワードを入力してください'),
})

export type LoginUserInput = z.infer<typeof loginUserSchema>

/**
 * User update schema
 */
export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
