import { useEffect, useRef, useState } from "react";
import {
  ArrowArcLeft, ArrowArcRight, Eraser, LinkSimple, ListBullets, ListNumbers, Quotes, Table, TextB,
  TextHTwo, TextItalic, TextT, UploadSimple,
} from "@phosphor-icons/react";

// Text pasted from Word, Excel or a web page keeps its structure (paragraphs, headings, lists,
// tables, bold, links) but loses fonts, colours and Office markup. The server cleans it again.
const keep = new Set(["P", "BR", "H2", "H3", "H4", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "BLOCKQUOTE",
  "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "A", "IMG", "SUB", "SUP"]);
const rename = { H1: "H2", H5: "H4", H6: "H4", DIV: "P" };
export function cleanPastedHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node, target) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) { target.append(child.textContent.replace(/ /g, " ")); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = rename[child.tagName] || child.tagName;
      if (["STYLE", "SCRIPT", "META", "TITLE", "XML", "O:P"].includes(child.tagName)) continue;
      // Word marks list paragraphs with classes; treat them as paragraphs.
      if (!keep.has(tag)) { walk(child, target); continue; }
      const element = document.createElement(tag);
      if (tag === "A" && /^(https?:|mailto:|tel:|#\/)/i.test(child.getAttribute("href") || "")) {
        element.setAttribute("href", child.getAttribute("href"));
      }
      if (tag === "IMG") {
        if (!/^https?:\/\/|^\/(?!\/)/.test(child.getAttribute("src") || "")) continue;
        element.setAttribute("src", child.getAttribute("src"));
        element.setAttribute("alt", child.getAttribute("alt") || "");
      }
      for (const name of ["colspan", "rowspan"]) {
        if ((tag === "TD" || tag === "TH") && /^\d+$/.test(child.getAttribute(name) || "")) element.setAttribute(name, child.getAttribute(name));
      }
      walk(child, element);
      if (tag === "P" && !element.textContent.trim() && !element.querySelector("img")) continue;
      target.append(element);
    }
  };
  const container = document.createElement("div");
  walk(doc.body, container);
  return container.innerHTML;
}
const escapeHtml = (text) => text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

function Tool({ label, icon: Icon, onClick, disabled, wide = false }) {
  return <button type="button" className={wide ? "wide" : ""} title={label} disabled={disabled}
    onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
    <Icon size={22} aria-hidden="true" /><span>{label}</span>
  </button>;
}

export function RichEditor({ html, onChange, editorRef, onInsertFile, onUploadFiles, disabled = false }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const savedRange = useRef(null);
  useEffect(() => {
    if (editorRef.current && !editorRef.current.contains(document.activeElement) && editorRef.current.innerHTML !== (html || ""))
      editorRef.current.innerHTML = html || "";
  }, [html, editorRef]);
  const changed = () => onChange(editorRef.current?.innerHTML || "");
  const run = (command, value) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    changed();
  };
  const block = (tag) => {
    const current = document.queryCommandValue("formatBlock").toLowerCase();
    run("formatBlock", current === tag ? "p" : tag);
  };
  const insertTable = () => {
    const cells = (tag) => `<tr>${Array.from({ length: 3 }, () => `<${tag}>&nbsp;</${tag}>`).join("")}</tr>`;
    run("insertHTML", `<table><thead>${cells("th")}</thead><tbody>${cells("td")}${cells("td")}</tbody></table><p><br></p>`);
  };
  const openLink = () => {
    const selection = window.getSelection();
    savedRange.current = selection?.rangeCount && editorRef.current?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
    setLinkOpen(!linkOpen); setLinkError("");
  };
  const insertLink = () => {
    let url = linkUrl.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) url = "mailto:" + url;
    else if (/^www\./i.test(url)) url = "https://" + url;
    if (!/^(https?:\/\/|mailto:|tel:|#\/)/i.test(url)) {
      setLinkError("Вставьте полный адрес, например https://zhat.ru/… или адрес почты.");
      return;
    }
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (savedRange.current) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
    if (selection?.isCollapsed || !savedRange.current) {
      document.execCommand("insertHTML", false, `<a href="${escapeHtml(url)}">${escapeHtml(linkUrl.trim())}</a>&nbsp;`);
    } else document.execCommand("createLink", false, url);
    changed(); setLinkOpen(false); setLinkUrl(""); setLinkError("");
  };
  const paste = (event) => {
    event.preventDefault();
    const files = [...(event.clipboardData.files || [])].filter((file) => file.type.startsWith("image/"));
    if (files.length && onUploadFiles) { onUploadFiles(files); return; }
    const pasted = event.clipboardData.getData("text/html");
    if (pasted) document.execCommand("insertHTML", false, cleanPastedHtml(pasted));
    else document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    changed();
  };
  const drop = (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.length || !onUploadFiles) return;
    event.preventDefault();
    const point = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (point) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(point); }
    onUploadFiles(files);
  };
  return <div className="admin-rich">
    <div className="admin-toolbar" role="toolbar" aria-label="Оформление текста">
      <div className="admin-toolbar-group">
        <Tool label="Жирный" icon={TextB} disabled={disabled} onClick={() => run("bold")} />
        <Tool label="Курсив" icon={TextItalic} disabled={disabled} onClick={() => run("italic")} />
        <Tool label="Заголовок" icon={TextHTwo} disabled={disabled} onClick={() => block("h2")} />
        <Tool label="Обычный текст" icon={TextT} disabled={disabled} onClick={() => run("formatBlock", "p")} />
      </div>
      <div className="admin-toolbar-group">
        <Tool label="Список" icon={ListBullets} disabled={disabled} onClick={() => run("insertUnorderedList")} />
        <Tool label="Нумерация" icon={ListNumbers} disabled={disabled} onClick={() => run("insertOrderedList")} />
        <Tool label="Цитата" icon={Quotes} disabled={disabled} onClick={() => block("blockquote")} />
        <Tool label="Таблица" icon={Table} disabled={disabled} onClick={insertTable} />
      </div>
      <div className="admin-toolbar-group">
        <Tool label="Ссылка" icon={LinkSimple} disabled={disabled} onClick={openLink} />
        <Tool label="Убрать оформление" icon={Eraser} disabled={disabled} onClick={() => run("removeFormat")} />
        <Tool label="Отменить" icon={ArrowArcLeft} disabled={disabled} onClick={() => run("undo")} />
        <Tool label="Вернуть" icon={ArrowArcRight} disabled={disabled} onClick={() => run("redo")} />
      </div>
      <Tool label="Вставить фото или документ" icon={UploadSimple} disabled={disabled} onClick={onInsertFile} wide />
    </div>
    {linkOpen && <div className="admin-link-form">
      <label>Адрес ссылки
        <input type="text" autoFocus disabled={disabled} value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setLinkError(""); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); insertLink(); } }}
          placeholder="https://… или адрес почты" />
      </label>
      <button type="button" className="admin-primary" disabled={disabled || !linkUrl.trim()} onClick={insertLink}>Вставить ссылку</button>
      <button type="button" className="admin-secondary" onClick={() => setLinkOpen(false)}>Отмена</button>
      <small>{linkError || "Выделите слова в тексте, затем вставьте адрес — слова станут ссылкой. Без выделения в текст попадёт сам адрес."}</small>
    </div>}
    <div ref={editorRef} role="textbox" aria-label="Текст материала" aria-multiline="true" aria-readonly={disabled}
      contentEditable={!disabled} suppressContentEditableWarning className="admin-editable imported-content"
      onInput={changed} onBlur={changed} onPaste={paste} onDrop={drop} />
    <p className="admin-hint">Можно вставить текст из Word или Excel — таблицы, списки и жирный шрифт сохранятся. Фото можно перетащить прямо в текст.</p>
  </div>;
}
