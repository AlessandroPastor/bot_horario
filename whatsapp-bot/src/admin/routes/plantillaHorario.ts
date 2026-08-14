import { Router } from "express";
import type { DiaSemana } from "../../db/eventos.js";
import {
  actualizarClasePlantilla,
  clonarSeccion,
  crearClasePlantilla,
  eliminarClasePlantilla,
  listarPlantilla,
  obtenerClasePlantilla,
  type NuevaClasePlantilla,
} from "../../db/plantillaHorario.js";
import { SECCIONES } from "../../db/seed.js";

export const plantillaHorarioRouter = Router();

const DIAS_VALIDOS: DiaSemana[] = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function gradoValido(grado: unknown): grado is number {
  return typeof grado === "number" && Number.isInteger(grado) && grado >= 1 && grado <= 5;
}

function seccionValida(seccion: unknown): seccion is string {
  return typeof seccion === "string" && (SECCIONES as readonly string[]).includes(seccion);
}

function datosClase(body: unknown): NuevaClasePlantilla | null {
  const b = body as Partial<NuevaClasePlantilla> | null;
  if (!b) return null;
  if (!gradoValido(b.grado) || !seccionValida(b.seccion)) return null;
  if (typeof b.titulo !== "string" || !b.titulo.trim()) return null;
  if (typeof b.hora !== "string" || !HORA_VALIDA.test(b.hora)) return null;
  if (!Array.isArray(b.dias) || b.dias.length === 0 || !b.dias.every((d) => DIAS_VALIDOS.includes(d as DiaSemana))) {
    return null;
  }
  const docenteId =
    b.docenteId === null || b.docenteId === undefined ? null : Number(b.docenteId);
  const avisoPrevioMin =
    typeof b.avisoPrevioMin === "number" && Number.isInteger(b.avisoPrevioMin) && b.avisoPrevioMin >= 0
      ? b.avisoPrevioMin
      : 5;

  return {
    grado: b.grado,
    seccion: b.seccion,
    titulo: b.titulo.trim(),
    hora: b.hora,
    dias: b.dias as DiaSemana[],
    docenteId,
    avisoPrevioMin,
  };
}

plantillaHorarioRouter.get("/", (req, res) => {
  const grado = req.query.grado !== undefined ? Number(req.query.grado) : undefined;
  const seccion = typeof req.query.seccion === "string" ? req.query.seccion : undefined;
  res.json(listarPlantilla(grado, seccion));
});

plantillaHorarioRouter.get("/:id", (req, res) => {
  const clase = obtenerClasePlantilla(Number(req.params.id));
  if (!clase) {
    res.status(404).json({ error: "Clase no encontrada." });
    return;
  }
  res.json(clase);
});

plantillaHorarioRouter.post("/clonar", (req, res) => {
  const { origen, destino } = req.body ?? {};
  if (
    !origen ||
    !destino ||
    !gradoValido(origen.grado) ||
    !seccionValida(origen.seccion) ||
    !gradoValido(destino.grado) ||
    !seccionValida(destino.seccion)
  ) {
    res.status(400).json({ error: "Origen/destino inválidos (grado 1-5, sección A-E)." });
    return;
  }
  const creadas = clonarSeccion(
    { grado: origen.grado, seccion: origen.seccion },
    { grado: destino.grado, seccion: destino.seccion },
  );
  res.status(201).json({ creadas });
});

plantillaHorarioRouter.post("/", (req, res) => {
  const datos = datosClase(req.body);
  if (!datos) {
    res.status(400).json({
      error: "Datos inválidos (grado 1-5, sección A-E, título, hora HH:mm, días válidos).",
    });
    return;
  }
  res.status(201).json(crearClasePlantilla(datos));
});

plantillaHorarioRouter.put("/:id", (req, res) => {
  const datos = datosClase(req.body);
  if (!datos) {
    res.status(400).json({
      error: "Datos inválidos (grado 1-5, sección A-E, título, hora HH:mm, días válidos).",
    });
    return;
  }
  const id = Number(req.params.id);
  if (!actualizarClasePlantilla(id, datos)) {
    res.status(404).json({ error: "Clase no encontrada." });
    return;
  }
  res.json(obtenerClasePlantilla(id));
});

plantillaHorarioRouter.delete("/:id", (req, res) => {
  if (!eliminarClasePlantilla(Number(req.params.id))) {
    res.status(404).json({ error: "Clase no encontrada." });
    return;
  }
  res.status(204).end();
});
