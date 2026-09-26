import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CaretDown, Check, ClockCounterClockwise,
  FileText, FloppyDisk, House, Image, LinkSimple, List, MagnifyingGlass,
  Newspaper, Plus, SignOut, UploadSimple, Users, X, GraduationCap, GearSix,
} from "@phosphor-icons/react";
import { Brand } from "./Header";
import { useSiteData } from "../site-data";
import { ProgramsManager, SettingsManager } from "./AdminManagers";
import "./admin.css";

const adminLink = (section = "overview") => `#/admin/${section}`;
const editLink = (key) => adminLink("edit/" + encodeURIComponent(key));
const displayDate = (value) => value ? new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";

async function responseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Не удалось выполнить действие");
  return body;
}

function Login({ onSignedIn }) {
  const [setup, setSetup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        <h1>{setup ? "Первый запуск" : "Войти в редактор"}</h1>
        <p>{setup ? "Создайте учётную запись администратора. Код первого запуска показан в терминале сервера." : "Введите свой логин и пароль. После входа вы сможете менять материалы сайта."}</p>
        <form onSubmit={submit} className="admin-form">
          {setup && <label>Код первого запуска<input required value={fields.token} onChange={(e) => setFields({ ...fields, token: e.target.value })} autoComplete="off" /></label>}
          {setup && <label>Ваше имя<input required value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} autoComplete="name" /></label>}
          <label>Логин<input required value={fields.username} onChange={(e) => setFields({ ...fields, username: e.target.value })} autoComplete="username" /></label>
          <label>Пароль<input required type="password" minLength={setup ? 10 : undefined} value={fields.password} onChange={(e) => setFields({ ...fields, password: e.target.value })} autoComplete={setup ? "new-password" : "current-password"} /></label>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <button className="admin-primary" disabled={busy}>{busy ? "Подождите…" : setup ? "Создать администратора" : "Войти"}<ArrowRight /></button>
        </form>
      </>}
    </div>
  </main>;
}

const navItems = [
  ["overview", "Обзор", House], ["news", "Новости", Newspaper], ["pages", "Страницы", FileText],
  ["media", "Файлы и фото", Image], ["programs", "Направления", GraduationCap],
  ["settings", "Главная и контакты", GearSix], ["menu", "Меню сайта", List], ["users", "Сотрудники", Users],
];

export function AdminApp({ route }) {
  const [auth, setAuth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const { refresh } = useSiteData();
  useEffect(() => { document.title = "Редактор сайта — ЖАТ"; }, []);
  useEffect(() => {
    fetch("/api/admin/me", { credentials: "same-origin", cache: "no-store" })
      .then(responseJson).then(setAuth).catch(() => setAuth(null)).finally(() => setChecking(false));
  }, []);
  const api = useCallback(async (path, { method = "GET", body, headers = {} } = {}) => {
    const isFile = typeof File !== "undefined" && body instanceof File;
    const response = await fetch(path, {
      method, credentials: "same-origin", cache: "no-store",
      headers: {
        ...(body && !isFile ? { "Content-Type": "application/json" } : {}),
        ...(isFile ? { "Content-Type": body.type, "X-File-Name": encodeURIComponent(body.name) } : {}),
        ...(auth?.csrf ? { "X-CSRF-Token": auth.csrf } : {}), ...headers,
      }, body: body === undefined ? undefined : isFile ? body : JSON.stringify(body),
    });
    if (response.status === 401) setAuth(null);
    return responseJson(response);
  }, [auth?.csrf]);
  const logout = async () => {
    try { await api("/api/admin/logout", { method: "POST" }); } catch {}
    setAuth(null); location.hash = adminLink();
  };
  if (checking) return <main className="admin-splash" role="status">Открываем редактор…</main>;
  if (!auth) return <Login onSignedIn={setAuth} />;
  const section = route.split("/")[2] || "overview";
  let key = "";
  if (section === "edit") {
    try { key = decodeURIComponent(route.slice("#/admin/edit/".length)); } catch { key = ""; }
  }
  const visibleNav = navItems.filter(([id]) => auth.user.role === "admin" || !["menu", "users", "programs", "settings"].includes(id));
  const navLabel = navItems.find(([id]) => id === section)?.[1] || (section === "edit" ? "Редактирование" : "Новый материал");
  const navigate = (id) => { setMobileMenu(false); location.hash = adminLink(id); };
  return <div className="admin-shell">
    <button className="admin-mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-expanded={mobileMenu} aria-label="Меню редактора">{mobileMenu ? <X /> : <List />} Меню</button>
    <aside className={`admin-sidebar ${mobileMenu ? "open" : ""}`}>
      <Brand />
      <p className="admin-sidebar-title">Панель управления</p>
      <nav aria-label="Редактор сайта">{visibleNav.map(([id, label, Icon], index) => <div key={id}>{(id === "overview" || id === "news" || id === "programs" || id === "users") && <span className="admin-nav-label">{({ overview: "РАБОЧИЙ СТОЛ", news: "ПУБЛИКАЦИИ", programs: "САЙТ", users: "ДОСТУП" })[id]}</span>}<a className={section === id ? "current" : ""} href={adminLink(id)} onClick={() => setMobileMenu(false)}><Icon size={21} />{label}</a></div>)}</nav>
      <div className="admin-sidebar-bottom"><a href="#top" onClick={() => setMobileMenu(false)}>Открыть сайт <ArrowUpRight /></a><div><strong>{auth.user.name}</strong><span>{auth.user.role === "admin" ? "Администратор" : "Редактор"}</span></div><button onClick={logout}><SignOut size={18} /> Выйти</button></div>
    </aside>
    <main className="admin-main" id="main">
      <div className="admin-topline"><span>Редактор сайта <span aria-hidden="true">/</span> <strong>{navLabel}</strong></span><a href="#top">Смотреть сайт <ArrowUpRight size={17} /></a></div>
      {section === "overview" ? <Overview api={api} navigate={navigate} canAdmin={auth.user.role === "admin"} user={auth.user} /> :
        section === "news" ? <Entries api={api} kind="news" /> :
        section === "pages" ? <Entries api={api} kind="page" /> :
        section === "new" ? <Editor key={route} api={api} kind={route.split("/")[3] === "page" ? "page" : "news"} refresh={refresh} /> :
        section === "edit" ? <Editor key={key} api={api} entryKey={key} refresh={refresh} /> :
        section === "media" ? <MediaLibrary api={api} /> :
        section === "programs" && auth.user.role === "admin" ? <ProgramsManager api={api} refresh={refresh} /> :
        section === "settings" && auth.user.role === "admin" ? <SettingsManager api={api} refresh={refresh} /> :
        section === "menu" && auth.user.role === "admin" ? <MenuManager api={api} refresh={refresh} /> :
        section === "users" && auth.user.role === "admin" ? <Staff api={api} /> : <Overview api={api} navigate={navigate} canAdmin={auth.user.role === "admin"} user={auth.user} />}
    </main>
  </div>;
}

function SectionHeading({ title, description, action }) {
  return <header className="admin-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function Overview({ api, navigate, canAdmin, user }) {
  const [data, setData] = useState(null);
  useEffect(() => { api("/api/admin/overview").then(setData).catch(() => {}); }, [api]);
  return <>
    <SectionHeading title={`Здравствуйте, ${user?.name?.split(" ")[0] || "коллега"}!`} description="Главное о сайте — в одном месте. Выберите задачу и начните работу." />
    <div className="admin-overview-stats">
      <div><span>Материалы</span><strong>{data ? data.news.total + data.pages.total : "—"}</strong><small>новости и страницы</small></div>
      <div><span>Ждут публикации</span><strong>{data?.draftCount ?? "—"}</strong><small>черновиков</small></div>
      <div><span>Направления</span><strong>{data?.programCount ?? "—"}</strong><small>показаны на сайте</small></div>
      <div><span>Медиатека</span><strong>{data?.mediaCount ?? "—"}</strong><small>загруженных файлов</small></div>
    </div>
    <div className="admin-overview-section-title"><h2>Быстрые действия</h2><span>Чем займёмся сегодня?</span></div>
    <div className="admin-quick-actions">
      <button onClick={() => navigate("new/news")}><Newspaper size={30} /><strong>Добавить новость</strong><span>Напишите текст, добавьте фото и опубликуйте.</span><ArrowRight /></button>
      <button onClick={() => navigate("pages")}><FileText size={30} /><strong>Изменить страницу</strong><span>Найдите нужный раздел и обновите информацию.</span><ArrowRight /></button>
      <button onClick={() => navigate("media")}><UploadSimple size={30} /><strong>Загрузить файл</strong><span>Фото, PDF, документ или видео для материала.</span><ArrowRight /></button>
      {canAdmin && <button onClick={() => navigate("programs")}><GraduationCap size={30} /><strong>Направления</strong><span>Фото, описание и порядок специальностей.</span><ArrowRight /></button>}
    </div>
    <div className="admin-overview-bottom">
      <section className="admin-panel"><div className="admin-panel-heading"><h2>Черновики</h2><a href={adminLink("news")}>Все материалы <ArrowUpRight size={16} /></a></div>{data?.drafts?.length ? <ul className="admin-activity">{data.drafts.map((item) => <li key={item.key}><a href={editLink(item.key)}><strong>{item.title}</strong><span>Открыть черновик ↗</span></a><time>{displayDate(item.updatedAt)}</time></li>)}</ul> : <p>Черновиков пока нет. Создайте новость и сохраните её перед публикацией.</p>}</section>
      <section className="admin-panel"><h2>Недавние действия</h2>{data?.activity?.length ? <ul className="admin-activity">{data.activity.slice(0, 6).map((item, index) => <li key={index}><span>{({ published: "Опубликован материал", draft: "Сохранён черновик", archived: "Скрыт материал", restore: "Восстановлена версия", upload: "Загружен файл", menu: "Обновлено меню", programs: "Обновлены направления", settings: "Обновлены контакты", setup: "Создан администратор", "user:create": "Добавлен сотрудник", "user:update": "Изменён доступ сотрудника" })[item.action] || "Изменение сайта"}: <strong>{item.subject}</strong></span><time>{displayDate(item.createdAt)}</time></li>)}</ul> : <p>Изменений пока нет.</p>}</section>
    </div>
  </>;
}

function Entries({ api, kind }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api(`/api/admin/entries?kind=${kind}&q=${encodeURIComponent(query)}&page=${page}`)
      .then((data) => { if (active) { setResult(data); setError(""); } })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [kind, query, page, api]);
  return <>
    <SectionHeading title={kind === "news" ? "Новости" : "Страницы"} description={kind === "news" ? "Публикации техникума и архив. Найдите материал по названию." : "Все разделы и служебные страницы сайта."} action={<a className="admin-primary" href={adminLink("new/" + kind)}><Plus size={20} />{kind === "news" ? "Добавить новость" : "Новая страница"}</a>} />
    <label className="admin-search"><MagnifyingGlass size={22} /><input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Найти по названию" aria-label="Найти материал" /></label>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <div className="admin-panel admin-list"><div className="admin-list-caption">{result ? `Найдено: ${result.total}` : "Загружаем…"}</div>{result?.items?.map((item) => <a className="admin-list-row" href={editLink(item.key)} key={item.key}><span className="admin-list-icon">{kind === "news" ? <Newspaper /> : <FileText />}</span><span className="admin-list-copy"><strong>{item.title}</strong><small>{item.sourceUrl ? "Материал из прежнего сайта · " : "Новый материал · "}{displayDate(item.updatedAt)}</small></span><span className={`admin-status ${item.status}`}>{({ draft: "Черновик", archived: "Скрыто", "source-error": "Источник недоступен", published: "На сайте" })[item.status]}</span><ArrowRight size={18} /></a>)}</div>
    {result && result.total > result.size && <div className="admin-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</button><span>Страница {page} из {Math.ceil(result.total / result.size)}</span><button disabled={page * result.size >= result.total} onClick={() => setPage(page + 1)}>Далее →</button></div>}
  </>;
}

function RichEditor({ html, onChange, editorRef, onInsertFile, disabled = false }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  useEffect(() => {
    if (editorRef.current && !editorRef.current.contains(document.activeElement) && editorRef.current.innerHTML !== (html || ""))
      editorRef.current.innerHTML = html || "";
  }, [html, editorRef]);
  const format = (name) => { editorRef.current?.focus(); document.execCommand(name, false); onChange(editorRef.current?.innerHTML || ""); };
  const insertLink = () => {
    if (!/^https?:\/\//i.test(linkUrl) && !linkUrl.startsWith("#/")) return;
    editorRef.current?.focus(); document.execCommand("createLink", false, linkUrl);
    onChange(editorRef.current?.innerHTML || ""); setLinkOpen(false); setLinkUrl("");
  };
  return <div className="admin-rich">
    <div className="admin-toolbar" aria-label="Форматирование текста">
      <button type="button" title="Жирный" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => format("bold")}><strong>Ж</strong></button>
      <button type="button" title="Курсив" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => format("italic")}><em>К</em></button>
      <button type="button" title="Список" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => format("insertUnorderedList")}><List size={19} /></button>
      <button type="button" title="Нумерованный список" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => format("insertOrderedList")}>1.</button>
      <button type="button" title="Ссылка" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => setLinkOpen(!linkOpen)}><LinkSimple size={19} /></button>
      <button type="button" className="admin-toolbar-file" disabled={disabled} onClick={onInsertFile}><UploadSimple size={19} /> Вставить файл или фото</button>
    </div>
    {linkOpen && <div className="admin-link-form"><input type="text" disabled={disabled} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" aria-label="Адрес ссылки" /><button type="button" disabled={disabled} onClick={insertLink}>Вставить ссылку</button></div>}
    <div ref={editorRef} role="textbox" aria-label="Текст материала" aria-multiline="true" aria-readonly={disabled} contentEditable={!disabled} suppressContentEditableWarning className="admin-editable imported-content" onInput={(e) => onChange(e.currentTarget.innerHTML)} onPaste={(event) => { event.preventDefault(); const text = event.clipboardData.getData("text/plain"); document.execCommand("insertText", false, text); }} />
    <p className="admin-hint">Выделите текст, чтобы сделать его жирным или добавить ссылку. При вставке из Word сохранится текст без лишнего оформления.</p>
  </div>;
}

function insertNodeAtCursor(node, parent) {
  parent.focus();
  const selection = window.getSelection();
  if (selection?.rangeCount && parent.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
  } else parent.append(node);
}

function Editor({ api, entryKey, kind = "news", refresh }) {
  const [entry, setEntry] = useState(null);
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [image, setImage] = useState("");
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState([]);
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);
  const [revisions, setRevisions] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editorRef = useRef(null);
  const currentKind = entry?.kind || kind;
  useEffect(() => {
    api("/api/admin/menu").then((result) => setGroups(result.groups)).catch(() => {});
    if (!entryKey) { setEntry({ key: "", kind, version: 0, status: "draft" }); return; }
    let active = true;
    api("/api/admin/entry?key=" + encodeURIComponent(entryKey)).then(async (result) => {
      if (result.needsSourceBody && !result.html) {
        try { const source = await responseJson(await fetch("/api/content?key=" + encodeURIComponent(entryKey))); result.html = source.html || ""; } catch {}
      }
      if (!active) return;
      setEntry(result); setTitle(result.title || ""); setSummary(result.summary || ""); setHtml(result.html || ""); setImage(result.image || ""); setGroup(result.group || "");
    }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [entryKey, kind, api]);
  const save = async (status) => {
    if (busy) return;
    setError(""); setMessage(""); setBusy(true);
    try {
      const result = await api("/api/admin/entry", { method: "PUT", body: {
        key: entry?.key || "", kind: currentKind, title, summary, html: editorRef.current?.innerHTML || html,
        image, group, status, expectedVersion: entry?.version || 0,
      } });
      setEntry(result); setHtml(result.html || ""); setGroup(result.group || group);
      setMessage(status === "published" ? "Материал опубликован и уже виден на сайте." : status === "archived" ? "Материал скрыт с сайта." : "Черновик сохранён. Посетители его не видят.");
      window.dispatchEvent(new Event("zhat:site-updated")); await refresh();
      if (!entryKey && result.key) history.replaceState(null, "", editLink(result.key));
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const openHistory = async () => {
    try { setRevisions((await api("/api/admin/revisions?key=" + encodeURIComponent(entry.key))).items); }
    catch (cause) { setError(cause.message); }
  };
  const restore = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api("/api/admin/restore", { method: "POST", body: { key: entry.key, revisionId: id } });
      setEntry(result); setTitle(result.title); setSummary(result.summary); setHtml(result.html); setImage(result.image); setGroup(result.group || "");
      if (editorRef.current) editorRef.current.innerHTML = result.html || "";
      setMessage("Версия восстановлена."); setRevisions(null); window.dispatchEvent(new Event("zhat:site-updated"));
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const insertFile = (file, asCover = false) => {
    if (asCover) setImage(file.url);
    else {
      const node = document.createElement(file.mime.startsWith("image/") ? "img" : "a");
      if (node.tagName === "IMG") { node.src = file.url; node.alt = file.name; }
      else { node.href = file.url; node.textContent = file.name; node.target = "_blank"; node.rel = "noopener noreferrer"; }
      insertNodeAtCursor(node, editorRef.current); setHtml(editorRef.current.innerHTML);
    }
    setPicker(false);
  };
  if (!entry) return <p role="status" className="admin-panel">{error || "Открываем материал…"}</p>;
  return <>
    <a className="admin-back" href={adminLink(currentKind === "news" ? "news" : "pages")}><ArrowLeft /> К списку {currentKind === "news" ? "новостей" : "страниц"}</a>
    <SectionHeading title={entry.key ? currentKind === "news" ? "Редактировать новость" : "Редактировать страницу" : currentKind === "news" ? "Новая новость" : "Новая страница"} description="Напишите текст и проверьте его. Черновик можно сохранить без публикации." />
    <div className="admin-editor-layout">
      <div className="admin-panel admin-edit-form">
        <label>Название <span>*</span><input value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} maxLength={220} placeholder={currentKind === "news" ? "Например, День открытых дверей" : "Название раздела"} /></label>
        <label>Короткое описание<input value={summary} disabled={busy} onChange={(e) => setSummary(e.target.value)} maxLength={800} placeholder="Одно предложение о главном" /><small>Показывается в поиске и помогает посетителям понять материал.</small></label>
        {currentKind === "page" && !entry.sourceUrl && <label>Раздел сайта<select value={group} disabled={busy} onChange={(e) => setGroup(e.target.value)}><option value="">Без раздела</option>{groups.map((g) => <option key={g.title}>{g.title}</option>)}</select><small>Новая страница появится в выбранном разделе после публикации.</small></label>}
        <label className="admin-editor-label">Текст материала <span>*</span></label>
        <RichEditor html={html} onChange={setHtml} editorRef={editorRef} onInsertFile={() => setPicker("body")} disabled={busy} />
        {error && <p role="alert" className="admin-error">{error}</p>}
        {message && <p role="status" className="admin-success"><Check size={20} />{message}</p>}
      </div>
      <aside className="admin-editor-side">
        <div className="admin-panel"><h2>Публикация</h2><p className="admin-status-line">Сейчас: <span className={`admin-status ${entry.status}`}>{({ draft: "Черновик", published: "На сайте", archived: "Скрыто" })[entry.status]}</span></p><button disabled={busy || !title.trim() || !html.trim()} className="admin-primary" onClick={() => save("published")}><Check size={20} /> Опубликовать</button><button disabled={busy || !title.trim()} className="admin-secondary" onClick={() => save("draft")}><FloppyDisk size={20} /> Сохранить черновик</button><button className="admin-secondary" onClick={() => setPreview(true)}><ArrowUpRight size={20} /> Предпросмотр</button>{entry.key && entry.hasPublished && <a className="admin-secondary" href={`#/page/${encodeURIComponent(entry.key)}`} target="_blank" rel="noopener noreferrer">Посмотреть на сайте <ArrowUpRight /></a>}</div>
        {currentKind === "news" && <div className="admin-panel"><h2>Главное фото</h2>{image ? <img className="admin-cover-preview" src={image} alt="Обложка материала" /> : <p>У новости может быть фотография. Её увидят на главной.</p>}<button className="admin-secondary" disabled={busy} onClick={() => setPicker("cover")}><Image size={20} /> {image ? "Заменить фото" : "Добавить фото"}</button>{image && <button className="admin-quiet" disabled={busy} onClick={() => setImage("")}>Убрать фото</button>}</div>}
        {entry.key && <div className="admin-panel"><h2>История и адрес</h2><p className="admin-url">{entry.key}</p><button className="admin-secondary" onClick={openHistory}><ClockCounterClockwise size={20} /> Предыдущие версии</button>{revisions && <div className="admin-revisions">{revisions.length ? revisions.map((version) => <button key={version.id} disabled={busy} onClick={() => restore(version.id)}>{displayDate(version.created_at)} <ArrowRight size={16} /></button>) : <p>Предыдущих версий пока нет.</p>}</div>}{entry.status !== "archived" && <button className="admin-quiet" disabled={busy} onClick={() => save("archived")}>Скрыть с сайта</button>}</div>}
      </aside>
    </div>
    {picker && <MediaPicker api={api} defaultCover={picker === "cover"} onClose={() => setPicker(false)} onChoose={insertFile} />}
    {preview && <Preview title={title} summary={summary} image={image} html={editorRef.current?.innerHTML || html} onClose={() => setPreview(false)} />}
  </>;
}

const escapeMarkup = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function Preview({ title, summary, image, html, onClose }) {
  const srcDoc = `<!doctype html><html lang="ru"><meta charset="utf-8"><style>body{font:17px/1.7 system-ui,sans-serif;color:#182832;max-width:750px;margin:40px auto;padding:0 22px}h1{font-size:clamp(30px,6vw,50px);line-height:1.1}h2{line-height:1.2}img,video{max-width:100%;height:auto}a{color:#bc4e31}table{border-collapse:collapse;display:block;overflow:auto}td,th{border:1px solid #dbe5e9;padding:8px}</style><h1>${escapeMarkup(title)}</h1>${summary ? `<p>${escapeMarkup(summary)}</p>` : ""}${image ? `<img src="${escapeMarkup(image)}" alt="">` : ""}<main>${html || ""}</main></html>`;
  return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="admin-modal admin-preview-modal" role="dialog" aria-modal="true" aria-label="Предпросмотр материала"><header><div><h2>Предпросмотр</h2><p>Так будет выглядеть материал после публикации.</p></div><button aria-label="Закрыть" onClick={onClose}><X /></button></header><iframe title="Материал до публикации" sandbox="" srcDoc={srcDoc} /></div></div>;
}

function MediaPicker({ api, onClose, onChoose, defaultCover = false }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api("/api/admin/media").then((result) => setItems(result.items)).catch((cause) => setError(cause.message));
  useEffect(() => { load(); }, [api]);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setError("");
    try { const item = await api("/api/admin/media", { method: "POST", body: file }); setItems([item, ...items]); onChoose(item, defaultCover && item.mime.startsWith("image/")); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="admin-modal" role="dialog" aria-modal="true" aria-label="Выбрать файл"><header><div><h2>{defaultCover ? "Главное фото" : "Файлы и фото"}</h2><p>{defaultCover ? "Загрузите фото или выберите одно из уже добавленных." : "Выберите загруженный файл или добавьте новый."}</p></div><button aria-label="Закрыть" onClick={onClose}><X /></button></header><label className="admin-upload"><UploadSimple />{busy ? "Загружаем…" : defaultCover ? "Загрузить новое фото" : "Загрузить новый файл"}<input type="file" accept={defaultCover ? "image/jpeg,image/png,image/webp,image/gif" : "image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xlsx,video/mp4"} onChange={(e) => upload(e.target.files?.[0])} disabled={busy} /></label>{error && <p role="alert" className="admin-error">{error}</p>}<div className="admin-media-grid">{items.filter((item) => !defaultCover || item.mime.startsWith("image/")).map((item) => <div key={item.id} className="admin-media-item">{item.mime.startsWith("image/") ? <img src={item.url || `/api/site/media/${item.id}`} alt="" /> : <FileText size={34} />}<strong>{item.name}</strong>{!defaultCover && <button onClick={() => onChoose({ ...item, url: item.url || `/api/site/media/${item.id}` }, false)}>Вставить в текст</button>}{item.mime.startsWith("image/") && <button onClick={() => onChoose({ ...item, url: item.url || `/api/site/media/${item.id}` }, true)}>На обложку</button>}</div>)}</div></div></div>;
}

function MediaLibrary({ api }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/admin/media").then((data) => setItems(data.items)).catch((cause) => setError(cause.message)); }, [api]);
  const upload = async (file) => {
    if (!file) return; setBusy(true); setError(""); setMessage("");
    try { const item = await api("/api/admin/media", { method: "POST", body: file }); setItems([item, ...items]); setMessage("Файл загружен. Откройте материал, чтобы вставить его в текст."); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const copy = async (item) => {
    setError(""); setMessage("");
    try {
      await navigator.clipboard.writeText(location.origin + (item.url || `/api/site/media/${item.id}`));
      setMessage(`Ссылка на «${item.name}» скопирована.`);
    } catch { setError("Не удалось скопировать ссылку. Откройте файл и скопируйте его адрес из браузера."); }
  };
  const visible = items.filter((item) => item.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")));
  return <><SectionHeading title="Файлы и фото" description="Все материалы в одном месте. Документы можно вставить в страницу или новость." />
    <label className="admin-upload"><UploadSimple size={24} />{busy ? "Загружаем…" : "Выбрать файл с компьютера"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xlsx,video/mp4" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} /></label>
    <p className="admin-hint">Изображения, PDF, Word, Excel и MP4. Максимум 25 МБ.</p>
    {error && <p role="alert" className="admin-error">{error}</p>}{message && <p role="status" className="admin-success">{message}</p>}
    <label className="admin-search admin-media-search"><MagnifyingGlass size={20} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти загруженный файл" aria-label="Найти файл" /></label>
    {visible.length ? <div className="admin-media-grid standalone">{visible.map((item) => <div key={item.id} className="admin-media-item"><a href={item.url || `/api/site/media/${item.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Открыть ${item.name}`}>{item.mime.startsWith("image/") ? <img src={item.url || `/api/site/media/${item.id}`} alt="" /> : <FileText size={40} />}</a><strong>{item.name}</strong><small>{Math.round(item.size / 1024)} КБ · {displayDate(item.uploadedAt)}</small><button onClick={() => copy(item)}>Скопировать ссылку</button></div>)}</div> : <p className="admin-empty">{items.length ? "По этому запросу файлов нет." : "Файлов пока нет. Загрузите первый файл с компьютера."}</p>}
  </>;
}

function MenuManager({ api, refresh }) {
  const [groups, setGroups] = useState([]);
  const [pages, setPages] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [chosen, setChosen] = useState({});
  useEffect(() => { api("/api/admin/menu").then((data) => setGroups(data.groups)).catch((cause) => setError(cause.message)); api("/api/admin/entries?kind=page&size=200").then((data) => setPages(data.items)).catch(() => {}); }, [api]);
  const move = (groupIndex, itemIndex, direction) => { const next = structuredClone(groups); const target = itemIndex + direction; if (target < 0 || target >= next[groupIndex].links.length) return; [next[groupIndex].links[itemIndex], next[groupIndex].links[target]] = [next[groupIndex].links[target], next[groupIndex].links[itemIndex]]; setGroups(next); };
  const remove = (groupIndex, itemIndex) => { const next = structuredClone(groups); next[groupIndex].links.splice(itemIndex, 1); setGroups(next); };
  const add = (groupIndex) => { const key = chosen[groupIndex]; const page = pages.find((p) => p.key === key); if (!page || groups[groupIndex].links.some((l) => l.key === key)) return; const next = structuredClone(groups); next[groupIndex].links.push({ key, title: page.title, url: key }); setGroups(next); };
  const save = async () => { setError(""); setMessage(""); try { await api("/api/admin/menu", { method: "PUT", body: { groups } }); setMessage("Меню обновлено на сайте."); window.dispatchEvent(new Event("zhat:site-updated")); await refresh(); } catch (cause) { setError(cause.message); } };
  return <><SectionHeading title="Меню сайта" description="Поменяйте порядок страниц стрелками или добавьте существующую страницу в раздел." action={<button className="admin-primary" onClick={save}><FloppyDisk /> Сохранить меню</button>} />
    {error && <p role="alert" className="admin-error">{error}</p>}{message && <p role="status" className="admin-success">{message}</p>}
    <div className="admin-menu-groups">{groups.map((group, i) => <details className="admin-panel" key={group.title}><summary><strong>{group.title}</strong><span>{group.links.length} пунктов <CaretDown /></span></summary><div className="admin-menu-items">{group.links.map((item, j) => <div key={item.key + j}><span>{item.title}</span><button aria-label={`Поднять ${item.title}`} title="Выше" disabled={j === 0} onClick={() => move(i, j, -1)}>↑</button><button aria-label={`Опустить ${item.title}`} title="Ниже" disabled={j === group.links.length - 1} onClick={() => move(i, j, 1)}>↓</button><button aria-label={`Убрать ${item.title} из меню`} title="Убрать из меню" onClick={() => remove(i, j)}><X size={17} /></button></div>)}</div><div className="admin-menu-add"><select value={chosen[i] || ""} onChange={(e) => setChosen({ ...chosen, [i]: e.target.value })} aria-label={`Добавить страницу в ${group.title}`}><option value="">Выберите страницу</option>{pages.map((page) => <option key={page.key} value={page.key}>{page.title}</option>)}</select><button onClick={() => add(i)}>Добавить</button></div></details>)}</div>
  </>;
}

function Staff({ api }) {
  const [items, setItems] = useState([]);
  const [fields, setFields] = useState({ username: "", name: "", role: "editor", password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  useEffect(() => { api("/api/admin/users").then((data) => setItems(data.items)).catch((cause) => setError(cause.message)); }, [api]);
  const create = async (event) => { event.preventDefault(); setError(""); try { const data = await api("/api/admin/users", { method: "POST", body: fields }); setItems(data.items); setFields({ username: "", name: "", role: "editor", password: "" }); setMessage("Сотрудник добавлен. Передайте ему логин и пароль лично."); } catch (cause) { setError(cause.message); } };
  const toggle = async (user) => { setError(""); try { const data = await api("/api/admin/user", { method: "PATCH", body: { id: user.id, active: !user.active } }); setItems(data.items); } catch (cause) { setError(cause.message); } };
  const resetPassword = async (event) => { event.preventDefault(); setError(""); setMessage(""); try { await api("/api/admin/user", { method: "PATCH", body: { id: resetId, password: newPassword } }); setResetId(null); setNewPassword(""); setMessage("Пароль обновлён. Старые сеансы сотрудника закрыты. Передайте новый пароль лично."); } catch (cause) { setError(cause.message); } };
  return <><SectionHeading title="Сотрудники" description="Каждый сотрудник входит под своим логином. Редактор публикует материалы; администратор также меняет меню и учётные записи." />
    <div className="admin-panel"><h2>Кто может редактировать сайт</h2>{items.map((user) => <div key={user.id}><div className="admin-staff-row"><div><strong>{user.name}</strong><small>{user.username} · {user.role === "admin" ? "Администратор" : "Редактор"}</small></div><span className={`admin-status ${user.active ? "published" : "archived"}`}>{user.active ? "Доступ есть" : "Отключён"}</span><button className="admin-quiet" onClick={() => { setResetId(user.id); setNewPassword(""); }}>Новый пароль</button><button className="admin-quiet" onClick={() => toggle(user)}>{user.active ? "Отключить" : "Включить"}</button></div>{resetId === user.id && <form className="admin-reset-form admin-form" onSubmit={resetPassword}><label>Новый пароль для {user.name}<input required type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>Не менее 10 символов.</small></label><button className="admin-primary">Обновить пароль</button><button type="button" className="admin-secondary" onClick={() => setResetId(null)}>Отмена</button></form>}</div>)}{error && <p role="alert" className="admin-error">{error}</p>}{message && <p role="status" className="admin-success">{message}</p>}</div>
    <form className="admin-panel admin-form admin-staff-create" onSubmit={create}><h2>Добавить сотрудника</h2><label>Имя<input required value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} /></label><label>Логин<input required value={fields.username} onChange={(e) => setFields({ ...fields, username: e.target.value })} /></label><label>Пароль для первого входа<input required type="password" minLength={10} value={fields.password} onChange={(e) => setFields({ ...fields, password: e.target.value })} /><small>Не менее 10 символов. Передайте пароль лично.</small></label><label>Роль<select value={fields.role} onChange={(e) => setFields({ ...fields, role: e.target.value })}><option value="editor">Редактор</option><option value="admin">Администратор</option></select></label>{error && <p role="alert" className="admin-error">{error}</p>}{message && <p role="status" className="admin-success">{message}</p>}<button className="admin-primary">Добавить сотрудника</button></form>
  </>;
}
