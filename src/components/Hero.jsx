import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  GraduationCap,
  UsersThree,
  Users,
} from "@phosphor-icons/react";
import { useSiteData } from "../site-data";
import { HomeTitle } from "./HomeTitle";
const audienceIcons = { admission: GraduationCap, students: UsersThree, parents: Users };
export function Hero({ open }) {
  const { homepage } = useSiteData();
  const hero = homepage.hero;
  return (
      <section className="hero" aria-labelledby="hero-title">
        <img
          className="hero-art"
          src={hero.image}
          alt={hero.imageAlt}
          fetchPriority="high"
        />
        <div className="hero-content">
          <h1 id="hero-title"><HomeTitle text={hero.title} accentLast /></h1>
          <p>{hero.lead}</p>
          <div className="hero-actions">
            <a className="button primary" href="#programs">
              {hero.primaryLabel} <ArrowUpRight size={21} />
            </a>
            <button className="text-link" onClick={() => open("about")}>
              {hero.secondaryLabel}
            </button>
          </div>
        </div>
        <div className="hero-location">
          <MapPin size={18} weight="fill" /> {hero.location}
        </div>
      </section>
  );
}
export function AudienceCards({ open }) {
  const { homepage } = useSiteData();
  return (
      <section className="audiences wrap" aria-label="Быстрый переход">
        {homepage.audiences.items.filter((item) => item.visible).map((item) => {
          const Icon = audienceIcons[item.id];
          return <button key={item.id} className="audience" onClick={() => open(item.id)}>
            <span className="audience-icon">
              <Icon size={27} weight="fill" />
            </span>
            <span className="audience-copy">
              <strong>
                {item.title}
                <ArrowRight size={24} />
              </strong>
              <span>{item.description}</span>
            </span>
          </button>;
        })}
      </section>
  );
}
