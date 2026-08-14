import { Router } from "express";
import {
  actualizarCurso,
  crearCurso,
  eliminarCurso,
  listarCursos,
  obtenerCurso,
  type NuevoCurso,
} from "../../db/cursos.js";
import { listarDocentes } from "../../db/docentes.js";
import { generarHorarioGrado } from "../../db/plantillaHorario.js";

export const cursosRouter = Router();

function gradoValido(grado: unknown): grado is number {
  return typeof grado === "number" && Number.isInteger(grado) && grado >= 1 && grado <= 5;
}

function datosCurso(body: unknown): NuevoCurso | null {
  const b = body as Partial<NuevoCurso> | null;
  if (!b) return null;
  if (!gradoValido(b.grado)) return null;
  if (typeof b.nombre !== "string" || !b.nombre.trim()) return null;
  const docenteId =
    b.docenteId === null || b.docenteId === undefined ? null : Number(b.docenteId);
  const vecesPorSemana =
    typeof b.vecesPorSemana === "number" && Number.isInteger(b.vecesPorSemana) &&
    b.vecesPorSemana >= 1 && b.vecesPorSemana <= 5
      ? b.vecesPorSemana
      : 2;
  const avisoPrevioMin =
    typeof b.avisoPrevioMin === "number" && Number.isInteger(b.avisoPrevioMin) && b.avisoPrevioMin >= 0
      ? b.avisoPrevioMin
      : 5;

  return { grado: b.grado, nombre: b.nombre.trim(), docenteId, vecesPorSemana, avisoPrevioMin };
}

cursosRouter.get("/", (req, res) => {
  const grado = req.query.grado !== undefined ? Number(req.query.grado) : undefined;
  res.json(listarCursos(grado));
});

cursosRouter.get("/:id", (req, res) => {
  const curso = obtenerCurso(Number(req.params.id));
  if (!curso) {
    res.status(404).json({ error: "Curso no encontrado." });
    return;
  }
  res.json(curso);
});

cursosRouter.post("/", (req, res) => {
  const datos = datosCurso(req.body);
  if (!datos) {
    res.status(400).json({
      error: "Datos inválidos (grado 1-5, nombre, veces por semana entre 1 y 5).",
    });
    return;
  }
  res.status(201).json(crearCurso(datos));
});

cursosRouter.put("/:id", (req, res) => {
  const datos = datosCurso(req.body);
  if (!datos) {
    res.status(400).json({
      error: "Datos inválidos (grado 1-5, nombre, veces por semana entre 1 y 5).",
    });
    return;
  }
  const id = Number(req.params.id);
  if (!actualizarCurso(id, datos)) {
    res.status(404).json({ error: "Curso no encontrado." });
    return;
  }
  res.json(obtenerCurso(id));
});

cursosRouter.delete("/:id", (req, res) => {
  if (!eliminarCurso(Number(req.params.id))) {
    res.status(404).json({ error: "Curso no encontrado." });
    return;
  }
  res.status(204).end();
});

// Genera (o regenera desde cero) el horario de las 5 secciones de un grado,
// a partir de su catálogo de cursos. No es un CRUD de "cursos" en sí, pero
// vive acá porque opera sobre ese catálogo.
cursosRouter.post("/generar-horario", (req, res) => {
  const grado = Number((req.body as { grado?: unknown } | null)?.grado);
  if (!gradoValido(grado)) {
    res.status(400).json({ error: "Grado inválido (debe ser 1-5)." });
    return;
  }
  // Regla fija: solo se puede generar si ya existen docentes Y cursos. Sin
  // alguno de los dos, no hay nada consistente que generar.
  if (listarDocentes().length === 0) {
    res.status(400).json({ error: "Todavía no hay ningún docente creado. Crea al menos uno antes de generar." });
    return;
  }
  if (listarCursos(grado).length === 0) {
    res.status(400).json({ error: "Este grado todavía no tiene ningún curso creado." });
    return;
  }
  res.json(generarHorarioGrado(grado));
});
