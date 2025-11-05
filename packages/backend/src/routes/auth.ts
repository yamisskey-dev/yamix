import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { registerUserSchema, loginUserSchema } from '@yamix/shared'
import { hashPassword, verifyPassword } from '../utils/auth.js'

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Register
  server.post(
    '/register',
    {
      schema: {
        description: 'Register a new user',
        tags: ['auth'],
        body: registerUserSchema,
        response: {
          201: z.object({
            user: z.object({
              id: z.number(),
              email: z.string(),
              displayName: z.string(),
            }),
            token: z.string(),
          }),
          400: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password, displayName } = request.body

      // Check if user exists
      const existingUser = await fastify.prisma.user.findUnique({
        where: { email },
      })

      if (existingUser) {
        return reply.code(400).send({ error: 'このメールアドレスは既に登録されています' })
      }

      // Hash password
      const hashedPassword = await hashPassword(password)

      // Create user
      const user = await fastify.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          displayName,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
        },
      })

      // Generate JWT
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      })

      reply.code(201).send({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        token,
      })
    }
  )

  // Login
  server.post(
    '/login',
    {
      schema: {
        description: 'Login user',
        tags: ['auth'],
        body: loginUserSchema,
        response: {
          200: z.object({
            user: z.object({
              id: z.number(),
              email: z.string(),
              displayName: z.string(),
            }),
            token: z.string(),
          }),
          401: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body

      // Find user
      const user = await fastify.prisma.user.findUnique({
        where: { email },
      })

      if (!user) {
        return reply.code(401).send({ error: 'メールアドレスまたはパスワードが正しくありません' })
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password)
      if (!isValid) {
        return reply.code(401).send({ error: 'メールアドレスまたはパスワードが正しくありません' })
      }

      // Generate JWT
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      })

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        token,
      })
    }
  )

  // Get current user
  server.get(
    '/me',
    {
      schema: {
        description: 'Get current authenticated user',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            id: z.number(),
            email: z.string(),
            displayName: z.string(),
            bio: z.string().nullable(),
            avatarUrl: z.string().nullable(),
            role: z.string(),
            createdAt: z.string(),
          }),
          401: z.object({
            error: z.string(),
          }),
        },
      },
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
        },
      })

      if (!user) {
        return reply.code(401).send({ error: 'ユーザーが見つかりません' })
      }

      reply.send({
        ...user,
        createdAt: user.createdAt.toISOString(),
      })
    }
  )
}
