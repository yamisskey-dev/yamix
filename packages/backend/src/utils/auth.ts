import { FastifyRequest } from 'fastify'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Get authenticated user from request
 */
export async function authenticateUser(request: FastifyRequest) {
  try {
    await request.jwtVerify()
    return request.user as { id: number; email: string; role: string }
  } catch (err) {
    throw new Error('認証が必要です')
  }
}

/**
 * Check if user has required role
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest) => {
    const user = await authenticateUser(request)
    if (!allowedRoles.includes(user.role)) {
      throw new Error('権限がありません')
    }
    return user
  }
}
