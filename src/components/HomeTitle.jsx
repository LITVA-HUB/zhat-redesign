import { Fragment } from "react";

export function HomeTitle({ text, accentLast = false, accentDot = false }) {
  const lines = String(text || "").trim().split("\n");
  return lines.map((line, index) => {
    const last = index === lines.length - 1;
    const content = last && accentDot ? line.replace(/\.$/, "") : line;
    return <Fragment key={index}>
      {index > 0 && <br />}
      {last && accentLast ? <span>{content}</span> : content}
      {last && accentDot && <span className="orange">.</span>}
    </Fragment>;
  });
}
