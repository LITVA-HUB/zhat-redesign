import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { contentApi } from "./content-api.mjs";
import { cmsApi } from "./cms-api.mjs";
const root = fileURLToPath(new URL("../dist/client/", import.meta.url));
// Files of the old Joomla site (/files, /images, …) copied from its hosting; see docs/CMS-OPERATIONS.md.
const legacyRoot = resolve(process.env.CMS_LEGACY_DIR || fileURLToPath(new URL("../.data/legacy/", import.meta.url)));
const legacyPrefixes = ["/files/", "/images/", "/media/", "/cache/", "/docs/"];
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".txt": "text/plain; charset=utf-8",
};
const inside = (base, file) => file === base || file.startsWith(base.endsWith(sep) ? base : base + sep);
const exists = async (file) => { try { return (await stat(file)).isFile(); } catch { return false; } };

// Old addresses (bookmarks, search engines, other sites) open the same material in the new site.
const known = new Set();
try {
  const catalogue = JSON.parse(await readFile(new URL("../src/content.json", import.meta.url), "utf8"));
  const archive = JSON.parse(await readFile(new URL("../public/content/archive.json", import.meta.url), "utf8"));
  for (const item of [...catalogue.pages, ...archive]) known.add(item.key);
} catch {}
function legacyRoute(url) {
  const article = url.searchParams.get("view") === "article" && /^\d+/.exec(url.searchParams.get("id") || "");
  if (article) return "/#/page/" + encodeURIComponent("/article/" + article[0]);
  const key = decodeURIComponent(url.pathname).replace(/\/$/, "");
  if (key && known.has(key)) return "/#/page/" + encodeURIComponent(key);
  return null;
}

createServer(async (req, res) => {
  if (await cmsApi(req, res)) return;
  if (await contentApi(req, res)) return;
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const url = new URL(req.url, "http://localhost");
    const path = decodeURIComponent(url.pathname);
    let file = resolve(root, "." + path);
    if (!inside(resolve(root), file)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!(await exists(file))) {
      const legacy = resolve(legacyRoot, "." + path);
      if (legacyPrefixes.some((prefix) => path.startsWith(prefix))) {
        if (!inside(legacyRoot, legacy) || !(await exists(legacy))) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Файл не найден");
          return;
        }
        const info = await stat(legacy);
        res.writeHead(200, {
          "Content-Type": mime[extname(legacy).toLowerCase()] || "application/octet-stream",
          "Content-Length": info.size,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=86400",
        });
        if (req.method === "HEAD") res.end();
        else createReadStream(legacy).pipe(res);
        return;
      }
      const target = legacyRoute(url);
      if (target) {
        res.writeHead(301, { Location: target });
        res.end();
        return;
      }
      file = resolve(root, "index.html");
    }
    const body = await readFile(file);
    res.setHeader(
      "Content-Type",
      mime[extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(500);
    res.end("Unable to load page");
  }
}).listen(Number(process.env.PORT || 5176), process.env.HOST || "127.0.0.1", () =>
  console.log("ЖАТ: http://" + (process.env.HOST || "127.0.0.1") + ":" + (process.env.PORT || 5176)),
);
