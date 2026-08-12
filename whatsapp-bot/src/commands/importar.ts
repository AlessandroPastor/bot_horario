import {
  downloadContentFromMessage,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import {
  crearEvento,
  type DiaSemana,
  type TipoEvento,
} from "../db/eventos.js";

const TIPOS_VALIDOS: TipoEvento[] = [
  "recurrente_LV",
  "recurrente_semanal",
  "puntual",
];
const DIAS_VALIDOS: DiaSemana[] = [
  "lun",
  "mar",
  "mie",
  "jue",
  "vie",
  "sab",
  "dom",
];

interface EventoImportado {
  titulo?: unknown;
  descripcion?: unknown;
  tipo?: unknown;
  dias?: unknown;
  fecha?: unknown;
  hora?: unknown;
  avisoPrevioMin?: unknown;
}

function esEventoValido(e: EventoImportado): boolean {
  if (typeof e.titulo !== "string" || !e.titulo.trim()) return false;
  if (typeof e.tipo !== "string" || !TIPOS_VALIDOS.includes(e.tipo as TipoEvento)) {
    return false;
  }
  if (typeof e.hora !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(e.hora)) {
    return false;
  }
  if (e.tipo === "puntual") {
    return typeof e.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.fecha);
  }
  return (
    Array.isArray(e.dias) &&
    e.dias.length > 0 &&
    e.dias.every((d) => DIAS_VALIDOS.includes(d as DiaSemana))
  );
}

export async function importarEventos(
  chatId: string,
  msg: proto.IWebMessageInfo,
): Promise<string> {
  const documento =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ?.documentMessage;

  if (!documento) {
    return "Para importar, responde (reply) al archivo .json exportado con !importar.";
  }

  try {
    const stream = await downloadContentFromMessage(documento, "document");
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk as Buffer]);
    }

    const datos: unknown = JSON.parse(buffer.toString("utf-8"));
    if (!Array.isArray(datos)) {
      return "El archivo no tiene el formato esperado (debe ser una lista de horarios).";
    }

    let importados = 0;
    let invalidos = 0;

    for (const item of datos as EventoImportado[]) {
      if (!esEventoValido(item)) {
        invalidos++;
        continue;
      }
      crearEvento({
        titulo: String(item.titulo),
        descripcion: typeof item.descripcion === "string" ? item.descripcion : null,
        chatId,
        tipo: item.tipo as TipoEvento,
        dias: (item.dias as DiaSemana[] | undefined) ?? null,
        fecha: (item.fecha as string | undefined) ?? null,
        hora: String(item.hora),
        avisoPrevioMin: Number.isInteger(item.avisoPrevioMin)
          ? (item.avisoPrevioMin as number)
          : 0,
      });
      importados++;
    }

    const resumen = [`✅ Importé ${importados} horario(s).`];
    if (invalidos > 0) {
      resumen.push(`⚠️ ${invalidos} entrada(s) no válida(s), se ignoraron.`);
    }
    return resumen.join("\n");
  } catch (err) {
    console.error("Error importando horarios:", err);
    return "No pude leer ese archivo. Asegúrate de responder al .json exportado con !importar.";
  }
}
