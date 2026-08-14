import type { proto } from "@whiskeysockets/baileys";
import { iniciarAdminServer } from "./admin/server.js";
import { crearBackup, iniciarBackupsAutomaticos } from "./backup/backup.js";
import { startBot } from "./bot/connection.js";
import { manejarMensaje } from "./commands/router.js";
import { sembrarPlantillasPorDefecto } from "./db/seed.js";
import { iniciarScheduler, setSocket } from "./scheduler/reminder.js";

function getMessageText(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  return (m?.conversation ?? m?.extendedTextMessage?.text ?? "").trim();
}

sembrarPlantillasPorDefecto();
iniciarScheduler();
iniciarBackupsAutomaticos();
iniciarAdminServer();

startBot({
  onConnected: (sock) => {
    setSocket(sock);
    crearBackup();
  },
  onMessage: async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    if (!chatId) return;

    const texto = getMessageText(msg);
    if (!texto) return;

    await manejarMensaje(sock, chatId, texto, msg);
  },
}).catch((err) => {
  console.error("Error iniciando el bot:", err);
  process.exit(1);
});
