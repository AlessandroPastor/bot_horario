import { db } from "./db.js";
import { crearEvento, type DiaSemana } from "./eventos.js";
import { obtenerDocente } from "./docentes.js";
import { crearClasePlantilla, listarPlantilla } from "./plantillaHorario.js";
import { crearFechaCivica, listarCalendarioCivico } from "./calendarioCivico.js";

interface ClasePlantillaBase {
  titulo: string;
  hora: string;
  dias: DiaSemana[];
}

/**
 * Contenido inicial (una sola vez, ver `sembrarPlantillasPorDefecto`) basado
 * en las áreas curriculares del Currículo Nacional de Educación Básica
 * (Matemática, Comunicación, Inglés, Ciencia y Tecnología, etc.), con turno
 * mañana de 8:00 a 12:45 y periodos de 45 minutos. A partir de acá vive en
 * la tabla `plantilla_horario` y es editable desde el panel de admin.
 */
const PLANTILLA_HORARIO_SECUNDARIA: ClasePlantillaBase[] = [
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

interface FechaCalendarioBase {
  titulo: string;
  fecha: string;
}

/**
 * Fechas cívicas y feriados oficiales del calendario peruano (2026), contenido
 * inicial de `calendario_civico` (editable desde el panel a partir de acá).
 */
const EVENTOS_CALENDARIO_PERU: FechaCalendarioBase[] = [
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

export const SECCIONES = ["A", "B", "C", "D", "E"] as const;
export type Seccion = (typeof SECCIONES)[number];
const GRADOS = [1, 2, 3, 4, 5] as const;

/** Aula fija por combinación grado+sección (101-105, 201-205, ... 501-505), para tener "salones" distintos por sección. */
export function aulaDe(grado: number, seccion: string): string {
  const indice = SECCIONES.indexOf(seccion as Seccion) + 1;
  return `${grado}0${indice}`;
}

function semillaEstado(): { horarioSembrado: boolean; calendarioSembrado: boolean } {
  const row = db.prepare(`SELECT * FROM semilla_estado WHERE id = 1`).get() as {
    horarioSembrado: number;
    calendarioSembrado: number;
  };
  return {
    horarioSembrado: row.horarioSembrado === 1,
    calendarioSembrado: row.calendarioSembrado === 1,
  };
}

/**
 * Siembra el contenido inicial de `plantilla_horario` y `calendario_civico`
 * UNA sola vez en la vida de la base (marcado en `semilla_estado`, no "si
 * está vacía" — así no se re-siembra si el admin borra todo a propósito).
 * Se llama al arrancar el proceso, antes de que el bot atienda mensajes.
 */
export function sembrarPlantillasPorDefecto(): void {
  const estado = semillaEstado();

  if (!estado.horarioSembrado) {
    for (const grado of GRADOS) {
      for (const seccion of SECCIONES) {
        for (const clase of PLANTILLA_HORARIO_SECUNDARIA) {
          crearClasePlantilla({
            grado,
            seccion,
            titulo: clase.titulo,
            hora: clase.hora,
            dias: clase.dias,
            avisoPrevioMin: 5,
          });
        }
      }
    }
    db.prepare(`UPDATE semilla_estado SET horarioSembrado = 1 WHERE id = 1`).run();
  }

  if (!estado.calendarioSembrado) {
    for (const evento of EVENTOS_CALENDARIO_PERU) {
      crearFechaCivica({ titulo: evento.titulo, fecha: evento.fecha });
    }
    db.prepare(`UPDATE semilla_estado SET calendarioSembrado = 1 WHERE id = 1`).run();
  }
}

function tieneCalendario(chatId: string): boolean {
  const row = db
    .prepare(`SELECT 1 FROM calendario_sembrado WHERE chatId = ?`)
    .get(chatId);
  return row !== undefined;
}

/** Crea las fechas del calendario cívico para el chat, una sola vez (es igual para todos los grados/secciones). */
export function sembrarCalendarioSiFalta(chatId: string): void {
  if (tieneCalendario(chatId)) return;

  for (const evento of listarCalendarioCivico()) {
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

/** Crea el horario de clases del grado y sección indicados (ej. 3°B) para el chat, leyendo la plantilla editable. Devuelve cuántos horarios creó. */
export function sembrarHorarioSeccion(chatId: string, grado: number, seccion: string): number {
  const aula = aulaDe(grado, seccion);
  let creados = 0;

  for (const clase of listarPlantilla(grado, seccion)) {
    const docente = clase.docenteId ? obtenerDocente(clase.docenteId) : null;
    const descripcion = `${grado}°${seccion} de Secundaria — Aula ${aula}${docente ? ` — Prof. ${docente.nombre}` : ""}`;

    crearEvento({
      titulo: clase.titulo,
      descripcion,
      chatId,
      tipo: "recurrente_semanal",
      dias: clase.dias,
      hora: clase.hora,
      avisoPrevioMin: clase.avisoPrevioMin,
    });
    creados++;
  }

  return creados;
}
