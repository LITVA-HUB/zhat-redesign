import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cleanEditorHtml, plainText } from "./cms-html.mjs";
import { programs as basePrograms, categories, siteSettings as baseSiteSettings } from "../src/data.js";
import { isValidPhone } from "../src/phone.js";
import { defaultHomepage, homeSectionIds } from "../src/homepage.js";

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
    CREATE TABLE IF NOT EXISTS setting_revisions (
      id INTEGER PRIMARY KEY, setting_name TEXT NOT NULL, version INTEGER NOT NULL,
      value TEXT NOT NULL, created_at TEXT NOT NULL, actor_id INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL,
      subject TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS revisions_entry ON revisions(entry_key,id DESC);
    CREATE INDEX IF NOT EXISTS entries_kind ON entries(kind,updated_at DESC);
    CREATE INDEX IF NOT EXISTS setting_revisions_name ON setting_revisions(setting_name,id DESC);
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
  const setting = (name) => parse(db.prepare("SELECT value FROM settings WHERE name=?").get(name)?.value);
  const saveSetting = (name, value) => db.prepare(
    "INSERT INTO settings(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
  ).run(name, JSON.stringify(value));
  const menuState = () => {
    const stored = setting("menu");
    if (Array.isArray(stored)) return { version: 0, groups: stored };
    return stored && Array.isArray(stored.groups) ? stored : { version: 0, groups: catalogue.groups };
  };
  const menu = () => menuState().groups;
  const saveMenu = (groups) => {
    const next = { version: menuState().version + 1, groups };
    saveSetting("menu", next);
    return next;
  };
  const payload = (row) => row?.draft ? parse(row.draft) : row?.published ? parse(row.published) : null;
  const syncPageMenu = (key, previous, next, custom) => {
    const groups = structuredClone(menu());
    let changed = false;
    if (next && next.title !== previous?.title) {
      for (const section of groups) for (const link of section.links) {
        if (link.key === key && link.title === previous?.title) {
          link.title = next.title;
          changed = true;
        }
      }
    }
    if (custom) {
      const listed = groups.some((section) => section.links.some((link) => link.key === key));
      if (!next && listed || next && (
        next.group !== (previous?.group || "") || next.group && !listed
      )) {
        let link;
        for (const section of groups) {
          const found = section.links.find((item) => item.key === key);
          if (found) link ||= found;
          section.links = section.links.filter((item) => item.key !== key);
        }
        const target = groups.find((section) => section.title === next?.group);
        if (target) target.links.push(link || { key, title: next.title, url: key });
        changed = true;
      }
    }
    if (changed) saveMenu(groups);
  };

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
      const hidden = new Set(hiddenKeys);
      const homepage = this.homepage().value;
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
      return { groups: menu().map((group) => ({
        ...group, links: group.links.filter((link) => !hidden.has(link.key)),
      })), news, overrides, hiddenKeys,
        programs: this.programs().items.filter((item) => item.visible),
        siteSettings: this.siteSettings().values, homepage, updatedAt: now() };
    },
    publicEntry(key) {
      const row = getEntry(key);
      return row && !row.archived && row.published ? parse(row.published) : null;
    },
    isHidden(key) { return Boolean(getEntry(key)?.archived); },
    list(kind, query = "", page = 1, size = 40, publishedOnly = false) {
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
      const items = [...registry.values()].filter((p) =>
        (!publishedOnly || p.status === "published") &&
        (!q || (p.title + " " + p.key).toLocaleLowerCase("ru").includes(q)));
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
      if (kind === "page" && status === "published")
        syncPageMenu(key, row?.published ? parse(row.published) : base, next, !base);
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
      if (row.kind === "page") {
        const base = baseline(key);
        syncPageMenu(key, row.published ? parse(row.published) : base,
          state.published ? parse(state.published) : base, !base);
      }
      auditAction(userId, "restore", payload(row)?.title || key);
      return this.editable(key);
    },
    menu,
    menuState,
    programs() {
      return setting("programs") || {
        version: 0, items: basePrograms.map((program) => ({ ...program, visible: true })),
      };
    },
    setPrograms(items, expectedVersion, userId) {
      const current = this.programs();
      if (Number(expectedVersion) !== current.version)
        throw new CmsError(409, "Направления изменены другим сотрудником. Обновите страницу.");
      const original = new Map(basePrograms.map((program) => [program.id, program]));
      if (!Array.isArray(items) || items.length !== original.size ||
          new Set(items.map((item) => item?.id)).size !== original.size ||
          items.some((item) => !original.has(item?.id)))
        throw new CmsError(400, "Список направлений неполный или содержит повторения");
      const normalized = items.map((item) => {
        const base = original.get(item.id);
        const short = (value, limit, label) => {
          if (typeof value !== "string" || !value.trim() || value.length > limit)
            throw new CmsError(400, `Проверьте поле «${label}» направления ${base.code}`);
          return value.trim();
        };
        if (!categories.slice(1).includes(item.category) || typeof item.visible !== "boolean")
          throw new CmsError(400, `Проверьте категорию и видимость направления ${base.code}`);
        const image = safeImage(item.image);
        if (!image) throw new CmsError(400, `Добавьте фото направления ${base.code}`);
        return {
          id: base.id, code: base.code, url: base.url,
          title: short(item.title, 180, "название"),
          category: item.category,
          duration: short(item.duration, 80, "срок обучения"),
          funding: short(item.funding, 120, "финансирование"),
          description: short(item.description, 500, "описание"),
          image, visible: item.visible,
        };
      });
      const next = { version: current.version + 1, items: normalized };
      saveSetting("programs", next);
      auditAction(userId, "programs", "направления обучения");
      return next;
    },
    siteSettings() {
      return setting("site_settings") || { version: 0, values: baseSiteSettings };
    },
    homepage() {
      return setting("homepage") || { version: 0, value: defaultHomepage(this.siteSettings().values) };
    },
    homepageRevisions() {
      return db.prepare(`SELECT id,version,value,created_at AS createdAt FROM setting_revisions
        WHERE setting_name='homepage' ORDER BY id DESC LIMIT 20`).all().map((row) => ({
          id: row.id, version: row.version, createdAt: row.createdAt,
          title: parse(row.value)?.hero?.title?.replaceAll("\n", " ") || "Без заголовка",
        }));
    },
    restoreHomepage(revisionId, expectedVersion, userId) {
      if (!Number.isSafeInteger(revisionId) || revisionId < 1)
        throw new CmsError(400, "Выберите версию главной");
      const row = db.prepare("SELECT value FROM setting_revisions WHERE setting_name='homepage' AND id=?").get(revisionId);
      if (!row) throw new CmsError(404, "Версия главной не найдена");
      return this.setHomepage(parse(row.value), expectedVersion, userId, "homepage:restore");
    },
    setHomepage(value, expectedVersion, userId, action = "homepage") {
      const current = this.homepage();
      if (Number(expectedVersion) !== current.version)
        throw new CmsError(409, "Блоки главной изменены другим сотрудником. Обновите страницу.");
      const object = (item) => item && typeof item === "object" && !Array.isArray(item);
      if (!object(value) || !object(value.hero) || !object(value.audiences) ||
          !object(value.programs) || !object(value.life) || !object(value.directory) ||
          !object(value.news) || !object(value.contacts))
        throw new CmsError(400, "Структура блоков главной некорректна");
      const text = (item, label, limit, maxLines = 1) => {
        if (typeof item !== "string" || !item.trim() || item.length > limit ||
            item.split(/\r?\n/).length > maxLines || item.split(/\r?\n/).some((line) => !line.trim()))
          throw new CmsError(400, `Проверьте поле «${label}»`);
        return item.trim().replace(/\r\n?/g, "\n");
      };
      const visible = (item, label) => {
        if (typeof item !== "boolean") throw new CmsError(400, `Проверьте видимость блока «${label}»`);
        return item;
      };
      if (!Array.isArray(value.order) || value.order.length !== homeSectionIds.length ||
          new Set(value.order).size !== homeSectionIds.length ||
          value.order.some((id) => !homeSectionIds.includes(id)))
        throw new CmsError(400, "Проверьте порядок блоков главной");
      const audienceIds = ["admission", "students", "parents"];
      if (!Array.isArray(value.audiences.items) || value.audiences.items.length !== audienceIds.length ||
          new Set(value.audiences.items.map((item) => item?.id)).size !== audienceIds.length ||
          value.audiences.items.some((item) => !object(item) || !audienceIds.includes(item.id)))
        throw new CmsError(400, "Проверьте быстрые переходы");
      const audiences = value.audiences.items.map((item) => ({
        id: item.id,
        visible: visible(item.visible, item.title || item.id),
        title: text(item.title, "название перехода", 65),
        description: text(item.description, "описание перехода", 120),
      }));
      if (value.audiences.visible && !audiences.some((item) => item.visible))
        throw new CmsError(400, "Оставьте хотя бы один быстрый переход или скройте весь блок");
      const heroImage = safeImage(value.hero.image), lifeImage = safeImage(value.life.image);
      if (!heroImage || !lifeImage) throw new CmsError(400, "Добавьте фотографии главного экрана и студенческой жизни");
      const normalized = {
        hero: {
          title: text(value.hero.title, "заголовок первого экрана", 120, 3),
          lead: text(value.hero.lead, "текст первого экрана", 300, 4),
          location: text(value.hero.location, "города", 180),
          image: heroImage,
          imageAlt: text(value.hero.imageAlt, "описание главного фото", 180),
          primaryLabel: text(value.hero.primaryLabel, "основная кнопка", 60),
          secondaryLabel: text(value.hero.secondaryLabel, "дополнительная кнопка", 60),
        },
        audiences: { visible: visible(value.audiences.visible, "Быстрый переход"), items: audiences },
        programs: {
          title: text(value.programs.title, "заголовок направлений", 100, 2),
          intro: text(value.programs.intro, "описание направлений", 260, 4),
        },
        life: {
          visible: visible(value.life.visible, "Студенческая жизнь"),
          title: text(value.life.title, "заголовок студенческой жизни", 120, 3),
          description: text(value.life.description, "описание студенческой жизни", 260, 4),
          image: lifeImage,
          imageAlt: text(value.life.imageAlt, "описание фото студенческой жизни", 180),
          caption: text(value.life.caption, "подпись к фото", 120),
        },
        directory: {
          visible: visible(value.directory.visible, "Разделы"),
          title: text(value.directory.title, "заголовок разделов", 100),
        },
        news: {
          visible: visible(value.news.visible, "Новости"),
          title: text(value.news.title, "заголовок новостей", 100, 2),
        },
        contacts: {
          title: text(value.contacts.title, "заголовок контактов", 120, 2),
          buttonLabel: text(value.contacts.buttonLabel, "кнопка контактов", 60),
        },
        order: [...value.order],
      };
      const next = { version: current.version + 1, value: normalized };
      db.exec("BEGIN IMMEDIATE");
      try {
        if (this.homepage().version !== current.version)
          throw new CmsError(409, "Блоки главной изменены другим сотрудником. Обновите страницу.");
        db.prepare(`INSERT INTO setting_revisions(setting_name,version,value,created_at,actor_id)
          VALUES('homepage',?,?,?,?)`).run(current.version, JSON.stringify(current.value), now(), userId);
        saveSetting("homepage", next);
        auditAction(userId, action, "блоки главной страницы");
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      return next;
    },
    setSiteSettings(values, expectedVersion, userId) {
      const current = this.siteSettings();
      if (Number(expectedVersion) !== current.version)
        throw new CmsError(409, "Контакты изменены другим сотрудником. Обновите страницу.");
      if (!values || typeof values !== "object" || Array.isArray(values))
        throw new CmsError(400, "Проверьте настройки сайта");
      const normalized = {};
      for (const [key, fallback] of Object.entries(baseSiteSettings)) {
        const value = values[key];
        if (typeof value !== "string" || !value.trim() || value.length > (key === "heroLead" ? 300 : 180))
          throw new CmsError(400, `Проверьте поле «${key}»`);
        normalized[key] = value.trim();
        if (key.endsWith("Phone") && !isValidPhone(normalized[key]))
          throw new CmsError(400, "Укажите российский номер: +7, 8 или десять цифр");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.generalEmail))
        throw new CmsError(400, "Проверьте адрес электронной почты");
      const next = { version: current.version + 1, values: normalized };
      saveSetting("site_settings", next);
      auditAction(userId, "settings", "контакты и первый экран");
      return next;
    },
    dashboard() {
      const drafts = allEntries().filter((row) => row.draft && !row.archived).slice(0, 5).map((row) => ({
        key: row.key, title: parse(row.draft)?.title || row.key, updatedAt: row.updated_at,
      }));
      return {
        drafts, draftCount: db.prepare("SELECT count(*) AS n FROM entries WHERE draft IS NOT NULL AND archived=0").get().n,
        mediaCount: db.prepare("SELECT count(*) AS n FROM media").get().n,
        programCount: this.programs().items.filter((item) => item.visible).length,
      };
    },
    setMenu(groups, expectedVersion, userId) {
      if (Number(expectedVersion) !== menuState().version)
        throw new CmsError(409, "Меню изменено другим сотрудником. Загрузите актуальную версию.");
      if (!Array.isArray(groups) || groups.length !== 6 || groups.some((g) =>
        !g || typeof g !== "object" || Array.isArray(g) ||
        !catalogue.groups.some((base) => base.title === g.title) || !Array.isArray(g.links) || g.links.length > 1000) ||
        new Set(groups.map((g) => g.title)).size !== catalogue.groups.length)
        throw new CmsError(400, "Структура меню некорректна");
      const normalized = groups.map((g) => ({ title: g.title, links: g.links.map((l) => {
        if (!l || typeof l.key !== "string" || !l.key || !basePages.has(l.key) && !getEntry(l.key))
          throw new CmsError(400, "Пункт меню должен вести к странице сайта");
        if (typeof l.title !== "string" || !l.title.trim() || l.title.length > 200)
          throw new CmsError(400, "Проверьте название пункта меню");
        const url = String(l.url || l.key);
        if (url.length > 1000 || !/^(https?:\/\/|\/(?!\/))/i.test(url))
          throw new CmsError(400, "Проверьте адрес пункта меню");
        return { key: l.key, title: l.title.trim(), url };
      }) }));
      if (normalized.some((group) => new Set(group.links.map((link) => link.key)).size !== group.links.length))
        throw new CmsError(400, "В одном разделе есть повторяющиеся страницы");
      const result = saveMenu(normalized);
      auditAction(userId, "menu", "разделы сайта");
      return result;
    },
    media() { return db.prepare("SELECT id,name,mime,size,uploaded_at AS uploadedAt FROM media ORDER BY uploaded_at DESC").all(); },
    addMedia(item, userId) {
      const uploadedAt = now();
      db.prepare("INSERT INTO media(id,name,filename,mime,size,uploaded_at,author_id) VALUES(?,?,?,?,?,?,?)")
        .run(item.id, item.name, item.filename, item.mime, item.size, uploadedAt, userId);
      auditAction(userId, "upload", item.name);
      return { ...item, uploadedAt, url: `/api/site/media/${item.id}` };
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
