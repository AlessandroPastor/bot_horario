import type { WASocket, proto } from "@whiskeysockets/baileys";
import { config } from "../config.js";
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
import {
  continuarConsultaOtroSalon,
  esConsultaOtroSalon,
  estaConsultandoOtroSalon,
  iniciarConsultaOtroSalon,
} from "./otroSalon.js";
import { estaEsperandoPerfil, preguntarPerfil, responderPerfil, SALUDO } from "./perfil.js";
import {
  borrarReunionAdmin,
  continuarWizardReunion,
  estaEnWizardReunion,
  iniciarCrearReunion,
  iniciarEditarReunion,
  listarReunionesAdmin,
  resumenReunionesParaChat,
} from "./reuniones.js";
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
  "!reunion — ver las próximas reuniones de padres que te tocan",
  "!otrosalon — ver el horario de OTRO grado/sección (no el tuyo)",
  "!ayuda — ver este mensaje",
  "",
  "También puedes preguntarme normal, sin el !, ej: \"cuál es mi horario\", \"y de mañana?\" o \"qué eventos hay esta semana\" (si mencionas 'horario/clases' te muestro solo eso, si mencionas 'eventos' te muestro solo el calendario cívico; !listar/!hoy/!semana muestran ambos juntos).",
  "Si solo dices \"mi horario\" sin más, te muestro el de HOY. Para el horario completo di \"todo mi horario\" o usa !listar / !semana.",
  "Para ver el horario de otro salón (no el tuyo), di algo como \"el horario de otro salón\" o usa !otrosalon — te pregunto grado y sección y te lo muestro, sin tocar tu propio registro.",
].join("\n");

const MENU_RAPIDO = [
  SALUDO,
  "Esto es lo que puedo hacer por ti:",
  "",
  '💬 "¿cuál es mi horario?" — tus clases de hoy',
  '💬 "y de mañana?" — tus clases de mañana',
  '💬 "¿qué eventos hay?" — el calendario cívico del colegio',
  '💬 "el horario de otro salón" — ver el horario de otro grado/sección',
  "👨‍👩‍👧 !reunion — próximas reuniones de padres",
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

  // El wizard de reuniones solo lo puede iniciar el chat admin (ver !reunion
  // agregar/editar más abajo), pero la continuación no necesita re-chequear
  // eso: si el mapa tiene una entrada para este chatId es porque ya pasó el
  // chequeo de admin al iniciarlo.
  if (estaEnWizardReunion(chatId)) {
    await responder(continuarWizardReunion(chatId, texto));
    return;
  }

  // Consultar el horario de OTRO salón: no toca el perfil propio, así que
  // cualquier chat (registrado o no) puede usarlo.
  if (estaConsultandoOtroSalon(chatId)) {
    await responder(continuarConsultaOtroSalon(chatId, texto));
    return;
  }

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

  // Consultar el horario de OTRO salón (comando explícito o lenguaje
  // natural: "otro salón", "otra sección", "otro grado"...). Se revisa
  // ANTES de detectarIntencion a propósito: una frase como "el horario de
  // otro salón" también menciona "horario", y detectarIntencion la tomaría
  // como pedir el horario PROPIO en vez de esto.
  if (comando === "otrosalon" || (!esComando && esConsultaOtroSalon(texto))) {
    await responder(iniciarConsultaOtroSalon(chatId));
    return;
  }

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

    case "reunion": {
      const subcomando = args[0]?.toLowerCase();
      const esAdmin = config.ownerChatId !== null && chatId === config.ownerChatId;

      // Sin subcomando: cualquier chat registrado puede ver sus próximas
      // reuniones. Crear/editar/borrar/listar (con ids) son solo del admin.
      if (!subcomando) {
        await responder(resumenReunionesParaChat(chatId));
        return;
      }

      if (!esAdmin) {
        await responder("Ese comando de reuniones es solo para el administrador del colegio.");
        return;
      }

      if (subcomando === "agregar") {
        await responder(iniciarCrearReunion(chatId));
        return;
      }
      if (subcomando === "editar") {
        const id = parseId(args[1]);
        if (!id) {
          await responder("Uso: !reunion editar <id> (mira el id con !reunion listar)");
          return;
        }
        await responder(iniciarEditarReunion(chatId, id));
        return;
      }
      if (subcomando === "borrar") {
        const id = parseId(args[1]);
        if (!id) {
          await responder("Uso: !reunion borrar <id> (mira el id con !reunion listar)");
          return;
        }
        await responder(borrarReunionAdmin(id));
        return;
      }
      if (subcomando === "listar") {
        await responder(listarReunionesAdmin());
        return;
      }

      await responder(
        "Subcomando no reconocido. Usa: !reunion agregar / editar <id> / borrar <id> / listar",
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
