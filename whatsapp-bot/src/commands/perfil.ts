import { guardarPerfil } from "../db/perfiles.js";
import { aulaDe, sembrarHorarioSeccion, SECCIONES, type Seccion } from "../db/seed.js";
import type { Intencion } from "./intencion.js";

export const SALUDO =
  "👋 ¡Hola! Soy *Ceneciano*, tu asistente del Colegio Nacional de Cabanillas (Puno).";

type Paso = "grado" | "seccion";

interface EstadoPerfil {
  paso: Paso;
  intencionPendiente: Intencion;
  grado?: number;
}

// chatId -> en qué paso va (grado o sección) y qué quería ver antes de preguntarle.
const enProgreso = new Map<string, EstadoPerfil>();

export function estaEsperandoPerfil(chatId: string): boolean {
  return enProgreso.has(chatId);
}

export function preguntarPerfil(chatId: string, intencionPendiente: Intencion): string {
  enProgreso.set(chatId, { paso: "grado", intencionPendiente });
  return [
    SALUDO,
    "",
    "Para mostrarte tu horario, cuéntame: ¿de qué grado eres? Responde con un número del 1 al 5 (1° a 5° de secundaria).",
  ].join("\n");
}

export interface RespuestaPerfil {
  mensaje: string;
  /** La intención que quedó pendiente (hoy/semana/listar), solo cuando ya se completó grado + sección. */
  intencionPendiente?: Intencion;
}

export function responderPerfil(chatId: string, textoCrudo: string): RespuestaPerfil {
  const estado = enProgreso.get(chatId);
  if (!estado) {
    return { mensaje: "Escribe !ayuda para ver qué puedo hacer 🙂" };
  }

  const texto = textoCrudo.trim();

  if (estado.paso === "grado") {
    const grado = Number(texto);
    if (!Number.isInteger(grado) || grado < 1 || grado > 5) {
      return {
        mensaje:
          "Ese grado no es válido 🤔 Responde solo con un número del 1 al 5 (1° a 5° de secundaria).",
      };
    }

    estado.grado = grado;
    estado.paso = "seccion";
    enProgreso.set(chatId, estado);
    return {
      mensaje: `¡Perfecto, ${grado}°! ¿Y tu sección? Responde con una letra: A, B, C, D o E.`,
    };
  }

  // estado.paso === "seccion"
  const seccion = texto.toUpperCase();
  if (!SECCIONES.includes(seccion as Seccion)) {
    return {
      mensaje: "Esa sección no es válida 🤔 Responde solo con una letra: A, B, C, D o E.",
    };
  }

  const grado = estado.grado!;
  guardarPerfil(chatId, grado, seccion);
  sembrarHorarioSeccion(chatId, grado, seccion);

  const intencionPendiente = estado.intencionPendiente;
  enProgreso.delete(chatId);

  return {
    mensaje: `Listo, quedaste registrado en *${grado}°${seccion}* de secundaria 🎓 (Aula ${aulaDe(grado, seccion)}). Aquí tienes:`,
    intencionPendiente,
  };
}
