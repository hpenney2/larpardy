import Fastify from "fastify";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fastifyAutoload from "@fastify/autoload";
import fastifySocketIO from "./io.js";
import { REST } from "@discordjs/rest";
import {
  Routes,
  type APIActivityInstance,
  type APIUser,
} from "discord-api-types/v10";

dotenv.config({ path: "../.env" });

const fastify = Fastify({ logger: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// awaiting because otherwise the instance won't be ready
// before attaching middleware
await fastify.register(fastifySocketIO, {
  connectionStateRecovery: {},
  path: "/api/connect",
  serveClient: false,
});

// Socket.IO middleware
// validate instance ID and access token on join
fastify.socketIO.use(async (socket, next) => {
  let instanceId = socket.handshake.auth.instanceId;
  let accessToken = socket.handshake.auth.token;

  try {
    let rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_BOT_TOKEN!,
    );

    let instance = (await rest.get(
      Routes.applicationActivityInstance(
        process.env.VITE_DISCORD_CLIENT_ID!,
        instanceId,
      ),
    )) as APIActivityInstance;

    rest.setToken(accessToken);
    let userInfo = (await rest.get(Routes.user(), {
      authPrefix: "Bearer",
    })) as APIUser;

    if (!instance.users.includes(userInfo.id)) {
      throw new Error(
        `user ${userInfo.id} isn't actually in instance (${instanceId}, has [${instance.users}])! maybe spoofed (or lag)?`,
      );
    }

    socket.data.discord = userInfo;
    socket.data.instanceId = instanceId;

    next();
  } catch (err) {
    console.log("connect error:", err);
    next(new Error(`Failed to verify your session.`));
  }
});

fastify.register(fastifyAutoload, { dir: join(__dirname, "plugins") });

fastify.listen({ port: 3001 }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
