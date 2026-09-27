import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  MagnifyingGlass,
  ArrowRight,
  FileText,
  CalendarBlank,
} from "@phosphor-icons/react";
import {
  content,
  pageHref,
  localHref,
  sourceKey,
  syncedDate,
} from "../portal-data";
import "./portal.css";
import sourceHealth from "../source-health.json";
import { sectionGuides } from "../section-guides";
import { useSiteData } from "../site-data";
import { phoneHref } from "../phone";
export function usePortalRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => {
      setHash(location.hash);
      if (location.hash.startsWith("#/"))
        window.scrollTo({ top: 0, behavior: "instant" });
      else
        requestAnimationFrame(() =>
          document
            .getElementById(location.hash.slice(1) || "top")
            ?.scrollIntoView(),
        );
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return hash;
}
let archiveCache;
function useArchive() {
  const [items, setItems] = useState(archiveCache || []),
    [error, setError] = useState("");
  useEffect(() => {
    if (archiveCache) return;
    let active = true;
    fetch("/content/archive.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        archiveCache = data;
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setError("Не удалось загрузить архив. Обновите страницу.");
      });
    return () => {
      active = false;
    };
  }, []);
  return { items, error };
}
const shortTitles = {
  "Сведения об образовательной организации": "О техникуме",
  Абитуриенту: "Поступающим",
  Студенту: "Студентам",
  Выпускнику: "Выпускникам",
  Педагогу: "Педагогам",
};
export function ServiceBar() {
  return (
    <nav className="service-bar wrap" aria-label="Разделы сайта">
      <a href="#/sections">
        Все разделы <ArrowUpRight />
      </a>
      <a href="#/news">Новости</a>
      <a href={pageHref("/schedule")}>Расписание</a>
      <a href="#/feedback">Обратная связь</a>
      <a href="#/search">
        <MagnifyingGlass /> Поиск
      </a>
    </nav>
  );
}
export function SectionDirectory({ compact = false }) {
  const { groups, homepage } = useSiteData();
  const [query, setQuery] = useState("");
  const matches = (link) =>
    link.title
      .toLocaleLowerCase("ru")
      .includes(query.trim().toLocaleLowerCase("ru"));
  return (
    <section className={compact ? "directory-home wrap" : "directory"}>
      <div className="portal-section-heading">
        <div>
          <p className="eyebrow">НУЖНОЕ — РЯДОМ</p>
          <h2>{compact ? homepage.directory.title : "Все разделы"}</h2>
        </div>
        {compact && (
          <a href="#/search" className="text-link">
            Найти материал <MagnifyingGlass />
          </a>
        )}
      </div>
      {!compact && (
        <label className="portal-search">
          <MagnifyingGlass />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти раздел: практика, документы, приём…"
            aria-label="Найти раздел"
          />
        </label>
      )}
      {!compact && (
        <p className="sync-note">
          Шесть разделов ·{" "}
          {groups.reduce((sum, g) => sum + g.links.length, 0)} тем.
          Выберите нужную или найдите по названию.
        </p>
      )}
      {query && !groups.some((g) => g.links.some(matches)) && (
        <p role="status" className="empty-state">
          Такого раздела нет. Попробуйте другое слово или{" "}
          <a href="#/search">поиск по всем материалам</a>.
        </p>
      )}
      <div className="directory-grid">
        {groups.map(
          (group, i) =>
            (!query || group.links.some(matches)) && (
              <details
                key={group.title + Boolean(query)}
                open={query ? true : undefined}
              >
                <summary>
                  <span className="directory-number">0{i + 1}</span>
                  <span>{shortTitles[group.title] || group.title}</span>
                  <span className="directory-plus">+</span>
                </summary>
                <div>
                  {group.links.filter(matches).map((l, j) => (
                    <a href={pageHref(l.key)} key={j}>
                      {l.title}
                      <ArrowUpRight size={16} />
                    </a>
                  ))}
                </div>
              </details>
            ),
        )}
      </div>
    </section>
  );
}
export function CurrentNews({ all = false }) {
  const { news, homepage } = useSiteData();
  const [query, setQuery] = useState("");
  const items = news.filter((n) =>
    n.title.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")),
  );
  return (
    <section className={all ? "" : "news section wrap"} id="news">
      <div className="news-heading">
        <h2 className="home-multiline">{homepage.news.title.replace(/\.$/, "")}<span className="orange">.</span></h2>
        {!all && (
          <a className="text-link" href="#/news">
            Все новости <ArrowUpRight />
          </a>
        )}
      </div>
      {all && (
        <label className="portal-search">
          <MagnifyingGlass />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти новость"
            aria-label="Найти новость"
          />
        </label>
      )}
      <div className="news-grid">
        {(all ? items : items.slice(0, 3)).map((n) => (
          <a className="news-card" href={pageHref(n.key)} key={n.key}>
            <div className="news-photo">
              {n.image && <img src={n.image} alt="" loading="lazy" />}
              <span className="news-arrow">
                <ArrowUpRight size={24} />
              </span>
            </div>
            <div className="news-meta">
              <span>Жизнь техникума</span>
            </div>
            <h3>{n.title}</h3>
          </a>
        ))}
      </div>
      {!items.length && (
        <p className="empty-state">
          Новостей с таким названием нет. Попробуйте другое слово.
        </p>
      )}
      {all && (
        <a className="button ink archive-link" href="#/archive">
          Архив новостей <ArrowRight />
        </a>
      )}
      <p className="sync-note">Материалы обновлены {syncedDate}.</p>
    </section>
  );
}
function Search() {
  const { pages, overrides, hidden } = useSiteData();
  const [searchPages, setSearchPages] = useState(content.pages);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/content/search.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setSearchPages)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(30);
  const words = query
    .trim()
    .toLocaleLowerCase("ru")
    .split(/\s+/)
    .filter(Boolean);
  const { items: archive, error: archiveError } = useArchive();
  const candidates = [
    ...searchPages.map((p) => overrides.get(p.key) || p).filter((p) => !hidden.has(p.key)),
    ...pages.filter((p) => !searchPages.some((found) => found.key === p.key)),
    ...archive.filter((a) => !hidden.has(a.key) && !searchPages.some((p) => p.key === a.key) && !pages.some((p) => p.key === a.key)),
  ];
  const matches = words.length
    ? candidates.filter((p) =>
        words.every((w) =>
          (p.title + " " + (p.text || "")).toLocaleLowerCase("ru").includes(w),
        ),
      )
    : [];
  return (
    <>
      <p className="eyebrow">БЫСТРЫЙ ДОСТУП</p>
      <h1>Что найдём?</h1>
      <label className="portal-search">
        <MagnifyingGlass />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(30);
          }}
          placeholder="Расписание, документы, стипендия…"
          aria-label="Поиск по сайту"
          type="search"
        />
      </label>
      <p role="status" className="search-status">
        {words.length
          ? `Найдено материалов: ${matches.length}`
          : "Введите название или слово из материала."}
      </p>
      <div className="search-results">
        {matches.slice(0, limit).map((p) => (
          <a href={pageHref(p.key)} key={p.key}>
            <FileText />
            <div>
              <h3>{p.title}</h3>
              <p>
                {p.text
                  ? p.text.slice(0, 170) + "…"
                  : "Новость из архива техникума"}
              </p>
            </div>
            <ArrowUpRight />
          </a>
        ))}
      </div>
      {matches.length > limit && (
        <button
          className="button ink archive-link"
          onClick={() => setLimit(limit + 30)}
        >
          Показать ещё
        </button>
      )}
      {archiveError && <p role="status">{archiveError}</p>}
      {words.length && !matches.length && (
        <div className="empty-state">
          Ничего не найдено. Попробуйте более короткий запрос или{" "}
          <a href="#/sections">откройте все разделы</a>.
        </div>
      )}
    </>
  );
}
function Feedback() {
  const { siteSettings } = useSiteData();
  const review = content.pages.find(
    (p) => p.title === "Оставить отзыв об организации",
  );
  return (
    <>
      <p className="eyebrow">МЫ НА СВЯЗИ</p>
      <h1>
        Есть вопрос?
        <br />
        <span className="orange">Давайте решим.</span>
      </h1>
      <p className="portal-lead">Выберите удобный способ связи с техникумом.</p>
      <div className="feedback-grid">
        {content.forms.map((f) => (
          <a href={f.url} target="_blank" rel="noopener noreferrer" key={f.url}>
            <ArrowUpRight />
            <h3>{f.title}</h3>
            <p>
              Официальная форма техникума в Яндекс Формах. Откроется в новой
              вкладке.
            </p>
          </a>
        ))}
        {review && (
          <a href={pageHref(review.key)}>
            <ArrowRight />
            <h3>Оставить отзыв</h3>
            <p>Оценка работы образовательной организации.</p>
          </a>
        )}
        <a href={`mailto:${siteSettings.generalEmail}`}>
          <ArrowUpRight />
          <h3>Написать письмо</h3>
          <p>{siteSettings.generalEmail}</p>
        </a>
      </div>
      <div className="portal-contact">
        <h3>Позвонить в техникум</h3>
        <a href={phoneHref(siteSettings.generalPhone)}>{siteSettings.generalPhone}</a>
        <p>
          Приёмная комиссия: <a href={phoneHref(siteSettings.admissionPhone)}>{siteSettings.admissionPhone}</a>
        </p>
        <a href={pageHref("/worktime")}>Время работы →</a>
      </div>
    </>
  );
}
function Archive() {
  const { news, hidden, overrides } = useSiteData();
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const { items: archive, error } = useArchive();
  const merged = [
    ...news.filter((n) => !archive.some((item) => item.key === n.key)),
    ...archive.map((item) => overrides.get(item.key) || item),
  ].filter((item) => !hidden.has(item.key)).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  const items = merged.filter((n) =>
    n.title.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")),
  );
  const pages = Math.max(1, Math.ceil(items.length / 30));
  return (
    <>
      <p className="eyebrow">СОБЫТИЯ И ИСТОРИЯ</p>
      <h1>Архив новостей</h1>
      <label className="portal-search">
        <MagnifyingGlass />
        <input
          aria-label="Поиск в архиве"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Событие, слово или год…"
          type="search"
        />
      </label>
      <p role="status" className="search-status">
        {error ||
          (!archive.length ? "Загружаем архив…" : `Найдено: ${items.length}`)}
      </p>
      <div className="archive-list">
        {items.slice((page - 1) * 30, page * 30).map((n) => (
          <a href={pageHref(n.key)} key={n.key}>
            <span>{n.title}</span>
            <ArrowUpRight size={20} />
          </a>
        ))}
      </div>
      {!items.length && (
        <p className="empty-state">
          Ничего не найдено. Попробуйте другое слово.
        </p>
      )}
      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => {
            setPage(page - 1);
            window.scrollTo({ top: 0, behavior: "instant" });
          }}
        >
          ← Назад
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          disabled={page === pages}
          onClick={() => {
            setPage(page + 1);
            window.scrollTo({ top: 0, behavior: "instant" });
          }}
        >
          Далее →
        </button>
      </div>
    </>
  );
}
function Article({ pageKey }) {
  const { pages, groups, overrides, hidden } = useSiteData();
  const stored = pages.find((p) => p.key === pageKey);
  const { items: archive, error: catalogError } = useArchive();
  const archived = archive.find((p) => p.key === pageKey);
  const group = groups.find((g) => g.links[0]?.key === pageKey);
  const [loaded, setLoaded] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const entry = hidden.has(pageKey) ? null : stored || archived;
  useEffect(() => {
    if (!entry || (group && stored?.error && !overrides.has(pageKey))) return;
    const controller = new AbortController();
    setError("");
    setLoaded(null);
    fetch(
      overrides.has(pageKey)
        ? "/api/site/page?key=" + encodeURIComponent(pageKey)
        : stored && !stored.error && stored.contentFile
          ? stored.contentFile
          : "/api/content?key=" + encodeURIComponent(pageKey),
      { signal: controller.signal },
    )
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok || p.error)
          throw new Error(p.error || "Материал не загрузился");
        setLoaded(p);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Не удалось загрузить материал с официального сайта.");
      });
    return () => controller.abort();
  }, [pageKey, retry, entry, stored, overrides]);
  const page = loaded;
  const articleHTML = useMemo(() => {
    if (!page?.html) return "";
    const doc = new DOMParser().parseFromString(page.html, "text/html");
    for (const link of doc.querySelectorAll("a[href]")) {
      if (!sourceHealth.unavailable[link.getAttribute("href")]) continue;
      const note = doc.createElement("small");
      note.className = "unavailable-file";
      note.textContent =
        " — недоступно при проверке " +
        new Date(sourceHealth.checkedAt).toLocaleDateString("ru");
      link.append(note);
    }
    for (const img of doc.querySelectorAll("img[src]")) {
      if (!sourceHealth.unavailable[img.getAttribute("src")]) continue;
      const note = doc.createElement("span");
      note.className = "unavailable-file";
      note.textContent = "Изображение недоступно на сайте ЖАТ";
      img.replaceWith(note);
    }
    return doc.body.innerHTML;
  }, [page]);
  const section = groups.find((g) =>
    g.links.some((l) => l.key === pageKey),
  );
  const guide = sectionGuides[pageKey];
  const [documentQuery, setDocumentQuery] = useState("");
  const documents = (page?.resources || []).filter((r) =>
    r.title
      .toLocaleLowerCase("ru")
      .includes(documentQuery.toLocaleLowerCase("ru")),
  );
  useEffect(() => {
    if (entry) document.title = entry.title + " — ЖАТ";
  }, [entry]);
  const clickContent = (e) => {
    const a = e.target.closest("a");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute("href");
    if (!href) return;
    const url = new URL(href, "https://zhat.ru");
    if (url.hash && !href.startsWith("#/") && sourceKey(href) === pageKey) {
      const target = document.getElementById(
        "source-" + decodeURIComponent(url.hash.slice(1)),
      );
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    const local = localHref(href);
    if (local.startsWith("#")) {
      e.preventDefault();
      location.hash = local;
    }
  };
  if (pageKey === "/sitemap") return <SectionDirectory />;
  if (!entry && !archive.length && !hidden.has(pageKey))
    return (
      <p role="status" className="empty-state">
        {catalogError || "Загружаем каталог…"}
      </p>
    );
  if (!entry)
    return (
      <div className="empty-state">
        <h1>Страница не найдена</h1>
        <a href="#/sections">Перейти ко всем разделам</a>
      </div>
    );
  return (
    <>
      <p className="eyebrow">АВИАЦИОННЫЙ ТЕХНИКУМ ИМЕНИ В. А. КАЗАКОВА</p>
      <h1>{entry.title}</h1>
      <div className="page-meta">
        <span>
          <CalendarBlank />
          {stored?.live && stored.updatedAt
            ? "Обновлено " + new Date(stored.updatedAt).toLocaleDateString("ru")
            : stored ? "Обновлено " + syncedDate : "Материал с официального сайта"}
        </span>
        {entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer">
          На официальном сайте <ArrowUpRight />
        </a>}
      </div>
      {section && (
        <details className="section-jump">
          <summary>
            В этом разделе: {shortTitles[section.title] || section.title}
          </summary>
          <nav aria-label="Темы раздела">
            {section.links.map((l) => (
              <a
                key={l.key}
                href={pageHref(l.key)}
                aria-current={l.key === pageKey ? "page" : undefined}
              >
                {l.title}
                <ArrowRight size={16} />
              </a>
            ))}
          </nav>
        </details>
      )}
      {guide?.message && !overrides.has(pageKey) && (
        <aside className="source-notice">
          <h2>Что доступно сейчас</h2>
          <p>{guide.message}</p>
          <a href="#/feedback">Уточнить у техникума →</a>
        </aside>
      )}
      {page?.pending && !guide?.message && (
        <aside className="source-notice">
          <p>Техникум пока не опубликовал материалы на этой странице.</p>
          <a href="#/feedback">Уточнить информацию →</a>
        </aside>
      )}
      {!!page?.resources?.length && (
        <details className="document-panel">
          <summary>
            <FileText /> Документы и файлы · {page.resources.length}
          </summary>
          {page.resources.length > 5 && (
            <label className="portal-search">
              <MagnifyingGlass />
              <input
                value={documentQuery}
                onChange={(e) => setDocumentQuery(e.target.value)}
                placeholder="Найти документ на странице"
                aria-label="Найти документ на странице"
                type="search"
              />
            </label>
          )}
          <div className="document-list">
            {documents.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText size={20} />
                <span>
                  {r.title}
                  {sourceHealth.unavailable[r.url] && (
                    <small className="unavailable-file">
                      Файл недоступен при проверке{" "}
                      {new Date(sourceHealth.checkedAt).toLocaleDateString(
                        "ru",
                      )}
                      . Уточните в техникуме.
                    </small>
                  )}
                </span>
                <ArrowUpRight size={18} />
              </a>
            ))}
          </div>
          {!documents.length && (
            <p role="status">Документов с таким названием нет.</p>
          )}
        </details>
      )}
      {group && stored?.error && !overrides.has(pageKey) ? (
        <div className="archive-list">
          {group.links.slice(1).map((l) => (
            <a key={l.key} href={pageHref(l.key)}>
              {l.title}
              <ArrowUpRight />
            </a>
          ))}
        </div>
      ) : page && !page.error ? (
        <article
          className="imported-content"
          onClick={clickContent}
          dangerouslySetInnerHTML={{ __html: articleHTML }}
        />
      ) : error ? (
        <div className="empty-state">
          <h3>Материал временно недоступен</h3>
          <p>{error}</p>
          <button className="button ink" onClick={() => setRetry(retry + 1)}>
            Повторить
          </button>
          <a
            className="text-link"
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть источник <ArrowUpRight />
          </a>
        </div>
      ) : (
        <p className="empty-state" role="status">
          Загружаем материал…
        </p>
      )}
      {guide?.links?.length > 0 && (
        <section className="related-materials">
          <h2>Полезные материалы</h2>
          <div className="archive-list">
            {guide.links.map((key) => {
              const related = content.pages.find((p) => p.key === key);
              return (
                related && (
                  <a key={key} href={pageHref(key)}>
                    {related.title}
                    <ArrowUpRight />
                  </a>
                )
              );
            })}
          </div>
        </section>
      )}
      <div className="page-bottom">
        <a href="#/sections">← Все разделы</a>
        <a href="#/feedback">Нужна помощь? →</a>
      </div>
    </>
  );
}
export function Portal({ route }) {
  useEffect(() => {
    if (!route.startsWith("#/page/"))
      document.title =
        ({
          "#/sections": "Все разделы",
          "#/news": "Новости",
          "#/archive": "Архив новостей",
          "#/search": "Поиск",
          "#/feedback": "Обратная связь",
        }[route] || "ЖАТ") + " — ЖАТ";
  }, [route]);
  let key = "";
  try {
    key = decodeURIComponent(route.slice("#/page/".length));
  } catch {}
  return (
    <main id="main" tabIndex={-1} className="portal wrap">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <a href="#top">
          <ArrowLeft size={16} />
          Главная
        </a>
        <span>/</span>
        <a href="#/sections">Разделы</a>
      </nav>
      {route === "#/sections" ? (
        <SectionDirectory />
      ) : route === "#/search" ? (
        <Search />
      ) : route === "#/news" ? (
        <CurrentNews all />
      ) : route === "#/feedback" ? (
        <Feedback />
      ) : route === "#/archive" || key === "/article/867" ? (
        <Archive />
      ) : (
        <Article key={key} pageKey={key} />
      )}
    </main>
  );
}
