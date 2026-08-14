import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import { config } from "../config.js";

const AUTH_DIR = path.resolve("auth_info");
// Dentro de data/ (no en la raíz) para que quede en el mismo volumen
// persistente que la base de datos — así en Docker no hace falta montar un
// archivo aparte, con el que además Docker suele tener problemas si no
// existe todavía en el host antes del primer arranque.
const QR_PATH = path.resolve("data", "qr.png");
fs.mkdirSync(path.dirname(QR_PATH), { recursive: true });
const logger = pino({ level: "silent" });

function abrirImagen(rutaAbsoluta: string): void {
  const [comando, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", rutaAbsoluta]]
      : process.platform === "darwin"
        ? ["open", [rutaAbsoluta]]
        : ["xdg-open", [rutaAbsoluta]];

  try {
    const hijo = spawn(comando as string, args as string[], {
      detached: true,
      stdio: "ignore",
    });
    // spawn() no lanza de forma síncrona si el comando no existe (ej. sin
    // entorno gráfico dentro de un contenedor Docker) — el error llega async
    // como evento. Sin este listener, Node lo trata como excepción no
    // capturada y tumba el proceso; aquí simplemente no hay nada que abrir.
    hijo.on("error", () => {});
    hijo.unref();
  } catch (err) {
    console.error("No pude abrir el visor de imágenes automáticamente:", err);
  }
}

/**
 * El QR en ASCII se rompe si la terminal no es lo bastante ancha (se corta
 * de línea y deja de ser un QR válido), así que además se genera un PNG y se
 * abre con el visor de imágenes del sistema — mucho más confiable para
 * escanear con la cámara.
 */
async function mostrarQR(qr: string, esElPrimero: boolean): Promise<void> {
  qrcodeTerminal.generate(qr, { small: true });
  try {
    await QRCode.toFile(QR_PATH, qr, { width: 512, margin: 2 });
    console.log(
      `\nSi el QR de arriba no entra en la cámara o se ve cortado, abre: ${QR_PATH}`,
    );
    if (esElPrimero) abrirImagen(QR_PATH);
  } catch (err) {
    console.error("No pude generar qr.png:", err);
  }
}

// Se mantiene a nivel de módulo porque startBot() se vuelve a llamar a sí
// mismo en cada reconexión, y necesitamos que sobreviva entre esas llamadas.
let desconectadoDesde: number | null = null;

// Referencias al socket/handlers "actuales", para poder desvincular desde
// afuera (panel de administrador) sin tener que pasar el socket a mano por
// todos lados. Se actualizan en cada startBot()/reconexión.
let sockActual: WASocket | null = null;
let handlersActuales: BotHandlers | null = null;
let conectado = false;

export function obtenerEstadoConexion(): { conectado: boolean } {
  return { conectado };
}

/**
 * useMultiFileAuthState todavía puede tener una escritura de creds.json en
 * curso (por el último creds.update) justo cuando llega el logout, lo que
 * deja el directorio "busy" un instante. El error que tira Node en ese caso
 * (sobre todo con el bind mount de Docker) no siempre trae `err.code`
 * poblado (a veces llega vacío), así que el `maxRetries` propio de
 * fs.rmSync —que compara por código— no alcanza a engancharlo. Reintentamos
 * a mano, sin filtrar por código, dándole tiempo a que la escritura pendiente
 * termine sola.
 */
async function borrarDirectorioConReintentos(
  ruta: string,
  intentos = 6,
  esperaMs = 300,
): Promise<void> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      fs.rmSync(ruta, { recursive: true, force: true });
      return;
    } catch (err) {
      if (intento === intentos) throw err;
      await new Promise((resolve) => setTimeout(resolve, esperaMs));
    }
  }
}

/**
 * Borra la sesión guardada (auth_info/ + el qr.png viejo, que ya no sirve)
 * y arranca una reconexión desde cero — eso hace que Baileys pida un QR
 * nuevo enseguida, sin tener que reiniciar el contenedor a mano.
 *
 * La reconexión se intenta SIEMPRE, incluso si el borrado termina fallando
 * después de todos los reintentos — de lo contrario un solo borrado fallido
 * deja el bot desconectado para siempre (nadie vuelve a llamar startBot) y
 * hay que reiniciar el contenedor a mano para recuperarlo. Si el borrado no
 * se pudo completar, useMultiFileAuthState va a releer la sesión vieja (ya
 * invalidada por el logout), lo que dispara otro cierre casi inmediato y
 * este mismo flujo se repite — para entonces el archivo ya no está ocupado y
 * el segundo intento de borrado se completa solo.
 */
async function limpiarSesionYReconectar(): Promise<void> {
  conectado = false;
  try {
    await borrarDirectorioConReintentos(AUTH_DIR);
  } catch (err) {
    console.error(
      "No se pudo borrar auth_info tras varios intentos; igual se intenta reconectar:",
      err,
    );
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  try {
    if (fs.existsSync(QR_PATH)) fs.rmSync(QR_PATH, { force: true });
  } catch (err) {
    console.error("No se pudo borrar el qr.png viejo:", err);
  }
  if (handlersActuales) {
    startBot(handlersActuales).catch((err) =>
      console.error("Error al reconectar tras desvincular:", err),
    );
  }
}

/**
 * Desvincula el número actual (llamado desde el panel de administrador).
 * Intenta cerrar sesión "prolijo" con logout() — eso avisa a WhatsApp que el
 * dispositivo se desvinculó de verdad, no solo que se cayó la conexión — y
 * en cualquier caso (haya o no un socket activo, funcione o no logout())
 * termina limpiando la sesión guardada y reconectando para mostrar un QR
 * nuevo.
 */
export async function desvincularWhatsApp(): Promise<{ ok: boolean; mensaje: string }> {
  if (sockActual) {
    try {
      await sockActual.logout();
      // El evento connection.update (rama "sesión cerrada") ya se encarga de
      // limpiar y reconectar apenas Baileys confirme el cierre — no hace
      // falta duplicar el trabajo acá.
      return {
        ok: true,
        mensaje: "Desvinculando... en unos segundos vas a ver un nuevo QR para escanear.",
      };
    } catch (err) {
      console.error("No se pudo desvincular con logout(), se limpia la sesión a mano:", err);
    }
  }
  await limpiarSesionYReconectar();
  return {
    ok: true,
    mensaje: "Sesión de WhatsApp borrada. En unos segundos vas a ver un nuevo QR para escanear.",
  };
}

export type MessageHandler = (
  sock: WASocket,
  msg: proto.IWebMessageInfo,
) => Promise<void> | void;

export interface BotHandlers {
  onMessage: MessageHandler;
  onConnected?: (sock: WASocket) => void;
}

function avisarSiEstuvoCaido(sock: WASocket): void {
  if (desconectadoDesde === null) return;

  const minutosCaido = Math.round((Date.now() - desconectadoDesde) / 60000);
  desconectadoDesde = null;
  if (minutosCaido < config.downtimeAlertMin) return;

  console.warn(`El bot estuvo desconectado ~${minutosCaido} minuto(s).`);
  if (config.ownerChatId) {
    sock
      .sendMessage(config.ownerChatId, {
        text: `⚠️ Me reconecté a WhatsApp. Estuve caído ~${minutosCaido} minutos, así que pude haberme perdido algún recordatorio en ese rango.`,
      })
      .catch((err) => console.error("No pude avisar la reconexión:", err));
  }
}

export async function startBot(handlers: BotHandlers): Promise<WASocket> {
  handlersActuales = handlers;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
  });
  sockActual = sock;

  let qrAbierto = false;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Escanea este QR con WhatsApp (Dispositivos vinculados):");
      mostrarQR(qr, !qrAbierto).catch((err) =>
        console.error("Error mostrando el QR:", err),
      );
      qrAbierto = true;
    }

    if (connection === "close") {
      conectado = false;
      if (desconectadoDesde === null) desconectadoDesde = Date.now();

      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
        ?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(
        `Conexión cerrada (código ${statusCode}). Reconectar: ${shouldReconnect}`,
      );
      if (shouldReconnect) {
        startBot(handlers).catch((err) =>
          console.error("Error al reconectar:", err),
        );
      } else {
        console.log(
          "Sesión cerrada (logout). Borrando la sesión guardada y generando un nuevo QR...",
        );
        limpiarSesionYReconectar().catch((err) =>
          console.error("Error limpiando la sesión tras el logout:", err),
        );
      }
    } else if (connection === "open") {
      conectado = true;
      console.log("Bot conectado a WhatsApp ✅");
      avisarSiEstuvoCaido(sock);
      handlers.onConnected?.(sock);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      await handlers.onMessage(sock, msg);
    }
  });

  return sock;
}
