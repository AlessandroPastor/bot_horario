import type { WASocket } from "@whiskeysockets/baileys";
import { listarEventos } from "../db/eventos.js";

export async function exportarEventos(
  sock: WASocket,
  chatId: string,
): Promise<void> {
  const eventos = listarEventos(chatId);

  if (eventos.length === 0) {
    await sock.sendMessage(chatId, {
      text: "No tienes horarios guardados para exportar.",
    });
    return;
  }

  const payload = eventos.map((e) => ({
    titulo: e.titulo,
    descripcion: e.descripcion,
    tipo: e.tipo,
    dias: e.dias,
    fecha: e.fecha,
    hora: e.hora,
    avisoPrevioMin: e.avisoPrevioMin,
    activo: e.activo,
  }));

  const buffer = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");

  await sock.sendMessage(chatId, {
    document: buffer,
    fileName: "horarios.json",
    mimetype: "application/json",
    caption: `📦 Exporté ${eventos.length} horario(s). Guarda este archivo — puedes recuperarlo respondiéndole (reply) con !importar.`,
  });
}
