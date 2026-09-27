import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createCmsStore } from "../scripts/cms-store.mjs";
import { createCmsHandler } from "../scripts/cms-api.mjs";
import { isValidPhone, phoneHref } from "../src/phone.js";

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
    const archivedPage = await api("/api/admin/entry", { method: "PUT", body: {
      ...publishedPage.data, status: "archived", expectedVersion: 2,
    } });
    assert.equal(archivedPage.status, 200);
    assert.ok(!(await api("/api/site")).data.groups[0].links.some((item) => item.key === newPage.data.key), "Скрытая страница исчезает из публичного меню");
    assert.ok((await api("/api/admin/menu")).data.groups[0].links.some((item) => item.key === newPage.data.key), "Администратор сохраняет пункт для восстановления");
    assert.equal((await api("/api/site/page?key=" + encodeURIComponent(newPage.data.key))).status, 404);
    const republishedPage = await api("/api/admin/entry", { method: "PUT", body: {
      ...archivedPage.data, status: "published", expectedVersion: 3,
    } });
    assert.equal(republishedPage.status, 200);
    assert.ok((await api("/api/site")).data.groups[0].links.some((item) => item.key === newPage.data.key), "После публикации пункт снова виден");
    const movedPage = await api("/api/admin/entry", { method: "PUT", body: {
      ...republishedPage.data, group: catalogue.groups[1].title, status: "published", expectedVersion: 4,
    } });
    assert.equal(movedPage.status, 200);
    const movedMenu = (await api("/api/site")).data.groups;
    assert.ok(!movedMenu[0].links.some((item) => item.key === newPage.data.key), "Страница исчезает из прежнего раздела");
    assert.ok(movedMenu[1].links.some((item) => item.key === newPage.data.key), "Смена раздела перемещает страницу");
    const pageRevisions = (await api("/api/admin/revisions?key=" + encodeURIComponent(newPage.data.key))).data.items;
    const restoredGroup = await api("/api/admin/restore", { method: "POST", body: {
      key: newPage.data.key, revisionId: pageRevisions[0].id,
    } });
    assert.equal(restoredGroup.status, 200);
    assert.equal(restoredGroup.data.group, group);
    const restoredMenu = (await api("/api/site")).data.groups;
    assert.ok(restoredMenu[0].links.some((item) => item.key === newPage.data.key), "Восстановление версии возвращает прежний раздел");
    assert.ok(!restoredMenu[1].links.some((item) => item.key === newPage.data.key));
    const restoredDraft = await api("/api/admin/restore", { method: "POST", body: {
      key: newPage.data.key, revisionId: pageRevisions.at(-1).id,
    } });
    assert.equal(restoredDraft.status, 200);
    assert.equal(restoredDraft.data.status, "draft");
    assert.ok(!(await api("/api/admin/entries?kind=page&selectable=1&q=" + encodeURIComponent(newPage.data.key))).data.items.some((item) => item.key === newPage.data.key),
      "Поиск для меню показывает только опубликованные страницы");
    assert.ok(!(await api("/api/site")).data.groups[0].links.some((item) => item.key === newPage.data.key), "Восстановленный черновик не оставляет битую ссылку");
    assert.equal((await api("/api/admin/entry", { method: "PUT", body: {
      ...restoredDraft.data, image: "javascript:alert(1)", expectedVersion: 7,
    } })).status, 400);

    const menuBefore = (await api("/api/admin/menu")).data;
    assert.ok(menuBefore.version > 0, "Автоматическая синхронизация страниц обновляет версию меню");
    const editedMenu = structuredClone(menuBefore.groups);
    editedMenu[0].links[0].title = "Проверенное название раздела";
    const menuSaved = await api("/api/admin/menu", { method: "PUT", body: {
      groups: editedMenu, expectedVersion: menuBefore.version,
    } });
    assert.equal(menuSaved.status, 200);
    assert.equal(menuSaved.data.version, menuBefore.version + 1);
    assert.equal((await api("/api/site")).data.groups[0].links[0].title, "Проверенное название раздела");
    assert.equal((await api("/api/admin/menu", { method: "PUT", body: {
      groups: menuBefore.groups, expectedVersion: menuBefore.version,
    } })).status, 409, "Старая вкладка не перезаписывает меню другого сотрудника");
    const duplicateMenu = structuredClone(editedMenu);
    duplicateMenu[1].title = duplicateMenu[0].title;
    assert.equal((await api("/api/admin/menu", { method: "PUT", body: {
      groups: duplicateMenu, expectedVersion: menuSaved.data.version,
    } })).status, 400);
    const missingGroup = structuredClone(editedMenu);
    missingGroup[1] = null;
    assert.equal((await api("/api/admin/menu", { method: "PUT", body: {
      groups: missingGroup, expectedVersion: menuSaved.data.version,
    } })).status, 400);
    const unsafeMenu = structuredClone(editedMenu);
    unsafeMenu[0].links[0].url = "javascript:alert(1)";
    assert.equal((await api("/api/admin/menu", { method: "PUT", body: {
      groups: unsafeMenu, expectedVersion: menuSaved.data.version,
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
    assert.equal(phoneHref(settings.values.admissionPhone), "tel:+79260760893");
    assert.equal(phoneHref("8 (926) 076-08-93"), "tel:+79260760893");
    assert.equal(phoneHref("926 076-08-93"), "tel:+79260760893");
    assert.equal(isValidPhone("+7 (926) 076-08-93"), true);
    assert.equal(isValidPhone("12345"), false);
    const values = { ...settings.values, admissionPhone: "+7 (999) 111-22-33" };
    assert.equal((await api("/api/admin/settings", { method: "PUT", body: { values, expectedVersion: 0 } })).status, 200);
    assert.equal((await api("/api/site")).data.siteSettings.admissionPhone, values.admissionPhone);
    const nationalValues = { ...values, admissionPhone: "8 (999) 111-22-33" };
    assert.equal((await api("/api/admin/settings", { method: "PUT", body: { values: nationalValues, expectedVersion: 1 } })).status, 200);
    assert.equal(phoneHref((await api("/api/site")).data.siteSettings.admissionPhone), "tel:+79991112233");
    assert.equal((await api("/api/admin/settings", { method: "PUT", body: {
      values: { ...values, generalEmail: "некорректно" }, expectedVersion: 2,
    } })).status, 400);
    assert.equal((await api("/api/admin/settings", { method: "PUT", body: {
      values: { ...values, generalPhone: "12345" }, expectedVersion: 2,
    } })).status, 400);
    const homepage = (await api("/api/admin/homepage")).data;
    assert.equal(homepage.version, 0);
    assert.equal(homepage.value.hero.title, "Твоё будущее\nнабирает\nвысоту.");
    assert.equal(homepage.value.audiences.items.length, 3);
    const editedHome = structuredClone(homepage.value);
    editedHome.hero.title = "Учись\nсоздавай\nвзлетай.";
    editedHome.hero.lead = "Тестовый текст первого экрана";
    editedHome.hero.image = media.data.url;
    editedHome.life.visible = false;
    editedHome.order = ["news", "audiences", "programs", "directory", "life"];
    editedHome.audiences.items.reverse();
    const savedHome = await api("/api/admin/homepage", { method: "PUT", body: {
      value: editedHome, expectedVersion: 0,
    } });
    assert.equal(savedHome.status, 200);
    assert.equal(savedHome.data.version, 1);
    const publicHome = (await api("/api/site")).data.homepage;
    assert.equal(publicHome.hero.title, editedHome.hero.title);
    assert.equal(publicHome.hero.image, media.data.url);
    assert.equal(publicHome.life.visible, false);
    assert.deepEqual(publicHome.order, editedHome.order);
    assert.equal(publicHome.audiences.items[0].id, "parents");
    assert.equal((await api("/api/admin/homepage", { method: "PUT", body: {
      value: editedHome, expectedVersion: 0,
    } })).status, 409, "Устаревшая версия не перезаписывает блоки");
    const invalidHome = structuredClone(editedHome);
    invalidHome.order = ["news", "news", "programs", "directory", "life"];
    assert.equal((await api("/api/admin/homepage", { method: "PUT", body: {
      value: invalidHome, expectedVersion: 1,
    } })).status, 400);
    invalidHome.order = editedHome.order;
    invalidHome.hero.image = "javascript:alert(1)";
    assert.equal((await api("/api/admin/homepage", { method: "PUT", body: {
      value: invalidHome, expectedVersion: 1,
    } })).status, 400);
    invalidHome.hero.image = editedHome.hero.image;
    invalidHome.audiences.items.forEach((item) => { item.visible = false; });
    assert.equal((await api("/api/admin/homepage", { method: "PUT", body: {
      value: invalidHome, expectedVersion: 1,
    } })).status, 400);
    const homeVersions = (await api("/api/admin/homepage/revisions")).data.items;
    assert.equal(homeVersions.length, 1);
    assert.equal(homeVersions[0].version, 0);
    const restoredHome = await api("/api/admin/homepage/restore", { method: "POST", body: {
      revisionId: homeVersions[0].id, expectedVersion: 1,
    } });
    assert.equal(restoredHome.status, 200);
    assert.equal(restoredHome.data.version, 2);
    assert.equal((await api("/api/site")).data.homepage.hero.title, homepage.value.hero.title);
    assert.equal((await api("/api/admin/homepage/revisions")).data.items[0].version, 1,
      "До восстановления текущая версия сохраняется в истории");
    assert.equal((await api("/api/admin/homepage/restore", { method: "POST", body: {
      revisionId: homeVersions[0].id, expectedVersion: 1,
    } })).status, 409);
    const overview = (await api("/api/admin/overview")).data;
    assert.equal(overview.programCount, 10);
    assert.equal(overview.mediaCount, 1);
    assert.equal(overview.draftCount, 1, "Восстановленный черновик остаётся в очереди редактора");
    const pending = await api("/api/admin/entry", { method: "PUT", body: {
      kind: "news", title: "Новость для проверки очереди", html: "<p>Проверка</p>",
      status: "draft", expectedVersion: 0,
    } });
    assert.equal(pending.status, 200);
    const queue = (await api("/api/admin/overview")).data;
    assert.equal(queue.draftCount, 2);
    assert.equal(queue.drafts[0].key, pending.data.key);

    const users = await api("/api/admin/users", { method: "POST", body: { username: "writer", name: "Редактор", role: "editor", password: "writer-password-123" } });
    assert.equal(users.status, 201);
    assert.equal((await api("/api/admin/user", { method: "PATCH", body: { id: 1, active: false } })).status, 409, "Последнего администратора нельзя отключить");
    const login = await api("/api/admin/login", { method: "POST", body: { username: "writer", password: "writer-password-123" }, withAuth: false });
    cookie = login.cookie.split(";")[0]; csrf = login.data.csrf;
    assert.equal((await api("/api/admin/menu", { method: "PUT", body: { groups: catalogue.groups } })).status, 403);
    assert.equal((await api("/api/admin/programs", { method: "PUT", body: { items: changedPrograms, expectedVersion: 1 } })).status, 403);
    assert.equal((await api("/api/admin/settings", { method: "PUT", body: { values, expectedVersion: 1 } })).status, 403);
    assert.equal((await api("/api/admin/homepage", { method: "PUT", body: { value: editedHome, expectedVersion: 1 } })).status, 403);
    assert.equal((await api("/api/admin/homepage/revisions")).status, 403);
    assert.equal((await api("/api/admin/entry", { method: "PUT", body: { kind: "news", title: "Редактор пишет", status: "draft", expectedVersion: 0 } })).status, 200);
    assert.equal((await api("/api/admin/logout", { method: "POST" })).status, 200);
    assert.equal((await api("/api/admin/me")).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
