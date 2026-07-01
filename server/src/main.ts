import Fastify from "fastify";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fastifyAutoload from "@fastify/autoload";
import fastifySocketIO from "./io.js";

dotenv.config({ path: "../.env" });

const fastify = Fastify({ logger: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

fastify.register(fastifySocketIO, {
  connectionStateRecovery: {},
  path: "/api/connect",
  serveClient: false,
});
fastify.register(fastifyAutoload, { dir: join(__dirname, "plugins") });

fastify.listen({ port: 3001 }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
