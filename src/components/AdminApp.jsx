import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarBlank, CaretDown, Check, ClockCounterClockwise,
  FileText, FloppyDisk, Handshake, House, Image, Key, List, MagnifyingGlass, Megaphone,
  Newspaper, PencilSimple, Plus, Question, SignOut, TextAa, Trash, UploadSimple, Users, X,
  GraduationCap, GearSix, SquaresFour, VideoCamera,
} from "@phosphor-icons/react";
import { Brand } from "./Header";
import { useSiteData } from "../site-data";
import { ProgramsManager, SettingsManager } from "./AdminManagers";
import { HomepageManager } from "./HomepageManager";
import { AnnouncementManager, HelpPage, LinksManager, PasswordPage } from "./AdminExtras";
import { ConfirmProvider, LeaveGuardLinks, fileKind, formatSize, useConfirm, useLeaveGuard } from "./AdminUi";
import { RichEditor } from "./AdminRich";
import "./admin.css";
import "./admin-readable.css";

const adminLink = (section = "overview") => `#/admin/${section}`;
const editLink = (key) => adminLink("edit/" + encodeURIComponent(key));
const displayDate = (value) => value ? new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
const shortDate = (value) => value ? new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(value)) : "";
const dateInput = (value) => value ? new Date(value).toLocaleDateString("sv", { timeZone: "Europe/Moscow" }) : "";
const statusNames = { draft: "Черновик", archived: "Скрыто", "source-error": "Источник недоступен", published: "На сайте" };
const uploadAccept = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xlsx,video/mp4";

async function responseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Не удалось выполнить действие. Проверьте интернет и попробуйте ещё раз.");
    error.status = response.status;
    throw error;
  }
  return body;
}

function Login({ onSignedIn }) {
  const [setup, setSetup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [fields, setFields] = useState({ username: "", name: "", password: "", token: "" });
  useEffect(() => {
    fetch("/api/admin/setup-state", { credentials: "same-origin" })
      .then(responseJson).then((state) => setSetup(state.needsSetup)).catch(() => setSetup("unavailable"));
  }, []);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await responseJson(await fetch(setup ? "/api/admin/setup" : "/api/admin/login", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
      }));
      onSignedIn(result);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <main className="admin-login">
    <div className="admin-login-mark"><Brand /><p>Сайт, которым удобно управлять.</p><strong>Новости, страницы и файлы — в одном месте.</strong><a href="#top">← На сайт</a></div>
    <div className="admin-login-panel">
      {setup === null ? <p role="status">Подключаем редактор…</p> : setup === "unavailable" ? <><h1>Редактор пока недоступен</h1><p>Запустите сайт через Node.js с подключённой базой. Статическая копия показывает только публичные страницы.</p><a href="#top">Вернуться на сайт</a></> : <>
        <h1>{setup ? "Первый запуск" : "Вход в редактор сайта"}</h1>
        <p>{setup ? "Создайте учётную запись администратора. Код первого запуска показан в терминале сервера." : "Введите логин и пароль, которые вам выдал администратор сайта."}</p>
        <form onSubmit={submit} className="admin-form">
          {setup && <label>Код первого запуска<input required value={fields.token} onChange={(e) => setFields({ ...fields, token: e.target.value })} autoComplete="off" /></label>}
          {setup && <label>Ваше имя<input required value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} autoComplete="name" /></label>}
          <label>Логин<input required value={fields.username} onChange={(e) => setFields({ ...fields, username: e.target.value })} autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
          <label>Пароль<input required type={show ? "text" : "password"} minLength={setup ? 10 : undefined} value={fields.password} onChange={(e) => setFields({ ...fields, password: e.target.value })} autoComplete={setup ? "new-password" : "current-password"} /></label>
          <label className="admin-checkbox"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Показать пароль</label>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <button className="admin-primary" disabled={busy}>{busy ? "Подождите…" : setup ? "Создать администратора" : "Войти"}<ArrowRight /></button>
          {!setup && <p className="admin-hint">Забыли пароль? Обратитесь к администратору сайта — он задаст новый.</p>}
        </form>
      </>}
    </div>
  </main>;
}

const navItems = [
  ["overview", "Рабочий стол", House], ["news", "Новости", Newspaper, "ПУБЛИКАЦИИ"], ["pages", "Страницы", FileText],
  ["media", "Файлы и фото", Image], ["announcement", "Объявление", Megaphone],
  ["homepage", "Блоки главной", SquaresFour, "САЙТ", true], ["programs", "Специальности", GraduationCap, null, true],
  ["settings", "Контакты", GearSix, null, true], ["links", "Партнёры и ссылки", Handshake, null, true], ["menu", "Меню сайта", List, null, true],
  ["users", "Сотрудники", Users, "ДОСТУП", true], ["password", "Мой пароль", Key, "ВЫ"], ["help", "Помощь", Question],
];

function useLargeText() {
  const [large, setLarge] = useState(() => { try { return localStorage.getItem("zhat-admin-large") !== "false"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("zhat-admin-large", String(large)); } catch {} }, [large]);
  return [large, setLarge];
}

export function AdminApp(props) {
  return <ConfirmProvider><AdminShell {...props} /></ConfirmProvider>;
}

function AdminShell({ route }) {
  const [auth, setAuth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [large, setLarge] = useLargeText();
  const [imagePicker, setImagePicker] = useState(null);
  const { refresh } = useSiteData();
  useEffect(() => { document.title = "Редактор сайта — ЖАТ"; }, []);
  useEffect(() => {
    fetch("/api/admin/me", { credentials: "same-origin", cache: "no-store" })
      .then(responseJson).then(setAuth).catch(() => setAuth(null)).finally(() => setChecking(false));
  }, []);
  const api = useCallback(async (path, { method = "GET", body, headers = {} } = {}) => {
    const isFile = typeof File !== "undefined" && body instanceof File;
    let response;
    try {
      response = await fetch(path, {
        method, credentials: "same-origin", cache: "no-store",
        headers: {
          ...(body && !isFile ? { "Content-Type": "application/json" } : {}),
          ...(isFile ? { "Content-Type": body.type, "X-File-Name": encodeURIComponent(body.name) } : {}),
          ...(auth?.csrf ? { "X-CSRF-Token": auth.csrf } : {}), ...headers,
        }, body: body === undefined ? undefined : isFile ? body : JSON.stringify(body),
      });
    } catch {
      throw new Error("Нет связи с сайтом. Проверьте интернет и нажмите кнопку ещё раз — введённый текст не пропадёт.");
    }
    if (response.status === 401) setAuth(null);
    return responseJson(response);
  }, [auth?.csrf]);
  const logout = async () => {
    try { await api("/api/admin/logout", { method: "POST" }); } catch {}
    setAuth(null); location.hash = adminLink();
  };
  const pickImage = useCallback((onPick) => setImagePicker(() => onPick), []);
  if (checking) return <main className="admin-splash" role="status">Открываем редактор…</main>;
  if (!auth) return <Login onSignedIn={setAuth} />;
  const isAdmin = auth.user.role === "admin";
  const section = route.split("/")[2] || "overview";
  let key = "";
  if (section === "edit") {
    try { key = decodeURIComponent(route.slice("#/admin/edit/".length)); } catch { key = ""; }
  }
  const visibleNav = navItems.filter(([, , , , adminOnly]) => isAdmin || !adminOnly);
  const navLabel = navItems.find(([id]) => id === section)?.[1] || (section === "edit" ? "Редактирование" : "Новый материал");
  const navigate = (id) => { setMobileMenu(false); location.hash = adminLink(id); };
  const allowed = (id) => visibleNav.some(([item]) => item === id);
  const pages = {
    news: () => <Entries api={api} kind="news" />,
    pages: () => <Entries api={api} kind="page" />,
    new: () => <Editor key={route} api={api} kind={route.split("/")[3] === "page" ? "page" : "news"} refresh={refresh} />,
    edit: () => <Editor key={key} api={api} entryKey={key} refresh={refresh} />,
    media: () => <MediaLibrary api={api} user={auth.user} />,
    announcement: () => <AnnouncementManager api={api} refresh={refresh} />,
    homepage: () => <HomepageManager api={api} refresh={refresh} userId={auth.user.id} />,
    programs: () => <ProgramsManager api={api} refresh={refresh} />,
    settings: () => <SettingsManager api={api} refresh={refresh} />,
    links: () => <LinksManager api={api} refresh={refresh} pickImage={pickImage} />,
    menu: () => <MenuManager api={api} refresh={refresh} />,
    users: () => <Staff api={api} me={auth.user} />,
    password: () => <PasswordPage api={api} user={auth.user} />,
    help: () => <HelpPage canAdmin={isAdmin} />,
  };
  const page = pages[section] && (["new", "edit"].includes(section) || allowed(section)) ? pages[section]() :
    <Overview api={api} navigate={navigate} canAdmin={isAdmin} user={auth.user} />;
  return <div className={`admin-shell ${large ? "admin-large" : ""}`}>
    <LeaveGuardLinks />
    <button className="admin-mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-expanded={mobileMenu} aria-label="Меню редактора">{mobileMenu ? <X /> : <List />} Меню</button>
    <aside className={`admin-sidebar ${mobileMenu ? "open" : ""}`}>
      <Brand />
      <p className="admin-sidebar-title">Редактор сайта</p>
      <nav aria-label="Редактор сайта">{visibleNav.map(([id, label, Icon, group]) => <div key={id}>
        {group && <span className="admin-nav-label">{group}</span>}
        <a className={section === id || (id === "news" && section === "new" && !route.endsWith("/page")) ? "current" : ""} aria-current={section === id ? "page" : undefined} href={adminLink(id)} onClick={() => setMobileMenu(false)}><Icon size={22} />{label}</a>
      </div>)}</nav>
      <div className="admin-sidebar-bottom">
        <button onClick={() => setLarge(!large)} aria-pressed={large}><TextAa size={21} /> {large ? "Обычный шрифт" : "Крупный шрифт"}</button>
        <a href="#top" target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenu(false)}>Открыть сайт <ArrowUpRight /></a>
        <div><strong>{auth.user.name}</strong><span>{isAdmin ? "Администратор" : "Редактор"}</span></div>
        <button onClick={logout}><SignOut size={20} /> Выйти</button>
      </div>
    </aside>
    <main className="admin-main" id="main">
      <div className="admin-topline"><span>Редактор сайта <span aria-hidden="true">/</span> <strong>{navLabel}</strong></span><a href="#top" target="_blank" rel="noopener noreferrer">Посмотреть сайт <ArrowUpRight size={17} /></a></div>
      {page}
    </main>
    {imagePicker && <MediaPicker api={api} imagesOnly onClose={() => setImagePicker(null)} onChoose={(file) => { imagePicker(file.url); setImagePicker(null); }} />}
  </div>;
}

function SectionHeading({ title, description, action }) {
  return <header className="admin-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

const activityNames = {
  published: "Опубликован материал", draft: "Сохранён черновик", archived: "Скрыт материал", restore: "Восстановлена версия",
  upload: "Загружен файл", "media:rename": "Переименован файл", "media:delete": "Удалён файл", menu: "Обновлено меню",
  homepage: "Обновлены блоки главной", "homepage:restore": "Восстановлена версия главной", programs: "Обновлены специальности",
  settings: "Обновлены контакты", extras: "Обновлены партнёры и ссылки", announcement: "Опубликовано объявление",
  "announcement:off": "Снято объявление", password: "Сменён пароль", setup: "Создан администратор",
  "user:create": "Добавлен сотрудник", "user:update": "Изменён доступ сотрудника",
};

function Overview({ api, navigate, canAdmin, user }) {
  const [data, setData] = useState(null);
  useEffect(() => { api("/api/admin/overview").then(setData).catch(() => {}); }, [api]);
  const announcement = data?.announcement;
  const announcementOn = announcement?.visible && !(announcement.until && announcement.until < new Date().toLocaleDateString("sv"));
  return <>
    <SectionHeading title={`Здравствуйте, ${user?.name?.split(" ")[0] || "коллега"}!`} description="Выберите, что нужно сделать. Если что-то непонятно — откройте «Помощь» в меню слева." />
    <div className="admin-overview-section-title"><h2>Что будем делать?</h2></div>
    <div className="admin-quick-actions">
      <button onClick={() => navigate("new/news")}><Newspaper size={34} /><strong>Добавить новость</strong><span>Текст, фото — и опубликовать.</span><ArrowRight /></button>
      <button onClick={() => navigate("pages")}><PencilSimple size={34} /><strong>Исправить страницу</strong><span>Найти раздел по названию и обновить текст.</span><ArrowRight /></button>
      <button onClick={() => navigate("media")}><UploadSimple size={34} /><strong>Выложить файл</strong><span>Фото, PDF, Word, Excel или видео.</span><ArrowRight /></button>
      <button onClick={() => navigate("announcement")} className={announcementOn ? "admin-quick-on" : ""}><Megaphone size={34} /><strong>Объявление</strong><span>{announcementOn ? `Сейчас на сайте: «${announcement.text.slice(0, 70)}${announcement.text.length > 70 ? "…" : ""}»` : "Срочное сообщение вверху сайта."}</span><ArrowRight /></button>
    </div>
    <div className="admin-overview-stats">
      <div><span>Новости и страницы</span><strong>{data ? (data.news.total + data.pages.total).toLocaleString("ru") : "—"}</strong></div>
      <div><span>Черновики</span><strong>{data?.draftCount ?? "—"}</strong></div>
      <div><span>Специальности на сайте</span><strong>{data?.programCount ?? "—"}</strong></div>
      <div><span>Загружено файлов</span><strong>{data?.mediaCount ?? "—"}</strong></div>
    </div>
    <div className="admin-overview-bottom">
      <section className="admin-panel"><div className="admin-panel-heading"><h2>Неопубликованные черновики</h2></div>{data?.drafts?.length ? <ul className="admin-activity">{data.drafts.map((item) => <li key={item.key}><a href={editLink(item.key)}><strong>{item.title}</strong><span>Продолжить работу →</span></a><time>{displayDate(item.updatedAt)}</time></li>)}</ul> : <p>Черновиков нет — всё опубликовано.</p>}</section>
      <section className="admin-panel"><h2>Последние изменения</h2>{data?.activity?.length ? <ul className="admin-activity">{data.activity.slice(0, 6).map((item, index) => <li key={index}><span>{activityNames[item.action] || "Изменение сайта"}: <strong>{item.subject}</strong></span><time>{displayDate(item.createdAt)}</time></li>)}</ul> : <p>Изменений пока нет.</p>}</section>
    </div>
    {canAdmin && <p className="admin-hint admin-overview-more">Настройки сайта для администратора — в меню слева: блоки главной, специальности, контакты, партнёры, меню и сотрудники.</p>}
  </>;
}

function Entries({ api, kind }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api(`/api/admin/entries?kind=${kind}&q=${encodeURIComponent(query)}&page=${page}&status=${status}`)
        .then((data) => { if (active) { setResult(data); setError(""); } })
        .catch((cause) => { if (active) setError(cause.message); });
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, query, page, status, api]);
  const news = kind === "news";
  return <>
    <SectionHeading title={news ? "Новости" : "Страницы"} description={news ? "Все новости техникума, новые сверху. Нажмите на новость, чтобы её изменить." : "Все разделы сайта. Найдите страницу по названию и нажмите на неё."} action={<a className="admin-primary" href={adminLink("new/" + kind)}><Plus size={22} />{news ? "Добавить новость" : "Новая страница"}</a>} />
    <label className="admin-search"><MagnifyingGlass size={24} /><input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={news ? "Найти новость: слово из названия или дата, например 22.09.2026" : "Найти страницу: например, расписание или стипендия"} aria-label="Найти материал" /></label>
    <div className="admin-filter" role="group" aria-label="Показать">
      {[["", "Все"], ["published", "На сайте"], ["draft", "Черновики"], ["archived", "Скрытые"]].map(([value, label]) =>
        <button key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}
    </div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <div className="admin-panel admin-list"><div className="admin-list-caption">{result ? `Найдено: ${result.total.toLocaleString("ru")}` : "Загружаем…"}</div>
      {result?.items?.map((item) => <a className="admin-list-row" href={editLink(item.key)} key={item.key}>
        <span className="admin-list-icon">{item.image ? <img src={item.image} alt="" /> : news ? <Newspaper /> : <FileText />}</span>
        <span className="admin-list-copy"><strong>{item.title}</strong><small>{news && item.publishedAt ? `Дата новости: ${shortDate(item.publishedAt)}` : item.edited ? `Изменено ${displayDate(item.updatedAt)}` : "С прежнего сайта, не изменялась"}</small></span>
        <span className={`admin-status ${item.status}`}>{statusNames[item.status]}</span><span className="admin-list-open">Открыть <ArrowRight size={18} /></span></a>)}
      {result && !result.items.length && <p className="admin-empty-row">Ничего не найдено. Попробуйте другое слово.</p>}
    </div>
    {result && result.total > result.size && <div className="admin-pagination"><button disabled={page <= 1} onClick={() => { setPage(page - 1); scrollTo(0, 0); }}>← Предыдущие</button><span>Страница {page} из {Math.ceil(result.total / result.size)}</span><button disabled={page * result.size >= result.total} onClick={() => { setPage(page + 1); scrollTo(0, 0); }}>Следующие →</button></div>}
  </>;
}

function insertNodeAtCursor(node, parent) {
  parent.focus();
  const selection = window.getSelection();
  if (selection?.rangeCount && parent.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
  } else parent.append(node);
}
const mediaNode = (file) => {
  if (file.mime.startsWith("image/")) {
    const image = document.createElement("img"); image.src = file.url; image.alt = file.name.replace(/\.[a-z0-9]+$/i, ""); return image;
  }
  if (file.mime === "video/mp4") {
    const video = document.createElement("video"); video.src = file.url; video.controls = true; return video;
  }
  const link = document.createElement("a");
  link.href = file.url; link.textContent = file.name; link.target = "_blank"; link.rel = "noopener noreferrer";
  return link;
};

const draftKey = (entryKey, kind) => `zhat-editor-draft:${entryKey || "new-" + kind}`;
// The editable area re-serialises HTML, so compare both sides the same way to avoid false "unsaved" warnings.
const normalizeHtml = (html) => { const box = document.createElement("div"); box.innerHTML = html || ""; return box.innerHTML; };

function Editor({ api, entryKey, kind = "news", refresh }) {
  const confirm = useConfirm();
  const [entry, setEntry] = useState(null);
  const [form, setForm] = useState({ title: "", summary: "", html: "", image: "", group: "", publishedAt: "" });
  const [saved, setSaved] = useState(null);
  const [recovered, setRecovered] = useState(null);
  const [groups, setGroups] = useState([]);
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);
  const [revisions, setRevisions] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef(null);
  const currentKind = entry?.kind || kind;
  const storageKey = draftKey(entry?.key || entryKey, currentKind);
  const set = (patch) => { setForm((current) => ({ ...current, ...patch })); setMessage(""); };
  const fill = (result) => {
    const next = { title: result.title || "", summary: result.summary || "", html: result.html || "", image: result.image || "",
      group: result.group || "", publishedAt: result.publishedAt || "" };
    setForm(next); setSaved(next);
    if (editorRef.current) editorRef.current.innerHTML = next.html;
  };
  useEffect(() => {
    api("/api/admin/menu").then((result) => setGroups(result.groups)).catch(() => {});
    let active = true;
    const restoreLocal = (base) => {
      try {
        const local = JSON.parse(localStorage.getItem(draftKey(entryKey, kind)) || "null");
        if (local && JSON.stringify(local.form) !== JSON.stringify(base)) setRecovered(local);
      } catch {}
    };
    if (!entryKey) {
      const empty = { title: "", summary: "", html: "", image: "", group: "", publishedAt: "" };
      setEntry({ key: "", kind, version: 0, status: "draft" }); setForm(empty); setSaved(empty); restoreLocal(empty);
      return;
    }
    api("/api/admin/entry?key=" + encodeURIComponent(entryKey)).then(async (result) => {
      if (result.needsSourceBody && !result.html) {
        try { const source = await responseJson(await fetch("/api/content?key=" + encodeURIComponent(entryKey))); result.html = source.html || ""; } catch {}
      }
      if (!active) return;
      setEntry(result); fill(result);
      restoreLocal({ title: result.title || "", summary: result.summary || "", html: result.html || "", image: result.image || "", group: result.group || "", publishedAt: result.publishedAt || "" });
    }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [entryKey, kind, api]);
  const savedHtml = useMemo(() => normalizeHtml(saved?.html), [saved]);
  const formHtml = useMemo(() => normalizeHtml(form.html), [form.html]);
  const dirty = Boolean(saved && (formHtml !== savedHtml ||
    JSON.stringify({ ...form, html: "" }) !== JSON.stringify({ ...saved, html: "" })));
  useLeaveGuard(dirty, "Вы не сохранили изменения в этом материале. Текст останется на этом компьютере, но на сайт не попадёт.");
  // Every change is kept in this browser, so a closed tab or a lost connection never loses the text.
  useEffect(() => {
    if (!saved) return;
    try {
      if (dirty) localStorage.setItem(storageKey, JSON.stringify({ form, savedAt: new Date().toISOString() }));
      else localStorage.removeItem(storageKey);
    } catch {}
  }, [form, dirty, saved, storageKey]);
  const save = async (status) => {
    if (busy) return;
    if (status === "archived" && !await confirm({ title: "Скрыть материал с сайта?", text: "Посетители перестанут его видеть. Материал не удаляется: его можно вернуть кнопкой «Опубликовать».", action: "Скрыть с сайта", danger: true })) return;
    setError(""); setMessage(""); setBusy(true);
    const html = editorRef.current?.innerHTML || form.html;
    try {
      const result = await api("/api/admin/entry", { method: "PUT", body: {
        key: entry?.key || "", kind: currentKind, ...form, html, status, expectedVersion: entry?.version || 0,
      } });
      try { localStorage.removeItem(storageKey); } catch {}
      setEntry(result); fill(result); setRecovered(null);
      setMessage(status === "published" ? "Готово! Материал опубликован и уже виден на сайте." : status === "archived" ? "Материал скрыт с сайта. Вернуть его можно кнопкой «Опубликовать»." : "Черновик сохранён. Посетители его пока не видят.");
      window.dispatchEvent(new Event("zhat:site-updated")); await refresh();
      if (!entryKey && result.key) history.replaceState(null, "", editLink(result.key));
    } catch (cause) {
      setError(cause.status === 409 ? "Пока вы работали, этот материал сохранил другой сотрудник. Ваш текст сохранён на этом компьютере. Обновите страницу (F5) — вам предложат вернуть ваш текст." : cause.message);
    }
    finally { setBusy(false); }
  };
  const openHistory = async () => {
    try { setRevisions((await api("/api/admin/revisions?key=" + encodeURIComponent(entry.key))).items); }
    catch (cause) { setError(cause.message); }
  };
  const restore = async (version) => {
    if (busy) return;
    if (!await confirm({ title: "Вернуть эту версию?", text: `Материал станет таким, каким был до правки ${displayDate(version.created_at)}. Нынешний вариант тоже сохранится в истории.`, action: "Вернуть эту версию" })) return;
    setBusy(true); setError("");
    try {
      const result = await api("/api/admin/restore", { method: "POST", body: { key: entry.key, revisionId: version.id } });
      setEntry(result); fill(result);
      setMessage("Прежняя версия возвращена."); setRevisions(null); window.dispatchEvent(new Event("zhat:site-updated")); await refresh();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const insertFile = (file, asCover = false) => {
    if (asCover) set({ image: file.url });
    else { insertNodeAtCursor(mediaNode(file), editorRef.current); set({ html: editorRef.current.innerHTML }); }
    setPicker(false);
  };
  const uploadFiles = async (files) => {
    setUploading(true); setError("");
    try {
      for (const file of files) insertFile(await api("/api/admin/media", { method: "POST", body: file }));
    } catch (cause) { setError(cause.message); }
    finally { setUploading(false); }
  };
  if (!entry) return <p role="status" className="admin-panel">{error || "Открываем материал…"}</p>;
  const news = currentKind === "news";
  const html = form.html.replace(/<[^>]+>/g, "").trim() || /<(img|video)/i.test(form.html);
  const missing = [!form.title.trim() && "название", !html && "текст"].filter(Boolean);
  return <>
    <a className="admin-back" href={adminLink(news ? "news" : "pages")}><ArrowLeft /> Назад к списку {news ? "новостей" : "страниц"}</a>
    <SectionHeading title={entry.key ? news ? "Редактирование новости" : "Редактирование страницы" : news ? "Новая новость" : "Новая страница"} description="Заполните поля и нажмите «Опубликовать». Фото, история изменений и предпросмотр — в колонке «Публикация»." />
    {recovered && <div className="admin-recovered" role="alert"><div><strong>Найден несохранённый текст</strong><span>Вы работали над этим материалом {displayDate(recovered.savedAt)}, но не сохранили. Вернуть тот текст?</span></div>
      <button className="admin-primary" onClick={() => { set(recovered.form); if (editorRef.current) editorRef.current.innerHTML = recovered.form.html; setRecovered(null); }}>Вернуть мой текст</button>
      <button className="admin-secondary" onClick={() => { try { localStorage.removeItem(storageKey); } catch {} setRecovered(null); }}>Не нужно</button></div>}
    <div className="admin-editor-layout">
      <div className="admin-panel admin-edit-form">
        <label><span className="admin-label-row">Название <b className="admin-required" aria-hidden="true">*</b></span><input value={form.title} disabled={busy} onChange={(e) => set({ title: e.target.value })} maxLength={220} placeholder={news ? "Например: День открытых дверей" : "Название раздела"} /></label>
        {news && <label className="admin-date-field"><span className="admin-label-row"><CalendarBlank size={20} /> Дата новости</span><input type="date" value={dateInput(form.publishedAt)} disabled={busy} onChange={(e) => set({ publishedAt: e.target.value })} /><small>{form.publishedAt ? "По этой дате новость стоит в списке. Правка текста дату не меняет." : "Если не указать, будет поставлена дата публикации."}</small></label>}
        <label>Короткое описание (необязательно)<input value={form.summary} disabled={busy} onChange={(e) => set({ summary: e.target.value })} maxLength={800} placeholder="Одно предложение о главном" /><small>Показывается в поиске по сайту.</small></label>
        {!news && !entry.sourceUrl && <label>Раздел сайта<select value={form.group} disabled={busy} onChange={(e) => set({ group: e.target.value })}><option value="">Не показывать в меню</option>{groups.map((g) => <option key={g.title}>{g.title}</option>)}</select><small>Страница появится в этом разделе меню после публикации.</small></label>}
        <div className="admin-editor-label">Текст <span aria-hidden="true">*</span>{uploading && <em>Загружаем файл…</em>}</div>
        <RichEditor html={form.html} onChange={(value) => set({ html: value })} editorRef={editorRef} onInsertFile={() => setPicker("body")} onUploadFiles={uploadFiles} disabled={busy} />
        {error && <p role="alert" className="admin-error">{error}</p>}
        {message && <p role="status" className="admin-success"><Check size={22} />{message}{entry.key && entry.hasPublished && entry.status === "published" && <a href={`#/page/${encodeURIComponent(entry.key)}`} target="_blank" rel="noopener noreferrer">Посмотреть на сайте <ArrowUpRight size={16} /></a>}</p>}
      </div>
      <aside className="admin-editor-side">
        <div className="admin-panel admin-publish-panel"><h2>Публикация</h2>
          <p className="admin-status-line">Сейчас: <span className={`admin-status ${entry.status}`}>{statusNames[entry.status]}</span>{dirty && <span className="admin-unsaved">есть несохранённые правки</span>}</p>
          <button disabled={busy || missing.length > 0} className="admin-primary" onClick={() => save("published")}><Check size={22} /> {busy ? "Сохраняем…" : "Опубликовать"}</button>
          {missing.length > 0 && <p className="admin-hint">Чтобы опубликовать, заполните {missing.join(" и ")}.</p>}
          <button disabled={busy || !form.title.trim()} className="admin-secondary" onClick={() => save("draft")}><FloppyDisk size={20} /> Сохранить черновик</button>
          <button className="admin-secondary" onClick={() => setPreview(true)}><ArrowUpRight size={20} /> Предпросмотр</button>
          {entry.key && entry.hasPublished && <a className="admin-secondary" href={`#/page/${encodeURIComponent(entry.key)}`} target="_blank" rel="noopener noreferrer">Открыть на сайте <ArrowUpRight /></a>}
        </div>
        {news && <div className="admin-panel"><h2>Фото новости</h2>{form.image ? <img className="admin-cover-preview" src={form.image} alt="Фото новости" /> : <p>Фото покажется в карточке новости на главной странице.</p>}<button className="admin-secondary" disabled={busy} onClick={() => setPicker("cover")}><Image size={20} /> {form.image ? "Заменить фото" : "Добавить фото"}</button>{form.image && <button className="admin-quiet" disabled={busy} onClick={() => set({ image: "" })}>Убрать фото</button>}</div>}
        {entry.key && <div className="admin-panel"><h2>История</h2>
          <button className="admin-secondary" onClick={revisions ? () => setRevisions(null) : openHistory}><ClockCounterClockwise size={20} /> {revisions ? "Скрыть версии" : "Предыдущие версии"}</button>
          {revisions && <div className="admin-revisions">{revisions.length ? revisions.map((version) => <div key={version.id}>
            <div><strong>До правки {displayDate(version.created_at)}</strong><small>{version.author ? `Правку сделал(а): ${version.author}` : ""}{version.status === "original" ? " · исходный текст с прежнего сайта" : version.status === "draft" ? " · был черновик" : version.status === "archived" ? " · был скрыт" : ""}</small></div>
            <button className="admin-secondary" disabled={busy} onClick={() => restore(version)}>Вернуть эту версию</button></div>) : <p>Предыдущих версий пока нет.</p>}</div>}
          {entry.status !== "archived" && <button className="admin-quiet admin-hide" disabled={busy} onClick={() => save("archived")}>Скрыть с сайта</button>}
          <p className="admin-url">Адрес: {entry.key}</p>
        </div>}
      </aside>
    </div>
    {picker && <MediaPicker api={api} imagesOnly={picker === "cover"} onClose={() => setPicker(false)} onChoose={(file) => insertFile(file, picker === "cover")} />}
    {preview && <Preview title={form.title} summary={form.summary} image={form.image} html={editorRef.current?.innerHTML || form.html} onClose={() => setPreview(false)} />}
  </>;
}

const escapeMarkup = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function Preview({ title, summary, image, html, onClose }) {
  useEffect(() => {
    const close = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const srcDoc = `<!doctype html><html lang="ru"><meta charset="utf-8"><base href="${escapeMarkup(location.origin)}/"><style>body{font:18px/1.7 system-ui,sans-serif;color:#182832;max-width:750px;margin:40px auto;padding:0 22px}h1{font-size:clamp(30px,6vw,50px);line-height:1.1}h2{line-height:1.2}img,video{max-width:100%;height:auto}a{color:#134a99}table{border-collapse:collapse;display:block;overflow:auto}td,th{border:1px solid #dbe5e9;padding:8px}blockquote{border-left:4px solid #1b5fc1;margin:0;padding-left:18px}</style><h1>${escapeMarkup(title)}</h1>${summary ? `<p>${escapeMarkup(summary)}</p>` : ""}${image ? `<img src="${escapeMarkup(image)}" alt="">` : ""}<main>${html || ""}</main></html>`;
  return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="admin-modal admin-preview-modal" role="dialog" aria-modal="true" aria-label="Предпросмотр материала"><header><div><h2>Предпросмотр</h2><p>Так материал будет выглядеть на сайте. Это ещё не публикация.</p></div><button className="admin-secondary" onClick={onClose}><X /> Закрыть</button></header><iframe title="Материал до публикации" sandbox="" srcDoc={srcDoc} /></div></div>;
}

function MediaThumb({ item, size = 34 }) {
  const kind = fileKind(item.mime);
  return kind === "image" ? <img src={item.url || `/api/site/media/${item.id}`} alt="" loading="lazy" /> :
    <span className={`admin-file-icon ${kind}`}>{kind === "video" ? <VideoCamera size={size} /> : <FileText size={size} />}<small>{(item.name.split(".").pop() || "").slice(0, 4).toUpperCase()}</small></span>;
}

function MediaPicker({ api, onClose, onChoose, imagesOnly = false }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/admin/media").then((result) => setItems(result.items)).catch((cause) => setError(cause.message)); }, [api]);
  useEffect(() => {
    const close = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setError("");
    try { const item = await api("/api/admin/media", { method: "POST", body: file }); onChoose(item); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const shown = items.filter((item) => (!imagesOnly || item.mime.startsWith("image/")) && item.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")));
  return <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="admin-modal" role="dialog" aria-modal="true" aria-label={imagesOnly ? "Выбрать фото" : "Выбрать файл"}>
    <header><div><h2>{imagesOnly ? "Выберите фото" : "Вставить фото или документ"}</h2><p>Загрузите новый файл с компьютера или выберите из уже загруженных.</p></div><button className="admin-secondary" onClick={onClose}><X /> Закрыть</button></header>
    <label className="admin-upload admin-upload-big"><UploadSimple size={28} />{busy ? "Загружаем… подождите" : imagesOnly ? "Загрузить фото с компьютера" : "Загрузить с компьютера"}<input type="file" accept={imagesOnly ? "image/jpeg,image/png,image/webp,image/gif" : uploadAccept} onChange={(e) => upload(e.target.files?.[0])} disabled={busy} /></label>
    <p className="admin-hint">{imagesOnly ? "Подойдут фото JPG и PNG до 25 МБ." : "Фото, PDF, Word, Excel и видео MP4 до 25 МБ. Документ вставится в текст ссылкой с его названием."}</p>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {items.length > 8 && <label className="admin-search"><MagnifyingGlass size={20} /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти загруженный файл по названию" aria-label="Найти файл" /></label>}
    <div className="admin-media-grid">{shown.map((item) => <button type="button" key={item.id} className="admin-media-item admin-media-choice" onClick={() => onChoose({ ...item, url: item.url || `/api/site/media/${item.id}` })}>
      <MediaThumb item={item} /><strong>{item.name}</strong><span>Выбрать</span></button>)}</div>
    {!shown.length && <p className="admin-empty">{items.length ? "Ничего не найдено." : "Загруженных файлов пока нет."}</p>}
  </div></div>;
}

function MediaLibrary({ api, user }) {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [dragging, setDragging] = useState(false);
  const load = () => api("/api/admin/media").then((data) => setItems(data.items)).catch((cause) => setError(cause.message));
  useEffect(() => { load(); }, [api]);
  const upload = async (files) => {
    files = [...(files || [])];
    if (!files.length) return;
    setError(""); setMessage("");
    let done = 0;
    for (const file of files) {
      setProgress(`Загружаем ${done + 1} из ${files.length}: ${file.name}`);
      try { await api("/api/admin/media", { method: "POST", body: file }); done++; }
      catch (cause) { setError(`«${file.name}»: ${cause.message}`); }
    }
    setProgress(""); await load();
    if (done) setMessage(done === 1 ? "Файл загружен. Чтобы он появился на сайте, вставьте его в новость или страницу." : `Загружено файлов: ${done}.`);
  };
  const copy = async (item) => {
    setError(""); setMessage("");
    try {
      await navigator.clipboard.writeText(location.origin + item.url);
      setMessage(`Ссылка на «${item.name}» скопирована. Её можно вставить в текст кнопкой «Ссылка».`);
    } catch { setError("Не удалось скопировать ссылку. Откройте файл и скопируйте адрес из строки браузера."); }
  };
  const remove = async (item) => {
    if (!await confirm({ title: `Удалить «${item.name}»?`, text: "Файл исчезнет навсегда. Если он где-то вставлен, сайт не даст его удалить и подскажет где.", action: "Удалить файл", danger: true })) return;
    setError(""); setMessage("");
    try { await api("/api/admin/media?id=" + item.id, { method: "DELETE" }); setItems(items.filter((media) => media.id !== item.id)); setMessage(`Файл «${item.name}» удалён.`); }
    catch (cause) { setError(cause.message); }
  };
  const rename = async (event) => {
    event.preventDefault(); setError("");
    try { const updated = await api("/api/admin/media", { method: "PATCH", body: { id: renaming.id, name: renaming.name } }); setItems(items.map((item) => item.id === updated.id ? updated : item)); setRenaming(null); setMessage("Название файла изменено."); }
    catch (cause) { setError(cause.message); }
  };
  const visible = items.filter((item) => (!type || fileKind(item.mime) === type) && item.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")));
  const canChange = (item) => user.role === "admin" || item.authorId === user.id;
  return <><SectionHeading title="Файлы и фото" description="Здесь хранятся все загруженные фото и документы. Чтобы показать файл на сайте, вставьте его в новость или страницу." />
    <label className={`admin-upload admin-dropzone ${dragging ? "active" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}>
      <UploadSimple size={34} /><span><strong>{progress || "Выбрать файлы на компьютере"}</strong><small>или перетащите их сюда мышкой. Фото, PDF, Word, Excel, MP4 — до 25 МБ каждый.</small></span>
      <input type="file" multiple accept={uploadAccept} disabled={Boolean(progress)} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label>
    {error && <p role="alert" className="admin-error">{error}</p>}{message && <p role="status" className="admin-success"><Check size={22} />{message}</p>}
    <div className="admin-media-tools">
      <label className="admin-search"><MagnifyingGlass size={22} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти файл по названию" aria-label="Найти файл" /></label>
      <div className="admin-filter" role="group" aria-label="Тип файлов">{[["", "Все"], ["image", "Фото"], ["document", "Документы"], ["video", "Видео"]].map(([value, label]) => <button key={value} aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>)}</div>
    </div>
    {visible.length ? <div className="admin-media-grid standalone">{visible.map((item) => <div key={item.id} className="admin-media-item">
      <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть ${item.name}`} className="admin-media-preview"><MediaThumb item={item} size={44} /></a>
      {renaming?.id === item.id ? <form onSubmit={rename} className="admin-rename"><input autoFocus value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} aria-label="Новое название" /><button className="admin-primary">Сохранить</button><button type="button" className="admin-secondary" onClick={() => setRenaming(null)}>Отмена</button></form> : <strong>{item.name}</strong>}
      <small>{formatSize(item.size)} · {shortDate(item.uploadedAt)}{item.author ? ` · ${item.author}` : ""}</small>
      <span className={`admin-status ${item.used ? "published" : "draft"}`}>{item.used ? "Используется на сайте" : "Пока нигде не вставлен"}</span>
      <div className="admin-media-actions">
        <button onClick={() => copy(item)}>Копировать ссылку</button>
        {canChange(item) && <button onClick={() => setRenaming({ id: item.id, name: item.name })}><PencilSimple size={16} /> Переименовать</button>}
        {canChange(item) && <button className="danger" onClick={() => remove(item)}><Trash size={16} /> Удалить</button>}
      </div>
    </div>)}</div> : <p className="admin-empty">{items.length ? "По этому запросу файлов нет." : "Файлов пока нет. Загрузите первый файл с компьютера."}</p>}
  </>;
}

function MenuManager({ api, refresh }) {
  const [menuData, setMenuData] = useState(null);
  const [saved, setSaved] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageQuery, setPageQuery] = useState("");
  const [pageTotal, setPageTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const [chosen, setChosen] = useState({});
  const groups = menuData?.groups || [];
  const dirty = Boolean(menuData && saved && JSON.stringify(groups) !== JSON.stringify(saved.groups));
  useLeaveGuard(dirty, "Вы не сохранили изменения в меню. Если уйти, они пропадут.");
  const load = async () => {
    setError(""); setConflict(false);
    try { const data = await api("/api/admin/menu"); setMenuData(data); setSaved(data); setMessage(""); }
    catch (cause) { setError(cause.message); }
  };
  useEffect(() => { load(); }, [api]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api(`/api/admin/entries?kind=page&selectable=1&size=100&q=${encodeURIComponent(pageQuery.trim())}`)
        .then((result) => { if (active) { setPages(result.items); setPageTotal(result.total); } })
        .catch((cause) => { if (active) { setConflict(false); setError(cause.message); } });
    }, pageQuery ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [api, pageQuery]);
  const change = (update) => { setMenuData((current) => {
    const next = structuredClone(current); update(next.groups); return next;
  }); setMessage(""); setError(""); setConflict(false); };
  const move = (groupIndex, itemIndex, direction) => change((next) => {
    const target = itemIndex + direction;
    if (target < 0 || target >= next[groupIndex].links.length) return;
    [next[groupIndex].links[itemIndex], next[groupIndex].links[target]] = [next[groupIndex].links[target], next[groupIndex].links[itemIndex]];
  });
  const remove = (groupIndex, itemIndex) => change((next) => { next[groupIndex].links.splice(itemIndex, 1); });
  const rename = (groupIndex, itemIndex, title) => change((next) => { next[groupIndex].links[itemIndex].title = title; });
  const add = (groupIndex) => {
    const key = chosen[groupIndex];
    const page = pages.find((item) => item.key === key);
    if (!page || groups[groupIndex].links.some((link) => link.key === key)) return;
    change((next) => { next[groupIndex].links.push({ key, title: page.title, url: page.sourceUrl || key }); });
    setChosen((current) => ({ ...current, [groupIndex]: "" }));
  };
  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true); setError(""); setConflict(false); setMessage("");
    try {
      const result = await api("/api/admin/menu", { method: "PUT", body: {
        groups, expectedVersion: menuData.version,
      } });
      setMenuData(result); setSaved(result);
      setMessage("Меню обновлено на сайте.");
      window.dispatchEvent(new Event("zhat:site-updated")); await refresh();
    } catch (cause) { setConflict(cause.status === 409); setError(cause.message); }
    finally { setBusy(false); }
  };
  return <><SectionHeading title="Меню сайта" description="Откройте раздел, чтобы переименовать пункты, поменять порядок или убрать лишнее. Чтобы добавить страницу, найдите её в поиске ниже." action={<button className="admin-primary" onClick={save} disabled={!dirty || busy}><FloppyDisk /> {busy ? "Сохраняем…" : "Сохранить меню"}</button>} />
    {error && <div role="alert" className="admin-error admin-home-notice">{error}{conflict && <button className="admin-secondary" onClick={load} disabled={busy}>Загрузить актуальное меню</button>}</div>}{message && <p role="status" className="admin-success"><Check size={20} />{message}</p>}
    <div className="admin-panel admin-menu-finder"><label className="admin-search"><MagnifyingGlass size={22} /><input type="search" value={pageQuery} onChange={(event) => { setPageQuery(event.target.value); setChosen({}); }} placeholder="Найти страницу для меню" aria-label="Найти страницу для меню" /></label><p>{pageQuery ? `Найдено страниц: ${pageTotal}. Теперь откройте нужный раздел ниже и выберите страницу в списке «Добавить».` : "Чтобы добавить страницу в меню, сначала найдите её по названию."}</p></div>
    {menuData ? <div className="admin-menu-groups">{groups.map((group, i) => <details className="admin-panel" key={group.title}><summary><strong>{group.title}</strong><span>{group.links.length} пунктов <CaretDown /></span></summary><div className="admin-menu-items">{group.links.map((item, j) => <div key={item.key + j}><input value={item.title} maxLength={200} disabled={busy} aria-label={`Название пункта ${item.title}`} onChange={(event) => rename(i, j, event.target.value)} /><button aria-label={`Поднять ${item.title}`} title="Выше" disabled={busy || j === 0} onClick={() => move(i, j, -1)}>↑</button><button aria-label={`Опустить ${item.title}`} title="Ниже" disabled={busy || j === group.links.length - 1} onClick={() => move(i, j, 1)}>↓</button><button aria-label={`Убрать ${item.title} из меню`} title="Убрать из меню" disabled={busy} onClick={() => remove(i, j)}><X size={17} /></button></div>)}</div><div className="admin-menu-add"><select value={chosen[i] || ""} onChange={(event) => setChosen({ ...chosen, [i]: event.target.value })} aria-label={`Добавить страницу в ${group.title}`} disabled={busy}><option value="">Выберите страницу, чтобы добавить</option>{pages.filter((page) => !group.links.some((link) => link.key === page.key)).map((page) => <option key={page.key} value={page.key}>{page.title}</option>)}</select><button onClick={() => add(i)} disabled={busy || !chosen[i]}>Добавить</button></div></details>)}</div> : <p role="status">Загружаем меню…</p>}
    {dirty && <div className="admin-save-bar"><span>Есть несохранённые изменения</span><div><button className="admin-secondary" onClick={() => { setMenuData(saved); setError(""); setConflict(false); }} disabled={busy}>Отменить правки</button><button className="admin-primary" onClick={save} disabled={busy}><FloppyDisk size={18} /> Сохранить</button></div></div>}
  </>;
}

function Staff({ api, me }) {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [fields, setFields] = useState({ username: "", name: "", role: "editor", password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  useEffect(() => { api("/api/admin/users").then((data) => setItems(data.items)).catch((cause) => setError(cause.message)); }, [api]);
  const create = async (event) => {
    event.preventDefault(); setCreateError(""); setMessage("");
    try { const data = await api("/api/admin/users", { method: "POST", body: fields }); setItems(data.items); setMessage(`Сотрудник «${fields.name}» добавлен. Передайте ему логин «${fields.username}» и пароль лично.`); setFields({ username: "", name: "", role: "editor", password: "" }); }
    catch (cause) { setCreateError(cause.message); }
  };
  const toggle = async (user) => {
    if (user.active && !await confirm({ title: `Отключить доступ для «${user.name}»?`, text: "Сотрудник больше не сможет войти в редактор. Его материалы останутся на сайте. Доступ можно включить снова.", action: "Отключить доступ", danger: true })) return;
    setError(""); setMessage("");
    try { const data = await api("/api/admin/user", { method: "PATCH", body: { id: user.id, active: !user.active } }); setItems(data.items); }
    catch (cause) { setError(cause.message); }
  };
  const changeRole = async (user, role) => {
    setError(""); setMessage("");
    try { const data = await api("/api/admin/user", { method: "PATCH", body: { id: user.id, role } }); setItems(data.items); setMessage(`Роль сотрудника «${user.name}» изменена.`); }
    catch (cause) { setError(cause.message); }
  };
  const resetPassword = async (event) => { event.preventDefault(); setError(""); setMessage(""); try { await api("/api/admin/user", { method: "PATCH", body: { id: resetId, password: newPassword } }); setResetId(null); setNewPassword(""); setMessage("Пароль обновлён. Передайте его сотруднику лично; на других компьютерах ему нужно будет войти заново."); } catch (cause) { setError(cause.message); } };
  return <><SectionHeading title="Сотрудники" description="У каждого сотрудника свой логин. Так видно, кто что изменил, и можно отключить доступ одному человеку." />
    <div className="admin-roles"><div><strong>Редактор</strong><span>Новости, страницы, файлы и объявление.</span></div><div><strong>Администратор</strong><span>Всё то же, а также главная, меню, контакты, партнёры и сотрудники.</span></div></div>
    {error && <p role="alert" className="admin-error">{error}</p>}{message && <p role="status" className="admin-success"><Check size={22} />{message}</p>}
    <div className="admin-panel"><h2>Кто может редактировать сайт</h2>{items.map((user) => <div key={user.id}><div className="admin-staff-row"><div><strong>{user.name}{user.id === me.id ? " (вы)" : ""}</strong><small>Логин: {user.username}</small></div>
      <select aria-label={`Роль: ${user.name}`} value={user.role} onChange={(event) => changeRole(user, event.target.value)}><option value="editor">Редактор</option><option value="admin">Администратор</option></select>
      <span className={`admin-status ${user.active ? "published" : "archived"}`}>{user.active ? "Доступ есть" : "Отключён"}</span><button className="admin-secondary" onClick={() => { setResetId(user.id); setNewPassword(""); }}>Задать новый пароль</button><button className="admin-quiet" onClick={() => toggle(user)}>{user.active ? "Отключить" : "Включить"}</button></div>
      {resetId === user.id && <form className="admin-reset-form admin-form" onSubmit={resetPassword}><label>Новый пароль для {user.name}<input required type="text" minLength={10} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>Не менее 10 символов. Пароль виден, чтобы его можно было записать и передать.</small></label><button className="admin-primary">Сохранить пароль</button><button type="button" className="admin-secondary" onClick={() => setResetId(null)}>Отмена</button></form>}</div>)}</div>
    <form className="admin-panel admin-form admin-staff-create" onSubmit={create}><h2>Добавить сотрудника</h2><label>Имя и фамилия<input required value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} placeholder="Например: Иванова Мария Петровна" /></label><label>Логин для входа<input required value={fields.username} onChange={(e) => setFields({ ...fields, username: e.target.value })} placeholder="Например: ivanova" autoCapitalize="none" spellCheck={false} /><small>Латинские или русские буквы и цифры, без пробелов.</small></label><label>Пароль для первого входа<input required type="text" minLength={10} value={fields.password} onChange={(e) => setFields({ ...fields, password: e.target.value })} /><small>Не менее 10 символов. Сотрудник сможет сменить его сам в разделе «Мой пароль».</small></label><label>Роль<select value={fields.role} onChange={(e) => setFields({ ...fields, role: e.target.value })}><option value="editor">Редактор — новости, страницы, файлы</option><option value="admin">Администратор — все настройки сайта</option></select></label>{createError && <p role="alert" className="admin-error">{createError}</p>}<button className="admin-primary"><Plus size={20} /> Добавить сотрудника</button></form>
  </>;
}
