import { useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpRight, Check, ClockCounterClockwise, Eye, FloppyDisk,
  SquaresFour, UploadSimple, X,
} from "@phosphor-icons/react";
import { defaultHomepage, isHomepageShape } from "../homepage";

const sections = {
  hero: { name: "Первый экран", detail: "Заголовок, фото и главные кнопки", anchor: "#top" },
  audiences: { name: "Быстрые переходы", detail: "Кнопки для поступающих, студентов и родителей", anchor: "#top" },
  programs: { name: "Направления", detail: "Вступление к каталогу специальностей", anchor: "#programs" },
  life: { name: "Студенческая жизнь", detail: "История и фотография", anchor: "#life" },
  directory: { name: "Разделы сайта", detail: "Переход к страницам и документам", anchor: "#/sections" },
  news: { name: "Новости", detail: "Лента опубликованных новостей", anchor: "#news" },
  contacts: { name: "Контакты", detail: "Завершающий блок и приёмная комиссия", anchor: "#contacts" },
};

const audienceNames = { admission: "Поступающим", students: "Студентам", parents: "Родителям" };
const previewKey = "zhat-home-preview";

const announce = (refresh) => {
  window.dispatchEvent(new Event("zhat:site-updated"));
  return refresh();
};

export function HomepageManager({ api, refresh, userId }) {
  const draftKey = `zhat-home-draft-${userId}`;
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState(null);
  const [selected, setSelected] = useState("hero");
  const [busy, setBusy] = useState(false);
  const [galleryFor, setGalleryFor] = useState("");
  const [gallery, setGallery] = useState([]);
  const [previewId, setPreviewId] = useState(0);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = Boolean(data && saved && JSON.stringify(data.value) !== JSON.stringify(saved.value));

  const load = async (discardDraft = false) => {
    setError(""); setConflict(false);
    try {
      const result = await api("/api/admin/homepage");
      let draft = null;
      try { draft = JSON.parse(sessionStorage.getItem(draftKey) || "null"); } catch {}
      if (discardDraft) sessionStorage.removeItem(draftKey);
      const restored = !discardDraft && draft?.version === result.version && isHomepageShape(draft?.value, result.value);
      setData(restored ? { ...result, value: draft.value } : result);
      setSaved(result);
      setMessage(restored ? "Незавершённые правки восстановлены в редакторе. Они ещё не видны посетителям." : "");
    } catch (cause) { setError(cause.message); }
  };
  useEffect(() => { load(); }, [api]);
  useEffect(() => {
    if (!data || !saved) return;
    try {
      if (dirty) sessionStorage.setItem(draftKey, JSON.stringify({ version: data.version, value: data.value }));
      else sessionStorage.removeItem(draftKey);
    } catch {}
  }, [data, saved, dirty]);
  useEffect(() => () => { try { sessionStorage.removeItem(previewKey); } catch {} }, []);
  useEffect(() => {
    if (!galleryFor) return;
    const close = (event) => { if (event.key === "Escape") setGalleryFor(""); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [galleryFor]);

  const change = (section, key, value) => {
    setData((current) => ({ ...current, value: {
      ...current.value, [section]: { ...current.value[section], [key]: value },
    } }));
    setMessage(""); setError(""); setConflict(false);
  };
  const changeAudience = (id, key, value) => {
    setData((current) => ({ ...current, value: {
      ...current.value, audiences: { ...current.value.audiences,
        items: current.value.audiences.items.map((item) => item.id === id ? { ...item, [key]: value } : item),
      },
    } }));
    setMessage(""); setError(""); setConflict(false);
  };
  const move = (id, direction, audience = false) => {
    setData((current) => {
      const value = structuredClone(current.value);
      const items = audience ? value.audiences.items : value.order;
      const from = audience ? items.findIndex((item) => item.id === id) : items.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= items.length) return current;
      [items[from], items[to]] = [items[to], items[from]];
      return { ...current, value };
    });
    setMessage(""); setError(""); setConflict(false);
  };
  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true); setError(""); setConflict(false); setMessage("");
    try {
      const result = await api("/api/admin/homepage", { method: "PUT", body: {
        value: data.value, expectedVersion: data.version,
      } });
      setData(result); setSaved(result);
      setMessage("Блоки главной обновлены. Изменения уже видны посетителям.");
      await announce(refresh);
    } catch (cause) { setConflict(cause.status === 409); setError(cause.message); }
    finally { setBusy(false); }
  };
  const upload = async (section, file) => {
    if (!file) return;
    setBusy(true); setError(""); setConflict(false); setMessage("");
    try {
      const item = await api("/api/admin/media", { method: "POST", body: file });
      change(section, "image", item.url);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const openGallery = async (section) => {
    setBusy(true); setError(""); setConflict(false);
    try {
      const result = await api("/api/admin/media");
      setGallery(result.items.filter((item) => item.mime.startsWith("image/")));
      setGalleryFor(section);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const preview = () => {
    if (!data) return;
    try { sessionStorage.setItem(previewKey, JSON.stringify(data.value)); }
    catch { setConflict(false); setError("Не удалось открыть предпросмотр в этом браузере."); return; }
    setPreviewMode("desktop");
    setPreviewId(Date.now());
  };
  const closePreview = () => { setPreviewId(0); sessionStorage.removeItem(previewKey); };
  const openHistory = async () => {
    setBusy(true); setError(""); setConflict(false);
    try {
      const result = await api("/api/admin/homepage/revisions");
      setHistory(result.items); setHistoryOpen(true);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const restore = async (revisionId) => {
    if (dirty || busy) return;
    setBusy(true); setError(""); setConflict(false); setMessage("");
    try {
      const result = await api("/api/admin/homepage/restore", { method: "POST", body: {
        revisionId, expectedVersion: data.version,
      } });
      setData(result); setSaved(result); setHistoryOpen(false);
      setMessage("Прежняя версия главной восстановлена и опубликована.");
      await announce(refresh);
    } catch (cause) { setConflict(cause.status === 409); setError(cause.message); }
    finally { setBusy(false); }
  };
  const field = (section, key, label, { hint = "", rows = 0, maxLength = 180 } = {}) =>
    <label key={`${section}-${key}`}>{label}
      {rows ? <textarea rows={rows} value={data.value[section][key]} disabled={busy}
        maxLength={maxLength} required onChange={(event) => change(section, key, event.target.value)} />
        : <input value={data.value[section][key]} disabled={busy} maxLength={maxLength}
          required onChange={(event) => change(section, key, event.target.value)} />}
      {hint && <small>{hint}</small>}
    </label>;
  const photo = (section, label) => <div className="admin-home-photo-field">
    <strong>{label}</strong>
    <img src={data.value[section].image} alt="Текущая фотография блока" />
    <div className="admin-program-photo-actions">
      <label className="admin-secondary"><UploadSimple size={18} />Загрузить фото
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy}
          onChange={(event) => { upload(section, event.target.files?.[0]); event.target.value = ""; }} />
      </label>
      <button className="admin-secondary" disabled={busy} onClick={() => openGallery(section)}>Из загруженных</button>
      <button className="admin-quiet" disabled={busy || data.value[section].image === defaultHomepage()[section].image}
        onClick={() => change(section, "image", defaultHomepage()[section].image)}>Вернуть исходное</button>
    </div>
    {field(section, "imageAlt", "Описание фотографии", { hint: "Коротко опишите изображение для тех, кто не видит фото.", maxLength: 180 })}
  </div>;

  const value = data?.value;
  const orderedNav = value ? ["hero", ...value.order, "contacts"] : [];
  const sectionIndex = value?.order.indexOf(selected) ?? -1;
  const related = {
    programs: ["Редактировать специальности", "#/admin/programs"],
    directory: ["Редактировать меню сайта", "#/admin/menu"],
    news: ["Редактировать новости", "#/admin/news"],
    contacts: ["Изменить телефоны и адреса", "#/admin/settings"],
  }[selected];

  return <>
    <header className="admin-heading admin-home-heading"><div><span className="admin-eyebrow">СТРУКТУРА САЙТА</span><h1>Блоки главной</h1><p>Выберите блок, измените текст или фото и сохраните. Порядок и видимость тоже управляются здесь.</p></div><div className="admin-home-heading-actions"><button className="admin-secondary" onClick={openHistory} disabled={!data || busy}><ClockCounterClockwise size={20} /> Версии</button><button className="admin-secondary" onClick={preview} disabled={!data || busy}><Eye size={20} /> Предпросмотр</button><button className="admin-primary" onClick={save} disabled={!dirty || busy}><FloppyDisk size={20} />{busy ? "Сохраняем…" : "Опубликовать изменения"}</button></div></header>
    {error && <div role="alert" className="admin-error admin-home-notice">{error}{conflict && <button className="admin-secondary" onClick={() => load(true)} disabled={busy}>Загрузить актуальную версию</button>}</div>}
    {message && <p role="status" className="admin-success"><Check size={20} />{message}</p>}
    {!data && !error && <p role="status">Загружаем блоки главной…</p>}
    {value && <div className="admin-home-layout">
      <aside className="admin-panel admin-home-list" aria-label="Блоки главной">
        <div className="admin-home-list-heading"><SquaresFour size={20} /><strong>Главная страница</strong><span>{value.order.length + 2} блоков</span></div>
        <label className="admin-home-mobile-select">Выберите блок
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            {orderedNav.map((id, index) => <option key={id} value={id}>{String(index + 1).padStart(2, "0")}. {sections[id].name}{value[id].visible === false ? " · скрыт" : ""}</option>)}
          </select>
        </label>
        {orderedNav.map((id, index) => <button key={id} className={`admin-home-list-item ${selected === id ? "active" : ""}`}
          aria-pressed={selected === id} onClick={() => setSelected(id)}>
          <span className="admin-home-list-number">{String(index + 1).padStart(2, "0")}</span>
          <span><strong>{sections[id].name}</strong><small>{sections[id].detail}</small></span>
          {id !== "hero" && id !== "contacts" && id !== "programs" && <span className={`admin-home-visibility ${value[id].visible ? "" : "hidden"}`}>{value[id].visible ? "На сайте" : "Скрыт"}</span>}
        </button>)}
      </aside>
      <div className="admin-panel admin-home-editor">
        <div className="admin-home-editor-head"><div><span className="admin-eyebrow">БЛОК {String(orderedNav.indexOf(selected) + 1).padStart(2, "0")}</span><h2>{sections[selected].name}</h2><p>{sections[selected].detail}</p></div><a href={sections[selected].anchor} target="_blank" rel="noopener noreferrer" className="admin-secondary">Посмотреть <ArrowUpRight size={18} /></a></div>
        {sectionIndex >= 0 && <div className="admin-home-controls">
          <div><strong>Порядок на главной</strong><small>Передвигайте блоки выше или ниже.</small></div>
          <button className="admin-secondary" disabled={busy || sectionIndex === 0} onClick={() => move(selected, -1)} aria-label={`Поднять блок ${sections[selected].name}`}><ArrowUp size={17} /> Выше</button>
          <button className="admin-secondary" disabled={busy || sectionIndex === value.order.length - 1} onClick={() => move(selected, 1)} aria-label={`Опустить блок ${sections[selected].name}`}><ArrowDown size={17} /> Ниже</button>
        </div>}
        {selected !== "hero" && selected !== "contacts" && selected !== "programs" && <label className="admin-home-toggle"><input type="checkbox" checked={value[selected].visible} disabled={busy}
          onChange={(event) => change(selected, "visible", event.target.checked)} /><span><strong>Показывать блок на сайте</strong><small>Если выключить, данные сохранятся и блок можно будет вернуть.</small></span></label>}
        <div className="admin-edit-form admin-home-fields">
          {selected === "hero" && <>
            {field("hero", "title", "Главный заголовок", { rows: 3, maxLength: 120, hint: "Каждая строка появится на отдельной строке первого экрана. Максимум три строки." })}
            {field("hero", "lead", "Текст под заголовком", { rows: 3, maxLength: 300 })}
            {field("hero", "location", "Города", { maxLength: 180 })}
            {photo("hero", "Главная фотография")}
            <div className="admin-field-grid">{field("hero", "primaryLabel", "Кнопка к направлениям", { maxLength: 60 })}{field("hero", "secondaryLabel", "Кнопка знакомства", { maxLength: 60 })}</div>
          </>}
          {selected === "audiences" && <>
            <p className="admin-hint">Каждая карточка открывает свой раздел для посетителей. Порядок и названия можно менять, назначение кнопки остаётся правильным.</p>
            {value.audiences.items.map((item, index) => <div className="admin-home-audience" key={item.id}>
              <div className="admin-home-audience-head"><strong>{audienceNames[item.id]}</strong><div><button className="admin-secondary" disabled={busy || index === 0} onClick={() => move(item.id, -1, true)} aria-label={`Поднять переход ${item.title}`}><ArrowUp size={16} /></button><button className="admin-secondary" disabled={busy || index === value.audiences.items.length - 1} onClick={() => move(item.id, 1, true)} aria-label={`Опустить переход ${item.title}`}><ArrowDown size={16} /></button></div></div>
              <label className="admin-home-toggle compact"><input type="checkbox" checked={item.visible} disabled={busy || value.audiences.visible && item.visible && value.audiences.items.filter((entry) => entry.visible).length === 1} onChange={(event) => changeAudience(item.id, "visible", event.target.checked)} /><span>Показывать карточку</span></label>
              <label>Название<input value={item.title} maxLength={65} disabled={busy} required onChange={(event) => changeAudience(item.id, "title", event.target.value)} /></label>
              <label>Пояснение<input value={item.description} maxLength={120} disabled={busy} required onChange={(event) => changeAudience(item.id, "description", event.target.value)} /></label>
            </div>)}
          </>}
          {selected === "programs" && <>{field("programs", "title", "Заголовок", { rows: 2, maxLength: 100, hint: "Точка в конце выделяется цветом автоматически." })}{field("programs", "intro", "Короткое вступление", { rows: 3, maxLength: 260 })}<p className="admin-hint">Карточки специальностей, их фото и порядок редактируются отдельно.</p></>}
          {selected === "life" && <>{field("life", "title", "Заголовок", { rows: 3, maxLength: 120 })}{field("life", "description", "Описание", { rows: 3, maxLength: 260 })}{photo("life", "Фотография блока")}{field("life", "caption", "Подпись к фотографии", { maxLength: 120 })}</>}
          {selected === "directory" && <>{field("directory", "title", "Заголовок блока", { maxLength: 100 })}<p className="admin-hint">Пункты шести разделов и их порядок редактируются в меню сайта.</p></>}
          {selected === "news" && <>{field("news", "title", "Заголовок блока", { rows: 2, maxLength: 100 })}<p className="admin-hint">Три последние опубликованные новости подставляются автоматически.</p></>}
          {selected === "contacts" && <>{field("contacts", "title", "Заголовок блока", { rows: 2, maxLength: 120, hint: "Точка в конце выделяется цветом автоматически." })}{field("contacts", "buttonLabel", "Кнопка приёмной комиссии", { maxLength: 60 })}<p className="admin-hint">Телефоны, адреса и почта находятся в разделе «Контакты».</p></>}
        </div>
        {related && <a className="admin-secondary admin-home-related" href={related[1]}>{related[0]} <ArrowUpRight size={18} /></a>}
      </div>
    </div>}
    {dirty && <div className="admin-save-bar"><span>Есть неопубликованные изменения</span><div><button className="admin-secondary" disabled={busy} onClick={() => { setData(saved); setMessage(""); setError(""); setConflict(false); }}>Отменить правки</button><button className="admin-primary" disabled={busy} onClick={save}><FloppyDisk size={18} /> Опубликовать</button></div></div>}
    {galleryFor && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setGalleryFor(""); }}><div className="admin-modal admin-program-gallery" role="dialog" aria-modal="true" aria-label="Выбрать фотографию"><header><div><h2>Фото из файлов</h2><p>Выберите ранее загруженное изображение.</p></div><button aria-label="Закрыть" onClick={() => setGalleryFor("")}><X /></button></header><div className="admin-media-grid">{gallery.length ? gallery.map((file) => <button className="admin-media-item" key={file.id} onClick={() => { change(galleryFor, "image", `/api/site/media/${file.id}`); setGalleryFor(""); }}><img src={`/api/site/media/${file.id}`} alt="" /><strong>{file.name}</strong></button>) : <p>Фото ещё не загружены. Загрузите первое фото с компьютера.</p>}</div></div></div>}
    {historyOpen && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}><div className="admin-modal admin-home-history" role="dialog" aria-modal="true" aria-label="Прежние версии главной"><header><div><h2>Прежние версии главной</h2><p>Восстановление сразу опубликует выбранную версию. Текущая сохранится в истории.</p></div><button aria-label="Закрыть" onClick={() => setHistoryOpen(false)}><X /></button></header>{dirty && <p className="admin-hint">Сначала опубликуйте или отмените текущие правки.</p>}<div className="admin-home-history-list">{history.length ? history.map((item) => <div key={item.id}><div><strong>{item.version === 0 ? "Исходная версия" : `Версия ${item.version}`}</strong><span>{item.title}</span><small>Копия сохранена {new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</small></div><button className="admin-secondary" disabled={busy || dirty} onClick={() => restore(item.id)}>Восстановить</button></div>) : <p>Предыдущих версий пока нет. Они появятся после первой публикации.</p>}</div></div></div>}
    {previewId > 0 && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}><div className="admin-modal admin-home-preview" role="dialog" aria-modal="true" aria-label="Предпросмотр главной"><header><div><h2>Предпросмотр главной</h2><p>Так страница будет выглядеть после публикации. Изменения пока видны только здесь.</p></div><button aria-label="Закрыть" onClick={closePreview}><X /></button></header><div className="admin-home-preview-tools"><button className={previewMode === "desktop" ? "active" : ""} onClick={() => setPreviewMode("desktop")}>Компьютер</button><button className={previewMode === "mobile" ? "active" : ""} onClick={() => setPreviewMode("mobile")}>Телефон</button></div><div className="admin-home-preview-frame"><iframe title="Главная страница до публикации" className={previewMode} src={`/?home-preview=${previewId}#top`} /></div></div></div>}
  </>;
}
