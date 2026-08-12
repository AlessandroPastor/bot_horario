import { listarEventos, type DiaSemana } from "../db/eventos.js";
import { diasFaltantes, faltanTexto, formatearFecha } from "./format.js";
import { perteneceATema, type Tema } from "./intencion.js";

const DIAS_ORDEN: DiaSemana[] = ["lun", "mar", "mie", "jue", "vie"];
const NOMBRES: Record<DiaSemana, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
};

export function resumenSemana(chatId: string, tema: Tema = "todo"): string {
  const eventos = listarEventos(chatId, { soloActivos: true }).filter((e) =>
    perteneceATema(e, tema),
  );
  const bloques: string[] = [];

  for (const dia of DIAS_ORDEN) {
    const delDia = eventos.filter(
      (e) => e.tipo !== "puntual" && e.dias?.includes(dia),
    );
    if (delDia.length === 0) continue;
    const lineas = delDia
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((e) => `  • ${e.hora} — ${e.titulo} (#${e.id})`);
    bloques.push(`*${NOMBRES[dia]}*\n${lineas.join("\n")}`);
  }

  // Todas las próximas fechas puntuales (no solo las de esta semana), para
  // no dejar fuera eventos del calendario cívico que caen más adelante.
  const puntuales = eventos
    .filter((e) => e.tipo === "puntual" && e.fecha && (diasFaltantes(e.fecha) ?? -1) >= 0)
    .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));

  if (puntuales.length > 0) {
    bloques.push(
      "*Próximas fechas*\n" +
        puntuales
          .map((e) => {
            const faltan = faltanTexto(diasFaltantes(e.fecha));
            return `  • ${formatearFecha(e.fecha)}${faltan ? ` (${faltan})` : ""}, ${e.hora} — ${e.titulo} (#${e.id})`;
          })
          .join("\n"),
    );
  }

  if (bloques.length === 0) {
    return "No tienes nada programado esta semana.";
  }
  return bloques.join("\n\n");
}
