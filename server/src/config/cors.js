// CORS for the approved frontend origins only. With the Vite proxy (dev) and
// Express serving dist/ (prod) the app is same-origin and CORS is unused;
// this matters only when the frontend is hosted on a separate origin.

import cors from "cors";
import { env } from "./env.js";

export const corsMiddleware = cors({
  origin(origin, cb) {
    // Same-origin requests and non-browser clients send no Origin header.
    if (!origin || env.appOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  maxAge: 600,
});
