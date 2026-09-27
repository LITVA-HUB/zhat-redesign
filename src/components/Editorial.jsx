import {
  ArrowUpRight,
  ArrowRight,
  Phone,
  MapPin,
  Envelope,
} from "@phosphor-icons/react";
import { ExternalLink } from "./Dialog";
import { Brand } from "./Header";
import { news, official } from "../data";
import { useSiteData } from "../site-data";
import { phoneHref } from "../phone";
import { HomeTitle } from "./HomeTitle";
export function Life() {
  const { homepage } = useSiteData();
  const life = homepage.life;
  return (
    <section className="life" id="life">
      <div className="life-copy">
        <h2><HomeTitle text={life.title} accentLast /></h2>
        <p className="home-multiline">{life.description}</p>
        <ExternalLink href={official + "/studentu"} className="text-link">
          Жизнь техникума <ArrowUpRight size={22} />
        </ExternalLink>
        <div className="life-links">
          <ExternalLink href={official + "/studentu/studencheskij-mediatsentr"}>
            Медиацентр <ArrowRight size={16} />
          </ExternalLink>
          <ExternalLink
            href={official + "/studentu/studencheskij-sportivnyj-klub"}
          >
            Спорт <ArrowRight size={16} />
          </ExternalLink>
        </div>
      </div>
      <div className="life-media">
        <img
          src={life.image}
          alt={life.imageAlt}
          loading="lazy"
        />
        <span className="photo-caption">{life.caption}</span>
      </div>
    </section>
  );
}
export function News() {
  return (
    <section className="news section wrap" id="news">
      <div className="news-heading">
        <h2>
          На связи —<br className="mobile-break" /> техникум
          <span className="orange">.</span>
        </h2>
        <ExternalLink
          href={official + "/?view=article&id=867:vse-novosti&catid=26"}
          className="text-link"
        >
          Все новости <ArrowUpRight size={20} />
        </ExternalLink>
      </div>
      <div className="news-grid">
        {news.map((n) => (
          <ExternalLink
            key={n.id}
            className="news-card"
            href={`${official}/?view=article&id=${n.id}&catid=26`}
          >
            <div className={`news-photo ${n.poster ? "poster" : ""}`}>
              <img src={`/images/${n.image}.webp`} alt={n.alt} loading="lazy" />
              <span className="news-arrow">
                <ArrowUpRight size={24} />
              </span>
            </div>
            <div className="news-meta">
              <time dateTime={n.iso}>{n.date}</time>
              <span>{n.tag}</span>
            </div>
            <h3>{n.title}</h3>
          </ExternalLink>
        ))}
      </div>
    </section>
  );
}
export function Footer({ open }) {
  const { siteSettings, homepage } = useSiteData();
  return (
    <>
      <section className="contact-section" id="contacts">
        <div className="wrap contact-content">
          <div>
            <h2><HomeTitle text={homepage.contacts.title} accentDot /></h2>
            <button
              className="button primary"
              onClick={() => open("admission")}
            >
              {homepage.contacts.buttonLabel} <ArrowUpRight size={22} />
            </button>
          </div>
          <div className="contact-details">
            <h3>Приёмная комиссия</h3>
            <a className="big-phone" href={phoneHref(siteSettings.admissionPhone)}>
              {siteSettings.admissionPhone}
            </a>
            <p>{siteSettings.admissionAddress}</p>
            <ExternalLink
              href="https://yandex.ru/maps/-/CBRka6u62D"
              className="text-link"
            >
              Как добраться <ArrowUpRight size={18} />
            </ExternalLink>
          </div>
        </div>
      </section>
      <footer className="footer wrap">
        <div className="footer-top">
          <div>
            <Brand />
            <p>
              Авиационный техникум
              <br />
              имени В. А. Казакова
            </p>
          </div>
          <div>
            <h3>Всегда на связи</h3>
            <a href={`mailto:${siteSettings.generalEmail}`}>{siteSettings.generalEmail}</a>
            <a href={phoneHref(siteSettings.generalPhone)}>{siteSettings.generalPhone}</a>
            <ExternalLink href="https://vk.com/zhatofficial_professionalitet">
              Сообщество ВКонтакте <ArrowUpRight size={16} />
            </ExternalLink>
          </div>
          <div>
            <h3>Филиал в Раменском</h3>
            <p>{siteSettings.branchAddress}</p>
            <a href={phoneHref(siteSettings.branchPhone)}>{siteSettings.branchPhone}</a>
          </div>
          <div>
            <h3>Официальная информация</h3>
            <ExternalLink href={official + "/sveden"}>
              Сведения об организации <ArrowUpRight size={16} />
            </ExternalLink>
            <ExternalLink href={official + "/sveden/document"}>
              Документы <ArrowUpRight size={16} />
            </ExternalLink>
            <ExternalLink
              href={
                official +
                "/files/sveden/docs/personal_data/polObrabPeronDannih_2.pdf"
              }
            >
              Политика обработки данных
            </ExternalLink>
            <a href="#/admin">Редактор сайта <ArrowUpRight size={16} /></a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ЖАТ имени В. А. Казакова</span>
          <span>
            Новая версия сайта · Материалы{" "}
            <ExternalLink href={official}>zhat.ru</ExternalLink>
          </span>
          <a href="#top">
            Наверх <ArrowUpRight size={17} />
          </a>
        </div>
      </footer>
    </>
  );
}
