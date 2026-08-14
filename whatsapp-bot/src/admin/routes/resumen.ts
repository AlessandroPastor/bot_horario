import { Router } from "express";
import { listarCalendarioCivico } from "../../db/calendarioCivico.js";
import { listarCursos } from "../../db/cursos.js";
import { listarDocentes } from "../../db/docentes.js";
import { contarPerfilesRegistrados } from "../../db/perfiles.js";
import { contarCombosConClases, listarPlantilla } from "../../db/plantillaHorario.js";
import { listarReuniones } from "../../db/reuniones.js";

export const resumenRouter = Router();

resumenRouter.get("/", (_req, res) => {
  res.json({
    docentes: listarDocentes().length,
    cursos: listarCursos().length,
    clasesPlantilla: listarPlantilla().length,
    combosConHorario: contarCombosConClases(),
    combosTotales: 25,
    fechasCivicas: listarCalendarioCivico().length,
    chatsRegistrados: contarPerfilesRegistrados(),
    reuniones: listarReuniones().length,
  });
});
