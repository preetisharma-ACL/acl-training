// Backend tests, plus plain-JS frontend logic tests (src/tests, no JSX or
// DOM). Separate from vite.config.js so the Solid plugin isn't loaded.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/tests/**/*.test.js", "src/tests/**/*.test.js"],
    env: { NODE_ENV: "test", STORAGE_DIR: "server/storage-test" },
    globalSetup: ["server/tests/globalSetup.js"],
    // One shared test database: run files one at a time.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
