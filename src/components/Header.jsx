import { useState } from "react";
import {
  ArrowUpRight,
  Eye,
  Check,
  List,
  X,
  CaretDown,
} from "@phosphor-icons/react";
import { ExternalLink } from "./Dialog";
import { official } from "../data";
export function Brand() {
  return (
    <a href="#top" className="brand" aria-label="ЖАТ — на главную">
      <img src="/images/logo.png" alt="" />
      <strong>ЖАТ</strong>
      <span>
        имени
        <br />
        В. А. Казакова
      </span>
    </a>
  );
}
export function Header({ open, contrast, setContrast }) {
  const [menu, setMenu] = useState(false);
  const act = (type) => {
    setMenu(false);
    open(type);
  };
  return (
    <>
      <a className="skip-link" href="#main" onClick={(event) => { event.preventDefault(); const main = document.getElementById("main"); main?.focus(); main?.scrollIntoView(); }}>
        Перейти к содержимому
      </a>
      <div className="utility">
        <ExternalLink href={official + "/sveden"}>
          Сведения об образовательной организации <ArrowUpRight size={13} />
        </ExternalLink>
        <button
          onClick={() => setContrast(!contrast)}
          aria-pressed={contrast}
          aria-label={contrast ? "Обычная версия" : "Версия для слабовидящих"}
        >
          {contrast ? <Check size={17} /> : <Eye size={17} />}
          <span>{contrast ? "Обычная версия" : "Версия для слабовидящих"}</span>
        </button>
      </div>
      <header className="header">
        <Brand />
        <nav className="desktop-nav" aria-label="Основная навигация">
          <button onClick={() => act("about")}>
            О техникуме <CaretDown size={13} />
          </button>
          <a href="#programs">Специальности</a>
          <button onClick={() => act("students")}>
            Студентам <CaretDown size={13} />
          </button>
          <a href="#/sections">Все разделы</a>
          <a href="#/feedback">Связаться</a>
        </nav>
        <button
          className="button ink header-apply"
          onClick={() => act("admission")}
        >
          Как поступить <ArrowUpRight size={19} />
        </button>
        <button
          className="icon-button menu-toggle"
          aria-label={menu ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menu}
          aria-controls="mobile-nav"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X size={26} /> : <List size={26} />}
        </button>
      </header>
      {menu && (
        <nav
          id="mobile-nav"
          className="mobile-nav"
          aria-label="Мобильная навигация"
        >
          <button onClick={() => act("about")}>
            О техникуме <ArrowUpRight />
          </button>
          <a href="#programs" onClick={() => setMenu(false)}>
            Специальности <ArrowUpRight />
          </a>
          <button onClick={() => act("students")}>
            Студентам <ArrowUpRight />
          </button>
          <a href="#/sections" onClick={() => setMenu(false)}>
            Все разделы <ArrowUpRight />
          </a>
          <a href="#/news" onClick={() => setMenu(false)}>
            Новости <ArrowUpRight />
          </a>
          <a href="#/search" onClick={() => setMenu(false)}>
            Поиск по сайту <ArrowUpRight />
          </a>
          <a href="#/feedback" onClick={() => setMenu(false)}>
            Обратная связь <ArrowUpRight />
          </a>
          <button onClick={() => act("admission")}>
            Как поступить <ArrowUpRight />
          </button>
        </nav>
      )}
    </>
  );
}
