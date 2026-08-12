import { db } from "./db.js";
import { crearEvento, type DiaSemana } from "./eventos.js";

interface ClasePlantilla {
  titulo: string;
  hora: string;
  dias: DiaSemana[];
}

/**
 * Horario semanal de ejemplo para un curso de secundaria en Perú, basado en
 * las áreas curriculares del Currículo Nacional de Educación Básica
 * (Matemática, Comunicación, Inglés, Ciencia y Tecnología, etc.), con turno
 * mañana de 8:00 a 12:45 y periodos de 45 minutos. Se reutiliza para los 5
 * grados de secundaria, cada uno en su propia aula.
 */
const PLANTILLA_HORARIO_SECUNDARIA: ClasePlantilla[] = [
  { titulo: "Matemática", hora: "08:00", dias: ["lun", "mie", "vie"] },
  { titulo: "Matemática", hora: "08:45", dias: ["mar", "jue"] },
  { titulo: "Comunicación", hora: "08:45", dias: ["lun", "vie"] },
  { titulo: "Comunicación", hora: "08:00", dias: ["mar", "jue"] },
  { titulo: "Comunicación", hora: "09:30", dias: ["mie"] },
  { titulo: "Inglés", hora: "09:30", dias: ["lun", "vie"] },
  { titulo: "Inglés", hora: "11:15", dias: ["mie"] },
  { titulo: "Ciencia y Tecnología", hora: "10:30", dias: ["lun", "mar", "mie"] },
  { titulo: "Ciencia y Tecnología", hora: "12:00", dias: ["vie"] },
  { titulo: "Ciencias Sociales", hora: "11:15", dias: ["lun", "jue"] },
  { titulo: "Ciencias Sociales", hora: "08:45", dias: ["mie"] },
  { titulo: "Tutoría (TOE)", hora: "12:00", dias: ["lun"] },
  { titulo: "Educación Física", hora: "10:30", dias: ["mar", "vie"] },
  { titulo: "Arte y Cultura", hora: "11:15", dias: ["mar"] },
  { titulo: "Arte y Cultura", hora: "10:30", dias: ["jue"] },
  {
    titulo: "Desarrollo Personal, Ciudadanía y Cívica",
    hora: "12:00",
    dias: ["mar"],
  },
  {
    titulo: "Desarrollo Personal, Ciudadanía y Cívica",
    hora: "11:15",
    dias: ["vie"],
  },
  { titulo: "Educación para el Trabajo", hora: "12:00", dias: ["mie"] },
  { titulo: "Educación para el Trabajo", hora: "09:30", dias: ["jue"] },
  { titulo: "Educación Religiosa", hora: "12:00", dias: ["jue"] },
];

interface FechaCalendario {
  titulo: string;
  fecha: string;
}

/**
 * Fechas cívicas y feriados oficiales del calendario peruano (2026),
 * limitado a las que caen después de la fecha en que se agrega este
 * módulo, para que aparezcan como próximas y no como eventos ya pasados.
 * Es igual para todos los grados: los eventos del colegio no dependen del
 * grado de cada alumno.
 */
const EVENTOS_CALENDARIO_PERU: FechaCalendario[] = [
  { titulo: "Santa Rosa de Lima (patrona del Perú y América)", fecha: "2026-08-30" },
  { titulo: "Día de la Primavera y la Juventud", fecha: "2026-09-23" },
  { titulo: "Combate de Angamos (Día de la Marina de Guerra del Perú)", fecha: "2026-10-08" },
  {
    titulo: "Día de los Pueblos Originarios y del Diálogo Intercultural",
    fecha: "2026-10-12",
  },
  { titulo: "Día de Todos los Santos", fecha: "2026-11-01" },
  { titulo: "Inmaculada Concepción", fecha: "2026-12-08" },
  { titulo: "Batalla de Ayacucho", fecha: "2026-12-09" },
  { titulo: "Navidad", fecha: "2026-12-25" },
];

function tieneCalendario(chatId: string): boolean {
  const row = db
    .prepare(`SELECT 1 FROM calendario_sembrado WHERE chatId = ?`)
    .get(chatId);
  return row !== undefined;
}

/** Crea las fechas del calendario cívico para el chat, una sola vez (es igual para todos los grados). */
export function sembrarCalendarioSiFalta(chatId: string): void {
  if (tieneCalendario(chatId)) return;

  for (const evento of EVENTOS_CALENDARIO_PERU) {
    crearEvento({
      titulo: evento.titulo,
      chatId,
      tipo: "puntual",
      fecha: evento.fecha,
      hora: "08:00",
      avisoPrevioMin: 0,
    });
  }

  db.prepare(`INSERT OR IGNORE INTO calendario_sembrado (chatId) VALUES (?)`).run(chatId);
}

export const SECCIONES = ["A", "B", "C", "D", "E"] as const;
export type Seccion = (typeof SECCIONES)[number];

/** Aula fija por combinación grado+sección (101-105, 201-205, ... 501-505), para tener "salones" distintos por sección. */
export function aulaDe(grado: number, seccion: string): string {
  const indice = SECCIONES.indexOf(seccion as Seccion) + 1;
  return `${grado}0${indice}`;
}

/** Crea el horario de clases del grado y sección indicados (ej. 3°B) para el chat. Devuelve cuántos horarios creó. */
export function sembrarHorarioSeccion(chatId: string, grado: number, seccion: string): number {
  const aula = aulaDe(grado, seccion);
  let creados = 0;

  for (const clase of PLANTILLA_HORARIO_SECUNDARIA) {
    crearEvento({
      titulo: clase.titulo,
      descripcion: `${grado}°${seccion} de Secundaria — Aula ${aula}`,
      chatId,
      tipo: "recurrente_semanal",
      dias: clase.dias,
      hora: clase.hora,
      avisoPrevioMin: 5,
    });
    creados++;
  }

  return creados;
}
