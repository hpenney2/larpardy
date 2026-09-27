import z from "zod";
import { BoardClue, GameBoard } from "./state";

export const ClueDataSchema: z.ZodType<BoardClue> = z.object({
  value: z.int().min(0),
  question: z.string().trim().nonempty(),
  answer: z.string().trim().nonempty(),
  revealed: z.literal(false),
  answered: z.literal(false),
});

export const BoardDataSchema: z.ZodType<GameBoard> = z.array(
  z.object({ name: z.string().max(500), clues: z.array(ClueDataSchema) }),
);

export const BoardPrivacySchema = z.enum(["private", "unlisted", "public"]);

export const UserBoardSchema = z.object({
  title: z.string().trim().nonempty(),
  privacy: BoardPrivacySchema,
  board: BoardDataSchema,
});

export const FullBoardSchema = UserBoardSchema.extend({
  id: z.uuid(),
  created: z.date(),
});

export type BoardPrivacy = z.infer<typeof BoardPrivacySchema>;
export type UserBoard = z.infer<typeof UserBoardSchema>;
