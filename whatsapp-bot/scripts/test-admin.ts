// Estos deben fijarse ANTES de importar cualquier cosa que dependa de
// config.ts (que lee process.env al cargar el módulo) — por eso admin/server.js
// y commands/router.js se importan de forma dinámica más abajo, después de
// fijar las variables. Las demás importaciones (db, CRUD, seed) no dependen
// de env, así que sí pueden ser estáticas arriba como de costumbre.
process.env.ADMIN_USER = "admin-de-prueba";
process.env.ADMIN_PASSWORD = "clave-de-prueba-123";
process.env.ADMIN_SESSION_SECRET = "secreto-de-prueba-abc";
process.env.OWNER_CHAT_ID = "admin-owner-test@s.whatsapp.net";

import type { WASocket, proto } from "@whiskeysockets/baileys";
import { db } from "../src/db/db.js";
import {
  actualizarDocente,
  crearDocente,
  eliminarDocente,
  listarDocentes,
  obtenerDocente,
} from "../src/db/docentes.js";
import {
  actualizarClasePlantilla,
  clonarSeccion,
  crearClasePlantilla,
  eliminarClasePlantilla,
  generarHorarioGrado,
  listarPlantilla,
  obtenerClasePlantilla,
} from "../src/db/plantillaHorario.js";
import {
  actualizarCurso,
  crearCurso,
  eliminarCurso,
  listarCursos,
  obtenerCurso,
} from "../src/db/cursos.js";
import {
  actualizarFechaCivica,
  crearFechaCivica,
  eliminarFechaCivica,
  listarCalendarioCivico,
  obtenerFechaCivica,
} from "../src/db/calendarioCivico.js";
import { sembrarHorarioSeccion } from "../src/db/seed.js";
import { listarEventos } from "../src/db/eventos.js";
import { guardarPerfil, listarChatsPorGradoSeccion } from "../src/db/perfiles.js";
import {
  actualizarReunion,
  crearReunion,
  eliminarReunion,
  listarReuniones,
  obtenerReunion,
} from "../src/db/reuniones.js";

// Combo fuera de rango (1-5, A-E son los reales): nunca choca con currículo
// real de producción, así que las pruebas de la capa DB pueden usarlo
// libremente sin arriesgar tocar datos de un colegio de verdad.
const GRADO_PRUEBA = 99;
const SECCION_PRUEBA = "Z";
const CHAT_PRUEBA_SEED = "seed-test-chat@s.whatsapp.net";

// Reuniones: el wizard de WhatsApp y la API HTTP sí validan grado 1-5 (rango
// real), así que ahí no se puede usar el combo centinela 99/Z como con
// docentes/plantilla_horario. En su lugar, se elige en tiempo de ejecución un
// grado real (1-5) que ahora mismo no tenga NINGÚN chat registrado (ver
// elegirGradoSinChatsReales), y se usa solo un chat propio de la prueba
// dentro de ese grado — así el reparto (fan-out) nunca puede alcanzar a un
// chat real de producción.
const CHAT_REUNION_Z = "reunion-fanout-z@s.whatsapp.net";
const CHAT_REUNION_Y = "reunion-fanout-y@s.whatsapp.net";
const CHAT_REUNION_WIZARD = "reunion-wizard-test@s.whatsapp.net";
const CHAT_REUNION_HTTP = "reunion-http-test@s.whatsapp.net";
const CHAT_ADMIN = process.env.OWNER_CHAT_ID!;
const CHAT_NO_ADMIN = "no-admin-test@s.whatsapp.net";
const CHATS_REUNION_PRUEBA = [
  CHAT_REUNION_Z,
  CHAT_REUNION_Y,
  CHAT_REUNION_WIZARD,
  CHAT_REUNION_HTTP,
  CHAT_NO_ADMIN,
];

function elegirGradoSinChatsReales(): number {
  for (let g = 1; g <= 5; g++) {
    if (listarChatsPorGradoSeccion(g, null).length === 0) return g;
  }
  throw new Error(
    "No hay ningún grado real (1-5) sin chats registrados; no se puede probar el " +
      "reparto de reuniones vía wizard/HTTP sin arriesgar avisar a chats reales.",
  );
}

const idsDocentes: number[] = [];
const idsClases: number[] = [];
const idsFechas: number[] = [];
const idsReuniones: number[] = [];
const idsCursos: number[] = [];

function limpiar() {
  for (const id of idsClases) db.prepare(`DELETE FROM plantilla_horario WHERE id = ?`).run(id);
  for (const id of idsDocentes) db.prepare(`DELETE FROM docentes WHERE id = ?`).run(id);
  for (const id of idsFechas) db.prepare(`DELETE FROM calendario_civico WHERE id = ?`).run(id);
  for (const id of idsCursos) db.prepare(`DELETE FROM cursos WHERE id = ?`).run(id);
  // Cualquier fila de plantilla_horario que haya quedado del generador sobre
  // el combo centinela (grado 99) — nunca se llama a generarHorarioGrado con
  // un grado real (1-5) en las pruebas, así que esto es lo único que puede
  // quedar pendiente de esa parte.
  db.prepare(`DELETE FROM plantilla_horario WHERE grado = ?`).run(GRADO_PRUEBA);
  db.prepare(`DELETE FROM eventos WHERE chatId = ?`).run(CHAT_PRUEBA_SEED);
  db.prepare(`DELETE FROM calendario_sembrado WHERE chatId = ?`).run(CHAT_PRUEBA_SEED);
  // Borrar la reunión ya borra en cascada los eventos repartidos con ese
  // reunionId; el DELETE de eventos/perfiles de abajo es solo una red de
  // seguridad extra por si una aserción falló a medio camino.
  for (const id of idsReuniones) db.prepare(`DELETE FROM reuniones WHERE id = ?`).run(id);
  for (const chatId of CHATS_REUNION_PRUEBA) {
    db.prepare(`DELETE FROM eventos WHERE chatId = ?`).run(chatId);
    db.prepare(`DELETE FROM perfiles WHERE chatId = ?`).run(chatId);
  }
}

let fallos = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`OK  - ${msg}`);
  } else {
    fallos++;
    console.log(`FAIL - ${msg}`);
  }
}

async function probarCapaDB() {
  // --- docentes CRUD, con varios grados a la vez (un docente puede dictar
  // cursos en más de un grado) ---
  const docente = crearDocente({
    nombre: "Prof. De Prueba",
    materia: "Prueba",
    contacto: "999999999",
    grados: [GRADO_PRUEBA, GRADO_PRUEBA + 1],
  });
  idsDocentes.push(docente.id);
  assert(
    docente.nombre === "Prof. De Prueba" && JSON.stringify(docente.grados) === JSON.stringify([GRADO_PRUEBA, GRADO_PRUEBA + 1]),
    "crearDocente guarda el nombre y la lista de grados",
  );
  assert(
    listarDocentes().some((d) => d.id === docente.id),
    "listarDocentes incluye el docente recién creado",
  );
  assert(
    listarDocentes(GRADO_PRUEBA).some((d) => d.id === docente.id) &&
      listarDocentes(GRADO_PRUEBA + 1).some((d) => d.id === docente.id) &&
      !listarDocentes(GRADO_PRUEBA + 2).some((d) => d.id === docente.id),
    "listarDocentes(grado) incluye al docente en CADA uno de sus grados, y en ninguno más",
  );

  assert(
    actualizarDocente(docente.id, { nombre: "Prof. Actualizado", materia: null, contacto: null, grados: [GRADO_PRUEBA + 1] }),
    "actualizarDocente devuelve true al encontrar el docente",
  );
  assert(
    obtenerDocente(docente.id)?.nombre === "Prof. Actualizado" &&
      JSON.stringify(obtenerDocente(docente.id)?.grados) === JSON.stringify([GRADO_PRUEBA + 1]),
    "actualizarDocente cambia los datos (incluidos los grados) de verdad",
  );
  assert(
    !actualizarDocente(999_999, { nombre: "x", materia: null, contacto: null, grados: [GRADO_PRUEBA] }),
    "actualizarDocente devuelve false si el id no existe",
  );

  // --- plantilla_horario CRUD (combo centinela) ---
  const clase = crearClasePlantilla({
    grado: GRADO_PRUEBA,
    seccion: SECCION_PRUEBA,
    titulo: "Materia de Prueba",
    hora: "07:00",
    dias: ["lun"],
    docenteId: docente.id,
    avisoPrevioMin: 5,
  });
  idsClases.push(clase.id);
  assert(
    listarPlantilla(GRADO_PRUEBA, SECCION_PRUEBA).some((c) => c.id === clase.id),
    "listarPlantilla(grado, seccion) incluye la clase recién creada",
  );

  assert(
    actualizarClasePlantilla(clase.id, {
      grado: GRADO_PRUEBA,
      seccion: SECCION_PRUEBA,
      titulo: "Materia de Prueba (editada)",
      hora: "07:30",
      dias: ["lun", "mie"],
      docenteId: docente.id,
      avisoPrevioMin: 10,
    }),
    "actualizarClasePlantilla devuelve true al encontrar la clase",
  );
  assert(
    obtenerClasePlantilla(clase.id)?.hora === "07:30",
    "actualizarClasePlantilla cambia la hora de verdad",
  );

  // --- ON DELETE SET NULL: borrar el docente no borra la clase ---
  assert(eliminarDocente(docente.id), "eliminarDocente borra el docente");
  idsDocentes.pop();
  assert(
    obtenerClasePlantilla(clase.id)?.docenteId === null,
    "al borrar el docente, la clase vinculada queda con docenteId null (ON DELETE SET NULL)",
  );

  // --- clonarSeccion ---
  const creadasClon = clonarSeccion(
    { grado: GRADO_PRUEBA, seccion: SECCION_PRUEBA },
    { grado: GRADO_PRUEBA, seccion: "Y" },
  );
  const clasesClonadas = listarPlantilla(GRADO_PRUEBA, "Y");
  for (const c of clasesClonadas) idsClases.push(c.id);
  assert(creadasClon === 1 && clasesClonadas.length === 1, "clonarSeccion copia las clases a la sección destino");

  assert(eliminarClasePlantilla(clase.id), "eliminarClasePlantilla borra la clase");
  idsClases.splice(idsClases.indexOf(clase.id), 1);
  assert(!eliminarClasePlantilla(999_999), "eliminarClasePlantilla devuelve false si el id no existe");

  // --- calendario_civico CRUD ---
  const fecha = crearFechaCivica({ titulo: "PRUEBA-Fecha Cívica", fecha: "2099-01-01" });
  idsFechas.push(fecha.id);
  assert(
    listarCalendarioCivico().some((f) => f.id === fecha.id),
    "listarCalendarioCivico incluye la fecha recién creada",
  );
  assert(
    actualizarFechaCivica(fecha.id, { titulo: "PRUEBA-Fecha Cívica (editada)", fecha: "2099-02-02" }),
    "actualizarFechaCivica devuelve true al encontrar la fecha",
  );
  assert(
    obtenerFechaCivica(fecha.id)?.fecha === "2099-02-02",
    "actualizarFechaCivica cambia la fecha de verdad",
  );
  assert(eliminarFechaCivica(fecha.id), "eliminarFechaCivica borra la fecha");
  idsFechas.pop();

  // --- seed.ts leyendo de la plantilla (no del array hardcodeado) ---
  const claseSeedA = crearClasePlantilla({
    grado: GRADO_PRUEBA,
    seccion: SECCION_PRUEBA,
    titulo: "Siembra Prueba A",
    hora: "07:00",
    dias: ["lun", "mar"],
    avisoPrevioMin: 5,
  });
  const claseSeedB = crearClasePlantilla({
    grado: GRADO_PRUEBA,
    seccion: SECCION_PRUEBA,
    titulo: "Siembra Prueba B",
    hora: "08:00",
    dias: ["vie"],
    avisoPrevioMin: 15,
  });
  idsClases.push(claseSeedA.id, claseSeedB.id);

  const creados = sembrarHorarioSeccion(CHAT_PRUEBA_SEED, GRADO_PRUEBA, SECCION_PRUEBA);
  const eventosSembrados = listarEventos(CHAT_PRUEBA_SEED);
  assert(creados === 2, "sembrarHorarioSeccion crea un evento por cada clase de la plantilla del combo");
  assert(
    eventosSembrados.some((e) => e.titulo === "Siembra Prueba A" && e.hora === "07:00") &&
      eventosSembrados.some((e) => e.titulo === "Siembra Prueba B" && e.hora === "08:00"),
    "los eventos sembrados reflejan el contenido real de plantilla_horario (no el array hardcodeado)",
  );
}

async function probarCursosYGenerador() {
  // --- cursos CRUD (combo centinela grado 99) ---
  const docenteCurso = crearDocente({ nombre: "Prof. Cursos Prueba", grados: [GRADO_PRUEBA] });
  idsDocentes.push(docenteCurso.id);

  const curso = crearCurso({
    grado: GRADO_PRUEBA,
    nombre: "Curso de Prueba",
    docenteId: docenteCurso.id,
    vecesPorSemana: 3,
  });
  idsCursos.push(curso.id);
  assert(curso.nombre === "Curso de Prueba" && curso.vecesPorSemana === 3, "crearCurso guarda los datos");
  assert(
    listarCursos(GRADO_PRUEBA).some((c) => c.id === curso.id),
    "listarCursos(grado) incluye el curso recién creado",
  );
  assert(
    !listarCursos(GRADO_PRUEBA + 1).some((c) => c.id === curso.id),
    "listarCursos(otroGrado) no lo incluye",
  );

  assert(
    actualizarCurso(curso.id, {
      grado: GRADO_PRUEBA,
      nombre: "Curso de Prueba (editado)",
      docenteId: docenteCurso.id,
      vecesPorSemana: 4,
    }),
    "actualizarCurso devuelve true al encontrar el curso",
  );
  assert(obtenerCurso(curso.id)?.vecesPorSemana === 4, "actualizarCurso cambia los datos de verdad");
  assert(!actualizarCurso(999_999, { grado: 1, nombre: "x" }), "actualizarCurso devuelve false si el id no existe");

  // --- ON DELETE SET NULL: borrar el docente no borra el curso ---
  assert(eliminarDocente(docenteCurso.id), "eliminarDocente borra el docente del curso");
  idsDocentes.splice(idsDocentes.indexOf(docenteCurso.id), 1);
  assert(
    obtenerCurso(curso.id)?.docenteId === null,
    "al borrar el docente, el curso vinculado queda con docenteId null (ON DELETE SET NULL)",
  );

  assert(eliminarCurso(curso.id), "eliminarCurso borra el curso");
  idsCursos.splice(idsCursos.indexOf(curso.id), 1);
  assert(!eliminarCurso(curso.id), "eliminarCurso devuelve false si ya no existe");

  // --- generarHorarioGrado: caso normal, sin choques ---
  // Nunca se llama con un grado real (1-5): DELETE FROM plantilla_horario
  // WHERE grado=? es destructivo, y un grado real ya tiene el currículo de
  // producción. El combo centinela 99 es el único seguro para esto.
  const docenteGen = crearDocente({ nombre: "Prof. Generador Prueba", grados: [GRADO_PRUEBA] });
  idsDocentes.push(docenteGen.id);
  const cursoA = crearCurso({ grado: GRADO_PRUEBA, nombre: "Curso A", docenteId: docenteGen.id, vecesPorSemana: 3 });
  const cursoB = crearCurso({ grado: GRADO_PRUEBA, nombre: "Curso B", docenteId: docenteGen.id, vecesPorSemana: 2 });
  const cursoC = crearCurso({ grado: GRADO_PRUEBA, nombre: "Curso C", docenteId: null, vecesPorSemana: 2 });
  idsCursos.push(cursoA.id, cursoB.id, cursoC.id);

  const resultado = generarHorarioGrado(GRADO_PRUEBA);
  const filasGeneradas = listarPlantilla(GRADO_PRUEBA);
  for (const f of filasGeneradas) idsClases.push(f.id);

  assert(resultado.avisos.length === 0, "con carga razonable, el generador ubica todo sin avisos de cupo");
  assert(
    resultado.filasCreadas === filasGeneradas.length,
    "el conteo de filas creadas que devuelve el generador coincide con lo que quedó en la plantilla",
  );
  assert(
    new Set(filasGeneradas.map((f) => f.seccion)).size === 5,
    "el generador arma horario para las 5 secciones (A-E), no solo una",
  );

  let choquesSeccion = 0;
  const ocupadoPorSeccion = new Map<string, Set<string>>();
  for (const f of filasGeneradas) {
    const set = ocupadoPorSeccion.get(f.seccion) ?? new Set<string>();
    ocupadoPorSeccion.set(f.seccion, set);
    for (const dia of f.dias) {
      const key = `${dia}-${f.hora}`;
      if (set.has(key)) choquesSeccion++;
      set.add(key);
    }
  }
  assert(choquesSeccion === 0, "ninguna sección tiene dos clases a la misma hora el mismo día");

  let choquesDocente = 0;
  const ocupadoPorDocente = new Map<string, Set<string>>();
  for (const f of filasGeneradas) {
    if (f.docenteId === null) continue;
    for (const dia of f.dias) {
      const key = `${f.docenteId}-${dia}-${f.hora}`;
      const secciones = ocupadoPorDocente.get(key) ?? new Set<string>();
      ocupadoPorDocente.set(key, secciones);
      secciones.add(f.seccion);
      if (secciones.size > 1) choquesDocente++;
    }
  }
  assert(
    choquesDocente === 0,
    "el mismo docente nunca queda dictando en dos secciones a la misma hora el mismo día",
  );

  // --- generarHorarioGrado: regenerar borra lo anterior (no acumula) ---
  const resultado2 = generarHorarioGrado(GRADO_PRUEBA);
  const filasTrasRegenerar = listarPlantilla(GRADO_PRUEBA);
  for (const f of filasTrasRegenerar) idsClases.push(f.id);
  assert(
    resultado2.filasCreadas === filasTrasRegenerar.length && filasTrasRegenerar.length < filasGeneradas.length * 2,
    "generar de nuevo reemplaza el horario anterior del grado, no lo acumula",
  );

  // --- generarHorarioGrado: reporta avisos si no hay cupo, sin producir choques ---
  db.prepare(`DELETE FROM plantilla_horario WHERE grado = ?`).run(GRADO_PRUEBA);
  for (const c of listarCursos(GRADO_PRUEBA)) eliminarCurso(c.id);
  idsCursos.length = 0;

  const docenteSobrecargado = crearDocente({ nombre: "Prof. Sobrecargado Prueba", grados: [GRADO_PRUEBA] });
  idsDocentes.push(docenteSobrecargado.id);
  for (let i = 1; i <= 7; i++) {
    const c = crearCurso({
      grado: GRADO_PRUEBA,
      nombre: `Curso Estrés ${i}`,
      docenteId: docenteSobrecargado.id,
      vecesPorSemana: 5,
    });
    idsCursos.push(c.id);
  }

  const resultadoEstres = generarHorarioGrado(GRADO_PRUEBA);
  const filasEstres = listarPlantilla(GRADO_PRUEBA);
  for (const f of filasEstres) idsClases.push(f.id);

  assert(
    resultadoEstres.avisos.length > 0,
    "cuando un docente está sobrecargado (35 sesiones/semana pedidas, máximo real 30), el generador avisa en vez de fallar silenciosamente",
  );

  let choquesEstres = 0;
  const ocupadoEstres = new Map<string, Set<string>>();
  for (const f of filasEstres) {
    if (f.docenteId === null) continue;
    for (const dia of f.dias) {
      const key = `${f.docenteId}-${dia}-${f.hora}`;
      const secciones = ocupadoEstres.get(key) ?? new Set<string>();
      ocupadoEstres.set(key, secciones);
      secciones.add(f.seccion);
      if (secciones.size > 1) choquesEstres++;
    }
  }
  assert(
    choquesEstres === 0,
    "incluso sobrecargado al límite, el generador nunca produce un choque de docente entre secciones",
  );

  // --- generarHorarioGrado: un docente que dicta en DOS grados distintos
  // nunca queda con un choque de horario ENTRE esos grados (antes de este
  // caso ni siquiera era posible: un docente dictaba un solo grado) ---
  db.prepare(`DELETE FROM plantilla_horario WHERE grado = ?`).run(GRADO_PRUEBA);
  for (const c of listarCursos(GRADO_PRUEBA)) eliminarCurso(c.id);
  idsCursos.length = 0;

  const GRADO_PRUEBA_2 = GRADO_PRUEBA + 1; // 100: otro combo centinela, distinto de 99
  const docenteMultiGrado = crearDocente({
    nombre: "Prof. Multi-Grado Prueba",
    grados: [GRADO_PRUEBA, GRADO_PRUEBA_2],
  });
  idsDocentes.push(docenteMultiGrado.id);
  const cursoGradoA = crearCurso({
    grado: GRADO_PRUEBA,
    nombre: "Curso Multi-Grado A",
    docenteId: docenteMultiGrado.id,
    vecesPorSemana: 3,
  });
  const cursoGradoB = crearCurso({
    grado: GRADO_PRUEBA_2,
    nombre: "Curso Multi-Grado B",
    docenteId: docenteMultiGrado.id,
    vecesPorSemana: 3,
  });
  idsCursos.push(cursoGradoA.id, cursoGradoB.id);

  generarHorarioGrado(GRADO_PRUEBA);
  generarHorarioGrado(GRADO_PRUEBA_2);

  const filasMultiA = listarPlantilla(GRADO_PRUEBA);
  const filasMultiB = listarPlantilla(GRADO_PRUEBA_2);
  for (const f of [...filasMultiA, ...filasMultiB]) idsClases.push(f.id);

  const ocupadoPorGrado = new Map<string, string>(); // "dia-hora" -> "grado°seccion" que lo usa
  let choquesEntreGrados = 0;
  for (const f of [...filasMultiA, ...filasMultiB]) {
    if (f.docenteId !== docenteMultiGrado.id) continue;
    for (const dia of f.dias) {
      const key = `${dia}-${f.hora}`;
      const marca = `${f.grado}°${f.seccion}`;
      if (ocupadoPorGrado.has(key) && ocupadoPorGrado.get(key) !== marca) choquesEntreGrados++;
      ocupadoPorGrado.set(key, marca);
    }
  }
  assert(
    choquesEntreGrados === 0,
    "un docente que dicta en dos grados distintos nunca queda con un choque de horario entre esos grados",
  );

  // regenerar el primer grado de nuevo: sigue respetando lo que el mismo
  // docente ya tiene comprometido en el segundo grado (que no se tocó)
  generarHorarioGrado(GRADO_PRUEBA);
  const filasMultiARegenerado = listarPlantilla(GRADO_PRUEBA);
  const filasMultiBIntacto = listarPlantilla(GRADO_PRUEBA_2);
  for (const f of filasMultiARegenerado) idsClases.push(f.id);

  const ocupadoTrasRegenerar = new Map<string, string>();
  let choquesTrasRegenerar = 0;
  for (const f of [...filasMultiARegenerado, ...filasMultiBIntacto]) {
    if (f.docenteId !== docenteMultiGrado.id) continue;
    for (const dia of f.dias) {
      const key = `${dia}-${f.hora}`;
      const marca = `${f.grado}°${f.seccion}`;
      if (ocupadoTrasRegenerar.has(key) && ocupadoTrasRegenerar.get(key) !== marca) choquesTrasRegenerar++;
      ocupadoTrasRegenerar.set(key, marca);
    }
  }
  assert(
    choquesTrasRegenerar === 0,
    "regenerar un grado sigue respetando los compromisos vigentes del mismo docente en el otro grado",
  );

  db.prepare(`DELETE FROM plantilla_horario WHERE grado = ?`).run(GRADO_PRUEBA_2);
}

async function probarReunionesDB() {
  // --- listarChatsPorGradoSeccion: la base de todo el reparto (fan-out) ---
  guardarPerfil(CHAT_REUNION_Z, GRADO_PRUEBA, SECCION_PRUEBA);
  guardarPerfil(CHAT_REUNION_Y, GRADO_PRUEBA, "Y");

  assert(
    listarChatsPorGradoSeccion(GRADO_PRUEBA, SECCION_PRUEBA).includes(CHAT_REUNION_Z) &&
      !listarChatsPorGradoSeccion(GRADO_PRUEBA, SECCION_PRUEBA).includes(CHAT_REUNION_Y),
    "listarChatsPorGradoSeccion(grado, seccion) filtra por sección exacta",
  );
  assert(
    listarChatsPorGradoSeccion(GRADO_PRUEBA, null).includes(CHAT_REUNION_Z) &&
      listarChatsPorGradoSeccion(GRADO_PRUEBA, null).includes(CHAT_REUNION_Y),
    "listarChatsPorGradoSeccion(grado, null) incluye todas las secciones de ese grado",
  );
  assert(
    listarChatsPorGradoSeccion(null, null).includes(CHAT_REUNION_Z) &&
      listarChatsPorGradoSeccion(null, null).includes(CHAT_REUNION_Y),
    "listarChatsPorGradoSeccion(null, null) incluye chats de cualquier grado (colegio completo)",
  );

  // --- crearReunion: reparte solo a quien calza grado+sección exactos ---
  const { reunion, avisados } = crearReunion({
    titulo: "PRUEBA-Reunión 99Z",
    fecha: "2099-03-01",
    hora: "18:00",
    lugar: "Auditorio de prueba",
    grado: GRADO_PRUEBA,
    seccion: SECCION_PRUEBA,
    avisoPrevioMin: 30,
  });
  idsReuniones.push(reunion.id);
  assert(avisados === 1, "crearReunion reparte solo al chat que calza grado+sección exactos");
  assert(
    listarEventos(CHAT_REUNION_Z).some((e) => e.reunionId === reunion.id && e.titulo === "PRUEBA-Reunión 99Z"),
    "el chat que calza recibe el recordatorio repartido con el reunionId correcto",
  );
  assert(
    !listarEventos(CHAT_REUNION_Y).some((e) => e.reunionId === reunion.id),
    "el chat de otra sección del mismo grado no recibe el recordatorio",
  );
  assert(
    listarReuniones().some((r) => r.id === reunion.id),
    "listarReuniones incluye la reunión recién creada",
  );
  assert(obtenerReunion(reunion.id)?.titulo === "PRUEBA-Reunión 99Z", "obtenerReunion trae los datos correctos");

  // --- actualizarReunion: re-reparte desde cero (sin duplicar) ---
  const actualizacion = actualizarReunion(reunion.id, {
    titulo: "PRUEBA-Reunión 99 (editada)",
    fecha: "2099-03-02",
    hora: "19:00",
    lugar: null,
    grado: GRADO_PRUEBA,
    seccion: null, // ahora aplica a TODO el grado 99, no solo a la sección Z
    avisoPrevioMin: 45,
  });
  assert(
    actualizacion.actualizada && actualizacion.avisados === 2,
    "actualizarReunion re-reparte a todo el grado tras ampliar el destino (seccion: null)",
  );
  assert(
    listarEventos(CHAT_REUNION_Z).some(
      (e) => e.reunionId === reunion.id && e.titulo === "PRUEBA-Reunión 99 (editada)",
    ) &&
      listarEventos(CHAT_REUNION_Y).some(
        (e) => e.reunionId === reunion.id && e.titulo === "PRUEBA-Reunión 99 (editada)",
      ),
    "tras actualizar, ambos chats del grado tienen el recordatorio con el contenido nuevo",
  );
  assert(
    listarEventos(CHAT_REUNION_Z).filter((e) => e.reunionId === reunion.id).length === 1,
    "actualizarReunion no deja duplicados: borra el recordatorio viejo antes de repartir el nuevo",
  );
  assert(
    !actualizarReunion(999_999, { titulo: "x", fecha: "2099-01-01", hora: "10:00" }).actualizada,
    "actualizarReunion devuelve actualizada:false si el id no existe",
  );

  // --- eliminarReunion: ON DELETE CASCADE borra los recordatorios repartidos ---
  assert(eliminarReunion(reunion.id), "eliminarReunion borra la reunión");
  idsReuniones.splice(idsReuniones.indexOf(reunion.id), 1);
  assert(
    !listarEventos(CHAT_REUNION_Z).some((e) => e.reunionId === reunion.id) &&
      !listarEventos(CHAT_REUNION_Y).some((e) => e.reunionId === reunion.id),
    "al borrar la reunión, los recordatorios ya repartidos se borran solos (ON DELETE CASCADE)",
  );
  assert(obtenerReunion(reunion.id) === null, "obtenerReunion devuelve null tras borrar");
  assert(!eliminarReunion(reunion.id), "eliminarReunion devuelve false si ya no existe");
}

async function probarReunionesRouter() {
  const gradoSeguro = elegirGradoSinChatsReales();
  const { manejarMensaje } = await import("../src/commands/router.js");

  const sent: { chatId: string; text: string }[] = [];
  const mockSock = {
    sendMessage: async (chatId: string, content: { text?: string }) => {
      sent.push({ chatId, text: content.text ?? "" });
      return {};
    },
  } as unknown as WASocket;
  const SIN_MENSAJE_CITADO = {} as proto.IWebMessageInfo;

  async function last(chatId: string, texto: string): Promise<string> {
    const antes = sent.length;
    await manejarMensaje(mockSock, chatId, texto, SIN_MENSAJE_CITADO);
    return sent.slice(antes).map((s) => s.text).join("\n---\n");
  }

  const RECHAZO_ADMIN = "Ese comando de reuniones es solo para el administrador del colegio.";

  // --- autorización: solo el chat admin (OWNER_CHAT_ID) puede escribir ---
  assert(
    (await last(CHAT_NO_ADMIN, "!reunion agregar")) === RECHAZO_ADMIN,
    "un chat no-admin no puede iniciar !reunion agregar",
  );
  assert(
    (await last(CHAT_NO_ADMIN, "!reunion editar 1")) === RECHAZO_ADMIN,
    "un chat no-admin no puede usar !reunion editar",
  );
  assert(
    (await last(CHAT_NO_ADMIN, "!reunion borrar 1")) === RECHAZO_ADMIN,
    "un chat no-admin no puede usar !reunion borrar",
  );
  assert(
    (await last(CHAT_NO_ADMIN, "!reunion listar")) === RECHAZO_ADMIN,
    "un chat no-admin no puede usar !reunion listar",
  );
  assert(
    (await last(CHAT_NO_ADMIN, "!reunion")) !== RECHAZO_ADMIN,
    "cualquier chat sí puede leer sus próximas reuniones con !reunion sin subcomando",
  );

  // --- usos inválidos (ya autenticado como admin) ---
  assert(
    (await last(CHAT_ADMIN, "!reunion editar")).startsWith("Uso: !reunion editar"),
    "!reunion editar sin id devuelve el mensaje de uso",
  );
  assert(
    (await last(CHAT_ADMIN, "!reunion borrar")).startsWith("Uso: !reunion borrar"),
    "!reunion borrar sin id devuelve el mensaje de uso",
  );
  assert(
    (await last(CHAT_ADMIN, "!reunion algoquenoexiste")).startsWith("Subcomando no reconocido"),
    "un subcomando desconocido devuelve el mensaje de ayuda",
  );
  assert(
    (await last(CHAT_ADMIN, "!reunion editar 999999")).includes("No encontré la reunión"),
    "editar un id inexistente no crea el wizard, solo avisa que no existe",
  );

  // --- wizard completo: crear, listar, editar, borrar (grado real sin chats reales) ---
  guardarPerfil(CHAT_REUNION_WIZARD, gradoSeguro, "A");

  const inicio = await last(CHAT_ADMIN, "!reunion agregar");
  assert(inicio.includes("¿Para qué grado?"), "!reunion agregar (admin) inicia el wizard preguntando el grado");
  await last(CHAT_ADMIN, String(gradoSeguro));
  await last(CHAT_ADMIN, "A");
  await last(CHAT_ADMIN, "PRUEBA-Reunión wizard");
  await last(CHAT_ADMIN, "2099-04-01");
  await last(CHAT_ADMIN, "17:00");
  await last(CHAT_ADMIN, "ninguno");
  const creacion = await last(CHAT_ADMIN, "60");
  assert(
    creacion.includes("Reunión creada") && creacion.includes("avisó de inmediato a 1 chat"),
    "el wizard completo crea la reunión y avisa solo al chat de prueba registrado en ese grado/sección",
  );

  const idCreado = Number(creacion.match(/#(\d+)/)?.[1]);
  assert(Number.isInteger(idCreado) && idCreado > 0, "se pudo extraer el id de la reunión creada por el wizard");
  idsReuniones.push(idCreado);

  const listado = await last(CHAT_ADMIN, "!reunion listar");
  assert(
    listado.includes(`#${idCreado}`) && listado.includes("PRUEBA-Reunión wizard"),
    "!reunion listar (admin) muestra la reunión recién creada con su id",
  );

  const inicioEdit = await last(CHAT_ADMIN, `!reunion editar ${idCreado}`);
  assert(inicioEdit.includes(`#${idCreado}`), "!reunion editar (admin) inicia el wizard de edición mencionando el id");
  await last(CHAT_ADMIN, String(gradoSeguro));
  await last(CHAT_ADMIN, "todos"); // toda la sección del mismo grado seguro: sigue sin tocar chats reales
  await last(CHAT_ADMIN, "PRUEBA-Reunión wizard (editada)");
  await last(CHAT_ADMIN, "2099-04-02");
  await last(CHAT_ADMIN, "18:00");
  await last(CHAT_ADMIN, "ninguno");
  const edicion = await last(CHAT_ADMIN, "30");
  assert(
    edicion.includes(`Reunión #${idCreado} actualizada`) && edicion.includes("Avisé a 1 chat"),
    "el wizard de edición actualiza la reunión y re-avisa (sigue siendo 1 solo chat en ese grado)",
  );
  assert(
    listarEventos(CHAT_REUNION_WIZARD).some(
      (e) => e.reunionId === idCreado && e.titulo === "PRUEBA-Reunión wizard (editada)",
    ),
    "el recordatorio del chat de prueba refleja el contenido editado",
  );

  // cancelar a medio wizard
  await last(CHAT_ADMIN, "!reunion agregar");
  assert(
    (await last(CHAT_ADMIN, "cancelar")) === "Listo, cancelé el proceso.",
    "cancelar a medio wizard lo aborta",
  );
  assert(
    !(await last(CHAT_ADMIN, "!reunion")).includes("cancel"),
    "tras cancelar, !reunion vuelve a responder como comando normal (ya no sigue en el wizard)",
  );

  const borrado = await last(CHAT_ADMIN, `!reunion borrar ${idCreado}`);
  assert(borrado.includes(`Reunión #${idCreado} eliminada`), "!reunion borrar (admin) elimina la reunión");
  idsReuniones.splice(idsReuniones.indexOf(idCreado), 1);
  assert(
    !listarEventos(CHAT_REUNION_WIZARD).some((e) => e.reunionId === idCreado),
    "al borrar desde WhatsApp, el recordatorio repartido también desaparece (cascada)",
  );
  assert(
    (await last(CHAT_ADMIN, `!reunion borrar ${idCreado}`)).includes("No encontré la reunión"),
    "borrar un id ya borrado devuelve el mensaje de no encontrado",
  );
}

async function probarRutasExpress() {
  const { crearAdminApp } = await import("../src/admin/server.js");
  const app = crearAdminApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  try {
    // login con credenciales incorrectas
    const loginMalo = await fetch(`${base}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "admin-de-prueba", contrasena: "clave-incorrecta" }),
    });
    assert(loginMalo.status === 401, "login con contraseña incorrecta responde 401");

    // acceso sin sesión
    const sinSesion = await fetch(`${base}/api/docentes`);
    assert(sinSesion.status === 401, "GET /api/docentes sin sesión responde 401");

    // login correcto
    const loginOk = await fetch(`${base}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "admin-de-prueba", contrasena: "clave-de-prueba-123" }),
    });
    assert(loginOk.status === 200, "login con credenciales correctas responde 200");
    const cookie = loginOk.headers.get("set-cookie")?.split(";")[0];
    assert(cookie !== undefined, "el login deja una cookie de sesión");
    const headers = { Cookie: cookie ?? "", "Content-Type": "application/json" };

    // sesión activa
    const sesionResp = await fetch(`${base}/api/admin/session`, { headers });
    const sesionBody = (await sesionResp.json()) as { autenticado: boolean };
    assert(sesionBody.autenticado === true, "GET /api/admin/session confirma la sesión activa");

    // CRUD de docentes vía HTTP
    const docenteSinGradoResp = await fetch(`${base}/api/docentes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ nombre: "No debería crearse", materia: "Prueba" }),
    });
    assert(docenteSinGradoResp.status === 400, "POST /api/docentes rechaza si falta 'grados'");

    const docenteGradosVacioResp = await fetch(`${base}/api/docentes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ nombre: "No debería crearse", grados: [] }),
    });
    assert(docenteGradosVacioResp.status === 400, "POST /api/docentes rechaza grados: [] (ningún grado elegido)");

    const docenteGradoInvalidoResp = await fetch(`${base}/api/docentes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ nombre: "No debería crearse", grados: [GRADO_PRUEBA] }),
    });
    assert(docenteGradoInvalidoResp.status === 400, "POST /api/docentes rechaza un grado fuera de rango (1-5)");

    const GRADO_HTTP_DOCENTE_1 = 4;
    const GRADO_HTTP_DOCENTE_2 = 2;
    const crearResp = await fetch(`${base}/api/docentes`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        nombre: "Prof. HTTP",
        materia: "Prueba",
        grados: [GRADO_HTTP_DOCENTE_1, GRADO_HTTP_DOCENTE_2],
      }),
    });
    assert(crearResp.status === 201, "POST /api/docentes crea un docente con grados válidos");
    const docenteCreado = (await crearResp.json()) as { id: number; grados: number[] };
    idsDocentes.push(docenteCreado.id);
    assert(
      JSON.stringify(docenteCreado.grados) === JSON.stringify([GRADO_HTTP_DOCENTE_2, GRADO_HTTP_DOCENTE_1].sort((a, b) => a - b)),
      "el docente creado guarda los grados enviados (ordenados, sin duplicados)",
    );

    const listarResp = await fetch(`${base}/api/docentes`, { headers });
    const docentesListados = (await listarResp.json()) as { id: number }[];
    assert(
      docentesListados.some((d) => d.id === docenteCreado.id),
      "GET /api/docentes lista el docente recién creado",
    );

    const listarPorGradoResp = await fetch(`${base}/api/docentes?grado=${GRADO_HTTP_DOCENTE_1}`, { headers });
    const docentesPorGrado = (await listarPorGradoResp.json()) as { id: number }[];
    assert(
      docentesPorGrado.some((d) => d.id === docenteCreado.id),
      "GET /api/docentes?grado= incluye al docente en CADA uno de sus grados",
    );
    const listarPorGrado2Resp = await fetch(`${base}/api/docentes?grado=${GRADO_HTTP_DOCENTE_2}`, { headers });
    const docentesPorGrado2 = (await listarPorGrado2Resp.json()) as { id: number }[];
    assert(
      docentesPorGrado2.some((d) => d.id === docenteCreado.id),
      "GET /api/docentes?grado= también lo incluye en su segundo grado",
    );
    const listarOtroGradoResp = await fetch(`${base}/api/docentes?grado=1`, { headers });
    const docentesOtroGrado = (await listarOtroGradoResp.json()) as { id: number }[];
    assert(
      !docentesOtroGrado.some((d) => d.id === docenteCreado.id),
      "GET /api/docentes?grado= no incluye docentes que no dictan ese grado",
    );

    const eliminarResp = await fetch(`${base}/api/docentes/${docenteCreado.id}`, {
      method: "DELETE",
      headers,
    });
    assert(eliminarResp.status === 204, "DELETE /api/docentes/:id borra el docente");
    idsDocentes.pop();

    // validación de rango en la API (grado 1-5, sección A-E) — a diferencia
    // de la capa DB, acá SÍ debe rechazar el combo centinela 99/Z.
    const claseInvalida = await fetch(`${base}/api/plantilla-horario`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        grado: GRADO_PRUEBA,
        seccion: SECCION_PRUEBA,
        titulo: "No debería crearse",
        hora: "07:00",
        dias: ["lun"],
      }),
    });
    assert(
      claseInvalida.status === 400,
      "POST /api/plantilla-horario rechaza grado/sección fuera de rango (1-5, A-E), aunque la capa DB no lo exija",
    );

    // --- CRUD de cursos vía HTTP ---
    // Crear/editar/borrar un curso es aditivo y aislado (una fila propia, con
    // id rastreado) así que SÍ es seguro hacerlo con un grado real (a
    // diferencia de "generar horario", que borra y reescribe la plantilla
    // completa de ese grado — a eso ni se le acerca esta prueba).
    const cursoInvalido = await fetch(`${base}/api/cursos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ grado: GRADO_PRUEBA, nombre: "No debería crearse" }),
    });
    assert(cursoInvalido.status === 400, "POST /api/cursos rechaza grado fuera de rango (1-5)");

    const GRADO_HTTP_CURSO = 2;
    const crearCursoResp = await fetch(`${base}/api/cursos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ grado: GRADO_HTTP_CURSO, nombre: "PRUEBA-Curso HTTP", vecesPorSemana: 3 }),
    });
    assert(crearCursoResp.status === 201, "POST /api/cursos crea un curso válido");
    const cursoCreadoHttp = (await crearCursoResp.json()) as { id: number; nombre: string };
    idsCursos.push(cursoCreadoHttp.id);

    const listarCursosResp = await fetch(`${base}/api/cursos?grado=${GRADO_HTTP_CURSO}`, { headers });
    const cursosListadosHttp = (await listarCursosResp.json()) as { id: number }[];
    assert(
      cursosListadosHttp.some((c) => c.id === cursoCreadoHttp.id),
      "GET /api/cursos?grado= lista el curso recién creado",
    );

    const actualizarCursoResp = await fetch(`${base}/api/cursos/${cursoCreadoHttp.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ grado: GRADO_HTTP_CURSO, nombre: "PRUEBA-Curso HTTP (editado)", vecesPorSemana: 2 }),
    });
    assert(actualizarCursoResp.status === 200, "PUT /api/cursos/:id actualiza el curso");

    const eliminarCursoResp = await fetch(`${base}/api/cursos/${cursoCreadoHttp.id}`, {
      method: "DELETE",
      headers,
    });
    assert(eliminarCursoResp.status === 204, "DELETE /api/cursos/:id elimina el curso");
    idsCursos.splice(idsCursos.indexOf(cursoCreadoHttp.id), 1);

    // "Generar horario" en cambio SÍ es destructivo (borra y reescribe la
    // plantilla del grado), así que solo se prueba el rechazo por grado
    // inválido — nunca se llama con un grado real (ver nota arriba).
    const generarInvalido = await fetch(`${base}/api/cursos/generar-horario`, {
      method: "POST",
      headers,
      body: JSON.stringify({ grado: GRADO_PRUEBA }),
    });
    assert(
      generarInvalido.status === 400,
      "POST /api/cursos/generar-horario rechaza un grado fuera de rango (1-5)",
    );
    const generarSinBody = await fetch(`${base}/api/cursos/generar-horario`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    assert(generarSinBody.status === 400, "POST /api/cursos/generar-horario rechaza si falta el grado");

    // --- CRUD de reuniones vía HTTP (grado 1-5 real, igual que la API valida) ---
    const gradoSeguroHttp = elegirGradoSinChatsReales();
    guardarPerfil(CHAT_REUNION_HTTP, gradoSeguroHttp, "B");

    // el combo centinela 99/Z, válido en la capa DB, la API sí debe rechazarlo
    const reunionInvalida = await fetch(`${base}/api/reuniones`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        titulo: "No debería crearse",
        fecha: "2099-05-01",
        hora: "18:00",
        grado: GRADO_PRUEBA,
        seccion: SECCION_PRUEBA,
      }),
    });
    assert(reunionInvalida.status === 400, "POST /api/reuniones rechaza grado fuera de rango (1-5)");

    const seccionSinGrado = await fetch(`${base}/api/reuniones`, {
      method: "POST",
      headers,
      body: JSON.stringify({ titulo: "x", fecha: "2099-05-01", hora: "18:00", grado: null, seccion: "B" }),
    });
    assert(seccionSinGrado.status === 400, "POST /api/reuniones rechaza una sección sin grado");

    const crearReunionResp = await fetch(`${base}/api/reuniones`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        titulo: "PRUEBA-Reunión HTTP",
        fecha: "2099-05-01",
        hora: "18:00",
        lugar: "Sala de prueba",
        grado: gradoSeguroHttp,
        seccion: "B",
        avisoPrevioMin: 20,
      }),
    });
    assert(crearReunionResp.status === 201, "POST /api/reuniones crea una reunión válida");
    const reunionCreadaHttp = (await crearReunionResp.json()) as { id: number; avisados: number };
    idsReuniones.push(reunionCreadaHttp.id);
    assert(
      reunionCreadaHttp.avisados === 1,
      "POST /api/reuniones reparte de inmediato solo al chat de prueba registrado en ese grado/sección",
    );

    const obtenerReunionResp = await fetch(`${base}/api/reuniones/${reunionCreadaHttp.id}`, { headers });
    const reunionObtenidaHttp = (await obtenerReunionResp.json()) as { titulo: string };
    assert(
      obtenerReunionResp.status === 200 && reunionObtenidaHttp.titulo === "PRUEBA-Reunión HTTP",
      "GET /api/reuniones/:id trae la reunión recién creada",
    );

    const listarReunionesResp = await fetch(`${base}/api/reuniones`, { headers });
    const reunionesListadasHttp = (await listarReunionesResp.json()) as { id: number }[];
    assert(
      reunionesListadasHttp.some((r) => r.id === reunionCreadaHttp.id),
      "GET /api/reuniones lista la reunión recién creada",
    );

    const horaInvalida = await fetch(`${base}/api/reuniones/${reunionCreadaHttp.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ titulo: "x", fecha: "2099-05-01", hora: "25:99" }),
    });
    assert(horaInvalida.status === 400, "PUT /api/reuniones/:id rechaza una hora con formato inválido");

    const actualizarReunionResp = await fetch(`${base}/api/reuniones/${reunionCreadaHttp.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        titulo: "PRUEBA-Reunión HTTP (editada)",
        fecha: "2099-05-02",
        hora: "19:00",
        grado: gradoSeguroHttp,
        seccion: "B",
        avisoPrevioMin: 10,
      }),
    });
    const reunionActualizadaHttp = (await actualizarReunionResp.json()) as { avisados: number };
    assert(
      actualizarReunionResp.status === 200 && reunionActualizadaHttp.avisados === 1,
      "PUT /api/reuniones/:id actualiza y re-reparte la reunión",
    );
    assert(
      listarEventos(CHAT_REUNION_HTTP).some(
        (e) => e.reunionId === reunionCreadaHttp.id && e.titulo === "PRUEBA-Reunión HTTP (editada)",
      ),
      "tras el PUT, el recordatorio repartido refleja el contenido editado",
    );

    const eliminarReunionResp = await fetch(`${base}/api/reuniones/${reunionCreadaHttp.id}`, {
      method: "DELETE",
      headers,
    });
    assert(eliminarReunionResp.status === 204, "DELETE /api/reuniones/:id elimina la reunión");
    idsReuniones.splice(idsReuniones.indexOf(reunionCreadaHttp.id), 1);
    assert(
      !listarEventos(CHAT_REUNION_HTTP).some((e) => e.reunionId === reunionCreadaHttp.id),
      "tras el DELETE, el recordatorio repartido se borra en cascada",
    );

    const obtenerBorradaResp = await fetch(`${base}/api/reuniones/${reunionCreadaHttp.id}`, { headers });
    assert(obtenerBorradaResp.status === 404, "GET /api/reuniones/:id de una reunión borrada responde 404");

    const eliminarInexistenteResp = await fetch(`${base}/api/reuniones/${reunionCreadaHttp.id}`, {
      method: "DELETE",
      headers,
    });
    assert(eliminarInexistenteResp.status === 404, "DELETE /api/reuniones/:id ya borrada responde 404");

    // GET /api/resumen trae la forma esperada
    const resumenResp = await fetch(`${base}/api/resumen`, { headers });
    const resumen = (await resumenResp.json()) as Record<string, number>;
    assert(
      typeof resumen.docentes === "number" &&
        typeof resumen.cursos === "number" &&
        typeof resumen.clasesPlantilla === "number" &&
        typeof resumen.fechasCivicas === "number" &&
        typeof resumen.chatsRegistrados === "number" &&
        typeof resumen.reuniones === "number",
      "GET /api/resumen devuelve los conteos esperados para el dashboard, incluyendo reuniones",
    );

    // GET /api/whatsapp/estado y /qr: de solo lectura, seguros de probar tal
    // cual. POST /api/whatsapp/desvincular NO se prueba acá a propósito —
    // incluso en el caso "sin conexión activa" termina borrando la carpeta
    // auth_info/ real (ver src/bot/connection.ts), y este script corre
    // contra la base/carpetas reales del proyecto. Probarlo de verdad
    // requeriría un socket de WhatsApp real, fuera del alcance de estas
    // pruebas automatizadas.
    const estadoWaResp = await fetch(`${base}/api/whatsapp/estado`, { headers });
    const estadoWa = (await estadoWaResp.json()) as { conectado: boolean; tieneQR: boolean };
    assert(
      estadoWaResp.status === 200 && typeof estadoWa.conectado === "boolean" && typeof estadoWa.tieneQR === "boolean",
      "GET /api/whatsapp/estado devuelve conectado/tieneQR",
    );
    const qrWaResp = await fetch(`${base}/api/whatsapp/qr`, { headers });
    assert(
      qrWaResp.status === 200 || qrWaResp.status === 404,
      "GET /api/whatsapp/qr responde 200 (si hay QR guardado) o 404 (si no hay)",
    );

    // logout invalida la sesión
    const logoutResp = await fetch(`${base}/api/admin/logout`, { method: "POST", headers });
    assert(logoutResp.status === 200, "logout responde 200");
    const trasLogout = await fetch(`${base}/api/docentes`, { headers });
    assert(trasLogout.status === 401, "tras el logout, la misma cookie ya no da acceso");
  } finally {
    server.close();
  }
}

async function main() {
  await probarCapaDB();
  await probarCursosYGenerador();
  await probarReunionesDB();
  await probarReunionesRouter();
  await probarRutasExpress();
}

main()
  .catch((err) => {
    fallos++;
    console.error("Error inesperado durante las pruebas del panel de admin:", err);
  })
  .finally(() => {
    limpiar();
    console.log(`\n${fallos === 0 ? "TODO OK" : `${fallos} FALLO(S)`}`);
    process.exit(fallos === 0 ? 0 : 1);
  });
