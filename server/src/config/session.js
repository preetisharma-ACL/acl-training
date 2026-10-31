// Server-side sessions in PostgreSQL. The browser only holds an opaque,
// signed, httpOnly cookie; nothing about the user lives in localStorage.

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { env } from "./env.js";

const PgStore = connectPgSimple(session);

export const pgPool = new pg.Pool({ connectionString: env.databaseUrl, max: 5 });

export const SESSION_COOKIE = env.isProd ? "__Host-aa.sid" : "aa.sid";

export const sessionMiddleware = session({
  name: SESSION_COOKIE,
  secret: env.SESSION_SECRET,
  store: new PgStore({
    pool: pgPool,
    tableName: "session", // created by the Prisma migration
    createTableIfMissing: false,
    ttl: env.SESSION_HOURS * 3600, // used when the cookie has no maxAge
    pruneSessionInterval: env.isTest ? false : 15 * 60,
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true, // sliding expiry: each request extends an active session
  cookie: {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    // maxAge is set per login ("Keep me signed in"); otherwise a browser-session
    // cookie whose server-side record expires after SESSION_HOURS.
  },
});
