import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCmsStore, CmsError } from "./cms-store.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const MIME = new Map([
  ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"],
  ["image/gif", ".gif"], ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["application/msword", ".doc"], ["video/mp4", ".mp4"],
]);
const REQUEST_LIMIT = 650000;
const FILE_LIMIT = 25 * 1024 * 1024;
const attempts = new Map();
let defaultHandler;

async function readBody(req, limit) {
  const length = Number(req.headers["content-length"] || 0);
  if (length > limit) throw new CmsError(413, "Файл или материал слишком большой");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new CmsError(413, "Файл или материал слишком большой");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(req) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new CmsError(415, "Ожидается JSON");
  try { return JSON.parse((await readBody(req, REQUEST_LIMIT)).toString("utf8")); }
  catch (error) {
    if (error instanceof CmsError) throw error;
    throw new CmsError(400, "Некорректные данные формы");
  }
}
function cookie(req, name) {
  return req.headers.cookie?.split(";").map((item) => item.trim()).find((item) => item.startsWith(name + "="))?.slice(name.length + 1) || "";
}
function respond(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(value));
}
function requireOrigin(req) {
  if (!req.headers.origin) return;
  let origin;
  try { origin = new URL(req.headers.origin); }
  catch { throw new CmsError(403, "Запрос с другого сайта запрещён"); }
  if (origin.host !== req.headers.host) throw new CmsError(403, "Запрос с другого сайта запрещён");
}
function verifyCsrf(given, expected) {
  const a = Buffer.from(String(given || "")), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function secureCookie(req) {
  return req.socket?.encrypted || (process.env.CMS_TRUST_PROXY === "1" && req.headers["x-forwarded-proto"] === "https");
}
function setSessionCookie(req, res, token) {
  res.setHeader("Set-Cookie", `zhat_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800${secureCookie(req) ? "; Secure" : ""}`);
}
function clearSessionCookie(req, res) {
  res.setHeader("Set-Cookie", `zhat_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secureCookie(req) ? "; Secure" : ""}`);
}
function validateMedia(mime, data) {
  if (!MIME.has(mime)) throw new CmsError(415, "Допустимы изображения, PDF, Word, Excel и MP4");
  const starts = (bytes) => data.subarray(0, bytes.length).equals(Buffer.from(bytes));
  if (mime === "application/pdf" && !starts([0x25, 0x50, 0x44, 0x46])) throw new CmsError(415, "Это не PDF-файл");
  if (mime === "image/png" && !starts([0x89, 0x50, 0x4e, 0x47])) throw new CmsError(415, "Это не PNG-файл");
  if (mime === "image/jpeg" && !starts([0xff, 0xd8, 0xff])) throw new CmsError(415, "Это не JPEG-файл");
  if (mime === "image/gif" && data.toString("ascii", 0, 3) !== "GIF") throw new CmsError(415, "Это не GIF-файл");
  if (mime === "image/webp" && (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP")) throw new CmsError(415, "Это не WebP-файл");
  if (mime.includes("openxmlformats") && !starts([0x50, 0x4b])) throw new CmsError(415, "Это не документ Office");
  if (mime === "video/mp4" && data.toString("ascii", 4, 8) !== "ftyp") throw new CmsError(415, "Это не MP4-файл");
}

export function createCmsHandler({ store, uploadDir, setupToken }) {
  async function handle(req, res) {
    const request = new URL(req.url, "http://localhost");
    const path = request.pathname;
    if (!path.startsWith("/api/admin/") && !path.startsWith("/api/site")) return false;
    try {
      if (req.method === "GET" && path === "/api/site") {
        respond(res, 200, store.site()); return true;
      }
      if (req.method === "GET" && path === "/api/site/page") {
        const key = request.searchParams.get("key");
        const entry = store.publicEntry(key);
        respond(res, entry ? 200 : 404, entry || { error: "Материал не найден" }); return true;
      }
      if (req.method === "GET" && path.startsWith("/api/site/media/")) {
        const media = store.mediaById(path.slice("/api/site/media/".length));
        if (!media) throw new CmsError(404, "Файл не найден");
        const data = await readFile(join(uploadDir, media.filename));
        res.setHeader("Content-Type", media.mime);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.setHeader("Content-Disposition", (media.mime.startsWith("image/") || media.mime === "application/pdf" || media.mime === "video/mp4") ? "inline" : "attachment");
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
        if (match) {
          const start = match[1] ? Number(match[1]) : Math.max(0, data.length - Number(match[2]));
          const end = match[1] ? Math.min(data.length - 1, match[2] ? Number(match[2]) : data.length - 1) : data.length - 1;
          if (start > end || start >= data.length) throw new CmsError(416, "Диапазон недоступен");
          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${data.length}`);
          res.setHeader("Accept-Ranges", "bytes");
          res.end(data.subarray(start, end + 1));
        } else res.end(data);
        return true;
      }
      if (path === "/api/admin/setup-state" && req.method === "GET") {
        respond(res, 200, { needsSetup: store.needsSetup() }); return true;
      }
      if (path === "/api/admin/setup" && req.method === "POST") {
        requireOrigin(req);
        const body = await jsonBody(req);
        if (!store.needsSetup()) throw new CmsError(409, "Администратор уже создан");
        if (!setupToken || !verifyCsrf(body.token, setupToken)) throw new CmsError(403, "Неверный код первого запуска");
        const user = store.bootstrap(body);
        const session = store.createSession(user.id);
        setSessionCookie(req, res, session.token);
        respond(res, 201, { user, csrf: session.csrf }); return true;
      }
      if (path === "/api/admin/login" && req.method === "POST") {
        requireOrigin(req);
        const identity = req.socket?.remoteAddress || "local";
        const recent = (attempts.get(identity) || []).filter((time) => Date.now() - time < 15 * 60000);
        if (recent.length >= 8) throw new CmsError(429, "Слишком много попыток. Подождите 15 минут.");
        const body = await jsonBody(req);
        const user = store.authenticate(body.username, body.password);
        if (!user) {
          recent.push(Date.now()); attempts.set(identity, recent);
          throw new CmsError(401, "Неверный логин или пароль");
        }
        attempts.delete(identity);
        const session = store.createSession(user.id);
        setSessionCookie(req, res, session.token);
        respond(res, 200, { user, csrf: session.csrf }); return true;
      }
      const token = cookie(req, "zhat_session");
      const session = store.session(token);
      if (!session) throw new CmsError(401, "Войдите в редактор сайта");
      const { user, csrf } = session;
      if (path === "/api/admin/me" && req.method === "GET") {
        respond(res, 200, { user, csrf }); return true;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        requireOrigin(req);
        if (!verifyCsrf(req.headers["x-csrf-token"], csrf)) throw new CmsError(403, "Обновите страницу и повторите действие");
      }
      if (path === "/api/admin/logout" && req.method === "POST") {
        store.endSession(token); clearSessionCookie(req, res);
        respond(res, 200, { ok: true }); return true;
      }
      if (path === "/api/admin/overview" && req.method === "GET") {
        respond(res, 200, { news: store.list("news", "", 1, 5), pages: store.list("page", "", 1, 5),
          ...store.dashboard(), activity: store.activity() }); return true;
      }
      if (path === "/api/admin/programs" && req.method === "GET") {
        respond(res, 200, store.programs()); return true;
      }
      if (path === "/api/admin/programs" && req.method === "PUT") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор меняет направления");
        const body = await jsonBody(req);
        respond(res, 200, store.setPrograms(body.items, body.expectedVersion, user.id)); return true;
      }
      if (path === "/api/admin/settings" && req.method === "GET") {
        respond(res, 200, store.siteSettings()); return true;
      }
      if (path === "/api/admin/settings" && req.method === "PUT") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор меняет контакты");
        const body = await jsonBody(req);
        respond(res, 200, store.setSiteSettings(body.values, body.expectedVersion, user.id)); return true;
      }
      if (path === "/api/admin/homepage" && req.method === "GET") {
        respond(res, 200, store.homepage()); return true;
      }
      if (path === "/api/admin/homepage" && req.method === "PUT") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор меняет блоки главной");
        const body = await jsonBody(req);
        respond(res, 200, store.setHomepage(body.value, body.expectedVersion, user.id)); return true;
      }
      if (path === "/api/admin/homepage/revisions" && req.method === "GET") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор видит версии блоков");
        respond(res, 200, { items: store.homepageRevisions() }); return true;
      }
      if (path === "/api/admin/homepage/restore" && req.method === "POST") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор восстанавливает блоки");
        const body = await jsonBody(req);
        respond(res, 200, store.restoreHomepage(Number(body.revisionId), body.expectedVersion, user.id)); return true;
      }
      if (path === "/api/admin/entries" && req.method === "GET") {
        const kind = request.searchParams.get("kind") === "news" ? "news" : "page";
        const page = Math.max(1, Math.min(1000, Number(request.searchParams.get("page") || 1) || 1));
        const size = Math.max(1, Math.min(200, Number(request.searchParams.get("size") || 40) || 40));
        respond(res, 200, store.list(kind, request.searchParams.get("q"), page, size,
          kind === "page" && request.searchParams.get("selectable") === "1")); return true;
      }
      if (path === "/api/admin/entry" && req.method === "GET") {
        const entry = store.editable(request.searchParams.get("key"));
        if (!entry) throw new CmsError(404, "Материал не найден");
        respond(res, 200, entry); return true;
      }
      if (path === "/api/admin/entry" && req.method === "PUT") {
        const body = await jsonBody(req);
        respond(res, 200, store.save(body, user.id)); return true;
      }
      if (path === "/api/admin/revisions" && req.method === "GET") {
        respond(res, 200, { items: store.revisions(request.searchParams.get("key")) }); return true;
      }
      if (path === "/api/admin/restore" && req.method === "POST") {
        const body = await jsonBody(req);
        respond(res, 200, store.restore(body.key, Number(body.revisionId), user.id)); return true;
      }
      if (path === "/api/admin/menu" && req.method === "GET") {
        respond(res, 200, store.menuState()); return true;
      }
      if (path === "/api/admin/menu" && req.method === "PUT") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор меняет меню");
        const body = await jsonBody(req);
        respond(res, 200, store.setMenu(body.groups, body.expectedVersion, user.id)); return true;
      }
      if (path === "/api/admin/media" && req.method === "GET") {
        respond(res, 200, { items: store.media() }); return true;
      }
      if (path === "/api/admin/media" && req.method === "POST") {
        let name;
        try { name = decodeURIComponent(req.headers["x-file-name"] || "").replace(/[\\/\x00-\x1f]/g, "").slice(0, 160); }
        catch { throw new CmsError(400, "Недопустимое имя файла"); }
        const mime = req.headers["content-type"]?.split(";")[0]?.trim();
        if (!name || !MIME.has(mime)) throw new CmsError(415, "Выберите изображение, документ или MP4");
        const data = await readBody(req, FILE_LIMIT);
        if (!data.length) throw new CmsError(400, "Файл пуст");
        validateMedia(mime, data);
        const id = randomUUID();
        const filename = id + MIME.get(mime);
        await mkdir(uploadDir, { recursive: true, mode: 0o700 });
        await writeFile(join(uploadDir, filename), data, { flag: "wx", mode: 0o600 });
        try { respond(res, 201, store.addMedia({ id, name, filename, mime, size: data.length }, user.id)); }
        catch (error) { await unlink(join(uploadDir, filename)).catch(() => {}); throw error; }
        return true;
      }
      if (path === "/api/admin/users" && req.method === "GET") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор управляет сотрудниками");
        respond(res, 200, { items: store.users() }); return true;
      }
      if (path === "/api/admin/users" && req.method === "POST") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор управляет сотрудниками");
        respond(res, 201, { items: store.createUser(await jsonBody(req), user.id) }); return true;
      }
      if (path === "/api/admin/user" && req.method === "PATCH") {
        if (user.role !== "admin") throw new CmsError(403, "Только администратор управляет сотрудниками");
        const body = await jsonBody(req);
        respond(res, 200, { items: store.updateUser(Number(body.id), body, user.id) }); return true;
      }
      throw new CmsError(404, "Адрес не найден");
    } catch (error) {
      if (!(error instanceof CmsError)) console.error("CMS request failed:", error);
      respond(res, error instanceof CmsError ? error.status : 500, {
        error: error instanceof CmsError ? error.message : "Внутренняя ошибка. Повторите действие.",
      });
      return true;
    }
  }
  return handle;
}

export function cmsApi(req, res) {
  if (!defaultHandler) {
    const catalogue = JSON.parse(readFileSync(new URL("../src/content.json", import.meta.url), "utf8"));
    const archive = JSON.parse(readFileSync(new URL("../public/content/archive.json", import.meta.url), "utf8"));
    const store = createCmsStore({
      dbPath: process.env.CMS_DB_PATH || join(root, ".data", "cms.sqlite"),
      contentRoot: join(root, "public"), catalogue, archive,
    });
    const setupToken = process.env.CMS_SETUP_TOKEN || randomBytes(18).toString("base64url");
    if (store.needsSetup()) console.log(`Код первого запуска редактора ЖАТ: ${setupToken}`);
    defaultHandler = createCmsHandler({ store, setupToken, uploadDir: process.env.CMS_UPLOAD_DIR || join(root, ".data", "uploads") });
  }
  return defaultHandler(req, res);
}

export function cmsPlugin() {
  return {
    name: "zhat-cms-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        cmsApi(req, res).then((handled) => { if (!handled) next(); }).catch(next);
      });
    },
  };
}
