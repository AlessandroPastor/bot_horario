import { Router } from "express";
import {
  actualizarReunion,
  crearReunion,
  eliminarReunion,
  listarReuniones,
  obtenerReunion,
  type NuevaReunion,
} from "../../db/reuniones.js";
import { SECCIONES } from "../../db/seed.js";

export const reunionesRouter = Router();

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function gradoValido(grado: unknown): grado is number | null {
  if (grado === null || grado === undefined) return true;
  return typeof grado === "number" && Number.isInteger(grado) && grado >= 1 && grado <= 5;
}

function seccionValida(seccion: unknown): seccion is string | null {
  if (seccion === null || seccion === undefined) return true;
  return typeof seccion === "string" && (SECCIONES as readonly string[]).includes(seccion);
}

function datosReunion(body: unknown): NuevaReunion | null {
  const b = body as Partial<NuevaReunion> | null;
  if (!b) return null;
  if (typeof b.titulo !== "string" || !b.titulo.trim()) return null;
  if (typeof b.fecha !== "string" || !FECHA_VALIDA.test(b.fecha)) return null;
  if (Number.isNaN(new Date(`${b.fecha}T00:00:00`).getTime())) return null;
  if (typeof b.hora !== "string" || !HORA_VALIDA.test(b.hora)) return null;
  if (!gradoValido(b.grado ?? null) || !seccionValida(b.seccion ?? null)) return null;
  // Una sección sin grado no tiene sentido (A-E se repite por cada grado).
  if ((b.seccion ?? null) !== null && (b.grado ?? null) === null) return null;

  const avisoPrevioMin =
    typeof b.avisoPrevioMin === "number" && Number.isInteger(b.avisoPrevioMin) && b.avisoPrevioMin >= 0
      ? b.avisoPrevioMin
      : 60;

  return {
    titulo: b.titulo.trim(),
    fecha: b.fecha,
    hora: b.hora,
    lugar: typeof b.lugar === "string" && b.lugar.trim() ? b.lugar.trim() : null,
    grado: b.grado ?? null,
    seccion: b.seccion ?? null,
    avisoPrevioMin,
  };
}

reunionesRouter.get("/", (_req, res) => {
  res.json(listarReuniones());
});

reunionesRouter.get("/:id", (req, res) => {
  const reunion = obtenerReunion(Number(req.params.id));
  if (!reunion) {
    res.status(404).json({ error: "Reunión no encontrada." });
    return;
  }
  res.json(reunion);
});

reunionesRouter.post("/", (req, res) => {
  const datos = datosReunion(req.body);
  if (!datos) {
    res.status(400).json({
      error:
        "Datos inválidos (título, fecha AAAA-MM-DD, hora HH:mm, grado 1-5 o vacío, sección A-E o vacía — sin grado no puede haber sección).",
    });
    return;
  }
  const { reunion, avisados } = crearReunion(datos);
  res.status(201).json({ ...reunion, avisados });
});

reunionesRouter.put("/:id", (req, res) => {
  const datos = datosReunion(req.body);
  if (!datos) {
    res.status(400).json({
      error:
        "Datos inválidos (título, fecha AAAA-MM-DD, hora HH:mm, grado 1-5 o vacío, sección A-E o vacía — sin grado no puede haber sección).",
    });
    return;
  }
  const id = Number(req.params.id);
  const { actualizada, avisados } = actualizarReunion(id, datos);
  if (!actualizada) {
    res.status(404).json({ error: "Reunión no encontrada." });
    return;
  }
  res.json({ ...obtenerReunion(id), avisados });
});

reunionesRouter.delete("/:id", (req, res) => {
  if (!eliminarReunion(Number(req.params.id))) {
    res.status(404).json({ error: "Reunión no encontrada." });
    return;
  }
  res.status(204).end();
});
