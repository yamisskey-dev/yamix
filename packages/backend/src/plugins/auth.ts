import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async function (request: FastifyRequest) {
    try {
      await request.jwtVerify()
    } catch (err) {
      const error = new Error('認証が必要です')
      ;(error as any).statusCode = 401
      throw error
    }
  })
}

export default fp(authPlugin)
export { authPlugin }
