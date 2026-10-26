// Public-site blocks carried over from the Joomla homepage: banners, partners, map,
// social links and the two official counters (Gosuslugi feedback widget, Yandex Metrika).
const partner = (file, title, url) => ({ title, url, image: `/images/partners/${file}` });

export const defaultExtras = {
  social: {
    vk: "https://vk.com/zhatofficial_professionalitet",
    max: "https://max.ru/join/DyxRwl-0LcNwjpi4f4-0OUygfr6acJ2Rn_u7sFyJvjw",
    telegram: "",
  },
  map: {
    embed: "https://yandex.ru/map-widget/v1/?lang=ru_RU&scroll=false&source=constructor-api&um=constructor%3Abb67c12087b98b2a40916b76accfcb3c887566007cac297001ec8bdf4488522c",
    link: "https://yandex.ru/maps/-/CBRka6u62D",
    branchLink: "https://yandex.ru/maps/?um=constructor%3A0ec47dbff7bbe37f040f2465935a6d3da826e515ee66e1a5a958599994f243b4&source=constructorLink",
  },
  integrations: { gosuslugiId: "232010", metrikaId: "52234915" },
  resources: {
    visible: true,
    title: "Полезные ресурсы",
    items: [
      partner("pytevka.svg", "Путёвка в жизнь", "https://zhat.ru/events"),
      partner("szn.svg", "Содействие занятости населения", "https://zhat.ru/employment-promotion"),
      partner("kadry.png", "Кадровый портал Московской области", "https://kadry.mosreg.ru/"),
      partner("copp.png", "Центр опережающей профессиональной подготовки", "https://coppmo.ru/"),
      partner("obrazov.png", "Национальный проект «Образование»", "https://xn--80aapampemcchfmo7a3c9ehj.xn--p1ai/projects/obrazovanie/"),
      partner("trudvsem.png", "Работа России", "https://trudvsem.ru/"),
    ],
  },
  partners: {
    visible: true,
    title: "Наши партнёры",
    items: [
      partner("zhtpp.png", "Торгово-промышленная палата Жуковского", "https://zhukovsky.tpprf.ru/ru/"),
      partner("aeroport.png", "Аэропорт Жуковский", "http://www.zia.aero/"),
      partner("almazantey.png", "Концерн ВКО «Алмаз — Антей»", "https://almaz-antey.ru/"),
      partner("agat.png", "Агат", "https://aviaport.ru/aviafirms/284/"),
      partner("niip.png", "НИИП имени В. В. Тихомирова", "https://niip.ru/"),
      partner("rpz.png", "Раменский приборостроительный завод", "https://vk.com/rpz_official"),
      partner("tscagi.png", "ЦАГИ", "https://tsagi.ru/"),
      partner("fss.png", "Фонд социального страхования", "https://fss.ru/index.shtml"),
      partner("ncb.png", "Национальный центр вертолётостроения", "https://rhc.aero/structure/nhc"),
      partner("sh.png", "Партнёр техникума", ""),
      partner("kret.png", "КРЭТ", "https://vk.com/kretrussia"),
      partner("volonter.png", "Волонтёрский центр", "https://vk.com/volonter_soc_inc"),
      partner("redwings.png", "Red Wings", "https://flyredwings.com/about/"),
      partner("gerb_gsgu.png", "Государственный социально-гуманитарный университет", "https://gukolomna.ru/"),
      partner("oak.png", "Объединённая авиастроительная корпорация", "https://uacrussia.ru/ru/"),
      partner("balash_teh.png", "БИТТ", "https://xn--90aiq7a.xn--p1ai/"),
      partner("vordi.png", "ВОРДИ", "https://vordi.org/"),
      partner("asrdovz.png", "АСРДОВЗ", "https://asrdovz.mgou.ru/"),
      partner("rpkb.jpg", "РПКБ", ""),
    ],
  },
};

export const defaultAnnouncement = {
  visible: false, text: "", link: "", linkLabel: "Подробнее", tone: "info", until: "",
};

export function activeAnnouncement(value, now = new Date()) {
  if (!value?.visible || !value.text) return null;
  if (value.until && new Date(value.until + "T23:59:59+03:00") < now) return null;
  return value;
}
