import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import session from "express-session";
import { config } from "../config.js";
import { login, logout, requireAuth, sesion } from "./auth.js";
import { calendarioCivicoRouter } from "./routes/calendarioCivico.js";
import { cursosRouter } from "./routes/cursos.js";
import { docentesRouter } from "./routes/docentes.js";
import { plantillaHorarioRouter } from "./routes/plantillaHorario.js";
import { resumenRouter } from "./routes/resumen.js";
import { reunionesRouter } from "./routes/reuniones.js";

// Los estáticos del SPA (admin-panel/) se copian acá al buildear (ver
// Dockerfile). En desarrollo, si no existe, el panel corre aparte con
// `vite dev` y este servidor solo expone la API.
const ADMIN_STATIC_DIR = path.resolve("admin-static");

/** Factory separada de .listen() para poder testear la API con un puerto efímero. */
export function crearAdminApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      name: "ceneciano.admin.sid",
      // Nunca debería usarse este valor por defecto en producción real:
      // iniciarAdminServer() ya se niega a arrancar sin ADMIN_SESSION_SECRET.
      // Solo existe para que crearAdminApp() sea invocable en pruebas/dev.
      secret: config.adminSessionSecret ?? "dev-only-secret-no-usar-en-produccion",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", secure: false },
    }),
  );

  app.post("/api/admin/login", login);
  app.post("/api/admin/logout", logout);
  app.get("/api/admin/session", sesion);

  app.use("/api/docentes", requireAuth, docentesRouter);
  app.use("/api/cursos", requireAuth, cursosRouter);
  app.use("/api/plantilla-horario", requireAuth, plantillaHorarioRouter);
  app.use("/api/calendario-civico", requireAuth, calendarioCivicoRouter);
  app.use("/api/reuniones", requireAuth, reunionesRouter);
  app.use("/api/resumen", requireAuth, resumenRouter);

  if (fs.existsSync(ADMIN_STATIC_DIR)) {
    app.use(express.static(ADMIN_STATIC_DIR));
    app.get("/*splat", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(ADMIN_STATIC_DIR, "index.html"));
    });
  }

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "No encontrado." });
  });

  return app;
}

export function iniciarAdminServer(): void {
  if (!config.adminUser || !config.adminPassword || !config.adminSessionSecret) {
    console.warn(
      "⚠️ Panel de administrador deshabilitado: faltan ADMIN_USER/ADMIN_PASSWORD/ADMIN_SESSION_SECRET en .env. El bot de WhatsApp sigue funcionando normal.",
    );
    return;
  }

  const app = crearAdminApp();
  app.listen(config.adminPort, () => {
    console.log(`Panel de administrador escuchando en el puerto ${config.adminPort} 🛠️`);
  });
}
