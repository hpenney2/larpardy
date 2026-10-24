import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import z from "zod";

export type FastifyZod = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export const AuthorizationHeaderSchema = z.object({
  authorization: z.string(),
});
export type AuthorizationHeader = z.infer<typeof AuthorizationHeaderSchema>;
