import { serve } from "bun";
import index from "./index.html";

const PORT = Number(process.env.PORT) || 3000;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const server = serve({
  port: PORT,
  routes: {
    // Proxy API requests to backend
    "/api/*": async (req) => {
      const url = new URL(req.url);
      const targetUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
      return await fetch(targetUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
    },

    // SPA fallback: serve index.html for all other routes
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,
    console: true,
  },
});

console.log(`Frontend server running at http://localhost:${server.port}`);
