import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "public");

if (!existsSync(distPath)) {
  throw new Error(`Build directory not found: ${distPath}. Run "npm run build" first.`);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

async function serve(req: IncomingMessage, res: ServerResponse) {
  try {
    const urlPath = decodeURIComponent(req.url?.split("?")[0] || "/");
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
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    const fallback = await readFile(path.join(distPath, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fallback);
  }
}

const port = parseInt(process.env.PORT || "5000", 10);
createServer(serve).listen(
  { port, host: "0.0.0.0", reusePort: true },
  () => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    console.log(`${time} [server] serving on port ${port}`);
  },
);
