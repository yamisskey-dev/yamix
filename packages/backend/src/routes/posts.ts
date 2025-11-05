import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { createPostSchema, updatePostSchema, postFilterSchema } from '@yamix/shared'

export const postsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Get posts (with filtering and pagination)
  server.get(
    '/',
    {
      schema: {
        description: 'Get all published posts',
        tags: ['posts'],
        querystring: postFilterSchema.omit({ status: true }),
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.number(),
                title: z.string(),
                content: z.string(),
                thumbnailUrl: z.string().nullable(),
                viewCount: z.number(),
                createdAt: z.string(),
                publishedAt: z.string().nullable(),
                author: z
                  .object({
                    id: z.number(),
                    displayName: z.string(),
                  })
                  .nullable(),
                category: z.object({
                  id: z.number(),
                  name: z.string(),
                  slug: z.string(),
                }),
                tags: z.array(
                  z.object({
                    id: z.number(),
                    name: z.string(),
                    slug: z.string(),
                  })
                ),
              })
            ),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
            totalPages: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { page = 1, limit = 20, categoryId, tag, authorId } = request.query

      const where: any = {
        status: 'PUBLISHED',
      }

      if (categoryId) where.categoryId = categoryId
      if (authorId) where.authorId = authorId
      if (tag) {
        where.tags = {
          some: {
            tag: {
              slug: tag,
            },
          },
        }
      }

      const [posts, total] = await Promise.all([
        fastify.prisma.post.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { publishedAt: 'desc' },
          select: {
            id: true,
            title: true,
            content: true,
            thumbnailUrl: true,
            viewCount: true,
            createdAt: true,
            publishedAt: true,
            isAnonymous: true,
            author: {
              select: {
                id: true,
                displayName: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            tags: {
              select: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        }),
        fastify.prisma.post.count({ where }),
      ])

      const items = posts.map((post) => ({
        ...post,
        author: post.isAnonymous ? null : post.author,
        createdAt: post.createdAt.toISOString(),
        publishedAt: post.publishedAt?.toISOString() || null,
        tags: post.tags.map((t) => t.tag),
      }))

      reply.send({
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    }
  )

  // Get post by ID
  server.get(
    '/:id',
    {
      schema: {
        description: 'Get post by ID',
        tags: ['posts'],
        params: z.object({
          id: z.string().transform(Number),
        }),
        response: {
          200: z.object({
            id: z.number(),
            title: z.string(),
            content: z.string(),
            thumbnailUrl: z.string().nullable(),
            viewCount: z.number(),
            createdAt: z.string(),
            updatedAt: z.string(),
            publishedAt: z.string().nullable(),
            author: z
              .object({
                id: z.number(),
                displayName: z.string(),
                bio: z.string().nullable(),
                avatarUrl: z.string().nullable(),
              })
              .nullable(),
            category: z.object({
              id: z.number(),
              name: z.string(),
              slug: z.string(),
            }),
            tags: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                slug: z.string(),
              })
            ),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              bio: true,
              avatarUrl: true,
            },
          },
          category: true,
          tags: {
            include: {
              tag: true,
            },
          },
        },
      })

      if (!post || post.status !== 'PUBLISHED') {
        return reply.code(404).send({ error: '投稿が見つかりません' })
      }

      // Increment view count
      await fastify.prisma.post.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })

      reply.send({
        ...post,
        author: post.isAnonymous ? null : post.author,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        publishedAt: post.publishedAt?.toISOString() || null,
        tags: post.tags.map((t) => t.tag),
      })
    }
  )

  // Create post (authenticated)
  server.post(
    '/',
    {
      schema: {
        description: 'Create a new post',
        tags: ['posts'],
        security: [{ bearerAuth: [] }],
        body: createPostSchema,
        response: {
          201: z.object({
            id: z.number(),
            title: z.string(),
            status: z.string(),
          }),
          400: z.object({ error: z.string() }),
        },
      },
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id
      const { title, content, thumbnailUrl, categoryId, tags, isAnonymous, status } = request.body

      // Create post
      const post = await fastify.prisma.post.create({
        data: {
          title,
          content,
          thumbnailUrl,
          categoryId,
          authorId: isAnonymous ? null : userId,
          isAnonymous,
          status: status.toUpperCase() as any,
          publishedAt: status === 'published' ? new Date() : null,
        },
      })

      // Add tags
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          const slug = tagName.toLowerCase().replace(/\s+/g, '-')

          // Find or create tag
          const tag = await fastify.prisma.tag.upsert({
            where: { slug },
            create: { name: tagName, slug },
            update: {},
          })

          // Link tag to post
          await fastify.prisma.postTag.create({
            data: {
              postId: post.id,
              tagId: tag.id,
            },
          })
        }
      }

      reply.code(201).send({
        id: post.id,
        title: post.title,
        status: post.status,
      })
    }
  )
}
