import sanitizeHtml from "sanitize-html";

const tags = [
  "p", "div", "span", "br", "hr", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "blockquote", "ul", "ol", "li",
  "a", "img", "figure", "figcaption", "table", "thead", "tbody",
  "tfoot", "tr", "th", "td", "details", "summary", "video", "audio",
  "source", "small", "sup", "sub", "dl", "dt", "dd",
];

export function cleanEditorHtml(html) {
  return sanitizeHtml(String(html || ""), {
    allowedTags: tags,
    allowedAttributes: {
      "*": ["id"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "loading"],
      video: ["src", "poster", "controls", "preload"],
      audio: ["src", "controls", "preload"],
      source: ["src", "type"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "iframe", "svg", "math"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target === "_blank"
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
      }),
      video: (tagName, attribs) => ({ tagName, attribs: { ...attribs, controls: "", preload: "none" } }),
      audio: (tagName, attribs) => ({ tagName, attribs: { ...attribs, controls: "", preload: "none" } }),
    },
  });
}

export function plainText(html) {
  return cleanEditorHtml(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
