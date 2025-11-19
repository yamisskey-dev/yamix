import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export const transactionsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Create a transaction (send tokens)
  server.post(
    '/',
    {
      schema: {
        tags: ['transactions'],
        description: 'Create a transaction (send tokens to post author)',
      },
    },
    async (request, reply) => {
      const body = request.body as { postId: string; senderId: string; amount?: number }
      const { postId, senderId } = body
      const amount = body.amount || 1

      // Get the post with author
      const post = await fastify.prisma.post.findUnique({
        where: { id: postId },
        include: { wallet: true },
      })

      if (!post) {
        return reply.status(404).send({ error: 'Post not found' })
      }

      // Prevent self-transaction
      if (post.walletId === senderId) {
        return reply.status(400).send({ error: 'Cannot send tokens to yourself' })
      }

      // Get sender wallet
      const sender = await fastify.prisma.wallet.findUnique({
        where: { id: senderId },
      })

      if (!sender) {
        return reply.status(404).send({ error: 'Sender wallet not found' })
      }

      // Check balance
      if (sender.balance < amount) {
        return reply.status(400).send({ error: 'Insufficient balance' })
      }

      // Execute transaction atomically
      const transaction = await fastify.prisma.$transaction(async (tx) => {
        // Decrease sender balance
        await tx.wallet.update({
          where: { id: senderId },
          data: { balance: { decrement: amount } },
        })

        // Increase receiver balance
        await tx.wallet.update({
          where: { id: post.walletId },
          data: { balance: { increment: amount } },
        })

        // Create transaction record
        return tx.transaction.create({
          data: {
            postId,
            senderId,
            amount,
          },
        })
      })

      return reply.status(201).send(transaction)
    }
  )

  // Get transactions for a post
  server.get(
    '/',
    {
      schema: {
        tags: ['transactions'],
        description: 'Get transactions',
      },
    },
    async (request) => {
      const { postId } = request.query as { postId?: string }

      const where = postId ? { postId } : {}

      const transactions = await fastify.prisma.transaction.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      })

      return transactions
    }
  )
}
