// Entry point: start the HTTP server and shut down cleanly.

import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { pgPool } from "./config/session.js";
import { createApp } from "./app.js";
import { sweepPending } from "./services/storage.service.js";

const app = createApp();

// Abandoned PDF uploads (uploaded, never attached): clean at start and daily.
const sweep = () => sweepPending().catch((e) => console.error("upload sweep failed", e));
sweep();
setInterval(sweep, 24 * 3600 * 1000).unref();

const server = app.listen(env.PORT, () => {
  console.log(`Aajneeti Academy API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down…`);
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), pgPool.end()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
