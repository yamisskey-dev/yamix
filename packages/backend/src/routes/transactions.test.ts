import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { transactionsRoutes } from './transactions.js'
import { prismaPlugin } from '../plugins/prisma.js'

describe('Transactions API', () => {
  const fastify = Fastify()
  const prisma = new PrismaClient()

  let senderWallet: { id: string; address: string }
  let receiverWallet: { id: string; address: string }
  let testPost: { id: string }

  beforeAll(async () => {
    await fastify.register(prismaPlugin)
    await fastify.register(transactionsRoutes, { prefix: '/api/transactions' })
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

    // Create test wallets
    senderWallet = await prisma.wallet.create({
      data: { address: 'sender12', balance: 100 },
    })
    receiverWallet = await prisma.wallet.create({
      data: { address: 'receive1', balance: 0 },
    })

    // Create test post
    testPost = await prisma.post.create({
      data: {
        content: 'Test post',
        walletId: receiverWallet.id,
      },
    })
  })

  describe('POST /api/transactions', () => {
    it('should create a transaction (send tokens)', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/transactions',
        payload: {
          postId: testPost.id,
          senderId: senderWallet.id,
          amount: 10,
        },
      })

      expect(response.statusCode).toBe(201)
      const transaction = JSON.parse(response.payload)
      expect(transaction.amount).toBe(10)
      expect(transaction.senderId).toBe(senderWallet.id)
      expect(transaction.postId).toBe(testPost.id)
    })

    it('should update balances after transaction', async () => {
      await fastify.inject({
        method: 'POST',
        url: '/api/transactions',
        payload: {
          postId: testPost.id,
          senderId: senderWallet.id,
          amount: 10,
        },
      })

      // Check sender balance decreased
      const sender = await prisma.wallet.findUnique({
        where: { id: senderWallet.id },
      })
      expect(sender?.balance).toBe(90)

      // Check receiver balance increased
      const receiver = await prisma.wallet.findUnique({
        where: { id: receiverWallet.id },
      })
      expect(receiver?.balance).toBe(10)
    })

    it('should return 400 for insufficient balance', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/transactions',
        payload: {
          postId: testPost.id,
          senderId: senderWallet.id,
          amount: 200, // More than balance
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should default amount to 1', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/transactions',
        payload: {
          postId: testPost.id,
          senderId: senderWallet.id,
        },
      })

      expect(response.statusCode).toBe(201)
      const transaction = JSON.parse(response.payload)
      expect(transaction.amount).toBe(1)
    })

    it('should not allow self-transaction', async () => {
      // Create a post by sender
      const selfPost = await prisma.post.create({
        data: {
          content: 'Self post',
          walletId: senderWallet.id,
        },
      })

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/transactions',
        payload: {
          postId: selfPost.id,
          senderId: senderWallet.id,
          amount: 10,
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/transactions', () => {
    it('should get transactions for a post', async () => {
      // Create transactions
      await prisma.transaction.create({
        data: {
          postId: testPost.id,
          senderId: senderWallet.id,
          amount: 5,
        },
      })

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/transactions?postId=${testPost.id}`,
      })

      expect(response.statusCode).toBe(200)
      const transactions = JSON.parse(response.payload)
      expect(transactions).toHaveLength(1)
      expect(transactions[0].amount).toBe(5)
    })
  })
})
