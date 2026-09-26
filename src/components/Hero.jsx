import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  GraduationCap,
  UsersThree,
  Users,
} from "@phosphor-icons/react";
import { useSiteData } from "../site-data";
export function Hero({ open }) {
  const { siteSettings } = useSiteData();
  const audiences = [
    [
      "admission",
      "Хочу поступить",
      "Специальности и правила приёма",
      GraduationCap,
    ],
    ["students", "Я уже студент", "Расписание и полезные сервисы", UsersThree],
    ["parents", "Родителям", "Всё важное об обучении", Users],
  ];
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <img
          className="hero-art"
          src="/images/hero-sky.webp"
          alt="Пассажирский самолёт набирает высоту в голубом небе"
          fetchPriority="high"
        />
        <div className="hero-content">
          <h1 id="hero-title">
            Твоё будущее
            <br />
            набирает
            <br />
            <span>высоту.</span>
          </h1>
          <p>{siteSettings.heroLead}</p>
          <div className="hero-actions">
            <a className="button primary" href="#programs">
              Выбрать специальность <ArrowUpRight size={21} />
            </a>
            <button className="text-link" onClick={() => open("about")}>
              Знакомство с техникумом
            </button>
          </div>
        </div>
        <div className="hero-location">
          <MapPin size={18} weight="fill" /> {siteSettings.location}
        </div>
      </section>
      <section className="audiences wrap" aria-label="Быстрый переход">
        {audiences.map(([key, title, desc, Icon]) => (
          <button key={key} className="audience" onClick={() => open(key)}>
            <span className="audience-icon">
              <Icon size={27} weight="fill" />
            </span>
            <span className="audience-copy">
              <strong>
                {title}
                <ArrowRight size={24} />
              </strong>
              <span>{desc}</span>
            </span>
          </button>
        ))}
      </section>
    </>
  );
}
