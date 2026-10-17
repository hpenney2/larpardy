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
  title: z.string().trim().nonempty().max(500),
  privacy: BoardPrivacySchema,
  board: BoardDataSchema,
});

export const SearchBoardSchema = UserBoardSchema.extend({
  id: z.uuid(),
  author: z.string().nonempty(),
  owned: z.boolean(),
  created: z.date().transform((date) => date.toISOString()),
  edited: z.date().transform((date) => date.toISOString()),
  restricted: z
    .date()
    .transform((date) => date.toISOString())
    .nullable(),
  plays: z.int().min(0),
  favorites: z.int().min(0),
  favorited: z.boolean(),
});

export const SearchBoardPartialSchema = SearchBoardSchema.omit({ board: true });

export const BoardSearchSortSchema = z.enum([
  "plays",
  "favorites",
  "my_favorites",
  "my_boards",
  "relevance",
]);

export const BoardSearchQuerySchema = z.object({
  query: z.string().trim().optional(),
  sort: BoardSearchSortSchema,
  cursor: z.base64().optional(),
});

export type BoardPrivacy = z.infer<typeof BoardPrivacySchema>;
export type UserBoard = z.infer<typeof UserBoardSchema>;
export type SearchBoard = z.infer<typeof SearchBoardSchema>;
export type SearchBoardPartial = z.infer<typeof SearchBoardPartialSchema>;

export type BoardSearchSort = z.infer<typeof BoardSearchSortSchema>;
export type BoardSearchQuery = z.infer<typeof BoardSearchQuerySchema>;
