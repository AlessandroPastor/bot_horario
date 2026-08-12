import type { WASocket, proto } from "@whiskeysockets/baileys";
import {
  eliminarEvento,
  listarEventos,
  pausarEvento,
  reactivarEvento,
} from "../db/eventos.js";
import { obtenerPerfil } from "../db/perfiles.js";
import { sembrarCalendarioSiFalta } from "../db/seed.js";
import { exportarEventos } from "./exportar.js";
import { listaEventos } from "./format.js";
import { resumenHoy, resumenManana } from "./hoy.js";
import { importarEventos } from "./importar.js";
import { detectarIntencion, perteneceATema, type Intencion } from "./intencion.js";
import { estaEsperandoPerfil, preguntarPerfil, responderPerfil, SALUDO } from "./perfil.js";
import { resumenSemana } from "./semana.js";

const AYUDA = [
  "🤖 *Comandos disponibles*",
  "",
  "!listar — ver todos tus horarios",
  "!hoy — ver lo de hoy",
  "!manana — ver lo de mañana",
  "!semana — resumen de lunes a viernes",
  "!pausar <id> — pausar un horario",
  "!reactivar <id> — reactivar un horario pausado",
  "!borrar <id> — eliminar un horario",
  "!exportar — descargar tus horarios como archivo .json",
  "!importar — responde (reply) a un .json exportado con este comando para recuperarlo",
  "!ayuda — ver este mensaje",
  "",
  "También puedes preguntarme normal, sin el !, ej: \"cuál es mi horario\", \"y de mañana?\" o \"qué eventos hay esta semana\" (si mencionas 'horario/clases' te muestro solo eso, si mencionas 'eventos' te muestro solo el calendario cívico; !listar/!hoy/!semana muestran ambos juntos).",
  "Si solo dices \"mi horario\" sin más, te muestro el de HOY. Para el horario completo di \"todo mi horario\" o usa !listar / !semana.",
].join("\n");

const MENU_RAPIDO = [
  SALUDO,
  "Esto es lo que puedo hacer por ti:",
  "",
  '💬 "¿cuál es mi horario?" — tus clases de hoy',
  '💬 "y de mañana?" — tus clases de mañana',
  '💬 "¿qué eventos hay?" — el calendario cívico del colegio',
  "📋 !ayuda — ver todos los comandos",
  "",
  "Escríbeme cualquiera de esas opciones para empezar 😊",
].join("\n");

function parseId(arg: string | undefined): number | null {
  const id = Number(arg);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function responderIntencion(
  chatId: string,
  intencion: Intencion,
  responder: (t: string) => Promise<unknown>,
): Promise<void> {
  const { tema, alcance } = intencion;
  if (alcance === "hoy") await responder(resumenHoy(chatId, tema));
  else if (alcance === "manana") await responder(resumenManana(chatId, tema));
  else if (alcance === "semana") await responder(resumenSemana(chatId, tema));
  else {
    const eventos = listarEventos(chatId).filter((e) => perteneceATema(e, tema));
    await responder(listaEventos(eventos));
  }
}

export async function manejarMensaje(
  sock: WASocket,
  chatId: string,
  texto: string,
  msg: proto.IWebMessageInfo,
): Promise<void> {
  const responder = (t: string) => sock.sendMessage(chatId, { text: t });

  if (estaEsperandoPerfil(chatId)) {
    const { mensaje, intencionPendiente } = responderPerfil(chatId, texto);
    await responder(mensaje);
    if (intencionPendiente) await responderIntencion(chatId, intencionPendiente, responder);
    return;
  }

  const esComando = texto.startsWith("!");
  const [comandoCrudo, ...args] = esComando
    ? texto.slice(1).trim().split(/\s+/)
    : [];
  const comando = comandoCrudo?.toLowerCase();

  // "!hoy" / "!manana" / "!semana" / "!listar" muestran horario y eventos
  // juntos (por eso tema "todo"); en lenguaje natural ("¿cuál es mi
  // horario?", "y de mañana?") sí se distingue el tema para no mezclarlos.
  // En ambos casos: si no sabemos el grado y sección del chat, se pregunta.
  const intencion: Intencion | null = esComando
    ? comando === "hoy"
      ? { tema: "todo", alcance: "hoy" }
      : comando === "manana"
        ? { tema: "todo", alcance: "manana" }
        : comando === "semana"
          ? { tema: "todo", alcance: "semana" }
          : comando === "listar"
            ? { tema: "todo", alcance: "todos" }
            : null
    : detectarIntencion(texto);

  if (intencion) {
    sembrarCalendarioSiFalta(chatId);
    if (obtenerPerfil(chatId) === null) {
      await responder(preguntarPerfil(chatId, intencion));
      return;
    }
    await responderIntencion(chatId, intencion, responder);
    return;
  }

  if (!esComando) {
    await responder(MENU_RAPIDO);
    return;
  }

  switch (comando) {
    case "borrar": {
      const id = parseId(args[0]);
      if (!id) {
        await responder("Uso: !borrar <id> (mira el id con !listar)");
        return;
      }
      const ok = eliminarEvento(id, chatId);
      await responder(
        ok ? `🗑️ Horario #${id} eliminado.` : `No encontré el horario #${id}.`,
      );
      return;
    }

    case "pausar": {
      const id = parseId(args[0]);
      if (!id) {
        await responder("Uso: !pausar <id> (mira el id con !listar)");
        return;
      }
      const ok = pausarEvento(id, chatId);
      await responder(
        ok ? `⏸️ Horario #${id} pausado.` : `No encontré el horario #${id}.`,
      );
      return;
    }

    case "reactivar": {
      const id = parseId(args[0]);
      if (!id) {
        await responder("Uso: !reactivar <id> (mira el id con !listar)");
        return;
      }
      const ok = reactivarEvento(id, chatId);
      await responder(
        ok ? `▶️ Horario #${id} reactivado.` : `No encontré el horario #${id}.`,
      );
      return;
    }

    case "exportar":
      await exportarEventos(sock, chatId);
      return;

    case "importar":
      await responder(await importarEventos(chatId, msg));
      return;

    case "ayuda":
    case "help":
      await responder(AYUDA);
      return;

    default:
      await responder(
        `No conozco el comando !${comando}. Escribe !ayuda para ver la lista.`,
      );
  }
}
