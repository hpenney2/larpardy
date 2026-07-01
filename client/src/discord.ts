import { DiscordSDK } from "@discord/embedded-app-sdk";
import { REST } from "@discordjs/rest";

console.log("!!! SDK loading");

export const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

export let auth: Awaited<ReturnType<typeof discordSdk.commands.authenticate>>;
export const api = new REST({ version: "10" });
export async function setupDiscordSdk() {
  if (auth != null) return;

  await discordSdk.ready();
  console.log("Discord SDK is ready!");

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds", "guilds.members.read"],
  });

  const response = await fetch("/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`failed to contact server! (${response.status})`, { cause: response });
  }

  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  api.setToken(access_token);

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}

export const setupPromise = setupDiscordSdk();
