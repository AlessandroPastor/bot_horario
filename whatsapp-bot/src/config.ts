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

  /** Panel de administrador (docentes/horarios/calendario). Sin estos 3 valores, el panel no arranca. */
  adminUser: process.env.ADMIN_USER?.trim() || null,
  adminPassword: process.env.ADMIN_PASSWORD || null,
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET || null,
  /** Puerto del panel de administrador (solo importa si adminUser/adminPassword/adminSessionSecret están configurados). */
  adminPort: numeroEnv("ADMIN_PORT", 4500),
};
