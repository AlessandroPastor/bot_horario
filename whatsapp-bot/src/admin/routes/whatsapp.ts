import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { desvincularWhatsApp, obtenerEstadoConexion } from "../../bot/connection.js";

export const whatsappRouter = Router();

const QR_PATH = path.resolve("data", "qr.png");

whatsappRouter.get("/estado", (_req, res) => {
  res.json({ ...obtenerEstadoConexion(), tieneQR: fs.existsSync(QR_PATH) });
});

whatsappRouter.get("/qr", (_req, res) => {
  if (!fs.existsSync(QR_PATH)) {
    res.status(404).json({ error: "No hay QR generado todavía." });
    return;
  }
  res.sendFile(QR_PATH);
});

whatsappRouter.post("/desvincular", async (_req, res) => {
  const resultado = await desvincularWhatsApp();
  res.json(resultado);
});
