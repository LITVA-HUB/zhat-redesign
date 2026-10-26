import { fileURLToPath } from "node:url";
import { readFile, writeFile, rename, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { python, pythonEnv } from "./python.mjs";
const exec = promisify(execFile);
const root = new URL("../", import.meta.url);
// Archived news bodies are kept on the persistent disk next to the CMS database, so the
// archive keeps working after the old Joomla site is switched off. `npm run import:archive` fills it.
export const archiveDir = process.env.CMS_ARCHIVE_DIR || join(fileURLToPath(root), ".data", "archive");
export const archiveFile = (key) =>
  join(archiveDir, createHash("sha256").update(key).digest("hex").slice(0, 20) + ".json");
let cache = new Map(),
  inFlight = new Map(),
  catalogue = { time: 0, pages: new Map(), archive: new Map() };
async function lookup(key) {
  const files = [new URL("src/content.json", root), new URL("public/content/archive.json", root)];
  const time = Math.max(...(await Promise.all(files.map((file) => stat(file)))).map((info) => info.mtimeMs));
  if (time !== catalogue.time) {
    const [data, archive] = await Promise.all(files.map(async (file) => JSON.parse(await readFile(file, "utf8"))));
    catalogue = {
      time,
      pages: new Map(data.pages.map((page) => [page.key, page])),
      archive: new Map(archive.map((item) => [item.key, item])),
    };
  }
  const archived = catalogue.archive.get(key);
  return archived ? { entry: archived, archived: true } : { entry: catalogue.pages.get(key), archived: false };
}
export async function contentApi(req, res) {
  const request = new URL(req.url, "http://localhost");
  if (request.pathname !== "/api/content") return false;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const respond = (status, body) => {
    res.statusCode = status;
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };
  if (req.method !== "GET") {
    respond(405, { error: "Method not allowed" });
    return true;
  }
  try {
    const key = request.searchParams.get("key");
    // No arbitrary URL parameter: requests must match a public source entry from our imported catalogue.
    const { entry, archived } = await lookup(key);
    if (!entry) {
      respond(404, { error: "Материал не найден" });
      return true;
    }
    if (archived) {
      const stored = await readFile(archiveFile(key), "utf8").catch(() => null);
      if (stored) {
        respond(200, stored);
        return true;
      }
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
        python,
        [
          fileURLToPath(new URL("scripts/sync-content.py", root)),
          "--page",
          entry.url,
          entry.title,
        ],
        { timeout: 30000, maxBuffer: 5 * 1024 * 1024, env: pythonEnv },
      )
        .then(async ({ stdout }) => {
          const page = JSON.parse(stdout);
          if (!page.error) {
            cache.set(key, { page, time: Date.now() });
            if (archived) {
              await mkdir(archiveDir, { recursive: true });
              const temp = archiveFile(key) + ".tmp";
              await writeFile(temp, JSON.stringify(page));
              await rename(temp, archiveFile(key));
            }
          }
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
