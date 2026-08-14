import cron from "node-cron";
import type { WASocket } from "@whiskeysockets/baileys";
import {
  listarTodosActivos,
  marcarEnviadoHoy,
  type DiaSemana,
  type Evento,
} from "../db/eventos.js";
import { formatearDuracion } from "../commands/format.js";

const DIA_CODES: DiaSemana[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

// Cuánto puede atrasarse el aviso (ej. el bot tardó unos minutos en volver a
// conectarse) y todavía dispararse. Más allá de esto ya no tiene sentido
// avisar "empieza en 5 minutos" de algo que pasó hace horas, así que se
// marca como atendido sin enviar nada (evita el mensaje "de mentira").
const VENTANA_ALCANCE_MIN = 10;

let sockRef: WASocket | null = null;

export function setSocket(sock: WASocket): void {
  sockRef = sock;
}

function hoyISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function aplicaHoy(evento: Evento, ahora: Date): boolean {
  if (evento.tipo === "puntual") return evento.fecha === hoyISO(ahora);
  const diaHoy = DIA_CODES[ahora.getDay()];
  return evento.dias?.includes(diaHoy) ?? false;
}

function horaDeHoy(hora: string, ahora: Date): Date {
  const [h, m] = hora.split(":").map(Number);
  const fecha = new Date(ahora);
  fecha.setHours(h, m, 0, 0);
  return fecha;
}

/** Minutos reales que faltan para que empiece (negativo si ya empezó). */
function minutosHastaElEvento(evento: Evento, ahora: Date): number {
  const inicio = horaDeHoy(evento.hora, ahora);
  return Math.round((inicio.getTime() - ahora.getTime()) / 60_000);
}

function mensajeRecordatorio(evento: Evento, ahora: Date): string {
  const minutosReales = minutosHastaElEvento(evento, ahora);
  // El aula/docente (clases) o el lugar (reuniones) vive en `descripcion` —
  // sin esto, el aviso automático solo decía título+hora y había que
  // escribir !listar a mano para ver dónde era.
  const detalle = evento.descripcion ? `\n_${evento.descripcion}_` : "";

  if (minutosReales > 0) {
    return `⏰ Recordatorio: *${evento.titulo}* empieza en ${formatearDuracion(minutosReales)} (${evento.hora}).${detalle}`;
  }
  if (minutosReales === 0) {
    return `⏰ *${evento.titulo}* es ahora mismo (${evento.hora}).${detalle}`;
  }
  return `⏰ *${evento.titulo}* ya empezó hace ${formatearDuracion(-minutosReales)} (${evento.hora}).${detalle}`;
}

export async function revisarEventos(): Promise<void> {
  if (!sockRef) return;
  const ahora = new Date();
  const eventos = listarTodosActivos();

  for (const evento of eventos) {
    if (!aplicaHoy(evento, ahora)) continue;
    if (evento.ultimoEnvio === hoyISO(ahora)) continue;

    const objetivoAviso = horaDeHoy(evento.hora, ahora);
    objetivoAviso.setMinutes(objetivoAviso.getMinutes() - evento.avisoPrevioMin);

    const minutosDesdeElAviso = (ahora.getTime() - objetivoAviso.getTime()) / 60_000;
    if (minutosDesdeElAviso < 0) continue; // todavía no toca

    if (minutosDesdeElAviso > VENTANA_ALCANCE_MIN) {
      // Pasó hace demasiado (ej. el bot estuvo apagado varias horas): ya no
      // avisamos, solo lo marcamos para que no lo vuelva a intentar hoy.
      marcarEnviadoHoy(evento.id, hoyISO(ahora));
      continue;
    }

    try {
      await sockRef.sendMessage(evento.chatId, { text: mensajeRecordatorio(evento, ahora) });
      marcarEnviadoHoy(evento.id, hoyISO(ahora));
    } catch (err) {
      console.error(`Error enviando recordatorio #${evento.id}:`, err);
    }
  }
}

export function iniciarScheduler(): void {
  cron.schedule("* * * * *", () => {
    revisarEventos().catch((err) =>
      console.error("Error revisando recordatorios:", err),
    );
  });
  console.log("Scheduler de recordatorios iniciado (revisa cada minuto) ⏰");
}
