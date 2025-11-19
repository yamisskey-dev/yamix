import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { postsRoutes } from './posts.js'
import { prismaPlugin } from '../plugins/prisma.js'

describe('Posts API', () => {
  const fastify = Fastify()
  const prisma = new PrismaClient()

  let testWallet: { id: string; address: string }

  beforeAll(async () => {
    await fastify.register(prismaPlugin)
    await fastify.register(postsRoutes, { prefix: '/api/posts' })
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

    // Create test wallet with unique address
    const uniqueId = Date.now().toString()
    testWallet = await prisma.wallet.create({
      data: {
        address: `test${uniqueId.slice(-8)}`,
        balance: 0,
      },
    })
  })

  describe('GET /api/posts', () => {
    it('should return empty array when no posts', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/posts',
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.posts).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('should return posts with pagination', async () => {
      // Create test posts
      await prisma.post.createMany({
        data: [
          { content: 'Post 1', walletId: testWallet.id },
          { content: 'Post 2', walletId: testWallet.id },
          { content: 'Post 3', walletId: testWallet.id },
        ],
      })

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/posts?page=1&limit=2',
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.posts).toHaveLength(2)
      expect(result.total).toBe(3)
    })
  })

  describe('POST /api/posts', () => {
    it('should create a new post', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/posts',
        payload: {
          content: 'New post content',
          walletId: testWallet.id,
        },
      })

      expect(response.statusCode).toBe(201)
      const post = JSON.parse(response.payload)
      expect(post.content).toBe('New post content')
      expect(post.walletId).toBe(testWallet.id)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/posts',
        payload: {
          content: 'Missing fields',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/posts/:id', () => {
    it('should get post by id', async () => {
      const post = await prisma.post.create({
        data: {
          content: 'Test post',
          walletId: testWallet.id,
        },
      })

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/posts/${post.id}`,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.content).toBe('Test post')
      expect(result.wallet.address).toBe(testWallet.address)
    })

    it('should return 404 for non-existent post', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/posts/non-existent-id',
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
