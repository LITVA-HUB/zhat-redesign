import { localHref, pageHref } from "../portal-data";
import { useEffect, useRef } from "react";
import {
  X,
  ArrowUpRight,
  Phone,
  ArrowRight,
  Check,
} from "@phosphor-icons/react";
import { admissionUrl, official, studentLinks } from "../data";
export function ExternalLink({ href, children, className = "", ...rest }) {
  const destination = localHref(href);
  const internal = destination.startsWith("#");
  return (
    <a
      href={destination}
      target={internal ? undefined : "_blank"}
      rel="noopener noreferrer"
      className={className}
      {...rest}
    >
      {children}
    </a>
  );
}
export function Dialog({ content, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!content) return;
    const node = ref.current;
    const opener = document.activeElement;
    node?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = "";
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
      else
        document.querySelector(".menu-toggle")?.focus({ preventScroll: true });
    };
  }, [content]);
  if (!content) return null;
  const p = content.program;
  const title = p
    ? p.title
    : content.type === "admission"
      ? "Твой путь в техникум"
      : content.type === "students"
        ? "Всё под рукой"
        : content.type === "parents"
          ? "Важное для родителей"
          : "Техникум, где начинается будущее";
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-inner">
        <button
          className="icon-button close-dialog"
          aria-label="Закрыть окно"
          onClick={onClose}
        >
          <X size={24} />
        </button>
        <p className="dialog-eyebrow">
          {p
            ? `${p.code} / СПЕЦИАЛЬНОСТЬ`
            : content.type === "admission"
              ? "ПОСТУПЛЕНИЕ"
              : content.type === "students"
                ? "СТУДЕНТАМ"
                : content.type === "parents"
                  ? "РОДИТЕЛЯМ"
                  : "ЗНАКОМСТВО"}
        </p>
        <h2 id="dialog-title">{title}</h2>
        {p ? (
          <>
            <p className="dialog-lead">{p.description}</p>
            <dl className="program-facts">
              <div>
                <dt>После</dt>
                <dd>9 класса</dd>
              </div>
              <div>
                <dt>Обучение</dt>
                <dd>Очное</dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>{p.duration}</dd>
              </div>
              <div>
                <dt>Финансирование</dt>
                <dd>{p.funding}</dd>
              </div>
            </dl>
            <p className="source-note">
              По сведениям приёмной комиссии о наборе 2026 года. Актуальные
              места и условия уточняйте в техникуме.
            </p>
            <ExternalLink href={p.url} className="button primary">
              О специальности <ArrowUpRight size={20} />
            </ExternalLink>
            <a href="tel:+79260760893" className="contact-inline">
              <Phone size={19} /> +7 (926) 076-08-93
            </a>
          </>
        ) : null}
        {content.type === "admission" ? (
          <>
            <p className="dialog-lead">
              Выбери направление, узнай условия и подготовь документы. Мы
              собрали основные шаги.
            </p>
            <ol className="steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Определись со специальностью</h3>
                  <p>Посмотри программы, сроки и формат обучения.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Проверь условия приёма</h3>
                  <p>
                    Сроки, бюджетные места и документы — на странице приёмной
                    комиссии.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Свяжись с приёмной комиссией</h3>
                  <p>Жуковский, ул. Кирова, 3, корпус 4, аудитория 15.</p>
                </div>
              </li>
            </ol>
            <div className="admission-note">
              <Check size={20} />
              <p>
                Для набора 2026 на сайте опубликован срок подачи документов: 19
                июня — 15 августа. Информацию о дополнительном и следующем
                наборе уточняйте у комиссии.
              </p>
            </div>
            <ExternalLink className="button primary" href={admissionUrl}>
              Условия поступления <ArrowUpRight size={20} />
            </ExternalLink>
            <a className="contact-inline" href="tel:+79260760893">
              <Phone size={20} /> +7 (926) 076-08-93
            </a>
          </>
        ) : null}
        {content.type === "students" ? (
          <>
            <p className="dialog-lead">
              Учёба и полезные сервисы — без долгих поисков.
            </p>
            <a className="button ink" href="#/sections">
              Все разделы для студентов <ArrowRight />
            </a>
            <div className="resource-links">
              {studentLinks.map(([name, desc, url]) => (
                <ExternalLink key={name} href={official + url}>
                  <div>
                    <h3>{name}</h3>
                    <p>{desc}</p>
                  </div>
                  <ArrowUpRight size={23} />
                </ExternalLink>
              ))}
            </div>
          </>
        ) : null}
        {content.type === "parents" ? (
          <>
            <p className="dialog-lead">
              О поступлении, поддержке и обучении — из официальных источников.
            </p>
            <div className="resource-links">
              {[
                ["Условия поступления", admissionUrl],
                ["Стипендии и поддержка", official + "/sveden/grants"],
                ["Документы техникума", official + "/sveden/document"],
                ["Доступная среда", official + "/accessible_environment"],
              ].map(([name, url]) => (
                <ExternalLink key={name} href={url}>
                  <h3>{name}</h3>
                  <ArrowUpRight size={23} />
                </ExternalLink>
              ))}
            </div>
            <a href="tel:+79161970205" className="contact-inline">
              <Phone size={20} /> +7 (916) 197-02-05
            </a>
          </>
        ) : null}
        {content.type === "about" ? (
          <>
            <p className="dialog-lead">
              Авиационный техникум имени В. А. Казакова — в Жуковском, с
              филиалом в Раменском. Его история началась в 1945 году.
            </p>
            <p>
              Здесь изучают авиационную технику, электронику, IT и транспорт. А
              за пределами занятий — проекты, студенческий медиацентр и спорт.
            </p>
            <div className="resource-links">
              <ExternalLink href={official + "/virtualtour?ml=1"}>
                <h3>Виртуальный тур</h3>
                <ArrowUpRight size={23} />
              </ExternalLink>
              <ExternalLink href={official + "/sveden"}>
                <h3>Сведения о техникуме</h3>
                <ArrowUpRight size={23} />
              </ExternalLink>
            </div>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
