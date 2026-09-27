import { createContext, useContext, useEffect, useMemo, useState } from "react";
import base from "./content.json";
import { programs as basePrograms, siteSettings as baseSiteSettings } from "./data";
import { defaultHomepage, isHomepageShape } from "./homepage";

const SiteContext = createContext(null);
function homepagePreview() {
  if (!new URLSearchParams(location.search).has("home-preview")) return null;
  try {
    const preview = JSON.parse(sessionStorage.getItem("zhat-home-preview") || "null");
    return isHomepageShape(preview) ? preview : null;
  }
  catch { return null; }
}

export function SiteProvider({ children }) {
  const [live, setLive] = useState(null);
  const refresh = async () => {
    try {
      const response = await fetch("/api/site", { cache: "no-store" });
      if (response.ok) setLive(await response.json());
    } catch { /* Static preview keeps the public snapshot. */ }
  };
  useEffect(() => {
    refresh();
    window.addEventListener("zhat:site-updated", refresh);
    return () => window.removeEventListener("zhat:site-updated", refresh);
  }, []);
  const value = useMemo(() => {
    const overrides = live?.overrides || [];
    const hidden = new Set(live?.hiddenKeys || []);
    const pages = new Map(base.pages.map((page) => [page.key, page]));
    for (const item of overrides) {
      pages.set(item.key, { ...pages.get(item.key), ...item, text: item.text,
        url: item.url || pages.get(item.key)?.url || "", live: true });
    }
    return {
      groups: live?.groups || base.groups,
      news: live?.news || base.news,
      programs: live?.programs || basePrograms,
      siteSettings: live?.siteSettings || baseSiteSettings,
      homepage: homepagePreview() || live?.homepage || defaultHomepage(baseSiteSettings),
      pages: [...pages.values()].filter((item) => !hidden.has(item.key)),
      overrides: new Map(overrides.map((item) => [item.key, item])),
      hidden,
      refresh,
      connected: Boolean(live),
    };
  }, [live]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSiteData() {
  return useContext(SiteContext);
}
