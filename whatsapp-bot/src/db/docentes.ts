import { db } from "./db.js";

export interface Docente {
  id: number;
  nombre: string;
  materia: string | null;
  contacto: string | null;
  /** Grado que dicta (1-5). null = todavía sin asignar (docentes creados antes de este campo). */
  grado: number | null;
  createdAt: string;
}

export interface NuevoDocente {
  nombre: string;
  materia?: string | null;
  contacto?: string | null;
  grado?: number | null;
}

export function crearDocente(input: NuevoDocente): Docente {
  const result = db
    .prepare(`INSERT INTO docentes (nombre, materia, contacto, grado) VALUES (?, ?, ?, ?)`)
    .run(input.nombre, input.materia ?? null, input.contacto ?? null, input.grado ?? null);
  return obtenerDocente(Number(result.lastInsertRowid))!;
}

export function listarDocentes(grado?: number): Docente[] {
  if (grado !== undefined) {
    return db
      .prepare(`SELECT * FROM docentes WHERE grado = ? ORDER BY nombre ASC`)
      .all(grado) as unknown as Docente[];
  }
  return db
    .prepare(`SELECT * FROM docentes ORDER BY nombre ASC`)
    .all() as unknown as Docente[];
}

export function obtenerDocente(id: number): Docente | null {
  const row = db.prepare(`SELECT * FROM docentes WHERE id = ?`).get(id) as
    | Docente
    | undefined;
  return row ?? null;
}

export function actualizarDocente(id: number, input: NuevoDocente): boolean {
  const result = db
    .prepare(`UPDATE docentes SET nombre = ?, materia = ?, contacto = ?, grado = ? WHERE id = ?`)
    .run(input.nombre, input.materia ?? null, input.contacto ?? null, input.grado ?? null, id);
  return result.changes > 0;
}

export function eliminarDocente(id: number): boolean {
  const result = db.prepare(`DELETE FROM docentes WHERE id = ?`).run(id);
  return result.changes > 0;
}
