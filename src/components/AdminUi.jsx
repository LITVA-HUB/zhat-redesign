import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Warning } from "@phosphor-icons/react";

// Large, plain-language confirmation instead of the browser's tiny confirm():
// const ok = await confirm({ title, text, action: "Скрыть", danger: true });
const ConfirmContext = createContext(async () => true);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const confirm = useCallback((options) => new Promise((resolve) => setRequest({ ...options, resolve })), []);
  const answer = (value) => { request?.resolve(value); setRequest(null); };
  const actionRef = useRef(null);
  useEffect(() => {
    if (!request) return;
    actionRef.current?.focus();
    const close = (event) => { if (event.key === "Escape") answer(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  });
  return <ConfirmContext.Provider value={confirm}>
    {children}
    {request && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) answer(false); }}>
      <div className="admin-modal admin-confirm" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-text">
        {request.danger && <Warning size={40} weight="fill" className="admin-confirm-icon" />}
        <h2 id="admin-confirm-title">{request.title}</h2>
        {request.text && <p id="admin-confirm-text">{request.text}</p>}
        <div className="admin-confirm-actions">
          <button ref={actionRef} className={request.danger ? "admin-primary admin-danger" : "admin-primary"} onClick={() => answer(true)}>{request.action || "Да"}</button>
          <button className="admin-secondary" onClick={() => answer(false)}>{request.cancel || "Отмена"}</button>
        </div>
      </div>
    </div>}
  </ConfirmContext.Provider>;
}

// While an editor has unsaved work, links inside the admin ask first, and closing the tab warns.
const guard = { message: "" };
export function useLeaveGuard(dirty, message = "Вы не сохранили изменения. Если уйти со страницы, они пропадут.") {
  useEffect(() => {
    if (!dirty) return;
    guard.message = message;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => { guard.message = ""; window.removeEventListener("beforeunload", warn); };
  }, [dirty, message]);
}
export function LeaveGuardLinks() {
  const confirm = useConfirm();
  useEffect(() => {
    const click = async (event) => {
      const link = event.target.closest?.("a[href^='#']");
      if (!guard.message || !link || link.target === "_blank" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      const href = link.getAttribute("href");
      if (await confirm({ title: "Уйти без сохранения?", text: guard.message, action: "Уйти, не сохраняя", cancel: "Остаться и сохранить", danger: true })) {
        guard.message = "";
        location.hash = href;
      }
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [confirm]);
  return null;
}

export const formatSize = (bytes) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1).replace(".", ",")} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
export const fileKind = (mime = "") => mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "document";
