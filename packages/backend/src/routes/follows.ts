import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export const followsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Follow a wallet
  server.post(
    '/',
    {
      schema: {
        description: '人格を注目する',
        tags: ['follows'],
      },
    },
    async (request, reply) => {
      const body = request.body as { followerId?: string; targetAddress?: string }
      const { followerId, targetAddress } = body

      if (!followerId || !targetAddress) {
        return reply.code(400).send({ error: 'Missing required fields' })
      }

      // Verify follower wallet exists
      const followerWallet = await fastify.prisma.wallet.findUnique({
        where: { id: followerId },
      })

      if (!followerWallet) {
        return reply.code(400).send({ error: 'Follower wallet not found' })
      }

      // Find target wallet by address
      const targetWallet = await fastify.prisma.wallet.findUnique({
        where: { address: targetAddress },
      })

      if (!targetWallet) {
        return reply.code(404).send({ error: 'Target wallet not found' })
      }

      // Cannot follow yourself
      if (followerId === targetWallet.id) {
        return reply.code(400).send({ error: 'Cannot follow yourself' })
      }

      // Check if already following
      const existingFollow = await fastify.prisma.follow.findUnique({
        where: {
          followerId_targetId: {
            followerId,
            targetId: targetWallet.id,
          },
        },
      })

      if (existingFollow) {
        return reply.code(400).send({ error: 'Already following this wallet' })
      }

      // Create follow
      const follow = await fastify.prisma.follow.create({
        data: {
          followerId,
          targetId: targetWallet.id,
        },
      })

      return reply.code(201).send(follow)
    }
  )

  // Unfollow a wallet
  server.delete(
    '/',
    {
      schema: {
        description: '注目を解除',
        tags: ['follows'],
      },
    },
    async (request, reply) => {
      const body = request.body as { followerId?: string; targetAddress?: string }
      const { followerId, targetAddress } = body

      if (!followerId || !targetAddress) {
        return reply.code(400).send({ error: 'Missing required fields' })
      }

      // Find target wallet by address
      const targetWallet = await fastify.prisma.wallet.findUnique({
        where: { address: targetAddress },
      })

      if (!targetWallet) {
        return reply.code(404).send({ error: 'Target wallet not found' })
      }

      // Delete follow
      try {
        await fastify.prisma.follow.delete({
          where: {
            followerId_targetId: {
              followerId,
              targetId: targetWallet.id,
            },
          },
        })
      } catch {
        return reply.code(404).send({ error: 'Follow not found' })
      }

      return reply.code(204).send()
    }
  )

  // Get following list
  server.get(
    '/:walletId',
    {
      schema: {
        description: '注目一覧を取得',
        tags: ['follows'],
      },
    },
    async (request, reply) => {
      const { walletId } = request.params as { walletId: string }

      const follows = await fastify.prisma.follow.findMany({
        where: { followerId: walletId },
        orderBy: { createdAt: 'desc' },
      })

      // Get target wallet addresses
      const targetIds = follows.map(f => f.targetId)
      const wallets = await fastify.prisma.wallet.findMany({
        where: { id: { in: targetIds } },
        select: {
          id: true,
          address: true,
          balance: true,
        },
      })

      return wallets
    }
  )

  // Check if following a specific wallet
  server.get(
    '/:walletId/check/:targetAddress',
    {
      schema: {
        description: '注目状態を確認',
        tags: ['follows'],
      },
    },
    async (request, reply) => {
      const { walletId, targetAddress } = request.params as {
        walletId: string
        targetAddress: string
      }

      // Find target wallet by address
      const targetWallet = await fastify.prisma.wallet.findUnique({
        where: { address: targetAddress },
      })

      if (!targetWallet) {
        return { following: false }
      }

      const follow = await fastify.prisma.follow.findUnique({
        where: {
          followerId_targetId: {
            followerId: walletId,
            targetId: targetWallet.id,
          },
        },
      })

      return { following: !!follow }
    }
  )

  // Get home timeline (posts from followed wallets)
  server.get(
    '/:walletId/timeline',
    {
      schema: {
        description: 'タイムラインを取得（注目した人格の相談）',
        tags: ['follows'],
      },
    },
    async (request, reply) => {
      const { walletId } = request.params as { walletId: string }
      const query = request.query as { page?: string; limit?: string }
      const page = parseInt(query.page || '1', 10)
      const limit = parseInt(query.limit || '20', 10)

      // Get followed wallet IDs
      const follows = await fastify.prisma.follow.findMany({
        where: { followerId: walletId },
        select: { targetId: true },
      })

      const followedIds = follows.map(f => f.targetId)

      // Include own posts in timeline
      const timelineWalletIds = [...followedIds, walletId]

      // Get posts from followed wallets and own (only top-level posts)
      const [posts, total] = await Promise.all([
        fastify.prisma.post.findMany({
          where: {
            walletId: { in: timelineWalletIds },
            parentId: null, // Only top-level posts
          },
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
        fastify.prisma.post.count({
          where: {
            walletId: { in: timelineWalletIds },
            parentId: null,
          },
        }),
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
}
