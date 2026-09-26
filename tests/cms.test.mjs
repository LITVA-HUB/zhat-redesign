import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createCmsStore } from "../scripts/cms-store.mjs";
import { createCmsHandler } from "../scripts/cms-api.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalogue = JSON.parse(await readFile(join(root, "src/content.json"), "utf8"));
const archive = JSON.parse(await readFile(join(root, "public/content/archive.json"), "utf8"));

test("редактор: вход, черновик, публикация, права, файлы и версии", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zhat-cms-test-"));
  const store = createCmsStore({ dbPath: join(dir, "site.sqlite"), catalogue, archive, contentRoot: join(root, "public") });
  const handler = createCmsHandler({ store, uploadDir: join(dir, "uploads"), setupToken: "test-setup-token" });
  const server = createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "", csrf = "";
  const api = async (path, { method = "GET", body, headers = {}, withAuth = true } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body && !(body instanceof Uint8Array) ? { "Content-Type": "application/json" } : {}),
        ...(withAuth ? { Cookie: cookie, "X-CSRF-Token": csrf } : {}), ...headers,
      },
      body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => null), cookie: res.headers.get("set-cookie") };
  };
  try {
    assert.equal((await api("/api/admin/setup-state")).data.needsSetup, true);
    assert.equal((await api("/api/admin/entries?kind=page", { withAuth: false })).status, 401);
    assert.equal((await api("/api/admin/setup", { method: "POST", body: { token: "wrong", username: "owner", password: "long-password-123" }, withAuth: false })).status, 403);
    const created = await api("/api/admin/setup", { method: "POST", body: { token: "test-setup-token", username: "owner", name: "Главный редактор", password: "long-password-123" }, withAuth: false });
    assert.equal(created.status, 201);
    cookie = created.cookie.split(";")[0]; csrf = created.data.csrf;
    assert.match(created.cookie, /HttpOnly; SameSite=Strict/);
    assert.equal((await api("/api/admin/me")).data.user.role, "admin");
    assert.equal((await api("/api/admin/entry", { method: "PUT", body: { kind: "news", title: "Пустая новость", status: "published", expectedVersion: 0 } })).status, 400);
    assert.equal((await api("/api/admin/entry", { method: "PUT", body: { kind: "news", title: "Защита", expectedVersion: 0 }, headers: { Origin: "https://another.example" } })).status, 403);
    assert.equal((await api("/api/admin/setup", { method: "POST", body: { token: "test-setup-token", username: "other", password: "long-password-123" } })).status, 409);

    const pageKey = "/sveden/common";
    const original = await api("/api/admin/entry?key=" + encodeURIComponent(pageKey));
    assert.equal(original.status, 200);
    const baseline = await api("/api/site/page?key=" + encodeURIComponent(pageKey));
    assert.equal(baseline.status, 404);
    const draft = await api("/api/admin/entry", { method: "PUT", body: {
      key: pageKey, kind: "page", title: "Новая редакция", summary: "Проверка",
      html: "<p>Черновик</p><script>alert(1)</script><a href=javascript:alert(1)>опасно</a>",
      status: "draft", expectedVersion: 0,
    } });
    assert.equal(draft.status, 200);
    assert.equal(draft.data.status, "draft");
    assert.equal((await api("/api/site/page?key=" + encodeURIComponent(pageKey))).status, 404, "Черновик не заменяет опубликованную страницу");
    assert.equal((await api("/api/admin/entry", { method: "PUT", body: { ...draft.data, expectedVersion: 0, status: "published" } })).status, 409);
    const published = await api("/api/admin/entry", { method: "PUT", body: { ...draft.data, expectedVersion: 1, status: "published" } });
    assert.equal(published.status, 200);
    const publicPage = await api("/api/site/page?key=" + encodeURIComponent(pageKey));
    assert.equal(publicPage.data.title, "Новая редакция");
    assert.doesNotMatch(publicPage.data.html, /script|javascript:|alert\(/);
    const versions = (await api("/api/admin/revisions?key=" + encodeURIComponent(pageKey))).data.items;
    assert.equal(versions.length, 2);
    const restored = await api("/api/admin/restore", { method: "POST", body: { key: pageKey, revisionId: versions.at(-1).id } });
    assert.equal(restored.status, 200);
    assert.equal(restored.data.title, original.data.title);
    assert.equal((await api("/api/site/page?key=" + encodeURIComponent(pageKey))).status, 404, "Восстановлена исходная публичная страница");

    const news = await api("/api/admin/entry", { method: "PUT", body: {
      kind: "news", title: "Новая новость", summary: "Событие", html: "<p>Текст новости</p>",
      status: "published", expectedVersion: 0,
    } });
    assert.equal(news.status, 200);
    assert.ok(news.data.key.startsWith("/news/"));
    const site = await api("/api/site");
    assert.equal(site.data.news[0].title, "Новая новость");

    const group = catalogue.groups[0].title;
    const newPage = await api("/api/admin/entry", { method: "PUT", body: {
      kind: "page", title: "Новая страница", html: "<p>Содержимое</p>", group,
      status: "draft", expectedVersion: 0,
    } });
    assert.equal(newPage.status, 200);
    assert.equal(newPage.data.group, group);
    assert.ok(!(await api("/api/admin/menu")).data.groups[0].links.some((item) => item.key === newPage.data.key));
    const publishedPage = await api("/api/admin/entry", { method: "PUT", body: {
      ...newPage.data, status: "published", expectedVersion: 1,
    } });
    assert.equal(publishedPage.status, 200);
    assert.ok((await api("/api/admin/menu")).data.groups[0].links.some((item) => item.key === newPage.data.key));
    assert.equal((await api("/api/site/page?key=" + encodeURIComponent(newPage.data.key))).data.title, "Новая страница");
    assert.equal((await api("/api/admin/entry", { method: "PUT", body: {
      ...publishedPage.data, image: "javascript:alert(1)", expectedVersion: 2,
    } })).status, 400);

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
    const media = await api("/api/admin/media", { method: "POST", body: png, headers: { "Content-Type": "image/png", "X-File-Name": encodeURIComponent("фото.png") } });
    assert.equal(media.status, 201);
    assert.ok(media.data.uploadedAt, "Загруженный файл сразу показывает дату");
    assert.equal((await fetch(base + media.data.url)).status, 200);
    assert.equal((await api("/api/admin/media", { method: "POST", body: Buffer.from("<svg/>"), headers: { "Content-Type": "image/png", "X-File-Name": "fake.png" } })).status, 415);

    const basePrograms = (await api("/api/admin/programs")).data;
    assert.equal(basePrograms.items.length, 11);
    assert.equal(new Set(basePrograms.items.map((item) => item.image)).size, 11, "У каждого направления отдельное фото");
    for (const program of basePrograms.items) {
      const image = await readFile(join(root, "public", program.image.slice(1)));
      assert.ok(image.length > 100000, `Фото ${program.code} должно существовать в проекте`);
    }
    const changedPrograms = structuredClone(basePrograms.items);
    changedPrograms[0].image = media.data.url;
    changedPrograms[0].title = "Обновлённое направление";
    changedPrograms[1].visible = false;
    changedPrograms.reverse();
    assert.equal((await api("/api/admin/programs", { method: "PUT", body: {
      items: changedPrograms, expectedVersion: 0,
    } })).status, 200);
    const publicPrograms = (await api("/api/site")).data.programs;
    assert.equal(publicPrograms[0].code, changedPrograms[0].code, "Порядок специальностей попадает на сайт");
    assert.equal(publicPrograms.length, 10, "Скрытое направление не публикуется");
    assert.equal(publicPrograms.find((item) => item.title === "Обновлённое направление").image, media.data.url);
    assert.equal((await api("/api/admin/programs", { method: "PUT", body: {
      items: changedPrograms, expectedVersion: 0,
    } })).status, 409, "Нельзя перезаписать изменения другого сотрудника");
    const unsafePrograms = structuredClone(changedPrograms);
    unsafePrograms[0].image = "javascript:alert(1)";
    assert.equal((await api("/api/admin/programs", { method: "PUT", body: {
      items: unsafePrograms, expectedVersion: 1,
    } })).status, 400);
    const settings = (await api("/api/admin/settings")).data;
    assert.match(settings.values.admissionPhone, /926/);
    const values = { ...settings.values, admissionPhone: "+7 (999) 111-22-33" };
    assert.equal((await api("/api/admin/settings", { method: "PUT", body: { values, expectedVersion: 0 } })).status, 200);
    assert.equal((await api("/api/site")).data.siteSettings.admissionPhone, values.admissionPhone);
    assert.equal((await api("/api/admin/settings", { method: "PUT", body: {
      values: { ...values, generalEmail: "некорректно" }, expectedVersion: 1,
    } })).status, 400);
    const overview = (await api("/api/admin/overview")).data;
    assert.equal(overview.programCount, 10);
    assert.equal(overview.mediaCount, 1);
    assert.equal(overview.draftCount, 0);
    const pending = await api("/api/admin/entry", { method: "PUT", body: {
      kind: "news", title: "Новость для проверки очереди", html: "<p>Проверка</p>",
      status: "draft", expectedVersion: 0,
    } });
    assert.equal(pending.status, 200);
    const queue = (await api("/api/admin/overview")).data;
    assert.equal(queue.draftCount, 1);
    assert.equal(queue.drafts[0].key, pending.data.key);

    const users = await api("/api/admin/users", { method: "POST", body: { username: "writer", name: "Редактор", role: "editor", password: "writer-password-123" } });
    assert.equal(users.status, 201);
    assert.equal((await api("/api/admin/user", { method: "PATCH", body: { id: 1, active: false } })).status, 409, "Последнего администратора нельзя отключить");
    const login = await api("/api/admin/login", { method: "POST", body: { username: "writer", password: "writer-password-123" }, withAuth: false });
    cookie = login.cookie.split(";")[0]; csrf = login.data.csrf;
    assert.equal((await api("/api/admin/menu", { method: "PUT", body: { groups: catalogue.groups } })).status, 403);
    assert.equal((await api("/api/admin/programs", { method: "PUT", body: { items: changedPrograms, expectedVersion: 1 } })).status, 403);
    assert.equal((await api("/api/admin/settings", { method: "PUT", body: { values, expectedVersion: 1 } })).status, 403);
    assert.equal((await api("/api/admin/entry", { method: "PUT", body: { kind: "news", title: "Редактор пишет", status: "draft", expectedVersion: 0 } })).status, 200);
    assert.equal((await api("/api/admin/logout", { method: "POST" })).status, 200);
    assert.equal((await api("/api/admin/me")).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
