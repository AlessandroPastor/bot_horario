import { db } from "./db.js";

export interface Docente {
  id: number;
  nombre: string;
  materia: string | null;
  contacto: string | null;
  /** Grados que dicta (1-5 cada uno). Un docente puede dictar cursos en varios grados a la vez. */
  grados: number[];
  createdAt: string;
}

interface DocenteRow {
  id: number;
  nombre: string;
  materia: string | null;
  contacto: string | null;
  grados: string;
  createdAt: string;
}

function rowToDocente(row: DocenteRow): Docente {
  return { ...row, grados: JSON.parse(row.grados) as number[] };
}

export interface NuevoDocente {
  nombre: string;
  materia?: string | null;
  contacto?: string | null;
  grados: number[];
}

export function crearDocente(input: NuevoDocente): Docente {
  const result = db
    .prepare(`INSERT INTO docentes (nombre, materia, contacto, grados) VALUES (?, ?, ?, ?)`)
    .run(input.nombre, input.materia ?? null, input.contacto ?? null, JSON.stringify(input.grados));
  return obtenerDocente(Number(result.lastInsertRowid))!;
}

/** Sin `grado`: todos los docentes. Con `grado`: solo los que dictan ESE grado (entre los que tengan). */
export function listarDocentes(grado?: number): Docente[] {
  const rows = db
    .prepare(`SELECT * FROM docentes ORDER BY nombre ASC`)
    .all() as unknown as DocenteRow[];
  const docentes = rows.map(rowToDocente);
  return grado === undefined ? docentes : docentes.filter((d) => d.grados.includes(grado));
}

export function obtenerDocente(id: number): Docente | null {
  const row = db.prepare(`SELECT * FROM docentes WHERE id = ?`).get(id) as DocenteRow | undefined;
  return row ? rowToDocente(row) : null;
}

export function actualizarDocente(id: number, input: NuevoDocente): boolean {
  const result = db
    .prepare(`UPDATE docentes SET nombre = ?, materia = ?, contacto = ?, grados = ? WHERE id = ?`)
    .run(input.nombre, input.materia ?? null, input.contacto ?? null, JSON.stringify(input.grados), id);
  return result.changes > 0;
}

export function eliminarDocente(id: number): boolean {
  const result = db.prepare(`DELETE FROM docentes WHERE id = ?`).run(id);
  return result.changes > 0;
}
