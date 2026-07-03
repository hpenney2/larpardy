import type { FastifyInstance, RouteShorthandOptions } from "fastify";
import { fetchAndRetry } from "@larpardy/shared/utils";

interface Body {
  code: string;
}

interface Reply {
  200: {
    access_token: string;
  };
  500: undefined;
}

export default async function routes(
  fastify: FastifyInstance,
  options: Object,
) {
  fastify.post<{ Body: Body; Reply: Reply }>(
    "/api/token",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            code: { type: "string" },
          },
        },
      },
    },
    async function (request, reply) {
      const response = await fetchAndRetry(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: process.env.VITE_DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code: request.body.code,
          }),
        },
      );

      if (!response.ok) {
        reply.code(500).send();
        return;
      }

      const { access_token } = (await response.json()) as {
        access_token: string;
      };

      return { access_token };
    },
  );
}
