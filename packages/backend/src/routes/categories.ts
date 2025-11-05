import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

export const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>()

  // Get all categories
  server.get(
    '/',
    {
      schema: {
        description: 'Get all categories',
        tags: ['categories'],
        response: {
          200: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              slug: z.string(),
              description: z.string().nullable(),
              postCount: z.number(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      const categories = await fastify.prisma.category.findMany({
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: { posts: true },
          },
        },
      })

      reply.send(
        categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          postCount: cat._count.posts,
        }))
      )
    }
  )
}
