import content from "./content.json";
export { content };
export function sourceKey(href) {
  try {
    const u = new URL(href, "https://zhat.ru");
    if (!["zhat.ru", "www.zhat.ru"].includes(u.hostname)) return null;
    if (
      u.searchParams.get("view") === "article" &&
      /^\d+/.test(u.searchParams.get("id") || "")
    )
      return "/article/" + u.searchParams.get("id").match(/^\d+/)[0];
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}
export const pageHref = (key) => "#/page/" + encodeURIComponent(key);
export function localHref(href) {
  if (!href || href.startsWith("#") || new URL(href, "https://zhat.ru").hash)
    return href;
  const key = sourceKey(href);
  if (key === "/" && /^https:\/\/zhat.ru\/?$/.test(href)) return "#top";
  return content.pages.some((p) => p.key === key) ||
    (key?.startsWith("/article/") &&
      new URL(href, "https://zhat.ru").searchParams.get("catid") === "26")
    ? pageHref(key)
    : href;
}
export const syncedDate = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date(content.updatedAt));
