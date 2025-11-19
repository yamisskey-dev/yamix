import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { prismaPlugin } from './plugins/prisma.js'
import { walletsRoutes } from './routes/wallets.js'
import { postsRoutes } from './routes/posts.js'
import { categoriesRoutes } from './routes/categories.js'
import { transactionsRoutes } from './routes/transactions.js'

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '0.0.0.0'
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  }).withTypeProvider<ZodTypeProvider>()

  // Set validators
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)

  // Register plugins
  await fastify.register(cors, {
    origin: CORS_ORIGIN,
    credentials: true,
  })

  await fastify.register(cookie)

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  })

  // Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Yamix API',
        description: 'Blockchain-inspired anonymous community platform API',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'wallets', description: 'Wallet management endpoints' },
        { name: 'posts', description: 'Post management endpoints' },
        { name: 'categories', description: 'Category endpoints' },
        { name: 'transactions', description: 'Transaction endpoints' },
      ],
    },
    transform: jsonSchemaTransform,
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  })

  // Custom plugins
  await fastify.register(prismaPlugin)

  // Routes
  await fastify.register(walletsRoutes, { prefix: '/api/wallets' })
  await fastify.register(postsRoutes, { prefix: '/api/posts' })
  await fastify.register(categoriesRoutes, { prefix: '/api/categories' })
  await fastify.register(transactionsRoutes, { prefix: '/api/transactions' })

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  return fastify
}

async function start() {
  try {
    const fastify = await buildServer()

    await fastify.listen({ port: PORT, host: HOST })

    console.log(`
Yamix Backend Server is running!

Server:        http://localhost:${PORT}
API Docs:      http://localhost:${PORT}/docs
Health Check:  http://localhost:${PORT}/health

Environment: ${process.env.NODE_ENV || 'development'}
    `)
  } catch (err) {
    console.error('Error starting server:', err)
    process.exit(1)
  }
}

start()
