import type { FastifyZod } from "../shared.js";

export default async function routes(fastify: FastifyZod, options: Object) {
  // would it be beneficial to cache this in Redis at some point, or rate limit this endpoint?
  // this hits the DB every single time we want get this
  // BUT it's a simple (and indexed!) query
  fastify.get("/api/changelog", async (request, reply) => {
    return await fastify.db.getUpdateLogs();
  });
}
