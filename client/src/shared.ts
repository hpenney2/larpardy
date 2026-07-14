import type { discordSdk } from "./discord";

export const PROJ_NAME = "LARPARDY";
export type DiscordUsers = Awaited<
  ReturnType<typeof discordSdk.commands.getInstanceConnectedParticipants>
>;
