import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

export const tagsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Get all tags (popular tags)
  server.get(
    '/',
    {
      schema: {
        description: 'Get popular tags',
        tags: ['tags'],
        querystring: z.object({
          limit: z.string().transform(Number).optional().default('20'),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              slug: z.string(),
              postCount: z.number(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      const { limit = 20 } = request.query

      const tags = await fastify.prisma.tag.findMany({
        take: limit,
        include: {
          _count: {
            select: { posts: true },
          },
        },
        orderBy: {
          posts: {
            _count: 'desc',
          },
        },
      })

      reply.send(
        tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          postCount: tag._count.posts,
        }))
      )
    }
  )
}
