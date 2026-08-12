import { listarEventos, type DiaSemana } from "../db/eventos.js";
import { perteneceATema, type Tema } from "./intencion.js";

const DIA_CODES: DiaSemana[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resumenDia(
  chatId: string,
  tema: Tema,
  offsetDias: number,
  etiqueta: string,
): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + offsetDias);

  const eventos = listarEventos(chatId, { soloActivos: true }).filter((e) =>
    perteneceATema(e, tema),
  );
  const diaCodigo = DIA_CODES[fecha.getDay()];
  const fechaObjetivo = fechaISO(fecha);

  const delDia = eventos.filter((e) =>
    e.tipo === "puntual" ? e.fecha === fechaObjetivo : e.dias?.includes(diaCodigo),
  );

  if (delDia.length === 0) {
    return `No tienes nada programado para ${etiqueta.toLowerCase()}. 🎉`;
  }

  return (
    `*${etiqueta}:*\n` +
    delDia
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((e) => `• ${e.hora} — ${e.titulo} (#${e.id})`)
      .join("\n")
  );
}

export function resumenHoy(chatId: string, tema: Tema = "todo"): string {
  return resumenDia(chatId, tema, 0, "Hoy");
}

export function resumenManana(chatId: string, tema: Tema = "todo"): string {
  return resumenDia(chatId, tema, 1, "Mañana");
}
