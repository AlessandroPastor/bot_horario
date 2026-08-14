import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

declare module "express-session" {
  interface SessionData {
    autenticado?: boolean;
  }
}

/**
 * Compara dos strings en tiempo constante. Se hashean primero a un largo
 * fijo porque `timingSafeEqual` lanza si los buffers tienen largo distinto
 * (el caso normal cuando la contraseña ingresada es incorrecta).
 */
function compararSeguro(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function credencialesValidas(usuario: string, contrasena: string): boolean {
  if (!config.adminUser || !config.adminPassword) return false;
  return compararSeguro(usuario, config.adminUser) && compararSeguro(contrasena, config.adminPassword);
}

export function login(req: Request, res: Response): void {
  const { usuario, contrasena } = req.body ?? {};
  if (typeof usuario !== "string" || typeof contrasena !== "string") {
    res.status(400).json({ error: "Falta usuario o contraseña." });
    return;
  }
  if (!credencialesValidas(usuario, contrasena)) {
    res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    return;
  }
  req.session.autenticado = true;
  res.json({ autenticado: true });
}

export function logout(req: Request, res: Response): void {
  req.session.destroy(() => res.json({ autenticado: false }));
}

export function sesion(req: Request, res: Response): void {
  res.json({ autenticado: req.session.autenticado === true });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.autenticado === true) {
    next();
    return;
  }
  res.status(401).json({ error: "No autenticado." });
}
