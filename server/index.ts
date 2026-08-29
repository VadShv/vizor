import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth";
import orgRoutes from "./routes/orgs";
import datasetRoutes from "./routes/datasets";
import shareRoutes from "./routes/shares";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "public");

const app = new Hono();
app.use("/api/*", cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.route("/api/auth", authRoutes);
app.route("/api/orgs", orgRoutes);
app.route("/api/datasets", datasetRoutes);
app.route("/api", shareRoutes);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

if (existsSync(distPath)) {
  app.get("*", async (c) => {
    const urlPath = c.req.path;
    if (urlPath.startsWith("/api")) return c.notFound();
    try {
      let filePath = path.join(distPath, urlPath);
      if (urlPath === "/" || !path.extname(filePath)) {
        filePath = path.join(distPath, "index.html");
      } else {
        try {
          const s = await stat(filePath);
          if (s.isDirectory()) filePath = path.join(filePath, "index.html");
        } catch {
          filePath = path.join(distPath, "index.html");
        }
      }
      const data = await readFile(filePath);
      const ext = path.extname(filePath);
      return new Response(data, { headers: { "Content-Type": MIME[ext] || "application/octet-stream" } });
    } catch {
      const html = await readFile(path.join(distPath, "index.html"));
      return c.html(html);
    }
  });
}

const port = parseInt(process.env.PORT || "3003", 10);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`[vizor] serving on port ${info.port}`);
});
