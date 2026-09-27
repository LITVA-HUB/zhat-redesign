import { Fragment, useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { Hero, AudienceCards } from "./components/Hero";
import { Programs } from "./components/Programs";
import { Life, Footer } from "./components/Editorial";
import {
  Portal,
  ServiceBar,
  SectionDirectory,
  CurrentNews,
  usePortalRoute,
} from "./components/Portal";
import { Dialog } from "./components/Dialog";
import { SiteProvider, useSiteData } from "./site-data";
import { AdminApp } from "./components/AdminApp";
export function App() {
  return <SiteProvider><SiteApp /></SiteProvider>;
}
function SiteApp() {
  const { homepage, refresh } = useSiteData();
  const route = usePortalRoute();
  const previousRoute = useRef(route);
  useEffect(() => {
    setDialog(null);
    if (!route.startsWith("#/"))
      document.title = "ЖАТ — твоё будущее набирает высоту";
    if (previousRoute.current.startsWith("#/admin") && !route.startsWith("#/admin")) refresh();
    previousRoute.current = route;
  }, [route]);
  const [dialog, setDialog] = useState(null);
  const [contrast, setContrast] = useState(() => {
    try {
      return localStorage.getItem("zhat-contrast") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", contrast);
    try {
      localStorage.setItem("zhat-contrast", String(contrast));
    } catch {}
  }, [contrast]);
  const open = (type) => setDialog({ type });
  if (route.startsWith("#/admin")) return <AdminApp route={route} />;
  const homeBlocks = {
    audiences: <AudienceCards open={open} />,
    programs: <Programs onSelect={(program) => setDialog({ type: "program", program })} />,
    life: <Life />,
    directory: <SectionDirectory compact />,
    news: <CurrentNews />,
  };
  return (
    <div id="top">
      <Header open={open} contrast={contrast} setContrast={setContrast} />
      <ServiceBar />
      {route.startsWith("#/") ? (
        <Portal key={route} route={route} />
      ) : (
        <main id="main" tabIndex={-1}>
          <Hero open={open} />
          {homepage.order.map((id) => id !== "programs" && !homepage[id].visible
            ? null : <Fragment key={id}>{homeBlocks[id]}</Fragment>)}
        </main>
      )}
      <Footer open={open} />
      <Dialog content={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
