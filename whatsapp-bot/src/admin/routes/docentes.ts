import { Router } from "express";
import {
  actualizarDocente,
  crearDocente,
  eliminarDocente,
  listarDocentes,
  obtenerDocente,
  type NuevoDocente,
} from "../../db/docentes.js";

export const docentesRouter = Router();

function gradoValido(grado: unknown): grado is number {
  return typeof grado === "number" && Number.isInteger(grado) && grado >= 1 && grado <= 5;
}

function gradosValidos(grados: unknown): grados is number[] {
  return Array.isArray(grados) && grados.length > 0 && grados.every(gradoValido);
}

function datosDocente(body: unknown): NuevoDocente | null {
  const b = body as { nombre?: unknown; materia?: unknown; contacto?: unknown; grados?: unknown } | null;
  if (!b || typeof b.nombre !== "string" || !b.nombre.trim()) return null;
  if (!gradosValidos(b.grados)) return null;
  return {
    nombre: b.nombre.trim(),
    materia: typeof b.materia === "string" && b.materia.trim() ? b.materia.trim() : null,
    contacto: typeof b.contacto === "string" && b.contacto.trim() ? b.contacto.trim() : null,
    // sin duplicados, orden estable — no cambia el significado, solo se ve prolijo en la UI
    grados: [...new Set(b.grados)].sort((a, b) => a - b),
  };
}

docentesRouter.get("/", (req, res) => {
  const grado = req.query.grado !== undefined ? Number(req.query.grado) : undefined;
  res.json(listarDocentes(grado));
});

docentesRouter.get("/:id", (req, res) => {
  const docente = obtenerDocente(Number(req.params.id));
  if (!docente) {
    res.status(404).json({ error: "Docente no encontrado." });
    return;
  }
  res.json(docente);
});

docentesRouter.post("/", (req, res) => {
  const datos = datosDocente(req.body);
  if (!datos) {
    res.status(400).json({ error: "El nombre es obligatorio, y debe elegir al menos un grado (1-5)." });
    return;
  }
  res.status(201).json(crearDocente(datos));
});

docentesRouter.put("/:id", (req, res) => {
  const datos = datosDocente(req.body);
  if (!datos) {
    res.status(400).json({ error: "El nombre es obligatorio, y debe elegir al menos un grado (1-5)." });
    return;
  }
  const id = Number(req.params.id);
  if (!actualizarDocente(id, datos)) {
    res.status(404).json({ error: "Docente no encontrado." });
    return;
  }
  res.json(obtenerDocente(id));
});

docentesRouter.delete("/:id", (req, res) => {
  if (!eliminarDocente(Number(req.params.id))) {
    res.status(404).json({ error: "Docente no encontrado." });
    return;
  }
  res.status(204).end();
});
