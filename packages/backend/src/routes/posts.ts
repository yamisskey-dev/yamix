import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

export const postsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Get posts (with filtering and pagination)
  server.get(
    '/',
    {
      schema: {
        description: 'Get all posts',
        tags: ['posts'],
      },
    },
    async (request) => {
      const { categoryId } = request.query
      const page = parseInt(request.query.page || '1', 10)
      const limit = parseInt(request.query.limit || '20', 10)

      const where: any = {}
      if (categoryId) where.categoryId = categoryId

      const [posts, total] = await Promise.all([
        fastify.prisma.post.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            wallet: {
              select: {
                address: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                transactions: true,
              },
            },
          },
        }),
        fastify.prisma.post.count({ where }),
      ])

      return {
        posts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    }
  )

  // Get post by ID
  server.get(
    '/:id',
    {
      schema: {
        description: 'Get post by ID',
        tags: ['posts'],
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        include: {
          wallet: {
            select: {
              address: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          transactions: {
            select: {
              id: true,
              amount: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      })

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' })
      }

      return post
    }
  )

  // Create post
  server.post(
    '/',
    {
      schema: {
        description: 'Create a new post',
        tags: ['posts'],
      },
    },
    async (request, reply) => {
      const body = request.body as { content?: string; walletId?: string; categoryId?: string }
      const { content, walletId, categoryId } = body

      // Validate required fields
      if (!content || !walletId || !categoryId) {
        return reply.code(400).send({ error: 'Missing required fields' })
      }

      // Verify wallet exists
      const wallet = await fastify.prisma.wallet.findUnique({
        where: { id: walletId },
      })

      if (!wallet) {
        return reply.code(400).send({ error: 'Wallet not found' })
      }

      // Verify category exists
      const category = await fastify.prisma.category.findUnique({
        where: { id: categoryId },
      })

      if (!category) {
        return reply.code(400).send({ error: 'Category not found' })
      }

      const post = await fastify.prisma.post.create({
        data: {
          content,
          walletId,
          categoryId,
        },
      })

      return reply.code(201).send(post)
    }
  )
}
