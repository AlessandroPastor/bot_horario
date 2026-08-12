import type { WASocket, proto } from "@whiskeysockets/baileys";
import { manejarMensaje } from "../src/commands/router.js";
import { db } from "../src/db/db.js";
import { crearEvento, listarEventos, DIAS_LV } from "../src/db/eventos.js";
import { detectarIntencion } from "../src/commands/intencion.js";
import { diasFaltantes, faltanTexto, formatearFecha } from "../src/commands/format.js";
import { revisarEventos, setSocket } from "../src/scheduler/reminder.js";

const CHATS_DE_PRUEBA = [
  "test-chat@s.whatsapp.net",
  "otro-chat@s.whatsapp.net",
  "demo-chat@s.whatsapp.net",
  "reminder-chat@s.whatsapp.net",
];

function limpiarDatosDePrueba() {
  const stmtEventos = db.prepare(`DELETE FROM eventos WHERE chatId = ?`);
  const stmtPerfiles = db.prepare(`DELETE FROM perfiles WHERE chatId = ?`);
  const stmtCalendario = db.prepare(`DELETE FROM calendario_sembrado WHERE chatId = ?`);
  for (const chatId of CHATS_DE_PRUEBA) {
    stmtEventos.run(chatId);
    stmtPerfiles.run(chatId);
    stmtCalendario.run(chatId);
  }
}

interface ContenidoEnviado {
  text?: string;
  caption?: string;
  document?: unknown;
  fileName?: string;
}

const sent: { chatId: string; text: string }[] = [];

const mockSock = {
  sendMessage: async (chatId: string, content: ContenidoEnviado) => {
    const text =
      content.text ??
      (content.document ? `[documento:${content.fileName}] ${content.caption ?? ""}` : "");
    sent.push({ chatId, text });
    return {};
  },
} as unknown as WASocket;

setSocket(mockSock);

const SIN_MENSAJE_CITADO = {} as proto.IWebMessageInfo;

let fallos = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`OK  - ${msg}`);
  } else {
    fallos++;
    console.log(`FAIL - ${msg}`);
  }
}

async function last(
  chatId: string,
  texto: string,
  msg: proto.IWebMessageInfo = SIN_MENSAJE_CITADO,
) {
  const antes = sent.length;
  await manejarMensaje(mockSock, chatId, texto, msg);
  return sent.slice(antes).map((s) => s.text).join("\n---\n");
}

async function main() {
  const [chat, otroChat] = CHATS_DE_PRUEBA;

  // detectarIntencion en aislado (no depende del día de la semana en que se
  // corra la prueba, a diferencia de probarlo a través de !hoy/resumenHoy).
  assert(
    JSON.stringify(detectarIntencion("quiero saber mi horario")) ===
      JSON.stringify({ tema: "horario", alcance: "hoy" }),
    "preguntar por 'mi horario' sin más detalle asume que quieres el de hoy",
  );
  assert(
    JSON.stringify(detectarIntencion("quiero saber todo mi horario")) ===
      JSON.stringify({ tema: "horario", alcance: "todos" }),
    "agregar 'todo' pide el horario completo en vez de solo hoy",
  );
  assert(
    JSON.stringify(detectarIntencion("que horario tengo esta semana")) ===
      JSON.stringify({ tema: "horario", alcance: "semana" }),
    "'semana' sigue dando el resumen semanal aunque el tema sea horario",
  );
  assert(
    JSON.stringify(detectarIntencion("quiero saber los eventos")) ===
      JSON.stringify({ tema: "evento", alcance: "todos" }),
    "preguntar por 'los eventos' sin más detalle muestra todos (no son diarios como las clases)",
  );
  assert(
    JSON.stringify(detectarIntencion("y de mañana?")) ===
      JSON.stringify({ tema: "horario", alcance: "manana" }),
    "'y de mañana?' se reconoce como horario con alcance 'mañana' (misma idea que 'hoy')",
  );
  assert(
    JSON.stringify(detectarIntencion("hola, como estas")) === "null",
    "un saludo sin mencionar horario/evento/clase no genera ninguna intención",
  );

  // formato de fechas en español + "faltan X días" (no dependen del día en
  // que se corra la prueba: se calculan relativas a "hoy" dinámicamente)
  assert(
    formatearFecha("2026-08-30") === "30 de agosto",
    "formatearFecha da la fecha en español, sin el formato ISO crudo",
  );
  assert(
    formatearFecha(null) === "fecha por definir" && formatearFecha("no-es-fecha") === "no-es-fecha",
    "formatearFecha no explota con datos faltantes o inválidos",
  );
  assert(faltanTexto(0) === "¡hoy!", "faltanTexto marca el día de hoy");
  assert(faltanTexto(1) === "mañana", "faltanTexto dice 'mañana' para el día siguiente");
  assert(faltanTexto(5) === "en 5 días", "faltanTexto da un texto natural para varios días");
  assert(faltanTexto(-2) === "hace 2 días", "faltanTexto también describe fechas pasadas");

  const hoyDate = new Date();
  const en5dias = new Date(hoyDate);
  en5dias.setDate(hoyDate.getDate() + 5);
  const en5diasISO = `${en5dias.getFullYear()}-${String(en5dias.getMonth() + 1).padStart(2, "0")}-${String(en5dias.getDate()).padStart(2, "0")}`;
  assert(
    diasFaltantes(en5diasISO) === 5,
    "diasFaltantes calcula bien los días hasta una fecha futura, sin importar qué día es hoy",
  );

  // !ayuda
  let r = await last(chat, "!ayuda");
  assert(r.includes("Comandos disponibles"), "!ayuda muestra el menú");
  assert(!r.includes("!agregar"), "!ayuda ya no menciona !agregar (se quitó: eso se maneja internamente)");
  assert(r.includes("!manana"), "!ayuda menciona el nuevo comando !manana");

  // comando desconocido
  r = await last(chat, "!loquesea");
  assert(r.includes("No conozco el comando"), "comando desconocido responde aviso");
  r = await last(chat, "!agregar");
  assert(r.includes("No conozco el comando"), "!agregar ya no existe como comando (se maneja internamente, no por chat)");

  // Datos de prueba creados directamente (ya no hay wizard !agregar por
  // chat — los horarios ahora se manejan de forma interna/programática).
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const fechaHoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;

  crearEvento({
    titulo: "Clase de Redes",
    chatId: chat,
    tipo: "recurrente_LV",
    dias: DIAS_LV,
    hora: "08:00",
    avisoPrevioMin: 10,
  });

  crearEvento({
    titulo: "Evento de prueba scheduler",
    chatId: chat,
    tipo: "puntual",
    fecha: fechaHoy,
    hora: horaActual,
    avisoPrevioMin: 0,
  });

  // Primera vez que 'chat' pide su horario: como no sabemos su grado/sección,
  // debe saludar como "Ceneciano" (el asistente del colegio) y preguntar el
  // grado primero, en vez de listar de una.
  r = await last(chat, "!listar");
  assert(
    r.includes("Ceneciano") && r.includes("Cabanillas") && r.includes("qué grado"),
    "la primera vez que un chat pide su horario, Ceneciano se presenta y pregunta el grado",
  );

  // Grado válido -> pasa a preguntar la sección (no siembra nada todavía).
  r = await last(chat, "2");
  assert(r.includes("sección"), "tras un grado válido, se pregunta la sección (A-E)");

  // Sección inválida se rechaza sin perder lo avanzado (grado + intención pendiente).
  r = await last(chat, "Z");
  assert(r.includes("no es válida"), "una sección fuera de A-E se rechaza y se vuelve a pedir");

  // Con grado y sección completos, se siembra el horario de esa sección y de
  // una vez se responde lo que se había pedido originalmente (el !listar).
  r = await last(chat, "B");
  assert(
    r.includes("2°B") &&
      r.includes("Clase de Redes") &&
      r.includes("Evento de prueba scheduler"),
    "con grado y sección completos, confirma el registro y muestra el !listar pedido (con los horarios propios incluidos)",
  );

  // !hoy debe incluir el evento puntual de hoy (y Clase de Redes si hoy es L-V)
  r = await last(chat, "!hoy");
  assert(r.includes("Evento de prueba scheduler"), "!hoy incluye el evento puntual de hoy");

  // !manana: misma idea que !hoy pero para el día siguiente. "Clase de
  // Redes" es L-V, así que aparece salvo que mañana caiga sábado/domingo.
  r = await last(chat, "!manana");
  const mananaDate = new Date();
  mananaDate.setDate(mananaDate.getDate() + 1);
  const mananaEsFinde = mananaDate.getDay() === 0 || mananaDate.getDay() === 6;
  assert(
    mananaEsFinde
      ? r.includes("No tienes nada programado")
      : r.includes("Clase de Redes"),
    "!manana muestra lo del día siguiente (clase de Redes si mañana es L-V, vacío si es finde)",
  );

  // !semana no debe crashear
  r = await last(chat, "!semana");
  assert(typeof r === "string" && r.length > 0, "!semana responde algo");

  // !exportar debe mandar un documento con los horarios: 2 propios + 8 del
  // calendario cívico + 20 del horario de 2° de secundaria = 30
  r = await last(chat, "!exportar");
  assert(
    r.includes("[documento:horarios.json]") && r.includes("Exporté 30"),
    "!exportar envía un .json con todos los horarios del chat",
  );

  // !importar sin responder a un archivo debe pedirlo
  r = await last(chat, "!importar");
  assert(
    r.includes("responde (reply) al archivo"),
    "!importar sin mensaje citado pide que se responda al .json",
  );

  // scheduler: el evento puntual de 'ahora' con aviso 0 debe dispararse
  sent.length = 0;
  await revisarEventos();
  const disparados = sent.filter((s) => s.text.includes("Evento de prueba scheduler"));
  assert(disparados.length === 1, "el scheduler dispara el recordatorio del evento puntual de 'ahora'");

  // segunda pasada del scheduler en el mismo minuto: no debe duplicar
  sent.length = 0;
  await revisarEventos();
  const duplicados = sent.filter((s) => s.text.includes("Evento de prueba scheduler"));
  assert(duplicados.length === 0, "el scheduler no duplica el recordatorio ya enviado");

  // --- el recordatorio debe usar el tiempo REAL restante, no el aviso configurado,
  // y no debe "resucitar" avisos de clases que ya pasaron hace horas ---
  const reminderChat = "reminder-chat@s.whatsapp.net";

  function horaDentroDe(minutosDesdeAhora: number): string {
    const d = new Date(Date.now() + minutosDesdeAhora * 60_000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // La clase empieza en 95 minutos real, pero el aviso configurado es de 100
  // minutos antes (o sea, "toca avisar" desde hace 5 min). El mensaje debe
  // decir el tiempo REAL que falta (1 hora y 35 min), no el valor de
  // configuración (100 minutos) — eso era el bug reportado.
  crearEvento({
    titulo: "Clase futura cercana",
    chatId: reminderChat,
    tipo: "puntual",
    fecha: fechaHoy,
    hora: horaDentroDe(95),
    avisoPrevioMin: 100,
  });

  // Una clase que ya empezó hace 3 horas: si el bot recién ahora la revisa
  // (ej. porque estuvo apagado), NO debe mandar "empieza en 5 minutos" de
  // algo que ya pasó — debe quedarse callado y solo marcarla como atendida.
  crearEvento({
    titulo: "Clase de la mañana ya pasada",
    chatId: reminderChat,
    tipo: "puntual",
    fecha: fechaHoy,
    hora: horaDentroDe(-180),
    avisoPrevioMin: 5,
  });

  sent.length = 0;
  await revisarEventos();

  // No se compara contra un texto exacto tipo "1 hora y 35 minutos": al
  // construir la hora del evento a partir de un offset se pierden los
  // segundos, así que el minuto real puede variar en ±1 según en qué
  // segundo exacto corra la prueba. Lo que importa es que use horas+minutos
  // reales (~1h30m) y NO el valor de configuración (100 minutos).
  const avisoCercano = sent.find((s) => s.text.includes("Clase futura cercana"));
  assert(
    avisoCercano !== undefined &&
      /\b1 hora y 3[3-6] minutos\b/.test(avisoCercano.text) &&
      !avisoCercano.text.includes("100 minutos"),
    "el recordatorio dice el tiempo REAL que falta (~1h30m), no el aviso configurado (100 min)",
  );

  const avisoTardio = sent.find((s) => s.text.includes("Clase de la mañana ya pasada"));
  assert(
    avisoTardio === undefined,
    "una clase que ya pasó hace horas no manda un recordatorio 'de mentira' al reconectar",
  );

  const claseVieja = listarEventos(reminderChat).find((e) => e.titulo === "Clase de la mañana ya pasada");
  assert(
    claseVieja?.ultimoEnvio === fechaHoy,
    "aunque no avise, sí se marca como atendida hoy para no reintentar el resto del día",
  );

  // pausar / reactivar / borrar sobre "Clase de Redes"
  // (el id real no es necesariamente 1: el AUTOINCREMENT de SQLite sigue
  // subiendo entre corridas de `npm test` aunque se borren las filas de
  // prueba, así que se busca el id de verdad en vez de asumirlo)
  const idClaseDeRedes = listarEventos(chat).find((e) => e.titulo === "Clase de Redes")?.id;
  assert(idClaseDeRedes !== undefined, "se encuentra el id real de 'Clase de Redes' para las pruebas siguientes");

  r = await last(chat, `!pausar ${idClaseDeRedes}`);
  assert(r.includes("pausado"), "!pausar marca el horario como pausado");

  r = await last(chat, "!listar");
  assert(r.includes("(pausado)"), "!listar refleja el estado pausado");

  r = await last(chat, `!reactivar ${idClaseDeRedes}`);
  assert(r.includes("reactivado"), "!reactivar reactiva el horario");

  r = await last(chat, `!borrar ${idClaseDeRedes}`);
  assert(r.includes("eliminado"), "!borrar elimina el horario");

  r = await last(chat, "!borrar 999");
  assert(r.includes("No encontré"), "!borrar con id inexistente avisa que no lo encontró");

  // aislamiento entre chats: otro chat no debe ver los horarios de 'chat'
  // (verificación directa en la base, ya que !listar en otroChat ahora
  // dispararía su propia pregunta de grado en vez de listar algo)
  assert(
    !listarEventos(otroChat).some(
      (e) => e.titulo === "Clase de Redes" || e.titulo === "Evento de prueba scheduler",
    ),
    "los horarios están aislados por chatId (otro chat no ve los de 'chat')",
  );

  // --- lenguaje natural + saludo + pregunta de grado (chat nuevo, sin horarios) ---
  const demoChat = "demo-chat@s.whatsapp.net";

  assert(
    listarEventos(demoChat).length === 0,
    "el chat demo arranca sin horarios guardados",
  );

  // Primera pregunta por el horario: Ceneciano se presenta y pide el grado,
  // en vez de mostrar un horario de una vez.
  // (se pide "todo" el horario a propósito, para que la respuesta final sea
  // la lista completa y la prueba no dependa de qué día de la semana corra)
  r = await last(demoChat, "quiero saber todo mi horario");
  assert(
    r.includes("Ceneciano") && r.includes("Cabanillas") && r.includes("qué grado"),
    "primera pregunta por el horario: Ceneciano se presenta y pide el grado",
  );
  assert(
    listarEventos(demoChat).length === 8,
    "ya se sembró el calendario cívico (8 eventos) aunque todavía no se sepa el grado/sección",
  );

  // Un grado inválido se rechaza y no pierde la intención pendiente.
  r = await last(demoChat, "no sé, como 9no");
  assert(r.includes("no es válido"), "un grado fuera de 1-5 se rechaza y se vuelve a pedir");

  // Grado válido -> pasa a preguntar la sección.
  r = await last(demoChat, "3");
  assert(r.includes("sección"), "tras un grado válido, se pregunta la sección (A-E)");

  // Una sección inválida también se rechaza sin perder el grado ya elegido.
  r = await last(demoChat, "9");
  assert(r.includes("no es válida"), "una sección inválida se rechaza y se vuelve a pedir");

  // Con grado y sección completos, se siembra el horario de ESA sección y
  // responde de una vez lo que se había pedido originalmente. Como se pidió
  // específicamente el "horario" (no "eventos"), la respuesta NO debe traer
  // mezclado el calendario cívico (ese era el bug reportado).
  r = await last(demoChat, "b");
  assert(
    r.includes("3°B") && r.includes("Matemática"),
    "grado + sección válidos confirman el registro y de una vez muestran el horario pedido",
  );
  assert(
    !r.includes("Santa Rosa") && !r.includes("Angamos"),
    "pedir 'mi horario' no mezcla el calendario cívico en la respuesta",
  );
  assert(
    listarEventos(demoChat).length === 28,
    "se siembra el horario de la sección (20) + el calendario cívico ya sembrado (8) = 28 (aunque no se muestren juntos)",
  );
  assert(
    listarEventos(demoChat)
      .filter((e) => e.tipo !== "puntual")
      .every((e) => e.descripcion?.includes("3°B de Secundaria — Aula 302")),
    "las clases quedan etiquetadas con el grado, sección y aula (3°B de Secundaria — Aula 302)",
  );

  // Con el grado ya guardado, no se vuelve a preguntar, y "clases hoy" sigue
  // sin mezclar eventos del calendario cívico.
  r = await last(demoChat, "¿qué clases tengo hoy?");
  assert(!r.includes("qué grado eres"), "con el grado ya guardado no se vuelve a preguntar");
  assert(!r.includes("Santa Rosa"), "'qué clases tengo hoy' tampoco mezcla el calendario cívico");

  // "y de mañana?" en lenguaje natural: misma idea que "hoy" pero para el
  // día siguiente (el horario de 3°B cubre lunes a viernes, así que solo
  // aparece "No tienes nada" si mañana cae sábado o domingo).
  r = await last(demoChat, "y de mañana?");
  const mananaEsFindeDemo = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getDay() === 0 || d.getDay() === 6;
  })();
  assert(
    mananaEsFindeDemo ? r.includes("No tienes nada programado") : r.includes("Matemática"),
    "'y de mañana?' muestra el horario del día siguiente, sin mezclar el calendario cívico",
  );
  assert(!r.includes("Santa Rosa"), "'y de mañana?' tampoco mezcla el calendario cívico");

  // Al revés: pedir "los eventos" no debe traer las clases.
  r = await last(demoChat, "quiero saber los eventos del colegio");
  assert(
    r.includes("Santa Rosa") && !r.includes("Matemática"),
    "pedir 'los eventos' muestra el calendario cívico sin mezclar las clases",
  );

  // "!listar" (con !) sí sigue mostrando ambos juntos, a propósito.
  r = await last(demoChat, "!listar");
  assert(
    r.includes("Matemática") && r.includes("Santa Rosa"),
    "!listar (con !) muestra horario y eventos juntos, a diferencia del lenguaje natural específico",
  );
  assert(
    !/\d{4}-\d{2}-\d{2}/.test(r) && r.includes("de agosto"),
    "las fechas puntuales se muestran en español (ej. '30 de agosto'), no en formato ISO crudo",
  );

  // Un mensaje casual (sin !, sin mencionar horario/evento/clase) ya no se
  // ignora en silencio: responde con un mini menú de opciones para que el
  // usuario sepa qué escribir.
  r = await last(demoChat, "hola, buenos días");
  assert(
    r.includes("Ceneciano") && r.includes("mi horario") && r.includes("!ayuda"),
    "un mensaje casual muestra un menú rápido de opciones en vez de quedarse callado",
  );
}

main()
  .catch((err) => {
    fallos++;
    console.error("Error inesperado durante las pruebas:", err);
  })
  .finally(() => {
    limpiarDatosDePrueba();
    console.log(`\n${fallos === 0 ? "TODO OK" : `${fallos} FALLO(S)`}`);
    process.exit(fallos === 0 ? 0 : 1);
  });
