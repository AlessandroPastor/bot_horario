import fs from "node:fs";
import path from "node:path";
import cron from "node-cron";
import { config } from "../config.js";

const BACKUPS_DIR = path.resolve("backups");
const AUTH_DIR = path.resolve("auth_info");
const DB_FILE = path.resolve("data", "bot.db");

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function limpiarBackupsViejos(): void {
  if (!fs.existsSync(BACKUPS_DIR)) return;
  const carpetas = fs
    .readdirSync(BACKUPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const sobrantes = carpetas.length - config.backupKeep;
  for (let i = 0; i < sobrantes; i++) {
    fs.rmSync(path.join(BACKUPS_DIR, carpetas[i]), {
      recursive: true,
      force: true,
    });
  }
}

/** Copia auth_info/ y data/bot.db a backups/<timestamp>/. Devuelve la ruta creada, o null si no había nada que respaldar. */
export function crearBackup(): string | null {
  const hayAuth = fs.existsSync(AUTH_DIR);
  const hayDb = fs.existsSync(DB_FILE);
  if (!hayAuth && !hayDb) return null;

  const destino = path.join(BACKUPS_DIR, timestamp());
  fs.mkdirSync(destino, { recursive: true });

  if (hayAuth) {
    fs.cpSync(AUTH_DIR, path.join(destino, "auth_info"), { recursive: true });
  }
  if (hayDb) {
    fs.copyFileSync(DB_FILE, path.join(destino, "bot.db"));
  }

  limpiarBackupsViejos();
  return destino;
}

export function iniciarBackupsAutomaticos(): void {
  cron.schedule("0 3 * * *", () => {
    const destino = crearBackup();
    if (destino) console.log(`Backup diario creado en ${destino}`);
  });
  console.log(
    `Backups automáticos programados (diario 03:00, conserva ${config.backupKeep}) 💾`,
  );
}
