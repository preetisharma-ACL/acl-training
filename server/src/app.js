// Express application (no listen — server.js starts it; tests import it).

import express from "express";
import helmet from "helmet";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";
import { env, ROOT_DIR } from "./config/env.js";
import { corsMiddleware } from "./config/cors.js";
import { sessionMiddleware } from "./config/session.js";
import { originCheck } from "./middleware/originCheck.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

// CSP hashes for the inline scripts in the built index.html (the theme
// script that prevents a light→dark flash), so they run without 'unsafe-inline'.
function inlineScriptHashes(indexHtml) {
  if (!existsSync(indexHtml)) return [];
  const html = readFileSync(indexHtml, "utf8");
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`);
}

export function createApp() {
  const app = express();
  const dist = path.join(ROOT_DIR, "dist");

  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // YouTube's IFrame Player API drives the course videos.
          scriptSrc: ["'self'", ...inlineScriptHashes(path.join(dist, "index.html")), "https://www.youtube.com", "https://s.ytimg.com"],
          // PDFs are shown in an <iframe> served by this same origin; course
          // videos in YouTube's (privacy-enhanced) embedded player.
          frameSrc: ["'self'", "blob:", "https://www.youtube-nocookie.com", "https://www.youtube.com"],
          frameAncestors: ["'self'"],
          // Video thumbnails.
          imgSrc: ["'self'", "data:", "blob:", "https://i.ytimg.com"],
          // Media materials link to external video/audio hosts.
          mediaSrc: ["'self'", "https:", "blob:"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const api = express.Router();
  api.use(corsMiddleware);
  api.use(express.json({ limit: "1mb" }));
  api.use(sessionMiddleware);
  api.use(originCheck);
  api.use((req, res, next) => {
    // API responses are per-user: never cache them.
    res.set("Cache-Control", "no-store");
    next();
  });
  api.use("/v1", apiRoutes);
  api.use(notFoundHandler);
  app.use("/api", api);

  // Production: serve the built SolidJS app, with SPA fallback.
  if (env.isProd && env.SERVE_FRONTEND && existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
