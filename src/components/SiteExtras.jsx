import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Megaphone, Warning, X } from "@phosphor-icons/react";
import { useSiteData } from "../site-data";
import { ExternalLink } from "./Dialog";

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

export function Announcement() {
  const { announcement } = useSiteData();
  const id = announcement ? announcement.text + announcement.link : "";
  const [closed, setClosed] = useState(() => {
    try { return sessionStorage.getItem("zhat-announcement-closed") || ""; } catch { return ""; }
  });
  if (!announcement || closed === id) return null;
  const close = () => {
    setClosed(id);
    try { sessionStorage.setItem("zhat-announcement-closed", id); } catch {}
  };
  const Icon = announcement.tone === "warning" ? Warning : Megaphone;
  return (
    <div className={`announcement ${announcement.tone}`} role="region" aria-label="Объявление">
      <Icon size={22} weight="fill" aria-hidden="true" />
      <p>
        {announcement.text}
        {announcement.link && (
          <> <ExternalLink href={announcement.link}>{announcement.linkLabel || "Подробнее"} <ArrowUpRight size={15} /></ExternalLink></>
        )}
      </p>
      <button onClick={close} aria-label="Скрыть объявление"><X size={18} /></button>
    </div>
  );
}

function LinkTiles({ block, className }) {
  if (!block?.visible || !block.items?.length) return null;
  return (
    <section className={`link-tiles ${className} wrap`} aria-label={block.title}>
      <h2>{block.title}<span className="orange">.</span></h2>
      <div className="link-tiles-grid">
        {block.items.map((item) => {
          const body = <><img src={item.image} alt="" loading="lazy" /><span>{item.title}</span></>;
          return item.url
            ? <ExternalLink key={item.title + item.url} href={item.url} className="link-tile">{body}</ExternalLink>
            : <div key={item.title} className="link-tile">{body}</div>;
        })}
      </div>
    </section>
  );
}

export function Partners() {
  const { extras } = useSiteData();
  return <>
    <LinkTiles block={extras.resources} className="resources" />
    <LinkTiles block={extras.partners} className="partners" />
  </>;
}

// The official "Решаем вместе" banner: the Gosuslugi script binds itself to `.pos-banner-btn_2`.
export function GosuslugiWidget() {
  const { extras } = useSiteData();
  const id = extras.integrations?.gosuslugiId;
  const ref = useRef(null);
  useEffect(() => {
    if (!id || !ref.current) return;
    const start = () => { try { window.Widget?.("https://pos.gosuslugi.ru/form", Number(id)); } catch {} };
    if (window.Widget) { start(); return; }
    let script = document.querySelector("script[data-gosuslugi]");
    if (!script) {
      script = document.createElement("script");
      script.src = "https://pos.gosuslugi.ru/bin/script.min.js";
      script.async = true;
      script.dataset.gosuslugi = "true";
      document.head.append(script);
    }
    script.addEventListener("load", start);
    return () => script.removeEventListener("load", start);
  }, [id]);
  if (!id) return null;
  return (
    <section className="gosuslugi wrap" aria-label="Решаем вместе">
      <div id="js-show-iframe-wrapper" ref={ref}>
        <div className="gosuslugi-brand">
          <img src="https://pos.gosuslugi.ru/bin/banner-fluid/gosuslugi-logo.svg" alt="Госуслуги" loading="lazy" />
          <strong>Решаем вместе</strong>
        </div>
        <p>Есть предложения по организации учебного процесса или знаете, как сделать техникум лучше?</p>
        <button className="pos-banner-btn_2" type="button">Сообщить о проблеме</button>
      </div>
    </section>
  );
}

export function YandexMap({ title = "Схема проезда" }) {
  const { extras } = useSiteData();
  if (!extras.map?.embed) return null;
  return (
    <div className="site-map">
      <iframe src={extras.map.embed} title={title} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
    </div>
  );
}

export function SocialLinks() {
  const { extras } = useSiteData();
  const links = [["vk", "Сообщество ВКонтакте"], ["max", "Канал в MAX"], ["telegram", "Канал в Telegram"]]
    .filter(([key]) => extras.social?.[key]);
  return links.map(([key, label]) => (
    <ExternalLink key={key} href={extras.social[key]}>
      {label} <ArrowUpRight size={16} />
    </ExternalLink>
  ));
}

const consentKey = "zhat-cookie-consent";
function loadMetrika(id) {
  if (window.ym || !id) return;
  window.ym = function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  document.head.append(script);
  window.ym(Number(id), "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, trackHash: true });
}

// Analytics cookies are set only after the visitor agrees (152-ФЗ); the notice also links the data policy.
export function CookieConsent() {
  const { extras } = useSiteData();
  const id = extras.integrations?.metrikaId;
  const [choice, setChoice] = useState(() => readJson(consentKey, ""));
  useEffect(() => { if (choice === "accepted") loadMetrika(id); }, [choice, id]);
  if (choice) return null;
  const decide = (value) => { writeJson(consentKey, value); setChoice(value); };
  return (
    <div className="cookie-consent" role="region" aria-label="Использование cookie">
      <p>
        Сайт использует файлы cookie{id ? " и Яндекс Метрику, чтобы понимать, какие разделы нужны посетителям" : ""}.
        Подробнее — в{" "}
        <ExternalLink href="https://zhat.ru/files/sveden/docs/personal_data/polObrabPeronDannih_2.pdf">политике обработки данных</ExternalLink>.
      </p>
      <div>
        <button className="button primary" onClick={() => decide("accepted")}>Согласен</button>
        <button className="button ink" onClick={() => decide("declined")}>Только необходимые</button>
      </div>
    </div>
  );
}

// "Версия для слабовидящих" as on the old site: text size, colour scheme and images.
const a11yKey = "zhat-a11y";
const off = { on: false, scale: 1, scheme: "bw", images: true };
export function useAccessibility() {
  const [state, setState] = useState(() => {
    const saved = readJson(a11yKey, null);
    if (saved && typeof saved === "object") return { ...off, ...saved };
    try { if (localStorage.getItem("zhat-contrast") === "true") return { ...off, on: true }; } catch {}
    return off;
  });
  useEffect(() => writeJson(a11yKey, state), [state]);
  const className = state.on
    ? ["a11y", `a11y-${state.scheme}`, state.scheme === "bw" ? "high-contrast" : "", state.images ? "" : "a11y-no-images",
      state.scale > 1 ? `a11y-scale-${Math.round(state.scale * 10)}` : ""].filter(Boolean).join(" ")
    : "";
  return { state, setState, className };
}

export function AccessibilityPanel({ state, setState }) {
  if (!state.on) return null;
  const set = (patch) => setState((current) => ({ ...current, ...patch }));
  const option = (key, value, label, extra = {}) => (
    <button type="button" aria-pressed={state[key] === value} onClick={() => set({ [key]: value })} {...extra}>{label}</button>
  );
  return (
    <div className="a11y-panel" role="region" aria-label="Настройки версии для слабовидящих">
      <div><span>Размер текста</span>
        {option("scale", 1, "А", { "aria-label": "Обычный размер текста", className: "a11y-size-1" })}
        {option("scale", 1.2, "А", { "aria-label": "Крупный текст", className: "a11y-size-2" })}
        {option("scale", 1.4, "А", { "aria-label": "Очень крупный текст", className: "a11y-size-3" })}
      </div>
      <div><span>Цвет сайта</span>
        {option("scheme", "bw", "Ц", { "aria-label": "Чёрным по белому", className: "a11y-swatch bw" })}
        {option("scheme", "wb", "Ц", { "aria-label": "Белым по чёрному", className: "a11y-swatch wb" })}
        {option("scheme", "blue", "Ц", { "aria-label": "Тёмно-синим по голубому", className: "a11y-swatch blue" })}
        {option("scheme", "brown", "Ц", { "aria-label": "Коричневым по бежевому", className: "a11y-swatch brown" })}
      </div>
      <div><span>Изображения</span>
        {option("images", true, "Показать")}
        {option("images", false, "Скрыть")}
      </div>
      <button type="button" className="a11y-reset" onClick={() => setState(off)}>Обычная версия сайта</button>
    </div>
  );
}
