import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
let stale = true;
try {
  const content = JSON.parse(
    await readFile(new URL("../src/content.json", import.meta.url), "utf8"),
  );
  stale = Date.now() - Date.parse(content.updatedAt) > 3600000;
} catch {}
if (stale) {
  try {
    execFileSync(
      "python3",
      [fileURLToPath(new URL("sync-content.py", import.meta.url))],
      { stdio: "inherit", timeout: 180000 },
    );
  } catch {
    console.warn(
      "Синхронизация недоступна: используется последняя сохранённая копия. Дата показана на сайте.",
    );
  }
}
