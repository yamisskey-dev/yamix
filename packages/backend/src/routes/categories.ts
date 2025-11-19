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
              id: z.string(),
              name: z.string(),
              slug: z.string(),
              postCount: z.number(),
            })
          ),
        },
      },
    },
    async () => {
      const categories = await fastify.prisma.category.findMany({
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: { posts: true },
          },
        },
      })

      return categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        postCount: cat._count.posts,
      }))
    }
  )

  // Create category
  server.post(
    '/',
    {
      schema: {
        description: 'Create a new category',
        tags: ['categories'],
        body: z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          order: z.number().int().optional().default(0),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
            order: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, slug, order } = request.body

      const category = await fastify.prisma.category.create({
        data: {
          name,
          slug,
          order,
        },
      })

      return reply.code(201).send(category)
    }
  )
}
