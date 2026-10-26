import { useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpRight, Check, FloppyDisk, Megaphone, Plus, Trash, UploadSimple, Warning,
} from "@phosphor-icons/react";
import { defaultAnnouncement } from "../site-extras";
import { useLeaveGuard } from "./AdminUi";

const notifySite = (refresh) => {
  window.dispatchEvent(new Event("zhat:site-updated"));
  return refresh();
};
const today = () => new Date().toLocaleDateString("sv");

export function AnnouncementManager({ api, refresh }) {
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = () => api("/api/admin/announcement").then((result) => { setData(result); setSaved(result); })
    .catch((cause) => setError(cause.message));
  useEffect(() => { load(); }, [api]);
  const value = data?.value || defaultAnnouncement;
  const dirty = Boolean(data && JSON.stringify(data.value) !== JSON.stringify(saved?.value));
  useLeaveGuard(dirty);
  const change = (patch) => { setData((current) => ({ ...current, value: { ...current.value, ...patch } })); setMessage(""); setError(""); };
  const save = async (visible = value.visible) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api("/api/admin/announcement", { method: "PUT", body: { value: { ...value, visible }, expectedVersion: data.version } });
      setData(result); setSaved(result);
      setMessage(visible ? "Объявление опубликовано. Посетители видят его вверху каждой страницы." : "Объявление снято с сайта.");
      await notifySite(refresh);
    } catch (cause) { setError(cause.message); if (cause.status === 409) load(); }
    finally { setBusy(false); }
  };
  if (!data) return <p role="status" className="admin-panel">{error || "Загружаем объявление…"}</p>;
  const expired = value.until && value.until < today();
  return <>
    <header className="admin-heading"><div><span className="admin-eyebrow">ДЛЯ ВСЕХ СОТРУДНИКОВ</span><h1>Объявление на сайте</h1>
      <p>Короткое сообщение, которое видно вверху каждой страницы: изменение расписания, отмена занятий, важная дата.</p></div></header>
    <div className={`admin-big-status ${value.visible && !expired ? "on" : ""}`}>
      <Megaphone size={30} weight="fill" />
      <div><strong>{value.visible && !expired ? "Сейчас объявление показывается на сайте" : "Сейчас объявления на сайте нет"}</strong>
        <span>{value.visible && expired ? `Срок показа закончился ${new Date(value.until).toLocaleDateString("ru")}` : value.visible && value.until ? `Будет показываться до ${new Date(value.until).toLocaleDateString("ru")} включительно` : value.visible ? "Показывается, пока вы его не снимете" : "Напишите текст ниже и нажмите «Показать на сайте»"}</span></div>
      {value.visible && saved?.value.visible && <button className="admin-secondary" disabled={busy} onClick={() => save(false)}>Снять с сайта</button>}
    </div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {message && <p role="status" className="admin-success"><Check size={22} />{message}</p>}
    <div className="admin-panel admin-form admin-announcement-form">
      <label>Текст объявления<textarea rows={3} maxLength={300} value={value.text} disabled={busy}
        onChange={(event) => change({ text: event.target.value })} placeholder="Например: 4 ноября техникум не работает. Занятия 5 ноября — по обычному расписанию." />
        <small>{300 - value.text.length} символов осталось. Пишите коротко — одно-два предложения.</small></label>
      <fieldset className="admin-choice"><legend>Вид объявления</legend>
        <label><input type="radio" name="tone" checked={value.tone !== "warning"} onChange={() => change({ tone: "info" })} /><span className="admin-tone info">Обычное (голубое)</span></label>
        <label><input type="radio" name="tone" checked={value.tone === "warning"} onChange={() => change({ tone: "warning" })} /><span className="admin-tone warning"><Warning size={18} weight="fill" /> Важное (жёлтое)</span></label>
      </fieldset>
      <div className="admin-field-grid">
        <label>Ссылка «Подробнее» (необязательно)<input value={value.link} disabled={busy} onChange={(event) => change({ link: event.target.value })} placeholder="https://… или #/news" />
          <small>Например, на новость или страницу с расписанием. Можно оставить пустым.</small></label>
        <label>Показывать до (необязательно)<input type="date" min={today()} value={value.until} disabled={busy} onChange={(event) => change({ until: event.target.value })} />
          <small>После этой даты объявление исчезнет само.</small></label>
      </div>
      {value.text && <div className="admin-announcement-preview"><span>Так это увидят посетители:</span>
        <div className={`announcement ${value.tone}`}><Megaphone size={22} weight="fill" /><p>{value.text}{value.link && <> <u>{value.linkLabel || "Подробнее"} ↗</u></>}</p></div></div>}
      <div className="admin-form-actions">
        <button className="admin-primary" disabled={busy || !value.text.trim()} onClick={() => save(true)}><Megaphone size={20} />{busy ? "Сохраняем…" : value.visible && saved?.value.visible ? "Сохранить изменения" : "Показать на сайте"}</button>
        {dirty && <button className="admin-secondary" disabled={busy} onClick={() => setData(saved)}>Отменить правки</button>}
      </div>
    </div>
  </>;
}

function LinkListEditor({ block, onChange, onPickImage, busy, label }) {
  const update = (index, patch) => onChange({ ...block, items: block.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const move = (index, direction) => {
    const items = [...block.items], target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    onChange({ ...block, items });
  };
  return <section className="admin-panel admin-links-block">
    <div className="admin-links-head">
      <h2>{label}</h2>
      <label className="admin-switch"><input type="checkbox" checked={block.visible} disabled={busy} onChange={(event) => onChange({ ...block, visible: event.target.checked })} /><span>{block.visible ? "Показывается на главной" : "Скрыт"}</span></label>
    </div>
    <label className="admin-inline-field">Заголовок блока<input value={block.title} maxLength={100} disabled={busy} onChange={(event) => onChange({ ...block, title: event.target.value })} /></label>
    <div className="admin-links-list">{block.items.map((item, index) => <div className="admin-link-row" key={index}>
      <button type="button" className="admin-link-logo" disabled={busy} onClick={() => onPickImage((image) => update(index, { image }))} title="Заменить картинку">
        {item.image ? <img src={item.image} alt="" /> : <UploadSimple size={26} />}<span>Заменить</span>
      </button>
      <div className="admin-link-fields">
        <label>Название<input value={item.title} maxLength={160} disabled={busy} onChange={(event) => update(index, { title: event.target.value })} /></label>
        <label>Ссылка на сайт<input value={item.url} maxLength={1000} disabled={busy} placeholder="https://…" onChange={(event) => update(index, { url: event.target.value })} /></label>
      </div>
      <div className="admin-link-actions">
        <button type="button" className="admin-secondary" aria-label={`Выше: ${item.title}`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /> Выше</button>
        <button type="button" className="admin-secondary" aria-label={`Ниже: ${item.title}`} disabled={busy || index === block.items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /> Ниже</button>
        <button type="button" className="admin-quiet" disabled={busy} onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}><Trash size={18} /> Убрать</button>
      </div>
    </div>)}</div>
    <button type="button" className="admin-secondary" disabled={busy} onClick={() => onPickImage((image) => onChange({ ...block, items: [...block.items, { title: "", url: "", image }] }))}><Plus size={20} /> Добавить — сначала выберите картинку</button>
  </section>;
}

export function LinksManager({ api, refresh, pickImage }) {
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = () => api("/api/admin/extras").then((result) => { setData(result); setSaved(result); setError(""); })
    .catch((cause) => setError(cause.message));
  useEffect(() => { load(); }, [api]);
  const dirty = Boolean(data && JSON.stringify(data.value) !== JSON.stringify(saved?.value));
  useLeaveGuard(dirty);
  const change = (key, value) => { setData((current) => ({ ...current, value: { ...current.value, [key]: value } })); setMessage(""); setError(""); };
  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api("/api/admin/extras", { method: "PUT", body: { value: data.value, expectedVersion: data.version } });
      setData(result); setSaved(result); setMessage("Сохранено. Изменения уже на сайте.");
      await notifySite(refresh);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  if (!data) return <p role="status" className="admin-panel">{error || "Загружаем…"}</p>;
  const value = data.value;
  const field = (group, key, label, hint, placeholder = "https://…") => <label key={key}>{label}
    <input value={value[group][key] || ""} disabled={busy} placeholder={placeholder} onChange={(event) => change(group, { ...value[group], [key]: event.target.value })} />
    {hint && <small>{hint}</small>}</label>;
  return <>
    <header className="admin-heading"><div><span className="admin-eyebrow">ГЛАВНАЯ И ПОДВАЛ</span><h1>Партнёры и ссылки</h1>
      <p>Баннеры полезных ресурсов и логотипы партнёров внизу главной, соцсети, карта проезда и виджет «Решаем вместе».</p></div>
      <button className="admin-primary" onClick={save} disabled={!dirty || busy}><FloppyDisk size={20} />{busy ? "Сохраняем…" : "Сохранить на сайте"}</button></header>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {message && <p role="status" className="admin-success"><Check size={22} />{message}</p>}
    <div className="admin-links-layout">
      <LinkListEditor label="Полезные ресурсы" block={value.resources} busy={busy} onChange={(block) => change("resources", block)} onPickImage={pickImage} />
      <LinkListEditor label="Партнёры" block={value.partners} busy={busy} onChange={(block) => change("partners", block)} onPickImage={pickImage} />
      <section className="admin-panel admin-form">
        <h2>Соцсети</h2><p>Ссылки появятся в подвале сайта. Пустое поле — ссылка не показывается.</p>
        {field("social", "vk", "ВКонтакте")}{field("social", "max", "MAX")}{field("social", "telegram", "Telegram")}
      </section>
      <section className="admin-panel admin-form">
        <h2>Карта проезда</h2>
        {field("map", "link", "Ссылка «Как добраться» (основное здание)", "Откройте место в Яндекс Картах, нажмите «Поделиться» и скопируйте ссылку.")}
        {field("map", "branchLink", "Ссылка на схему проезда филиала")}
        {field("map", "embed", "Карта на странице", "Адрес из конструктора Яндекс Карт (начинается с https://yandex.ru/map-widget/). Если оставить пустым, карта не показывается.")}
      </section>
      <details className="admin-panel admin-form admin-technical">
        <summary><strong>Для специалиста: Госуслуги и Яндекс Метрика</strong><span>Меняйте, только если вам выдали новый номер</span></summary>
        {field("integrations", "gosuslugiId", "Номер виджета «Решаем вместе» (Госуслуги)", "Баннер обратной связи на главной и на странице «Обратная связь». Пусто — баннер скрыт.", "232010")}
        {field("integrations", "metrikaId", "Номер счётчика Яндекс Метрики", "Статистика посещений. Подключается только после согласия посетителя на cookie.", "52234915")}
      </details>
    </div>
    {dirty && <div className="admin-save-bar"><span>Есть несохранённые изменения</span><div>
      <button className="admin-secondary" onClick={() => setData(saved)} disabled={busy}>Отменить правки</button>
      <button className="admin-primary" onClick={save} disabled={busy}><FloppyDisk size={18} /> Сохранить</button></div></div>}
  </>;
}

export function PasswordPage({ api, user }) {
  const [fields, setFields] = useState({ current: "", next: "", repeat: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if (fields.next !== fields.repeat) { setError("Новый пароль и повтор не совпадают. Введите их ещё раз."); return; }
    setBusy(true);
    try {
      await api("/api/admin/password", { method: "POST", body: { current: fields.current, next: fields.next } });
      setFields({ current: "", next: "", repeat: "" });
      setMessage("Пароль изменён. Запишите его и храните в надёжном месте. На других компьютерах нужно будет войти заново.");
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const input = (key, label, autoComplete) => <label>{label}<input type={show ? "text" : "password"} required minLength={key === "current" ? undefined : 10}
    autoComplete={autoComplete} value={fields[key]} disabled={busy} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} /></label>;
  return <>
    <header className="admin-heading"><div><span className="admin-eyebrow">МОЯ УЧЁТНАЯ ЗАПИСЬ</span><h1>Сменить пароль</h1>
      <p>{user.name}, ваш логин — <strong>{user.username}</strong>. Если вы забыли пароль, попросите администратора сайта задать новый.</p></div></header>
    <form className="admin-panel admin-form admin-password-form" onSubmit={submit}>
      {input("current", "Текущий пароль", "current-password")}
      {input("next", "Новый пароль (не короче 10 символов)", "new-password")}
      {input("repeat", "Новый пароль ещё раз", "new-password")}
      <label className="admin-checkbox"><input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} /> Показать пароли</label>
      {error && <p role="alert" className="admin-error">{error}</p>}
      {message && <p role="status" className="admin-success"><Check size={22} />{message}</p>}
      <button className="admin-primary" disabled={busy}>{busy ? "Сохраняем…" : "Сменить пароль"}</button>
    </form>
  </>;
}

const help = [
  ["Как добавить новость", [
    "Слева нажмите «Новости», затем оранжевую кнопку «Добавить новость».",
    "Напишите название и текст. Текст можно скопировать из Word — оформление сохранится.",
    "Справа нажмите «Добавить фото», чтобы у новости была картинка на главной.",
    "Нажмите «Опубликовать». Новость сразу появится на сайте. Если не готовы — «Сохранить черновик»: посетители его не увидят.",
  ]],
  ["Как исправить текст на странице", [
    "Слева нажмите «Страницы» и напишите в поиске пару слов из названия.",
    "Откройте страницу, исправьте текст прямо в окне редактора.",
    "Нажмите «Опубликовать». Прежний вариант сохранится в «Предыдущих версиях».",
  ]],
  ["Как выложить документ (PDF, Word, Excel)", [
    "Откройте нужную страницу или новость.",
    "Поставьте курсор в то место текста, где должна быть ссылка на документ.",
    "Нажмите «Вставить фото или документ», затем «Загрузить с компьютера» и выберите файл.",
    "В тексте появится ссылка с названием файла. Нажмите «Опубликовать».",
  ]],
  ["Как вернуть, как было", [
    "Откройте материал и справа нажмите «Предыдущие версии».",
    "Выберите нужную дату и нажмите «Вернуть эту версию». Текущий вариант тоже сохранится в истории, поэтому ошибиться не страшно.",
  ]],
  ["Как показать срочное объявление", [
    "Слева нажмите «Объявление».",
    "Напишите текст, при желании укажите дату, до которой его показывать.",
    "Нажмите «Показать на сайте». Чтобы убрать — «Снять с сайта».",
  ]],
  ["Что значит «Материал изменён другим сотрудником»", [
    "Пока вы работали, этот же материал сохранил коллега. Чтобы не стереть его правки, сайт остановил сохранение.",
    "Скопируйте свой текст (выделите и нажмите Ctrl+C), обновите страницу (клавиша F5), вставьте текст снова и сохраните.",
  ]],
  ["Если шрифт кажется мелким", [
    "Внизу меню слева нажмите «Крупный шрифт». Настройка запоминается на этом компьютере.",
    "Можно также удерживать Ctrl и покрутить колёсико мыши — страница станет крупнее.",
  ]],
];

export function HelpPage({ canAdmin }) {
  return <>
    <header className="admin-heading"><div><span className="admin-eyebrow">ПОМОЩЬ</span><h1>Как пользоваться</h1>
      <p>Короткие инструкции по самым частым задачам. Ничего не сломается: у каждого материала сохраняются прежние версии.</p></div></header>
    <div className="admin-help">{help.map(([title, steps], index) => <details className="admin-panel" key={title} open={index === 0}>
      <summary>{title}</summary>
      <ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol>
    </details>)}</div>
    <div className="admin-panel admin-help-contact">
      <h2>Не получается?</h2>
      <p>{canAdmin ? "Вы администратор: можете задать сотруднику новый пароль в разделе «Сотрудники»." : "Обратитесь к администратору сайта — он может восстановить версию материала или задать новый пароль."}</p>
      <a className="admin-secondary" href="#top" target="_blank" rel="noopener noreferrer">Открыть сайт в новой вкладке <ArrowUpRight size={18} /></a>
    </div>
  </>;
}
