import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const root = new URL("../", import.meta.url);
let cache = new Map(),
  inFlight = new Map();
export async function contentApi(req, res) {
  const request = new URL(req.url, "http://localhost");
  if (request.pathname !== "/api/content") return false;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const respond = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  if (req.method !== "GET") {
    respond(405, { error: "Method not allowed" });
    return true;
  }
  try {
    const data = JSON.parse(
      await readFile(new URL("src/content.json", root), "utf8"),
    );
    const key = request.searchParams.get("key");
    // No arbitrary URL parameter: requests must match a public source entry from our imported catalogue.
    const archive = JSON.parse(
      await readFile(new URL("public/content/archive.json", root), "utf8"),
    );
    const entry =
      archive.find((p) => p.key === key) ||
      data.pages.find((p) => p.key === key);
    if (!entry) {
      respond(404, { error: "Материал не найден" });
      return true;
    }
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < 3600000) {
      respond(200, cached.page);
      return true;
    }
    if (!inFlight.has(key)) {
      if (inFlight.size >= 4) {
        respond(503, {
          error: "Сервис занят. Повторите через несколько секунд.",
        });
        return true;
      }
      const task = exec(
        "python3",
        [
          fileURLToPath(new URL("scripts/sync-content.py", root)),
          "--page",
          entry.url,
          entry.title,
        ],
        { timeout: 30000, maxBuffer: 5 * 1024 * 1024 },
      )
        .then(({ stdout }) => {
          const page = JSON.parse(stdout);
          if (!page.error) cache.set(key, { page, time: Date.now() });
          return page;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, task);
    }
    const page = await inFlight.get(key);
    respond(page.error ? 502 : 200, page);
  } catch {
    respond(502, {
      error:
        "Источник временно недоступен. Повторите запрос или откройте официальный сайт.",
    });
  }
  return true;
}
export function contentPlugin() {
  return {
    name: "zhat-public-content",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        contentApi(req, res)
          .then((handled) => {
            if (!handled) next();
          })
          .catch(next);
      });
    },
  };
}
