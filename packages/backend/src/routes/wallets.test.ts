import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { walletsRoutes, INITIAL_BALANCE } from './wallets.js'
import { prismaPlugin } from '../plugins/prisma.js'

describe('Wallets API', () => {
  const fastify = Fastify()
  const prisma = new PrismaClient()

  beforeAll(async () => {
    await fastify.register(prismaPlugin)
    await fastify.register(walletsRoutes, { prefix: '/api/wallets' })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.transaction.deleteMany()
    await prisma.post.deleteMany()
    await prisma.wallet.deleteMany()
  })

  describe('POST /api/wallets', () => {
    it('should create a new wallet', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/wallets',
      })

      expect(response.statusCode).toBe(201)
      const wallet = JSON.parse(response.payload)
      expect(wallet).toHaveProperty('id')
      expect(wallet).toHaveProperty('address')
      expect(wallet.address).toHaveLength(8)
      expect(wallet.balance).toBe(INITIAL_BALANCE)
    })

    it('should create wallet with unique address', async () => {
      const response1 = await fastify.inject({
        method: 'POST',
        url: '/api/wallets',
      })
      const response2 = await fastify.inject({
        method: 'POST',
        url: '/api/wallets',
      })

      const wallet1 = JSON.parse(response1.payload)
      const wallet2 = JSON.parse(response2.payload)
      expect(wallet1.address).not.toBe(wallet2.address)
    })
  })

  describe('GET /api/wallets/:address', () => {
    it('should get wallet by address', async () => {
      // Create a wallet first
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/api/wallets',
      })
      const createdWallet = JSON.parse(createResponse.payload)

      // Get the wallet
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/wallets/${createdWallet.address}`,
      })

      expect(response.statusCode).toBe(200)
      const wallet = JSON.parse(response.payload)
      expect(wallet.address).toBe(createdWallet.address)
      expect(wallet.balance).toBe(INITIAL_BALANCE)
    })

    it('should return 404 for non-existent wallet', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/wallets/notfound',
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /api/wallets/:address/posts', () => {
    it('should get posts by wallet address', async () => {
      // Create wallet first
      const createWalletResponse = await fastify.inject({
        method: 'POST',
        url: '/api/wallets',
      })
      const wallet = JSON.parse(createWalletResponse.payload)

      // Create posts
      await prisma.post.create({
        data: {
          content: 'Test post',
          walletId: wallet.id,
        },
      })

      // Get posts
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/wallets/${wallet.address}/posts`,
      })

      expect(response.statusCode).toBe(200)
      const posts = JSON.parse(response.payload)
      expect(posts).toHaveLength(1)
      expect(posts[0].content).toBe('Test post')
    })
  })
})
