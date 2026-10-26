import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { python, pythonEnv } from "./python.mjs";
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
      python,
      [fileURLToPath(new URL("sync-content.py", import.meta.url))],
      { stdio: "inherit", timeout: 180000, env: pythonEnv },
    );
  } catch {
    console.warn(
      "Синхронизация недоступна: используется последняя сохранённая копия. Дата показана на сайте.",
    );
  }
}
