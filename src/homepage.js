import { siteSettings as baseSiteSettings } from "./data.js";

export const homeSectionIds = ["audiences", "programs", "life", "directory", "news"];

export function isHomepageShape(value, example = defaultHomepage()) {
  if (Array.isArray(example))
    return Array.isArray(value) && value.length === example.length &&
      value.every((item, index) => isHomepageShape(item, example[index]));
  if (example && typeof example === "object")
    return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
      Object.entries(example).every(([key, item]) => isHomepageShape(value[key], item));
  return typeof value === typeof example;
}

export function defaultHomepage(settings = baseSiteSettings) {
  return {
    hero: {
      title: "Твоё будущее\nнабирает\nвысоту.",
      lead: settings.heroLead,
      location: settings.location,
      image: "/images/hero-sky.webp",
      imageAlt: "Пассажирский самолёт набирает высоту в голубом небе",
      primaryLabel: "Выбрать специальность",
      secondaryLabel: "Знакомство с техникумом",
    },
    audiences: {
      visible: true,
      items: [
        { id: "admission", visible: true, title: "Хочу поступить", description: "Специальности и правила приёма" },
        { id: "students", visible: true, title: "Я уже студент", description: "Расписание и полезные сервисы" },
        { id: "parents", visible: true, title: "Родителям", description: "Всё важное об обучении" },
      ],
    },
    programs: {
      title: "Найди своё\nнаправление",
      intro: "От первого проекта —\nк настоящей профессии.\nВыбери то, что интересно тебе.",
    },
    life: {
      visible: true,
      title: "Учиться.\nПробовать.\nБыть собой.",
      description: "Проекты, спорт, медиа и люди,\nс которыми хочется делать больше.",
      image: "/images/student-life.webp",
      imageAlt: "Участницы церемонии открытия чемпионата высоких технологий",
      caption: "В центре событий. Вместе.",
    },
    directory: { visible: true, title: "Твой маршрут." },
    news: { visible: true, title: "На связи —\nтехникум" },
    contacts: { title: "Твой следующий шаг\nначинается здесь", buttonLabel: "Как поступить" },
    order: [...homeSectionIds],
  };
}
