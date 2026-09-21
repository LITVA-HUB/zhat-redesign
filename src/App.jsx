import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
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
export function App() {
  const route = usePortalRoute();
  useEffect(() => {
    setDialog(null);
    if (!route.startsWith("#/"))
      document.title = "ЖАТ — твоё будущее набирает высоту";
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
  return (
    <div id="top">
      <Header open={open} contrast={contrast} setContrast={setContrast} />
      <ServiceBar />
      {route.startsWith("#/") ? (
        <Portal key={route} route={route} />
      ) : (
        <main id="main" tabIndex={-1}>
          <Hero open={open} />
          <Programs
            onSelect={(program) => setDialog({ type: "program", program })}
          />
          <Life />
          <SectionDirectory compact />
          <CurrentNews />
        </main>
      )}
      <Footer open={open} />
      <Dialog content={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
