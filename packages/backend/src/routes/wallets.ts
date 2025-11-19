import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { randomBytes } from 'crypto'

// Generate a unique 8-character address
function generateAddress(): string {
  return randomBytes(4).toString('hex')
}

export const walletsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Create a new wallet
  server.post(
    '/',
    {
      schema: {
        tags: ['wallets'],
        description: 'Create a new wallet',
      },
    },
    async (request, reply) => {
      // Generate unique address
      let address = generateAddress()
      let attempts = 0
      const maxAttempts = 10

      // Ensure uniqueness
      while (attempts < maxAttempts) {
        const existing = await fastify.prisma.wallet.findUnique({
          where: { address },
        })
        if (!existing) break
        address = generateAddress()
        attempts++
      }

      if (attempts >= maxAttempts) {
        return reply.status(500).send({ error: 'Failed to generate unique address' })
      }

      const wallet = await fastify.prisma.wallet.create({
        data: {
          address,
          balance: 0,
        },
      })

      return reply.status(201).send(wallet)
    }
  )

  // Get wallet by address
  server.get(
    '/:address',
    {
      schema: {
        tags: ['wallets'],
        description: 'Get wallet by address',
      },
    },
    async (request, reply) => {
      const { address } = request.params

      const wallet = await fastify.prisma.wallet.findUnique({
        where: { address },
      })

      if (!wallet) {
        return reply.status(404).send({ error: 'Wallet not found' })
      }

      return wallet
    }
  )

  // Get posts by wallet address
  server.get(
    '/:address/posts',
    {
      schema: {
        tags: ['wallets'],
        description: 'Get posts by wallet address',
      },
    },
    async (request, reply) => {
      const { address } = request.params

      const wallet = await fastify.prisma.wallet.findUnique({
        where: { address },
        include: {
          posts: {
            include: {
              category: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      })

      if (!wallet) {
        return reply.status(404).send({ error: 'Wallet not found' })
      }

      return wallet.posts
    }
  )
}
