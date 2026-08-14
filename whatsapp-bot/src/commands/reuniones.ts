import { obtenerPerfil } from "../db/perfiles.js";
import {
  actualizarReunion,
  crearReunion,
  eliminarReunion,
  listarReuniones,
  obtenerReunion,
  type NuevaReunion,
  type Reunion,
} from "../db/reuniones.js";

const SECCIONES_VALIDAS = ["A", "B", "C", "D", "E"];
const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

// --- wizard (crear/editar), solo para el chat admin (OWNER_CHAT_ID) ---

type Paso = "grado" | "seccion" | "titulo" | "fecha" | "hora" | "lugar" | "aviso";

interface EstadoWizard {
  modo: "crear" | "editar";
  idEditar?: number;
  paso: Paso;
  datos: Partial<NuevaReunion>;
}

const enProgreso = new Map<string, EstadoWizard>();

export function estaEnWizardReunion(chatId: string): boolean {
  return enProgreso.has(chatId);
}

const PIE_WIZARD = "\n\nEscribe *cancelar* en cualquier momento para salir.";

export function iniciarCrearReunion(chatId: string): string {
  enProgreso.set(chatId, { modo: "crear", paso: "grado", datos: {} });
  return (
    "📋 Vamos a crear una reunión de padres de familia.\n" +
    "¿Para qué grado? Responde un número del 1 al 5, o *todos* si es para todo el colegio." +
    PIE_WIZARD
  );
}

export function iniciarEditarReunion(chatId: string, id: number): string {
  const reunion = obtenerReunion(id);
  if (!reunion) return `No encontré la reunión #${id}.`;

  enProgreso.set(chatId, { modo: "editar", idEditar: id, paso: "grado", datos: {} });
  return (
    `✏️ Editando la reunión #${id} ("${reunion.titulo}"). Te voy a pedir todos los datos de nuevo.\n` +
    "¿Para qué grado? Responde un número del 1 al 5, o *todos* si es para todo el colegio." +
    PIE_WIZARD
  );
}

export function continuarWizardReunion(chatId: string, textoCrudo: string): string {
  const texto = textoCrudo.trim();
  const estado = enProgreso.get(chatId);
  if (!estado) return "Escribe !reunion agregar para empezar.";

  if (texto.toLowerCase() === "cancelar") {
    enProgreso.delete(chatId);
    return "Listo, cancelé el proceso.";
  }

  switch (estado.paso) {
    case "grado": {
      if (texto.toLowerCase() === "todos") {
        estado.datos.grado = null;
      } else {
        const grado = Number(texto);
        if (!Number.isInteger(grado) || grado < 1 || grado > 5) {
          return "Grado inválido 🤔 Responde un número del 1 al 5, o *todos*.";
        }
        estado.datos.grado = grado;
      }
      estado.paso = "seccion";
      enProgreso.set(chatId, estado);
      return "¿Qué sección? Responde una letra de A a E, o *todos* si aplica a todas las secciones de ese grado.";
    }

    case "seccion": {
      if (texto.toLowerCase() === "todos") {
        estado.datos.seccion = null;
      } else {
        const seccion = texto.toUpperCase();
        if (!SECCIONES_VALIDAS.includes(seccion)) {
          return "Sección inválida 🤔 Responde una letra de A a E, o *todos*.";
        }
        estado.datos.seccion = seccion;
      }
      estado.paso = "titulo";
      enProgreso.set(chatId, estado);
      return "¿Cuál es el título de la reunión? (ej: Reunión de padres — 1er bimestre)";
    }

    case "titulo": {
      if (!texto) return "El título no puede estar vacío. ¿Cuál es el título de la reunión?";
      estado.datos.titulo = texto;
      estado.paso = "fecha";
      enProgreso.set(chatId, estado);
      return "¿Qué fecha? (formato AAAA-MM-DD, ej: 2026-09-10)";
    }

    case "fecha": {
      if (!FECHA_VALIDA.test(texto) || Number.isNaN(new Date(`${texto}T00:00:00`).getTime())) {
        return "Fecha inválida. Usa AAAA-MM-DD (ej: 2026-09-10).";
      }
      estado.datos.fecha = texto;
      estado.paso = "hora";
      enProgreso.set(chatId, estado);
      return "¿A qué hora? (formato 24h, ej: 18:00)";
    }

    case "hora": {
      if (!HORA_VALIDA.test(texto)) {
        return "Hora inválida. Usa HH:mm en 24h (ej: 18:00).";
      }
      estado.datos.hora = texto;
      estado.paso = "lugar";
      enProgreso.set(chatId, estado);
      return "¿En qué lugar? (ej: Auditorio, Aula 302). Escribe *ninguno* si no aplica.";
    }

    case "lugar": {
      estado.datos.lugar = texto.toLowerCase() === "ninguno" ? null : texto;
      estado.paso = "aviso";
      enProgreso.set(chatId, estado);
      return "¿Cuántos minutos antes aviso? (ej: 60). Escribe un número entero.";
    }

    case "aviso": {
      const minutos = Number(texto);
      if (!Number.isInteger(minutos) || minutos < 0 || minutos > 10_080) {
        return "Escribe un número entero de minutos, entre 0 y 10080 (una semana).";
      }

      const datosCompletos: NuevaReunion = {
        titulo: estado.datos.titulo!,
        fecha: estado.datos.fecha!,
        hora: estado.datos.hora!,
        lugar: estado.datos.lugar ?? null,
        grado: estado.datos.grado ?? null,
        seccion: estado.datos.seccion ?? null,
        avisoPrevioMin: minutos,
      };

      if (estado.modo === "crear") {
        enProgreso.delete(chatId);
        const { reunion, avisados } = crearReunion(datosCompletos);
        return resumenReunionCreada(reunion, avisados);
      }

      const idEditar = estado.idEditar!;
      enProgreso.delete(chatId);
      const { actualizada, avisados } = actualizarReunion(idEditar, datosCompletos);
      if (!actualizada) return `No encontré la reunión #${idEditar}.`;
      return `✅ Reunión #${idEditar} actualizada. Avisé a ${avisados} chat(s) registrados.`;
    }

    default:
      enProgreso.delete(chatId);
      return "Algo salió mal, empecemos de nuevo con !reunion agregar.";
  }
}

function destinoLegible(reunion: Reunion): string {
  if (reunion.grado === null) return "todo el colegio";
  if (reunion.seccion === null) return `${reunion.grado}° (todas las secciones)`;
  return `${reunion.grado}°${reunion.seccion}`;
}

function resumenReunionCreada(reunion: Reunion, avisados: number): string {
  return [
    `✅ Reunión creada: *${reunion.titulo}* (#${reunion.id})`,
    `📅 ${reunion.fecha} a las ${reunion.hora}${reunion.lugar ? ` — ${reunion.lugar}` : ""}`,
    `👥 Para: ${destinoLegible(reunion)}`,
    `📨 Se avisó de inmediato a ${avisados} chat(s) ya registrados.`,
  ].join("\n");
}

// --- lectura: listado admin (con ids) y resumen para un chat cualquiera ---

export function listarReunionesAdmin(): string {
  const reuniones = listarReuniones();
  if (reuniones.length === 0) return "No hay reuniones programadas todavía.";

  return reuniones
    .map(
      (r) =>
        `#${r.id} — *${r.titulo}*\n📅 ${r.fecha} ${r.hora}${r.lugar ? ` — ${r.lugar}` : ""}\n👥 ${destinoLegible(r)}`,
    )
    .join("\n\n");
}

export function borrarReunionAdmin(id: number): string {
  return eliminarReunion(id)
    ? `🗑️ Reunión #${id} eliminada (los recordatorios ya repartidos también se borraron).`
    : `No encontré la reunión #${id}.`;
}

/** Próximas reuniones que le tocan a este chat (según su grado/sección) — para cualquiera, no solo el admin. */
export function resumenReunionesParaChat(chatId: string): string {
  const perfil = obtenerPerfil(chatId);
  const hoy = new Date(new Date().toDateString());

  const proximas = listarReuniones().filter((r) => {
    const coincideGrado = r.grado === null || (perfil && r.grado === perfil.grado);
    const coincideSeccion = r.seccion === null || (perfil && r.seccion === perfil.seccion);
    const fecha = new Date(`${r.fecha}T00:00:00`);
    return coincideGrado && coincideSeccion && fecha >= hoy;
  });

  if (proximas.length === 0) return "No tienes reuniones de padres programadas por ahora. 🎉";

  return (
    "*Próximas reuniones de padres:*\n\n" +
    proximas
      .map((r) => `📅 ${r.fecha} ${r.hora}${r.lugar ? ` — ${r.lugar}` : ""}\n*${r.titulo}*`)
      .join("\n\n")
  );
}
