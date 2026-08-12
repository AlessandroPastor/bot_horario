import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

function numeroEnv(nombre: string, porDefecto: number): number {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) ? valor : porDefecto;
}

export const config = {
  /** Chat (tu número o un grupo) al que se avisa de eventos del sistema, ej. reconexión tras caída. */
  ownerChatId: process.env.OWNER_CHAT_ID?.trim() || null,
  /** Cuántos backups diarios conservar antes de borrar los más viejos. */
  backupKeep: numeroEnv("BACKUP_KEEP", 7),
  /** Minutos de desconexión a partir de los cuales se avisa al reconectar. */
  downtimeAlertMin: numeroEnv("DOWNTIME_ALERT_MIN", 5),
};
