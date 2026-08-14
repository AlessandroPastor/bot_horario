import { db } from "./db.js";
import { DIAS_LV, type DiaSemana } from "./eventos.js";
import { listarCursos, type Curso } from "./cursos.js";

export interface ClasePlantilla {
  id: number;
  grado: number;
  seccion: string;
  titulo: string;
  hora: string;
  dias: DiaSemana[];
  docenteId: number | null;
  avisoPrevioMin: number;
  createdAt: string;
  updatedAt: string;
}

interface ClasePlantillaRow {
  id: number;
  grado: number;
  seccion: string;
  titulo: string;
  hora: string;
  dias: string;
  docenteId: number | null;
  avisoPrevioMin: number;
  createdAt: string;
  updatedAt: string;
}

function rowToClase(row: ClasePlantillaRow): ClasePlantilla {
  return { ...row, dias: JSON.parse(row.dias) as DiaSemana[] };
}

export interface NuevaClasePlantilla {
  grado: number;
  seccion: string;
  titulo: string;
  hora: string;
  dias: DiaSemana[];
  docenteId?: number | null;
  avisoPrevioMin?: number;
}

export function crearClasePlantilla(input: NuevaClasePlantilla): ClasePlantilla {
  const result = db
    .prepare(
      `INSERT INTO plantilla_horario (grado, seccion, titulo, hora, dias, docenteId, avisoPrevioMin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.grado,
      input.seccion,
      input.titulo,
      input.hora,
      JSON.stringify(input.dias),
      input.docenteId ?? null,
      input.avisoPrevioMin ?? 5,
    );
  return obtenerClasePlantilla(Number(result.lastInsertRowid))!;
}

export function listarPlantilla(grado?: number, seccion?: string): ClasePlantilla[] {
  // Filtros independientes: admite grado solo, grado+sección, o ninguno
  // (todo). Antes, pasar solo `grado` caía al "else" y devolvía la tabla
  // entera sin filtrar — nunca lo disparó ningún llamador existente (todos
  // pasaban ambos o ninguno), pero es la forma correcta de escribirlo.
  let query = `SELECT * FROM plantilla_horario WHERE 1 = 1`;
  const params: (number | string)[] = [];
  if (grado !== undefined) {
    query += ` AND grado = ?`;
    params.push(grado);
  }
  if (seccion !== undefined) {
    query += ` AND seccion = ?`;
    params.push(seccion);
  }
  query += ` ORDER BY grado ASC, seccion ASC, hora ASC`;
  const rows = db.prepare(query).all(...params) as unknown as ClasePlantillaRow[];
  return rows.map(rowToClase);
}

export function obtenerClasePlantilla(id: number): ClasePlantilla | null {
  const row = db.prepare(`SELECT * FROM plantilla_horario WHERE id = ?`).get(id) as
    | ClasePlantillaRow
    | undefined;
  return row ? rowToClase(row) : null;
}

export function actualizarClasePlantilla(id: number, input: NuevaClasePlantilla): boolean {
  const result = db
    .prepare(
      `UPDATE plantilla_horario
       SET grado = ?, seccion = ?, titulo = ?, hora = ?, dias = ?, docenteId = ?, avisoPrevioMin = ?, updatedAt = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.grado,
      input.seccion,
      input.titulo,
      input.hora,
      JSON.stringify(input.dias),
      input.docenteId ?? null,
      input.avisoPrevioMin ?? 5,
      id,
    );
  return result.changes > 0;
}

export function eliminarClasePlantilla(id: number): boolean {
  const result = db.prepare(`DELETE FROM plantilla_horario WHERE id = ?`).run(id);
  return result.changes > 0;
}

/** Copia todas las clases de una sección a otra (útil con 25 combinaciones grado×sección casi idénticas). */
export function clonarSeccion(
  origen: { grado: number; seccion: string },
  destino: { grado: number; seccion: string },
): number {
  const clases = listarPlantilla(origen.grado, origen.seccion);
  for (const clase of clases) {
    crearClasePlantilla({
      grado: destino.grado,
      seccion: destino.seccion,
      titulo: clase.titulo,
      hora: clase.hora,
      dias: clase.dias,
      docenteId: clase.docenteId,
      avisoPrevioMin: clase.avisoPrevioMin,
    });
  }
  return clases.length;
}

/** Cuántas combinaciones grado+sección tienen al menos una clase (de las 25 posibles). Para el dashboard. */
export function contarCombosConClases(): number {
  const row = db
    .prepare(`SELECT COUNT(DISTINCT grado || '-' || seccion) as n FROM plantilla_horario`)
    .get() as { n: number };
  return row.n;
}

// --- Generar horario automáticamente a partir del catálogo de cursos ---

const SECCIONES_GENERADAS = ["A", "B", "C", "D", "E"] as const;

// Los mismos 6 bloques diarios que ya usa la semilla por defecto (ver seed.ts).
const HORAS_GENERADAS = ["08:00", "08:45", "09:30", "10:30", "11:15", "12:00"];

function barajar<T>(arr: readonly T[]): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function ordenDia(a: DiaSemana, b: DiaSemana): number {
  return DIAS_LV.indexOf(a) - DIAS_LV.indexOf(b);
}

/**
 * Ubica un curso dentro de UNA sección: reparte sus `vecesPorSemana` sesiones
 * en bloques hora+días libres, evitando choques con lo ya ocupado en esa
 * sección y con lo ya ocupado por el mismo docente (que dicta las 5
 * secciones, así que no puede estar en dos a la misma hora). Puede generar
 * más de una fila si no cabe todo en un solo bloque horario. Devuelve cuántas
 * sesiones NO se pudieron ubicar (0 = cupo completo).
 */
function colocarCurso(
  curso: Curso,
  seccion: string,
  ocupadoSeccion: Set<string>,
  ocupadoDocente: Map<number, Set<string>>,
): number {
  let restantes = curso.vecesPorSemana;
  const docenteSet =
    curso.docenteId !== null
      ? (ocupadoDocente.get(curso.docenteId) ??
        (() => {
          const s = new Set<string>();
          ocupadoDocente.set(curso.docenteId!, s);
          return s;
        })())
      : null;

  for (const hora of barajar(HORAS_GENERADAS)) {
    if (restantes <= 0) break;
    const diasLibres = barajar(DIAS_LV).filter((dia) => {
      const key = `${dia}-${hora}`;
      return !ocupadoSeccion.has(key) && !docenteSet?.has(key);
    });
    if (diasLibres.length === 0) continue;

    const diasElegidos = diasLibres.slice(0, restantes).sort(ordenDia);
    crearClasePlantilla({
      grado: curso.grado,
      seccion,
      titulo: curso.nombre,
      hora,
      dias: diasElegidos,
      docenteId: curso.docenteId,
      avisoPrevioMin: curso.avisoPrevioMin,
    });
    for (const dia of diasElegidos) {
      const key = `${dia}-${hora}`;
      ocupadoSeccion.add(key);
      docenteSet?.add(key);
    }
    restantes -= diasElegidos.length;
  }
  return restantes;
}

export interface ResultadoGeneracion {
  filasCreadas: number;
  /** Cursos que no cupieron completos (choques de horario/docente sin resolver) — el resto sí se generó. */
  avisos: string[];
}

/**
 * Borra el horario actual de las 5 secciones de este grado y lo vuelve a
 * armar desde cero a partir del catálogo de `cursos` de ese grado, eligiendo
 * día(s) y hora al azar por sección. El mismo docente nunca queda en dos
 * secciones a la misma hora (dicta las 5, en horarios distintos). Si un
 * curso no cabe completo en alguna sección, esa sesión faltante se reporta
 * en `avisos` en vez de fallar silenciosamente o forzar un choque.
 */
export function generarHorarioGrado(grado: number): ResultadoGeneracion {
  const cursos = listarCursos(grado);
  db.prepare(`DELETE FROM plantilla_horario WHERE grado = ?`).run(grado);

  const ocupadoDocente = new Map<number, Set<string>>();
  const avisos: string[] = [];

  for (const seccion of SECCIONES_GENERADAS) {
    const ocupadoSeccion = new Set<string>();
    for (const curso of cursos) {
      const restantes = colocarCurso(curso, seccion, ocupadoSeccion, ocupadoDocente);
      if (restantes > 0) {
        avisos.push(
          `"${curso.nombre}" en ${grado}°${seccion}: solo se ubicaron ${curso.vecesPorSemana - restantes} de ${curso.vecesPorSemana} veces por semana (sin cupo libre para el resto, por choque de horario o del mismo docente en otra sección).`,
        );
      }
    }
  }

  const { n: filasCreadas } = db
    .prepare(`SELECT COUNT(*) as n FROM plantilla_horario WHERE grado = ?`)
    .get(grado) as { n: number };

  return { filasCreadas, avisos };
}
