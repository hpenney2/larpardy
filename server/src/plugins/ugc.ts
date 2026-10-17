import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import {
  type BoardSearchQuery,
  BoardSearchQuerySchema,
  UserBoardSchema,
  type UserBoard,
  SearchBoardPartialSchema,
  SearchBoardSchema,
} from "@larpardy/shared/userBoards";
import { Routes, type APIUser } from "discord-api-types/v10";
import { REST } from "discord.js";
import type { FastifyInstance } from "fastify";
import z from "zod";

async function getDiscordUser(token: string) {
  const rest = new REST({ version: "10", authPrefix: "Bearer" }).setToken(
    token,
  );

  const user = (await rest.get(Routes.user())) as APIUser;

  return user;
}

const AuthorizationHeaderSchema = z.object({ authorization: z.string() });
type AuthorizationHeader = z.infer<typeof AuthorizationHeaderSchema>;

export default async function routes(
  fastify: FastifyInstance,
  options: Object,
) {
  fastify = fastify.withTypeProvider<ZodTypeProvider>();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.post<{ Body: UserBoard; Headers: AuthorizationHeader }>(
    "/api/board",
    {
      schema: {
        body: UserBoardSchema,
        headers: AuthorizationHeaderSchema,
        response: {
          200: String,
        },
      },
    },
    async (request, reply) => {
      let discord;
      try {
        discord = await getDiscordUser(request.headers.authorization);
      } catch (err) {
        reply.code(401).send();
        return;
      }

      if (await fastify.db.isUserRestricted(discord.id)) {
        reply.code(403).send();
        return;
      }

      const id = fastify.db.putBoard(request.body, discord.id);

      return id;
    },
  );

  fastify.put<{
    Body: UserBoard;
    Headers: AuthorizationHeader;
    Params: { id: string };
  }>(
    "/api/board/:id",
    {
      schema: {
        body: UserBoardSchema,
        headers: AuthorizationHeaderSchema,
      },
    },
    async (request, reply) => {
      let discord;
      try {
        discord = await getDiscordUser(request.headers.authorization);
      } catch (err) {
        reply.code(401).send();
        return;
      }

      if (await fastify.db.isUserRestricted(discord.id)) {
        reply.code(403).send();
        return;
      }

      const id = await fastify.db.putBoard(
        request.body,
        discord.id,
        request.params.id,
      );

      if (id == null) {
        reply.code(403).send();
        return;
      }

      return id;
    },
  );

  fastify.get<{ Headers: AuthorizationHeader; Querystring: BoardSearchQuery }>(
    "/api/search_boards",
    {
      schema: {
        querystring: BoardSearchQuerySchema,
        headers: AuthorizationHeaderSchema,
        // response: {
        //   200: SearchBoardSchema.array(),
        // },
      },
    },
    async (request, reply) => {
      let discord;
      try {
        discord = await getDiscordUser(request.headers.authorization);
      } catch (err) {
        reply.code(401).send();
        return;
      }

      const result = await fastify.db.search(
        request.query.sort,
        discord.id,
        request.query.cursor,
        request.query.query,
      );

      return result;
    },
  );

  fastify.get<{
    Headers: AuthorizationHeader;
    Params: { id: string };
  }>(
    "/api/board/:id",
    {
      schema: {
        headers: AuthorizationHeaderSchema,
        // response: {
        //   200: SearchBoardSchema,
        // },
      },
    },
    async (request, reply) => {
      let discord;
      try {
        discord = await getDiscordUser(request.headers.authorization);
      } catch (err) {
        reply.code(401).send();
        return;
      }

      const result = await fastify.db.getBoard(request.params.id, discord.id);

      return result;
    },
  );

  fastify.post<{
    Body: { value: boolean };
    Headers: AuthorizationHeader;
    Params: { id: string };
  }>(
    "/api/board/:id/favorite",
    {
      schema: {
        headers: AuthorizationHeaderSchema,
        body: z.object({ value: z.boolean() }),
      },
    },
    async (request, reply) => {
      let discord;
      try {
        discord = await getDiscordUser(request.headers.authorization);
      } catch (err) {
        reply.code(401).send();
        return;
      }

      await fastify.db.setFavorite(
        request.params.id,
        discord.id,
        request.body.value,
      );

      return request.body.value;
    },
  );
}
