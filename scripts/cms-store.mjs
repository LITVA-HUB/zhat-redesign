import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cleanEditorHtml, plainText } from "./cms-html.mjs";

export class CmsError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const now = () => new Date().toISOString();
const parse = (value) => value ? JSON.parse(value) : null;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const passwordHash = (password) => {
  const salt = randomBytes(24).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
const safeImage = (value) => {
  const image = String(value || "").trim();
  if (!image) return "";
  if (image.length > 1000 || !/^(https?:\/\/|\/(?!\/))/i.test(image))
    throw new CmsError(400, "Используйте ссылку на фото с сайта или загруженный файл");
  return image;
};
const verifyPassword = (password, stored) => {
  if (!stored) return false;
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const known = Buffer.from(expected, "hex");
  return actual.length === known.length && timingSafeEqual(actual, known);
};
const publicUser = ({ id, username, name, role, active }) => ({ id, username, name, role, active: Boolean(active) });

export function createCmsStore({ dbPath, catalogue, archive = [], contentRoot }) {
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','editor')),
      password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      csrf TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entries (
      key TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('page','news')),
      source_url TEXT, published TEXT, draft TEXT,
      archived INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, author_id INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY, entry_key TEXT NOT NULL, state TEXT NOT NULL,
      created_at TEXT NOT NULL, author_id INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, filename TEXT NOT NULL,
      mime TEXT NOT NULL, size INTEGER NOT NULL, uploaded_at TEXT NOT NULL,
      author_id INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL,
      subject TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS revisions_entry ON revisions(entry_key,id DESC);
    CREATE INDEX IF NOT EXISTS entries_kind ON entries(kind,updated_at DESC);
  `);

  const basePages = new Map(catalogue.pages.map((p) => [p.key, p]));
  const archiveItems = new Map(archive.map((p) => [p.key, p]));
  const baseNews = new Map(catalogue.news.map((p) => [p.key, p]));
  const getEntry = (key) => db.prepare("SELECT * FROM entries WHERE key=?").get(key);
  const allEntries = () => db.prepare("SELECT * FROM entries ORDER BY updated_at DESC").all();
  const auditAction = (userId, action, subject) => db.prepare(
    "INSERT INTO audit(actor_id,action,subject,created_at) VALUES(?,?,?,?)",
  ).run(userId, action, subject, now());
  const baseline = (key) => {
    const page = basePages.get(key);
    if (page) {
      const body = JSON.parse(readFileSync(resolve(contentRoot, page.contentFile.slice(1)), "utf8"));
      return {
        key, kind: baseNews.has(key) || archiveItems.has(key) ? "news" : "page", title: page.title,
        summary: page.text?.slice(0, 260) || "", html: body.html || "",
        image: baseNews.get(key)?.image || "", sourceUrl: page.url,
        publishedAt: catalogue.updatedAt,
      };
    }
    const item = archiveItems.get(key);
    return item ? {
      key, kind: "news", title: item.title, summary: "", html: "",
      image: "", sourceUrl: item.url, publishedAt: null,
      needsSourceBody: true,
    } : null;
  };
  const menu = () => parse(db.prepare("SELECT value FROM settings WHERE name='menu'").get()?.value) || catalogue.groups;
  const payload = (row) => row?.draft ? parse(row.draft) : row?.published ? parse(row.published) : null;

  return {
    db,
    close() { db.close(); },
    needsSetup() { return !db.prepare("SELECT id FROM users LIMIT 1").get(); },
    bootstrap({ username, name, password }) {
      if (!this.needsSetup()) throw new CmsError(409, "Первый администратор уже создан");
      if (!/^[\p{L}\p{N}._-]{3,50}$/u.test(username || "")) throw new CmsError(400, "Логин: от 3 до 50 букв или цифр");
      if (String(password || "").length < 10) throw new CmsError(400, "Пароль должен содержать не менее 10 символов");
      db.prepare("INSERT INTO users(username,name,role,password_hash,created_at) VALUES(?,?,?,?,?)")
        .run(username.toLocaleLowerCase("ru"), String(name || username).slice(0, 100), "admin", passwordHash(password), now());
      const user = db.prepare("SELECT * FROM users WHERE username=?").get(username.toLocaleLowerCase("ru"));
      auditAction(user.id, "setup", user.username);
      return publicUser(user);
    },
    authenticate(username, password) {
      const user = db.prepare("SELECT * FROM users WHERE username=? AND active=1").get(String(username || "").toLocaleLowerCase("ru"));
      if (!user || !verifyPassword(String(password || ""), user.password_hash)) return null;
      return publicUser(user);
    },
    createSession(userId) {
      db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now());
      const token = randomBytes(32).toString("base64url");
      const csrf = randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      db.prepare("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)")
        .run(hash(token), userId, csrf, expiresAt);
      return { token, csrf, expiresAt };
    },
    session(token) {
      if (!token) return null;
      const row = db.prepare(`SELECT s.csrf,s.expires_at,u.id,u.username,u.name,u.role,u.active
        FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=?`).get(hash(token));
      return row?.active && row.expires_at > now() ? { user: publicUser(row), csrf: row.csrf } : null;
    },
    endSession(token) { if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token)); },
    site() {
      const rows = allEntries();
      const hiddenKeys = rows.filter((r) => r.archived).map((r) => r.key);
      const overrides = rows.filter((r) => !r.archived && r.published).map((r) => {
        const p = parse(r.published);
        return { key: r.key, kind: r.kind, title: p.title, summary: p.summary,
          text: plainText(p.html).slice(0, 2000), image: p.image,
          publishedAt: p.publishedAt, url: r.source_url || "", updatedAt: r.updated_at };
      });
      const news = [
        ...catalogue.news.filter((n) => !hiddenKeys.includes(n.key) && !overrides.some((p) => p.key === n.key)),
        ...overrides.filter((p) => p.kind === "news"),
      ];
      news.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
      return { groups: menu(), news, overrides, hiddenKeys, updatedAt: now() };
    },
    publicEntry(key) {
      const row = getEntry(key);
      return row && !row.archived && row.published ? parse(row.published) : null;
    },
    isHidden(key) { return Boolean(getEntry(key)?.archived); },
    list(kind, query = "", page = 1, size = 40) {
      const registry = new Map();
      if (kind === "page") {
        for (const item of catalogue.pages) {
          if (baseNews.has(item.key) || archiveItems.has(item.key)) continue;
          registry.set(item.key, { key: item.key, title: item.title, kind, sourceUrl: item.url,
            status: item.error ? "source-error" : "published", version: 0, updatedAt: catalogue.updatedAt });
        }
      } else {
        for (const item of archive) registry.set(item.key, { key: item.key, title: item.title, kind, sourceUrl: item.url,
          status: "published", version: 0, updatedAt: catalogue.updatedAt });
        for (const item of catalogue.news) registry.set(item.key, { key: item.key, title: item.title, kind, sourceUrl: item.url,
          status: "published", version: 0, updatedAt: catalogue.updatedAt });
      }
      for (const row of allEntries().filter((r) => r.kind === kind)) {
        const p = payload(row) || baseline(row.key);
        registry.set(row.key, { key: row.key, title: p?.title || row.key, kind, sourceUrl: row.source_url,
          status: row.archived ? "archived" : row.draft ? "draft" : "published", version: row.version,
          updatedAt: row.updated_at, image: p?.image || "" });
      }
      const q = String(query).trim().toLocaleLowerCase("ru");
      const items = [...registry.values()].filter((p) => !q || (p.title + " " + p.key).toLocaleLowerCase("ru").includes(q));
      items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      return { items: items.slice((page - 1) * size, page * size), total: items.length, page, size };
    },
    editable(key) {
      const row = getEntry(key), base = baseline(key);
      if (!row && !base) return null;
      const entry = payload(row) || base;
      return { ...entry, key, kind: row?.kind || entry.kind, version: row?.version || 0,
        status: row?.archived ? "archived" : row?.draft ? "draft" : "published",
        sourceUrl: row?.source_url || base?.sourceUrl || "", hasPublished: Boolean(row?.published || base) };
    },
    save({ key, kind, title, summary = "", html = "", image = "", status = "draft", expectedVersion, group }, userId) {
      if (!["page", "news"].includes(kind)) throw new CmsError(400, "Выберите тип материала");
      if (!["draft", "published", "archived"].includes(status)) throw new CmsError(400, "Неизвестный статус");
      if (typeof title !== "string" || title.trim().length < 2 || title.length > 220) throw new CmsError(400, "Укажите название до 220 символов");
      if (String(summary).length > 800 || String(html).length > 600000) throw new CmsError(413, "Материал слишком большой");
      if (group && !catalogue.groups.some((item) => item.title === group)) throw new CmsError(400, "Выберите существующий раздел сайта");
      const cleanedHtml = cleanEditorHtml(html);
      if (status === "published" && !plainText(cleanedHtml) && !/<(img|video|audio)\b/i.test(cleanedHtml))
        throw new CmsError(400, "Добавьте текст или файл перед публикацией");
      key ||= `/${kind === "news" ? "news" : "custom"}/${randomUUID()}`;
      if (!/^\/(news|custom|article|[a-z0-9-]+)(?:\/[a-zA-Z0-9а-яА-ЯёЁ._-]+)*$/u.test(key) || key.length > 250) throw new CmsError(400, "Недопустимый адрес материала");
      const row = getEntry(key), base = baseline(key);
      if (row?.kind && row.kind !== kind || base?.kind && base.kind !== kind) throw new CmsError(409, "Тип существующего материала изменить нельзя");
      if ((row?.version || 0) !== Number(expectedVersion ?? 0)) throw new CmsError(409, "Материал изменён другим сотрудником. Обновите страницу перед сохранением.");
      const stamp = now();
      const next = {
        key, kind, title: title.trim(), summary: String(summary).trim(), html: cleanedHtml,
        image: safeImage(image), group: String(group === undefined ? payload(row)?.group || "" : group).slice(0, 100),
        sourceUrl: row?.source_url || base?.sourceUrl || "",
        publishedAt: status === "published" ? stamp : (payload(row)?.publishedAt || base?.publishedAt || null),
      };
      const state = row ? { kind: row.kind, source_url: row.source_url, published: row.published,
        draft: row.draft, archived: row.archived } : base ? {
        kind: base.kind, source_url: base.sourceUrl, published: null, draft: null, archived: 0,
      } : null;
      if (state) db.prepare("INSERT INTO revisions(entry_key,state,created_at,author_id) VALUES(?,?,?,?)")
        .run(key, JSON.stringify(state), stamp, userId);
      const published = status === "published" ? JSON.stringify(next) : row?.published || null;
      const draft = status === "draft" ? JSON.stringify(next) : null;
      db.prepare(`INSERT INTO entries(key,kind,source_url,published,draft,archived,version,created_at,updated_at,author_id)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET published=excluded.published,
        draft=excluded.draft,archived=excluded.archived,version=excluded.version,updated_at=excluded.updated_at,author_id=excluded.author_id`)
        .run(key, kind, next.sourceUrl, published, draft, Number(status === "archived"),
          (row?.version || 0) + 1, row?.created_at || stamp, stamp, userId);
      if (kind === "page" && status === "published" && next.title !== (payload(row)?.title || base?.title || "")) {
        const groups = structuredClone(menu());
        let updated = false;
        for (const section of groups) for (const link of section.links) {
          if (link.key === key && link.title === (payload(row)?.title || base?.title)) {
            link.title = next.title; updated = true;
          }
        }
        if (updated) db.prepare("INSERT INTO settings(name,value) VALUES('menu',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value")
          .run(JSON.stringify(groups));
      }
      if (kind === "page" && next.group && status === "published" && !base && !menu().some((g) => g.links.some((l) => l.key === key))) {
        const groups = structuredClone(menu());
        const target = groups.find((g) => g.title === next.group);
        if (target) {
          target.links.push({ key, title: next.title, url: key });
          db.prepare("INSERT INTO settings(name,value) VALUES('menu',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value")
            .run(JSON.stringify(groups));
        }
      }
      auditAction(userId, status, next.title);
      return this.editable(key);
    },
    revisions(key) {
      return db.prepare("SELECT id,created_at,author_id FROM revisions WHERE entry_key=? ORDER BY id DESC LIMIT 30").all(key);
    },
    restore(key, revisionId, userId) {
      const row = getEntry(key);
      const revision = db.prepare("SELECT * FROM revisions WHERE id=? AND entry_key=?").get(revisionId, key);
      if (!row || !revision) throw new CmsError(404, "Версия не найдена");
      const stamp = now();
      db.prepare("INSERT INTO revisions(entry_key,state,created_at,author_id) VALUES(?,?,?,?)")
        .run(key, JSON.stringify({ kind: row.kind, source_url: row.source_url, published: row.published,
          draft: row.draft, archived: row.archived }), stamp, userId);
      const state = parse(revision.state);
      db.prepare("UPDATE entries SET published=?,draft=?,archived=?,version=?,updated_at=?,author_id=? WHERE key=?")
        .run(state.published, state.draft, state.archived, row.version + 1, stamp, userId, key);
      auditAction(userId, "restore", payload(row)?.title || key);
      return this.editable(key);
    },
    menu,
    setMenu(groups, userId) {
      if (!Array.isArray(groups) || groups.length !== 6 || groups.some((g) =>
        !catalogue.groups.some((base) => base.title === g.title) || !Array.isArray(g.links))) throw new CmsError(400, "Структура меню некорректна");
      const normalized = groups.map((g) => ({ title: g.title, links: g.links.map((l) => {
        if (!l.key || !l.title || (!basePages.has(l.key) && !getEntry(l.key))) throw new CmsError(400, "Пункт меню должен вести к странице сайта");
        return { key: l.key, title: String(l.title).slice(0, 200), url: l.url || l.key };
      }) }));
      db.prepare("INSERT INTO settings(name,value) VALUES('menu',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value")
        .run(JSON.stringify(normalized));
      auditAction(userId, "menu", "разделы сайта");
      return normalized;
    },
    media() { return db.prepare("SELECT id,name,mime,size,uploaded_at AS uploadedAt FROM media ORDER BY uploaded_at DESC").all(); },
    addMedia(item, userId) {
      db.prepare("INSERT INTO media(id,name,filename,mime,size,uploaded_at,author_id) VALUES(?,?,?,?,?,?,?)")
        .run(item.id, item.name, item.filename, item.mime, item.size, now(), userId);
      auditAction(userId, "upload", item.name);
      return { ...item, url: `/api/site/media/${item.id}` };
    },
    mediaById(id) { return db.prepare("SELECT * FROM media WHERE id=?").get(id); },
    users() { return db.prepare("SELECT id,username,name,role,active FROM users ORDER BY id").all().map(publicUser); },
    createUser({ username, name, role, password }, actorId) {
      if (!/^[\p{L}\p{N}._-]{3,50}$/u.test(username || "") || !["admin", "editor"].includes(role) || String(password || "").length < 10)
        throw new CmsError(400, "Проверьте логин, роль и пароль (не менее 10 символов)");
      try {
        db.prepare("INSERT INTO users(username,name,role,password_hash,created_at) VALUES(?,?,?,?,?)")
          .run(username.toLocaleLowerCase("ru"), String(name || username).slice(0, 100), role, passwordHash(password), now());
      } catch (error) {
        if (String(error).includes("UNIQUE")) throw new CmsError(409, "Этот логин уже занят");
        throw error;
      }
      auditAction(actorId, "user:create", username);
      return this.users();
    },
    updateUser(id, { name, role, password, active }, actorId) {
      const user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
      if (!user) throw new CmsError(404, "Сотрудник не найден");
      if (role && !["admin", "editor"].includes(role)) throw new CmsError(400, "Неизвестная роль");
      if (password && String(password).length < 10) throw new CmsError(400, "Пароль слишком короткий");
      const adminCount = db.prepare("SELECT count(*) AS count FROM users WHERE role='admin' AND active=1").get().count;
      if (user.role === "admin" && user.active && adminCount <= 1 && (role === "editor" || active === false))
        throw new CmsError(409, "Нельзя отключить последнего администратора");
      db.prepare("UPDATE users SET name=?,role=?,active=?,password_hash=? WHERE id=?")
        .run(String(name || user.name).slice(0, 100), role || user.role, active === undefined ? user.active : Number(Boolean(active)),
          password ? passwordHash(password) : user.password_hash, id);
      if (active === false || password) db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
      auditAction(actorId, "user:update", user.username);
      return this.users();
    },
    activity() { return db.prepare("SELECT action,subject,created_at AS createdAt FROM audit ORDER BY id DESC LIMIT 15").all(); },
  };
}
