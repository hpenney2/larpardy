import type { discordSdk } from "./discord";

export const PROJ_NAME = "LARPARDY";
export type DiscordUsers = Awaited<
  ReturnType<typeof discordSdk.commands.getInstanceConnectedParticipants>
>;

export type DiscordUser = Awaited<
  ReturnType<typeof discordSdk.commands.getInstanceConnectedParticipants>
>["participants"][0];
