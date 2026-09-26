import { DatabaseSync, backup } from "node:sqlite";
import { cp, mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dbPath = resolve(process.env.CMS_DB_PATH || join(root, ".data", "cms.sqlite"));
const uploadDir = resolve(process.env.CMS_UPLOAD_DIR || join(root, ".data", "uploads"));
const backupRoot = resolve(process.env.CMS_BACKUP_DIR || join(root, ".data", "backups"));

try { await stat(dbPath); }
catch { throw new Error("База редактора ещё не создана"); }

const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = join(backupRoot, stamp);
await mkdir(destination, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(dbPath, { readOnly: true });
try { await backup(db, join(destination, "cms.sqlite")); }
finally { db.close(); }
try { await cp(uploadDir, join(destination, "uploads"), { recursive: true, errorOnExist: true }); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  await mkdir(join(destination, "uploads"), { recursive: true, mode: 0o700 });
}
console.log(`Резервная копия редактора: ${destination}`);
