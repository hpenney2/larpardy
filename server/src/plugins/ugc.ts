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
  type UserPartial,
} from "@larpardy/shared/userBoards";
import { Routes, type APIUser } from "discord-api-types/v10";
import { REST } from "discord.js";
import type { FastifyInstance } from "fastify";
import z from "zod";
import {
  AuthorizationHeaderSchema,
  type AuthorizationHeader,
} from "../shared.js";

async function getDiscordUser(token: string) {
  const rest = new REST({ version: "10", authPrefix: "Bearer" }).setToken(
    token,
  );

  const user = (await rest.get(Routes.user())) as APIUser;

  return user;
}

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

  fastify.delete<{
    Headers: AuthorizationHeader;
    Params: { id: string };
  }>(
    "/api/board/:id",
    {
      schema: {
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

      const success = await fastify.db.deleteBoard(
        request.params.id,
        discord.id,
      );

      if (!success) {
        reply.code(404).send();
        return;
      }

      return;
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

      if (request.query.moderating && !(await fastify.db.isAdmin(discord.id))) {
        reply.code(403).send();
        return;
      }

      const result = await fastify.db.search(
        request.query.sort,
        discord.id,
        request.query.moderating,
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
      if (result) return result;
      else reply.code(404).send();
    },
  );

  fastify.get<{ Headers: AuthorizationHeader; Params: { id: string } }>(
    "/api/board/:id/author",
    {
      schema: { headers: AuthorizationHeaderSchema },
    },
    async (request, reply) => {
      let discord;
      try {
        discord = await getDiscordUser(request.headers.authorization);
      } catch (err) {
        reply.code(401).send();
        return;
      }

      if (!(await fastify.db.isAdmin(discord.id))) {
        reply.code(403).send();
        return;
      }

      const user = await fastify.db.getBoardAuthor(request.params.id);
      if (user) {
        return user;
      } else {
        reply.code(404).send();
        return;
      }
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

  fastify.post<{
    Body: { value: boolean };
    Headers: AuthorizationHeader;
    Params: { id: string };
  }>(
    "/api/board/:id/restrict",
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

      if (!(await fastify.db.isAdmin(discord.id))) {
        reply.code(403).send();
        return;
      }

      const result = await fastify.db.setBoardRestricted(
        request.params.id,
        request.body.value,
      );

      return result;
    },
  );

  fastify.get<{ Headers: AuthorizationHeader }>(
    "/api/users/me",
    {
      schema: { headers: AuthorizationHeaderSchema },
    },
    async (request, reply) => {
      let discord;
      try {
        discord = await getDiscordUser(request.headers.authorization);
      } catch (err) {
        reply.code(401).send();
        return;
      }

      const user = await fastify.db.getUser(discord.id);
      if (user) {
        return { admin: user.admin, restricted: user.restricted };
      } else {
        reply.code(404).send();
        return;
      }
    },
  );

  fastify.get<{ Headers: AuthorizationHeader; Params: { id: string } }>(
    "/api/users/:id",
    {
      schema: { headers: AuthorizationHeaderSchema },
    },
    async (request, reply) => {
      let discord;
      try {
        discord = await getDiscordUser(request.headers.authorization);
      } catch (err) {
        reply.code(401).send();
        return;
      }

      if (!(await fastify.db.isAdmin(discord.id))) {
        reply.code(403).send();
        return;
      }

      const user = await fastify.db.getUser(discord.id);
      if (user) {
        return user;
      } else {
        reply.code(404).send();
        return;
      }
    },
  );

  fastify.post<{
    Body: { value: boolean };
    Headers: AuthorizationHeader;
    Params: { id: string };
  }>(
    "/api/users/:id/restrict",
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

      if (!(await fastify.db.isAdmin(discord.id))) {
        reply.code(403).send();
        return;
      }

      const result = await fastify.db.setUserRestricted(
        request.params.id,
        request.body.value,
      );

      return result;
    },
  );
}
