import { defineConfig, loadEnv } from "vite";
import solid from "vite-plugin-solid";
import { fileURLToPath } from "node:url";

const mockDir = fileURLToPath(new URL("./src/services/mock/", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useMock = env.VITE_USE_MOCK === "true";
  return {
    plugins: [solid()],
    resolve: {
      // Mock mode: services/{auth,training,admin,demo} resolve to the in-browser
      // mock versions. Otherwise the mock code (and its answer keys) is never
      // part of the bundle.
      alias: useMock ? [{ find: /^(?:\.\.?\/)+services\/(auth|training|admin|demo)$/, replacement: `${mockDir}$1.js` }] : [],
    },
    server: {
      port: 5174,
      // Same-origin API in development: /api → Express. Cookies, SameSite and
      // the CSRF origin check then behave exactly as in production.
      proxy: {
        "/api": { target: `http://localhost:${env.PORT || 5000}`, changeOrigin: false },
      },
    },
  };
});
