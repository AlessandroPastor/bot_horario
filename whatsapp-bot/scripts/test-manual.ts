import type { WASocket, proto } from "@whiskeysockets/baileys";
import { manejarMensaje } from "../src/commands/router.js";
import { db } from "../src/db/db.js";
import { crearEvento, listarEventos, DIAS_LV } from "../src/db/eventos.js";
import { detectarIntencion } from "../src/commands/intencion.js";
import { diasFaltantes, faltanTexto, formatearDuracion, formatearFecha } from "../src/commands/format.js";
import { revisarEventos, setSocket } from "../src/scheduler/reminder.js";
import { listarCalendarioCivico, crearFechaCivica, eliminarFechaCivica } from "../src/db/calendarioCivico.js";
import { listarPlantilla, crearClasePlantilla, eliminarClasePlantilla } from "../src/db/plantillaHorario.js";
import { sembrarPlantillasPorDefecto } from "../src/db/seed.js";
import { esConsultaOtroSalon } from "../src/commands/otroSalon.js";

// Normalmente lo hace index.ts al arrancar el bot; acá se llama a mano
// porque este script corre aparte, sin pasar por index.ts. Es idempotente
// (solo siembra una vez en la vida de la base): en una base recién creada
// puebla el currículo/calendario por defecto, pero si un admin ya borró todo
// a propósito (marcando semilla_estado como "ya sembrado", ver panel de
// admin) esto es un no-op — por diseño, para no revivir datos que se
// borraron adrede. Por eso el bloque del "chat demo" más abajo NO depende de
// que esto haya poblado nada: siembra su propio dato centinela y lo limpia
// al final, así pasa igual con la plantilla vacía o con el currículo real
// del colegio ya cargado por el admin.
sembrarPlantillasPorDefecto();

const CHATS_DE_PRUEBA = [
  "test-chat@s.whatsapp.net",
  "otro-chat@s.whatsapp.net",
  "demo-chat@s.whatsapp.net",
  "reminder-chat@s.whatsapp.net",
  "otrosalon-chat@s.whatsapp.net",
];

const idsClasesPrueba: number[] = [];
const idsFechasPrueba: number[] = [];

function limpiarDatosDePrueba() {
  const stmtEventos = db.prepare(`DELETE FROM eventos WHERE chatId = ?`);
  const stmtPerfiles = db.prepare(`DELETE FROM perfiles WHERE chatId = ?`);
  const stmtCalendario = db.prepare(`DELETE FROM calendario_sembrado WHERE chatId = ?`);
  for (const chatId of CHATS_DE_PRUEBA) {
    stmtEventos.run(chatId);
    stmtPerfiles.run(chatId);
    stmtCalendario.run(chatId);
  }
  for (const id of idsClasesPrueba) eliminarClasePlantilla(id);
  for (const id of idsFechasPrueba) eliminarFechaCivica(id);
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

  // esConsultaOtroSalon en aislado: variantes válidas + entradas raras que
  // NO deberían tumbar nada (regex simple, sin backtracking catastrófico).
  assert(
    esConsultaOtroSalon("quiero ver el horario de otro salon"),
    "esConsultaOtroSalon reconoce 'otro salon' (sin tilde)",
  );
  assert(esConsultaOtroSalon("y el de otra sección?"), "reconoce 'otra sección' (con tilde)");
  assert(esConsultaOtroSalon("dame el horario de OTRO GRADO"), "no distingue mayúsculas/minúsculas");
  assert(esConsultaOtroSalon("el horario de otro curso"), "reconoce 'otro curso' también");
  assert(!esConsultaOtroSalon("mi horario"), "no dispara con una pregunta normal por el horario propio");
  assert(!esConsultaOtroSalon(""), "no revienta con texto vacío");
  assert(!esConsultaOtroSalon("   "), "no revienta con solo espacios");
  assert(!esConsultaOtroSalon("🎉".repeat(2000)), "no revienta con texto largo de emojis");
  assert(!esConsultaOtroSalon("a".repeat(50_000)), "no revienta con texto extremadamente largo");

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

  // !exportar debe mandar un documento con los horarios: 2 propios + calendario
  // cívico + horario de 2°B (conteos leídos de las tablas, no hardcodeados —
  // la plantilla ahora es editable desde el panel de admin).
  const totalEsperadoChat = 2 + listarCalendarioCivico().length + listarPlantilla(2, "B").length;
  r = await last(chat, "!exportar");
  assert(
    r.includes("[documento:horarios.json]") && r.includes(`Exporté ${totalEsperadoChat}`),
    `!exportar envía un .json con todos los horarios del chat (${totalEsperadoChat})`,
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

  // el aviso automático debe incluir la descripción (aula/docente en clases,
  // lugar en reuniones) — antes solo decía título+hora, y había que escribir
  // !listar a mano para ver dónde era.
  crearEvento({
    titulo: "Evento con lugar",
    descripcion: "Reunión de padres — Auditorio",
    chatId: chat,
    tipo: "puntual",
    fecha: fechaHoy,
    hora: horaActual,
    avisoPrevioMin: 0,
  });
  sent.length = 0;
  await revisarEventos();
  const conLugar = sent.find((s) => s.text.includes("Evento con lugar"));
  assert(
    conLugar?.text.includes("Reunión de padres — Auditorio") ?? false,
    "el aviso automático incluye la descripción (aula/lugar), no solo título y hora",
  );

  // --- el recordatorio debe usar el tiempo REAL restante, no el aviso configurado,
  // y no debe "resucitar" avisos de clases que ya pasaron hace horas ---
  const reminderChat = "reminder-chat@s.whatsapp.net";

  // Devuelve fecha+hora reales del momento pedido, no solo la hora — así el
  // test sigue siendo correcto aunque el offset cruce la medianoche (ej. si
  // se corre de noche, "dentro de 95 min" puede caer al día siguiente).
  function momentoDentroDe(minutosDesdeAhora: number): { fecha: string; hora: string } {
    const d = new Date(Date.now() + minutosDesdeAhora * 60_000);
    return {
      fecha: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      hora: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    };
  }

  function minutosHastaMedianoche(): number {
    const ahora = new Date();
    const medianoche = new Date(ahora);
    medianoche.setHours(24, 0, 0, 0);
    return Math.round((medianoche.getTime() - ahora.getTime()) / 60_000);
  }

  // La clase empieza en offsetCercana minutos real, pero el aviso configurado
  // es offsetCercana+5 minutos antes (o sea, "toca avisar" desde hace 5 min).
  // El mensaje debe decir el tiempo REAL que falta, no el valor de
  // configuración — eso era el bug reportado. El offset se limita para que
  // NUNCA cruce la medianoche: un evento "puntual" fechado mañana no lo
  // considera el scheduler de hoy en absoluto (no es un bug, es cómo debe
  // ser), así que si el offset cruzara de día el evento simplemente no
  // aplicaría hoy y la prueba dejaría de probar lo que quiere probar.
  const offsetCercana = Math.max(5, Math.min(95, minutosHastaMedianoche() - 10));
  const avisoPrevioCercana = offsetCercana + 5;
  const claseCercana = momentoDentroDe(offsetCercana);
  crearEvento({
    titulo: "Clase futura cercana",
    chatId: reminderChat,
    tipo: "puntual",
    fecha: claseCercana.fecha,
    hora: claseCercana.hora,
    avisoPrevioMin: avisoPrevioCercana,
  });

  // Una clase que ya empezó hace 3 horas: si el bot recién ahora la revisa
  // (ej. porque estuvo apagado), NO debe mandar "empieza en 5 minutos" de
  // algo que ya pasó — debe quedarse callado y solo marcarla como atendida.
  const momentoClaseVieja = momentoDentroDe(-180);
  crearEvento({
    titulo: "Clase de la mañana ya pasada",
    chatId: reminderChat,
    tipo: "puntual",
    fecha: momentoClaseVieja.fecha,
    hora: momentoClaseVieja.hora,
    avisoPrevioMin: 5,
  });

  sent.length = 0;
  await revisarEventos();

  // No se compara contra un texto exacto: al construir la hora del evento a
  // partir de un offset se pierden los segundos, así que el minuto real
  // puede variar en ±1 según en qué segundo exacto corra la prueba. Se
  // aceptan las 3 duraciones vecinas, calculadas con la misma función que
  // usa el producto (no un regex hardcodeado a un caso puntual).
  const avisoCercano = sent.find((s) => s.text.includes("Clase futura cercana"));
  const duracionesAceptables = [offsetCercana - 1, offsetCercana, offsetCercana + 1]
    .filter((m) => m > 0)
    .map((m) => formatearDuracion(m));
  assert(
    avisoCercano !== undefined &&
      duracionesAceptables.some((d) => avisoCercano.text.includes(d)) &&
      !avisoCercano.text.includes(`${avisoPrevioCercana} minutos`),
    `el recordatorio dice el tiempo REAL que falta (${duracionesAceptables.join(" / ")}), no el aviso configurado (${avisoPrevioCercana} min)`,
  );

  const avisoTardio = sent.find((s) => s.text.includes("Clase de la mañana ya pasada"));
  assert(
    avisoTardio === undefined,
    "una clase que ya pasó hace horas no manda un recordatorio 'de mentira' al reconectar",
  );

  // Si el offset de -180 min cruzó la medianoche (ej. corriendo la prueba
  // entre las 00:00 y las 03:00), la clase vieja queda fechada AYER — en ese
  // caso el scheduler ni siquiera la considera "de hoy" (aplicaHoy la filtra
  // antes de llegar al chequeo de "muy tarde para avisar"), así que nunca se
  // marca como atendida. Ambos casos son correctos: lo único que importa es
  // que nunca mande el aviso falso (ya verificado arriba).
  const claseVieja = listarEventos(reminderChat).find((e) => e.titulo === "Clase de la mañana ya pasada");
  const claseViejaSigueSiendoHoy = momentoClaseVieja.fecha === fechaHoy;
  assert(
    claseViejaSigueSiendoHoy ? claseVieja?.ultimoEnvio === fechaHoy : true,
    "si la clase vieja sigue fechada hoy, se marca como atendida para no reintentar el resto del día",
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

  // Dato centinela propio para este bloque: NO asume que 3°B ni el
  // calendario cívico ya tengan contenido real (el admin pudo haber
  // borrado todo, o cargado su propio currículo distinto al de prueba) —
  // se limpia al final igual que el resto de datos de prueba.
  const claseDemo = crearClasePlantilla({
    grado: 3,
    seccion: "B",
    titulo: "PRUEBA-Materia Demo",
    hora: "08:00",
    dias: DIAS_LV,
    avisoPrevioMin: 5,
  });
  idsClasesPrueba.push(claseDemo.id);
  const fechaDemo = crearFechaCivica({ titulo: "PRUEBA-Fecha Cívica Demo", fecha: "2099-08-30" });
  idsFechasPrueba.push(fechaDemo.id);

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
    listarEventos(demoChat).length === listarCalendarioCivico().length,
    "ya se sembró el calendario cívico completo aunque todavía no se sepa el grado/sección",
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
    r.includes("3°B") && r.includes("PRUEBA-Materia Demo"),
    "grado + sección válidos confirman el registro y de una vez muestran el horario pedido",
  );
  assert(
    !r.includes("PRUEBA-Fecha Cívica Demo"),
    "pedir 'mi horario' no mezcla el calendario cívico en la respuesta",
  );
  const totalEsperadoDemo = listarPlantilla(3, "B").length + listarCalendarioCivico().length;
  assert(
    listarEventos(demoChat).length === totalEsperadoDemo,
    `se siembra el horario de la sección + el calendario cívico ya sembrado = ${totalEsperadoDemo} (aunque no se muestren juntos)`,
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
  assert(!r.includes("PRUEBA-Fecha Cívica Demo"), "'qué clases tengo hoy' tampoco mezcla el calendario cívico");

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
    mananaEsFindeDemo ? r.includes("No tienes nada programado") : r.includes("PRUEBA-Materia Demo"),
    "'y de mañana?' muestra el horario del día siguiente, sin mezclar el calendario cívico",
  );
  assert(!r.includes("PRUEBA-Fecha Cívica Demo"), "'y de mañana?' tampoco mezcla el calendario cívico");

  // Al revés: pedir "los eventos" no debe traer las clases.
  r = await last(demoChat, "quiero saber los eventos del colegio");
  assert(
    r.includes("PRUEBA-Fecha Cívica Demo") && !r.includes("PRUEBA-Materia Demo"),
    "pedir 'los eventos' muestra el calendario cívico sin mezclar las clases",
  );

  // "!listar" (con !) sí sigue mostrando ambos juntos, a propósito.
  r = await last(demoChat, "!listar");
  assert(
    r.includes("PRUEBA-Materia Demo") && r.includes("PRUEBA-Fecha Cívica Demo"),
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
    r.includes("Ceneciano") && r.includes("Horario de hoy") && r.includes("!ayuda"),
    "un mensaje casual muestra un menú rápido de opciones en vez de quedarse callado",
  );

  // --- consultar el horario de OTRO salón: cualquier chat, sin registrarse ---
  const otroSalonChat = "otrosalon-chat@s.whatsapp.net";

  r = await last(otroSalonChat, "quiero ver el horario de otro salón");
  assert(
    r.includes("qué grado"),
    "el disparador en lenguaje natural inicia el wizard preguntando el grado, sin exigir estar registrado",
  );
  assert(
    listarEventos(otroSalonChat).length === 0,
    "iniciar la consulta no siembra nada en los eventos propios del chat (es de solo lectura)",
  );

  // entradas inválidas / basura mientras está en el paso "grado": debe
  // re-preguntar sin romperse, nunca lanzar una excepción.
  r = await last(otroSalonChat, "");
  assert(r.includes("Grado inválido"), "un mensaje vacío en el paso grado no rompe nada, solo re-pregunta");
  r = await last(otroSalonChat, "nueve");
  assert(r.includes("Grado inválido"), "texto no numérico en el paso grado se rechaza sin romperse");
  r = await last(otroSalonChat, "99");
  assert(r.includes("Grado inválido"), "un grado fuera de 1-5 se rechaza y se vuelve a pedir");
  r = await last(otroSalonChat, "🎉".repeat(500));
  assert(r.includes("Grado inválido"), "un mensaje larguísimo de emojis no rompe el wizard");

  // grado válido -> pasa a preguntar sección
  r = await last(otroSalonChat, "2");
  assert(r.includes("sección"), "un grado válido pasa a preguntar la sección");

  // entradas inválidas en el paso "sección"
  r = await last(otroSalonChat, "Z");
  assert(r.includes("Sección inválida"), "una sección fuera de A-E se rechaza y se vuelve a pedir");
  r = await last(otroSalonChat, "1");
  assert(r.includes("Sección inválida"), "un número en el paso sección se rechaza sin romperse");

  // sección válida -> muestra el horario de ESE salón (grado 2, sección A:
  // ya tiene currículo real cargado por el admin, con docentes asignados)
  r = await last(otroSalonChat, "a");
  assert(
    r.includes("Horario de 2°A") && !r.includes("todavía no tiene"),
    "una sección válida muestra el horario real de ESE salón (no el propio)",
  );
  assert(
    /Lunes|Martes|Miércoles|Jueves|Viernes/.test(r),
    "el horario se muestra agrupado por día de la semana",
  );

  // el wizard ya terminó: el siguiente mensaje se procesa normal, no sigue
  // atrapado en el flujo de otro salón.
  r = await last(otroSalonChat, "a");
  assert(!r.includes("Sección inválida"), "tras mostrar el horario, el wizard ya no sigue activo");

  // el chat que consultó sigue sin perfil propio ni eventos propios: la
  // consulta de otro salón nunca lo registra ni le siembra nada.
  assert(
    listarEventos(otroSalonChat).length === 0,
    "consultar el horario de otro salón no siembra eventos propios ni registra el perfil del chat",
  );

  // cancelar a medio wizard
  await last(otroSalonChat, "!otrosalon");
  r = await last(otroSalonChat, "cancelar");
  assert(r === "Listo, cancelé la consulta.", "cancelar a medio wizard lo aborta");
  r = await last(otroSalonChat, "3");
  assert(
    !r.includes("Sección inválida") && r.includes("opción de su preferencia"),
    "tras cancelar, el wizard ya no sigue activo (el '3' se procesa como mensaje normal, no como respuesta al wizard)",
  );

  // el comando !otrosalon funciona igual que la frase en lenguaje natural
  r = await last(otroSalonChat, "!otrosalon");
  assert(r.includes("grado"), "!otrosalon (con !) también inicia el wizard");
  await last(otroSalonChat, "cancelar");

  // consultar otro salón NO afecta a un chat que YA está registrado con su
  // propio horario (usa 'chat', registrado como 2°B más arriba en este mismo
  // script, con sus propios eventos ya sembrados).
  const eventosPropiosAntes = listarEventos(chat).length;
  await last(chat, "el horario de otro salón");
  await last(chat, "3");
  await last(chat, "A");
  assert(
    listarEventos(chat).length === eventosPropiosAntes,
    "consultar otro salón desde un chat ya registrado no altera sus propios eventos",
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
