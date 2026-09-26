import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, FloppyDisk, Image, MagnifyingGlass, UploadSimple } from "@phosphor-icons/react";
import { categories, programs as basePrograms } from "../data";

const notifySite = (refresh) => {
  window.dispatchEvent(new Event("zhat:site-updated"));
  return refresh();
};

export function ProgramsManager({ api, refresh }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api("/api/admin/programs").then((result) => {
      setData(result); setSelected(result.items[0]?.id);
    }).catch((cause) => setError(cause.message));
  }, [api]);
  const update = (id, patch) => {
    setData((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    setDirty(true); setMessage("");
  };
  const move = (id, direction) => {
    setData((current) => {
      const items = [...current.items];
      const from = items.findIndex((item) => item.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= items.length) return current;
      [items[from], items[to]] = [items[to], items[from]];
      return { ...current, items };
    });
    setDirty(true); setMessage("");
  };
  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api("/api/admin/programs", { method: "PUT", body: { items: data.items, expectedVersion: data.version } });
      setData(result); setDirty(false); setMessage("Направления обновлены на сайте."); await notifySite(refresh);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const item = await api("/api/admin/media", { method: "POST", body: file });
      update(selected, { image: item.url }); setShowGallery(false);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const openGallery = async () => {
    setError("");
    try {
      const result = await api("/api/admin/media");
      setGallery(result.items.filter((item) => item.mime.startsWith("image/")));
      setShowGallery(true);
    } catch (cause) { setError(cause.message); }
  };
  const item = data?.items.find((program) => program.id === selected);
  const shown = data?.items.filter((program) => (program.title + program.code).toLocaleLowerCase("ru").includes(filter.toLocaleLowerCase("ru"))) || [];
  return <>
    <header className="admin-heading"><div><span className="admin-eyebrow">КАТАЛОГ</span><h1>Направления</h1><p>Обновляйте карточки специальностей, фотографии и порядок на главной странице.</p></div><button className="admin-primary" onClick={save} disabled={!dirty || busy}><FloppyDisk size={20} />{busy ? "Сохраняем…" : "Сохранить изменения"}</button></header>
    {error && <p role="alert" className="admin-error">{error}</p>}{message && <p role="status" className="admin-success"><Check />{message}</p>}
    {data ? <div className="admin-program-layout">
      <aside className="admin-panel admin-program-list">
        <div className="admin-program-list-title"><strong>Все специальности</strong><span>{data.items.filter((p) => p.visible).length} на сайте</span></div>
        <label className="admin-search"><MagnifyingGlass size={19} /><input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Название или код" aria-label="Найти направление" /></label>
        <div className="admin-program-items">{shown.map((program) => <button key={program.id} className={selected === program.id ? "admin-program-item active" : "admin-program-item"} aria-pressed={selected === program.id} onClick={() => setSelected(program.id)}><img src={program.image} alt="" /><span><strong>{program.title}</strong><small>{program.code} · {program.visible ? "На сайте" : "Скрыто"}</small></span><span className="admin-program-number">{String(data.items.indexOf(program) + 1).padStart(2, "0")}</span></button>)}</div>
      </aside>
      {item && <div className="admin-panel admin-program-editor" key={item.id}>
        <div className="admin-program-editor-head"><div><span className="admin-eyebrow">{item.code}</span><h2>{item.title}</h2></div><label className="admin-switch"><input type="checkbox" checked={item.visible} onChange={(event) => update(item.id, { visible: event.target.checked })} /><span>{item.visible ? "Показывается" : "Скрыто"}</span></label></div>
        <div className="admin-program-photo"><img src={item.image} alt={`Фото направления «${item.title}»`} /><div><Image size={19} /><span>Фото карточки</span></div></div>
        <div className="admin-program-photo-actions"><label className="admin-secondary"><UploadSimple size={18} />Загрузить своё фото<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => upload(event.target.files?.[0])} disabled={busy} /></label><button className="admin-secondary" onClick={openGallery}>Выбрать из файлов</button>{item.image !== basePrograms.find((base) => base.id === item.id)?.image && <button className="admin-quiet" onClick={() => update(item.id, { image: basePrograms.find((base) => base.id === item.id).image })}>Вернуть исходное фото</button>}</div>
        <div className="admin-edit-form admin-program-fields">
          <label>Название специальности<input value={item.title} onChange={(event) => update(item.id, { title: event.target.value })} maxLength={180} /></label>
          <label>Короткое описание<textarea rows={3} value={item.description} onChange={(event) => update(item.id, { description: event.target.value })} maxLength={500} /></label>
          <div className="admin-field-grid"><label>Категория<select value={item.category} onChange={(event) => update(item.id, { category: event.target.value })}>{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></label><label>Срок обучения<input value={item.duration} onChange={(event) => update(item.id, { duration: event.target.value })} maxLength={80} /></label></div>
          <label>Финансирование<input value={item.funding} onChange={(event) => update(item.id, { funding: event.target.value })} maxLength={120} /></label>
        </div>
        <div className="admin-program-order"><div><strong>Порядок на главной</strong><small>Карточки идут слева направо в указанной последовательности.</small></div><button className="admin-secondary" disabled={data.items[0].id === item.id} onClick={() => move(item.id, -1)} aria-label="Поднять направление"><ArrowUp /> Выше</button><button className="admin-secondary" disabled={data.items.at(-1).id === item.id} onClick={() => move(item.id, 1)} aria-label="Опустить направление"><ArrowDown /> Ниже</button></div>
        <p className="admin-hint">Код специальности и ссылка на официальные сведения сохранены. Если меняются условия приёма, проверьте их в приёмной комиссии.</p>
      </div>}
    </div> : <p role="status">Загружаем направления…</p>}
    {dirty && <div className="admin-save-bar"><span>Есть несохранённые изменения</span><button className="admin-primary" onClick={save} disabled={busy}><FloppyDisk size={19} /> Сохранить</button></div>}
    {showGallery && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGallery(false); }}><div className="admin-modal admin-program-gallery" role="dialog" aria-modal="true" aria-label="Выбрать фотографию"><header><div><h2>Фото из файлов</h2><p>Выберите ранее загруженное изображение.</p></div><button onClick={() => setShowGallery(false)} aria-label="Закрыть">×</button></header><div className="admin-media-grid">{gallery.length ? gallery.map((file) => <button className="admin-media-item" key={file.id} onClick={() => { update(selected, { image: `/api/site/media/${file.id}` }); setShowGallery(false); }}><img src={`/api/site/media/${file.id}`} alt="" /><strong>{file.name}</strong></button>) : <p>Фото ещё не загружены. Добавьте их через кнопку «Загрузить своё фото».</p>}</div></div></div>}
  </>;
}

const settingFields = [
  ["heroLead", "Текст под заголовком", "Первые слова, которые видит посетитель"],
  ["location", "Города", "Подпись на первом экране"],
  ["admissionPhone", "Телефон приёмной комиссии", "Показывается в блоке «Как поступить»"],
  ["admissionAddress", "Адрес приёмной комиссии", "Показывается рядом с телефоном"],
  ["generalEmail", "Электронная почта", "Показывается в подвале"],
  ["generalPhone", "Телефон техникума", "Показывается в подвале"],
  ["branchAddress", "Адрес филиала", "Показывается в подвале"],
  ["branchPhone", "Телефон филиала", "Показывается в подвале"],
];

export function SettingsManager({ api, refresh }) {
  const [data, setData] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { api("/api/admin/settings").then(setData).catch((cause) => setError(cause.message)); }, [api]);
  const update = (key, value) => { setData((current) => ({ ...current, values: { ...current.values, [key]: value } })); setDirty(true); setMessage(""); };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await api("/api/admin/settings", { method: "PUT", body: { values: data.values, expectedVersion: data.version } });
      setData(result); setDirty(false); setMessage("Главная страница и контакты обновлены."); await notifySite(refresh);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <>
    <header className="admin-heading"><div><span className="admin-eyebrow">ИНФОРМАЦИЯ</span><h1>Главная и контакты</h1><p>Держите телефоны, адреса и текст первого экрана актуальными. Изменения сразу появятся на сайте.</p></div><a className="admin-secondary" href="#top" target="_blank" rel="noopener noreferrer">Открыть сайт</a></header>
    {error && <p role="alert" className="admin-error">{error}</p>}{message && <p role="status" className="admin-success"><Check />{message}</p>}
    {data ? <form className="admin-panel admin-form admin-settings-form" onSubmit={save}>
      <h2>Что видят посетители</h2><p>Заполните данные так, как они должны быть напечатаны на сайте. Номера станут ссылками для звонка.</p>
      {settingFields.map(([key, label, hint]) => <label key={key}>{label}{key === "heroLead" ? <textarea rows={3} value={data.values[key]} onChange={(event) => update(key, event.target.value)} maxLength={300} required /> : <input type={key === "generalEmail" ? "email" : "text"} value={data.values[key]} onChange={(event) => update(key, event.target.value)} maxLength={180} required />}<small>{hint}</small></label>)}
      <button className="admin-primary" disabled={!dirty || busy}><FloppyDisk size={20} />{busy ? "Сохраняем…" : "Сохранить на сайте"}</button>
    </form> : <p role="status">Загружаем контакты…</p>}
  </>;
}
