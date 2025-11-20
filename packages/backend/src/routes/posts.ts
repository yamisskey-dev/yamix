import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { POST_COST, MAX_BALANCE } from './wallets.js'

// Token reward for receiving a reply
const REPLY_REWARD = 1

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
          where: { parentId: null }, // Only top-level posts
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            wallet: {
              select: {
                address: true,
                name: true,
              },
            },
            _count: {
              select: {
                transactions: true,
                replies: true,
              },
            },
          },
        }),
        fastify.prisma.post.count({ where: { parentId: null } }),
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
              replies: true,
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
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              wallet: {
                select: {
                  address: true,
                },
              },
              _count: {
                select: {
                  transactions: true,
                  replies: true,
                },
              },
            },
          },
          parent: {
            include: {
              wallet: {
                select: {
                  address: true,
                },
              },
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
      const body = request.body as { content?: string; walletId?: string; parentId?: string }
      const { content, walletId, parentId } = body

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

      // Check if wallet has enough balance to post
      if (wallet.balance < POST_COST) {
        return reply.code(400).send({ error: 'Insufficient balance to post' })
      }

      // If this is a reply, verify parent post exists
      let parentPost = null
      if (parentId) {
        parentPost = await fastify.prisma.post.findUnique({
          where: { id: parentId },
          include: { wallet: true },
        })

        if (!parentPost) {
          return reply.code(400).send({ error: 'Parent post not found' })
        }
      }

      // Create post and handle token economy atomically
      const post = await fastify.prisma.$transaction(async (tx) => {
        // Decrease sender's wallet balance
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: POST_COST } },
        })

        // If this is a reply, reward the parent post owner (up to MAX_BALANCE)
        if (parentPost && parentPost.walletId !== walletId) {
          const parentWallet = await tx.wallet.findUnique({
            where: { id: parentPost.walletId },
          })

          if (parentWallet && parentWallet.balance < MAX_BALANCE) {
            const newBalance = Math.min(parentWallet.balance + REPLY_REWARD, MAX_BALANCE)
            await tx.wallet.update({
              where: { id: parentPost.walletId },
              data: { balance: newBalance },
            })
          }
        }

        // Create post
        return tx.post.create({
          data: {
            content,
            walletId,
            parentId: parentId || null,
          },
          include: {
            wallet: {
              select: {
                address: true,
                name: true,
              },
            },
          },
        })
      })

      return reply.code(201).send(post)
    }
  )

  // Delete post
  server.delete(
    '/:id',
    {
      schema: {
        description: 'Delete a post (only by owner)',
        tags: ['posts'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { walletId } = request.body as { walletId?: string }

      if (!walletId) {
        return reply.code(400).send({ error: 'Wallet ID is required' })
      }

      // Get the post
      const post = await fastify.prisma.post.findUnique({
        where: { id },
      })

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' })
      }

      // Verify ownership
      if (post.walletId !== walletId) {
        return reply.code(403).send({ error: 'Not authorized to delete this post' })
      }

      // Delete post (transactions will be cascade deleted)
      await fastify.prisma.post.delete({
        where: { id },
      })

      return reply.code(204).send()
    }
  )
}
