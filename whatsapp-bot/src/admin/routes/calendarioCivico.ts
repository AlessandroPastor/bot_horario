import { Router } from "express";
import {
  actualizarFechaCivica,
  crearFechaCivica,
  eliminarFechaCivica,
  listarCalendarioCivico,
  obtenerFechaCivica,
  type NuevaFechaCivica,
} from "../../db/calendarioCivico.js";

export const calendarioCivicoRouter = Router();

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function datosFecha(body: unknown): NuevaFechaCivica | null {
  const b = body as Partial<NuevaFechaCivica> | null;
  if (!b) return null;
  if (typeof b.titulo !== "string" || !b.titulo.trim()) return null;
  if (typeof b.fecha !== "string" || !FECHA_VALIDA.test(b.fecha)) return null;
  if (Number.isNaN(new Date(`${b.fecha}T00:00:00`).getTime())) return null;
  return { titulo: b.titulo.trim(), fecha: b.fecha };
}

calendarioCivicoRouter.get("/", (_req, res) => {
  res.json(listarCalendarioCivico());
});

calendarioCivicoRouter.get("/:id", (req, res) => {
  const fecha = obtenerFechaCivica(Number(req.params.id));
  if (!fecha) {
    res.status(404).json({ error: "Fecha no encontrada." });
    return;
  }
  res.json(fecha);
});

calendarioCivicoRouter.post("/", (req, res) => {
  const datos = datosFecha(req.body);
  if (!datos) {
    res.status(400).json({ error: "Datos inválidos (título, fecha AAAA-MM-DD)." });
    return;
  }
  res.status(201).json(crearFechaCivica(datos));
});

calendarioCivicoRouter.put("/:id", (req, res) => {
  const datos = datosFecha(req.body);
  if (!datos) {
    res.status(400).json({ error: "Datos inválidos (título, fecha AAAA-MM-DD)." });
    return;
  }
  const id = Number(req.params.id);
  if (!actualizarFechaCivica(id, datos)) {
    res.status(404).json({ error: "Fecha no encontrada." });
    return;
  }
  res.json(obtenerFechaCivica(id));
});

calendarioCivicoRouter.delete("/:id", (req, res) => {
  if (!eliminarFechaCivica(Number(req.params.id))) {
    res.status(404).json({ error: "Fecha no encontrada." });
    return;
  }
  res.status(204).end();
});
