import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import { categories } from "../data";
import { useSiteData } from "../site-data";
import { HomeTitle } from "./HomeTitle";
export function Programs({ onSelect }) {
  const { programs, homepage } = useSiteData();
  const [category, setCategory] = useState("Все направления");
  const [expanded, setExpanded] = useState(false);
  const filtered = programs.filter(
    (p) => category === "Все направления" || p.category === category,
  );
  const visible =
    category === "Все направления" && !expanded
      ? filtered.slice(0, 3)
      : filtered;
  return (
    <section
      className="programs section wrap"
      id="programs"
      aria-labelledby="programs-title"
    >
      <div className="section-heading">
        <h2 id="programs-title"><HomeTitle text={homepage.programs.title} accentDot /></h2>
        <p className="home-multiline">{homepage.programs.intro}</p>
      </div>
      <div className="filters" role="group" aria-label="Направления обучения">
        {categories.map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            className={category === c ? "active" : ""}
            onClick={() => {
              setCategory(c);
              setExpanded(false);
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="program-grid" aria-live="polite" aria-atomic="false">
        {visible.map((p) => (
          <button
            className="program"
            key={p.id}
            onClick={() => onSelect(p)}
            aria-label={`Подробнее: ${p.title}`}
          >
            <div className="program-photo">
              <img src={p.image} alt="" loading="lazy" />
              <span className="photo-overlay">
                Узнать о специальности <ArrowUpRight size={22} />
              </span>
            </div>
            <span className="program-code">{p.code}</span>
            <h3>{p.title}</h3>
            <div className="program-bottom">
              <span>После 9 класса · {p.duration}</span>
              <span className="round-arrow">
                <ArrowRight size={23} />
              </span>
            </div>
          </button>
        ))}
      </div>
      {category === "Все направления" ? (
        <button
          className="text-link all-programs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Свернуть список" : "Все специальности"}{" "}
          <ArrowUpRight size={19} />
          {!expanded && <span className="count">{programs.length}</span>}
        </button>
      ) : (
        <p className="filter-count">Найдено направлений: {filtered.length}</p>
      )}
    </section>
  );
}
