import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { prismaPlugin } from './plugins/prisma.js'
import { authPlugin } from './plugins/auth.js'
import { authRoutes } from './routes/auth.js'
import { postsRoutes } from './routes/posts.js'
import { categoriesRoutes } from './routes/categories.js'
import { tagsRoutes } from './routes/tags.js'

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '0.0.0.0'
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

async function buildServer() {
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

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    sign: {
      expiresIn: '7d',
    },
  })

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
        description: 'Open-source mental health community platform API',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'posts', description: 'Post management endpoints' },
        { name: 'categories', description: 'Category endpoints' },
        { name: 'tags', description: 'Tag endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
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
  await fastify.register(authPlugin)

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(postsRoutes, { prefix: '/api/posts' })
  await fastify.register(categoriesRoutes, { prefix: '/api/categories' })
  await fastify.register(tagsRoutes, { prefix: '/api/tags' })

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
🚀 Yamix Backend Server is running!

📍 Server:        http://localhost:${PORT}
📚 API Docs:      http://localhost:${PORT}/docs
🏥 Health Check:  http://localhost:${PORT}/health

Environment: ${process.env.NODE_ENV || 'development'}
    `)
  } catch (err) {
    console.error('Error starting server:', err)
    process.exit(1)
  }
}

start()
