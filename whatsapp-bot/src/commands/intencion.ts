import type { Evento } from "../db/eventos.js";

export type Tema = "horario" | "evento" | "todo";
export type Alcance = "hoy" | "manana" | "semana" | "todos";

export interface Intencion {
  tema: Tema;
  alcance: Alcance;
}

const PALABRAS_HORARIO = /\b(horario|horarios|clase|clases)\b/;
const PALABRAS_EVENTO = /\b(evento|eventos)\b/;
const PALABRA_HOY = /\bhoy\b/;
const PALABRA_MANANA = /\bmanana\b/;
const PALABRA_SEMANA = /\bsemana\b/;
const PALABRA_TODO = /\b(todo|toda|todos|todas|completo|completa)\b/;
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

/**
 * Reconoce preguntas en lenguaje natural sobre horarios/eventos (sin el
 * prefijo "!"), ej. "quiero saber mi horario", "que clases tengo hoy",
 * "y de mañana?", "que eventos hay esta semana". Distingue el tema (horario
 * vs. evento) para no mezclar clases con el calendario cívico cuando piden
 * solo uno de los dos. Devuelve null si el mensaje no parece estar
 * preguntando por eso, para no responder a cualquier mensaje suelto.
 *
 * "hoy" y "mañana" solos (sin decir "horario") también cuentan como
 * pregunta de horario: es la forma más natural de seguir la conversación
 * ("¿cuál es mi horario?" → "y de mañana?"), sin tener que repetir la
 * palabra "horario" cada vez.
 *
 * Si preguntan por el "horario" sin decir "hoy"/"mañana"/"semana"/"todo", se
 * asume que quieren el día de hoy (es lo más natural: "¿cuál es mi
 * horario?" casi siempre significa "¿qué tengo hoy?"). La lista completa
 * sigue disponible diciendo "toda mi semana"/"horario completo", o con
 * !listar / !semana. Para "eventos" el default es mostrar todos los
 * próximos, ya que son fechas puntuales (no algo diario) y casi nunca caen
 * justo hoy o mañana.
 */
export function detectarIntencion(textoCrudo: string): Intencion | null {
  const texto = normalizar(textoCrudo);

  const mencionaHorario = PALABRAS_HORARIO.test(texto);
  const mencionaEvento = PALABRAS_EVENTO.test(texto);
  const mencionaHoy = PALABRA_HOY.test(texto);
  const mencionaManana = PALABRA_MANANA.test(texto);
  if (!mencionaHorario && !mencionaEvento && !mencionaHoy && !mencionaManana) return null;

  const tema: Tema =
    mencionaHorario && mencionaEvento ? "todo" : mencionaEvento ? "evento" : "horario";

  let alcance: Alcance;
  if (PALABRA_SEMANA.test(texto)) alcance = "semana";
  else if (mencionaManana) alcance = "manana";
  else if (mencionaHoy) alcance = "hoy";
  else if (PALABRA_TODO.test(texto)) alcance = "todos";
  else alcance = tema === "horario" ? "hoy" : "todos";

  return { tema, alcance };
}

/** Si un evento debe mostrarse según el tema pedido (horario = solo clases, evento = solo calendario cívico). */
export function perteneceATema(evento: Evento, tema: Tema): boolean {
  if (tema === "todo") return true;
  if (tema === "evento") return evento.tipo === "puntual";
  return evento.tipo !== "puntual";
}
