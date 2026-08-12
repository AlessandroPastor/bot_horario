import type { DiaSemana, Evento } from "../db/eventos.js";

const NOMBRES_DIAS: Record<DiaSemana, string> = {
  lun: "Lun",
  mar: "Mar",
  mie: "Mié",
  jue: "Jue",
  vie: "Vie",
  sab: "Sáb",
  dom: "Dom",
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-08-30" -> "30 de agosto" (o "30 de agosto de 2027" si no es el año actual). */
export function formatearFecha(fechaISO: string | null | undefined): string {
  if (!fechaISO) return "fecha por definir";

  const partes = fechaISO.split("-").map(Number);
  if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) return fechaISO;

  const [anio, mes, dia] = partes;
  const anioActual = new Date().getFullYear();
  const base = `${dia} de ${MESES[mes - 1]}`;
  return anio === anioActual ? base : `${base} de ${anio}`;
}

function hoySinHora(): Date {
  return new Date(new Date().toDateString());
}

/** Días de diferencia entre hoy y la fecha (positivo = futuro, negativo = pasado). */
export function diasFaltantes(fechaISO: string | null | undefined): number | null {
  if (!fechaISO) return null;
  const fecha = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return null;
  return Math.round((fecha.getTime() - hoySinHora().getTime()) / 86_400_000);
}

/** Convierte el número de días en un texto natural: "¡hoy!", "mañana", "en 5 días", "hace 2 días". */
export function faltanTexto(dias: number | null): string | null {
  if (dias === null) return null;
  if (dias === 0) return "¡hoy!";
  if (dias === 1) return "mañana";
  if (dias > 1) return `en ${dias} días`;
  if (dias === -1) return "ayer";
  return `hace ${Math.abs(dias)} días`;
}

/** Minutos (positivos, ej. 95) -> "1 hora y 35 minutos". Para recordatorios en tiempo real, no en bloques fijos. */
export function formatearDuracion(minutosAbs: number): string {
  const horas = Math.floor(minutosAbs / 60);
  const mins = minutosAbs % 60;
  const partes: string[] = [];
  if (horas > 0) partes.push(`${horas} hora${horas === 1 ? "" : "s"}`);
  if (mins > 0 || horas === 0) partes.push(`${mins} minuto${mins === 1 ? "" : "s"}`);
  return partes.join(" y ");
}

export function resumenEvento(evento: Evento, titulo = ""): string {
  let cuando: string;
  if (evento.tipo === "puntual") {
    const faltan = faltanTexto(diasFaltantes(evento.fecha));
    cuando = `📅 ${formatearFecha(evento.fecha)}${faltan ? ` (${faltan})` : ""}`;
  } else {
    cuando = `🔁 ${(evento.dias ?? []).map((d) => NOMBRES_DIAS[d]).join(", ")}`;
  }

  const aviso =
    evento.avisoPrevioMin > 0
      ? ` (aviso ${evento.avisoPrevioMin} min antes)`
      : "";

  const lineas = [
    titulo,
    `#${evento.id} — *${evento.titulo}*`,
    `${cuando} a las ${evento.hora}${aviso}`,
    evento.descripcion ? `   _${evento.descripcion}_` : null,
  ].filter(Boolean);

  return lineas.join("\n");
}

export function listaEventos(eventos: Evento[]): string {
  if (eventos.length === 0) {
    return "No tienes horarios guardados todavía.";
  }
  return eventos
    .map((e) => resumenEvento(e) + (e.activo ? "" : " (pausado)"))
    .join("\n\n");
}
