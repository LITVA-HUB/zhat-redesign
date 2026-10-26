import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// One place to pick the interpreter: PYTHON, the project .venv, then the platform default.
// On Windows "python3" is usually the Microsoft Store stub, so it is never the fallback there.
const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const venv = root + (windows ? ".venv/Scripts/python.exe" : ".venv/bin/python3");
export const python = process.env.PYTHON || (existsSync(venv) ? venv : windows ? "python" : "python3");
export const pythonEnv = { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = spawnSync(python, process.argv.slice(2), { stdio: "inherit", env: pythonEnv });
  if (result.error) console.error(`Не удалось запустить Python (${python}): ${result.error.message}`);
  process.exit(result.status ?? 1);
}
