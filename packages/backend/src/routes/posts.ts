import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export const postsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Get posts (with pagination)
  server.get(
    '/',
    {
      schema: {
        description: 'Get all posts',
        tags: ['posts'],
      },
    },
    async (request) => {
      const query = request.query as { page?: string; limit?: string }
      const page = parseInt(query.page || '1', 10)
      const limit = parseInt(query.limit || '20', 10)

      const [posts, total] = await Promise.all([
        fastify.prisma.post.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            wallet: {
              select: {
                address: true,
              },
            },
            _count: {
              select: {
                transactions: true,
              },
            },
          },
        }),
        fastify.prisma.post.count(),
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
      const { id } = request.params as { id: string }

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        include: {
          wallet: {
            select: {
              address: true,
            },
          },
          _count: {
            select: {
              transactions: true,
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
      const body = request.body as { content?: string; walletId?: string }
      const { content, walletId } = body

      // Validate required fields
      if (!content || !walletId) {
        return reply.code(400).send({ error: 'Missing required fields' })
      }

      // Verify wallet exists
      const wallet = await fastify.prisma.wallet.findUnique({
        where: { id: walletId },
      })

      if (!wallet) {
        return reply.code(400).send({ error: 'Wallet not found' })
      }

      const post = await fastify.prisma.post.create({
        data: {
          content,
          walletId,
        },
      })

      return reply.code(201).send(post)
    }
  )
}
