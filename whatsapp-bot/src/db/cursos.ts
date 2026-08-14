import { db } from "./db.js";

export interface Curso {
  id: number;
  grado: number;
  nombre: string;
  docenteId: number | null;
  vecesPorSemana: number;
  avisoPrevioMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface NuevoCurso {
  grado: number;
  nombre: string;
  docenteId?: number | null;
  vecesPorSemana?: number;
  avisoPrevioMin?: number;
}

export function crearCurso(input: NuevoCurso): Curso {
  const result = db
    .prepare(
      `INSERT INTO cursos (grado, nombre, docenteId, vecesPorSemana, avisoPrevioMin)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.grado,
      input.nombre,
      input.docenteId ?? null,
      input.vecesPorSemana ?? 2,
      input.avisoPrevioMin ?? 5,
    );
  return obtenerCurso(Number(result.lastInsertRowid))!;
}

export function listarCursos(grado?: number): Curso[] {
  if (grado !== undefined) {
    return db
      .prepare(`SELECT * FROM cursos WHERE grado = ? ORDER BY nombre ASC`)
      .all(grado) as unknown as Curso[];
  }
  return db
    .prepare(`SELECT * FROM cursos ORDER BY grado ASC, nombre ASC`)
    .all() as unknown as Curso[];
}

export function obtenerCurso(id: number): Curso | null {
  const row = db.prepare(`SELECT * FROM cursos WHERE id = ?`).get(id) as Curso | undefined;
  return row ?? null;
}

export function actualizarCurso(id: number, input: NuevoCurso): boolean {
  const result = db
    .prepare(
      `UPDATE cursos
       SET grado = ?, nombre = ?, docenteId = ?, vecesPorSemana = ?, avisoPrevioMin = ?, updatedAt = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.grado,
      input.nombre,
      input.docenteId ?? null,
      input.vecesPorSemana ?? 2,
      input.avisoPrevioMin ?? 5,
      id,
    );
  return result.changes > 0;
}

export function eliminarCurso(id: number): boolean {
  const result = db.prepare(`DELETE FROM cursos WHERE id = ?`).run(id);
  return result.changes > 0;
}
