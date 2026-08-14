# Bot de WhatsApp – Recordatorio de Eventos y Horarios

**Stack elegido:** Node.js + TypeScript, [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web no oficial, sin API de pago), corriendo en tu PC local, con PM2 para mantenerlo vivo.

## Fase 0 — Preparación (antes de programar)
- [ ] Definir quién usa el bot: ¿solo tú, un grupo de WhatsApp, varios chats individuales? *(no bloquea nada — el código ya soporta multi-chat desde el día uno, cada chat ve solo sus horarios)*
- [ ] Definir zona horaria fija. *(no bloquea nada — el bot usa la hora del sistema de tu PC tal cual, así que solo importa que el reloj de Windows esté correcto)*
- [ ] Confirmar que vas a usar un número de WhatsApp dedicado para el bot (recomendado, no tu número principal) o el tuyo propio. *(decisión tuya al escanear el QR)*
- [x] Node.js LTS instalado en la PC donde va a correr — confirmado (v24.14.1).

## Fase 1 — Conexión básica con WhatsApp ✅
- [x] Inicializar proyecto Node + TypeScript (`package.json`, `tsconfig.json`).
- [x] Integrar Baileys: generar QR, iniciar sesión, guardar credenciales (`auth_info/`) para no escanear cada vez.
- [x] Bot mínimo que responde `pong` a un mensaje `ping` (prueba de vida).
- [x] Reconexión automática cuando Baileys pierde la conexión (WhatsApp cierra sockets seguido).

> Código en `whatsapp-bot/`. Falta que **tú** corras `npm run dev` y escanees el QR con tu WhatsApp para dejar la sesión vinculada (ver `whatsapp-bot/README.md`).

**Entregable:** el bot contesta mensajes de prueba desde tu WhatsApp.

## Fase 2 — Modelo de datos ✅
Definir la entidad **Evento/Horario**:

| Campo | Descripción |
|---|---|
| `id` | identificador único |
| `titulo` | ej. "Clase de Redes" |
| `descripcion` | opcional |
| `chatId` | a quién se le avisa (tu chat, un grupo, etc.) |
| `tipo` | `recurrente_LV` \| `recurrente_semanal` \| `puntual` |
| `dias` | ej. `["lun","mar","mie","jue","vie"]` (solo si es recurrente) |
| `fecha` | fecha exacta (solo si es `puntual`) |
| `hora` | `HH:mm` |
| `avisoPrevioMin` | minutos antes para avisar (ej. 10) |
| `activo` | true/false (pausar sin borrar) |

- [x] Elegir almacenamiento: **SQLite** vía `node:sqlite` (nativo de Node, sin compilar módulos nativos en Windows).
- [x] CRUD interno: crear, listar, editar, eliminar, pausar/reactivar horario.

**Entregable:** funciones de base de datos probadas con datos de ejemplo. ✅ Código en `whatsapp-bot/src/db/`.

## Fase 3 — Comandos del bot (conversación) ✅
Definir comandos con prefijo `!` para que el parser sea simple y confiable:

- `!listar` → todos los horarios activos.
- `!hoy` / `!manana` → eventos de hoy / de mañana.
- `!semana` → resumen lunes a viernes.
- `!borrar <id>` / `!pausar <id>` / `!reactivar <id>`.
- `!ayuda` → menú de comandos.

- [x] Parser de comandos.
- [x] Validaciones: hora válida, día válido, fecha válida, etc.

> **Cambio posterior:** originalmente existía `!agregar` (flujo guiado para crear horarios desde el chat), pero se quitó a pedido explícito — los horarios (clases por grado/sección + calendario cívico) se manejan de forma interna/programática (`whatsapp-bot/src/db/seed.ts`), no por los alumnos vía WhatsApp. Se eliminaron `agregar.ts` y `session.ts` del código.

**Entregable:** se puede listar, pausar, reactivar y borrar un horario por chat, sin tocar la base de datos a mano. ✅ Código en `whatsapp-bot/src/commands/`.

## Fase 4 — Motor de recordatorios (scheduler) ✅
- [x] Job con `node-cron` que corre cada minuto y revisa qué eventos "tocan" (compara contra la hora objetivo con `avisoPrevioMin` ya restado, usando `>=` en vez de igualdad exacta para no perder el aviso si el tick del cron se atrasa).
  - **Corregido:** ese `>=` no tenía límite, así que si el bot estaba apagado varias horas, al reconectar disparaba avisos de clases de hace rato diciendo "empieza en 5 minutos" (el `avisoPrevioMin` configurado, no la realidad). Ahora hay una ventana de tolerancia de 10 minutos — más allá de eso, se marca como atendido sin avisar.
- [x] El mensaje del recordatorio muestra el tiempo **real** que falta (en horas y minutos, ej. "1 hora y 35 minutos"), no el valor fijo de `avisoPrevioMin`.
- [x] Enviar el mensaje recordatorio al `chatId` correspondiente vía Baileys.
- [x] Manejar recurrencia L-V/personalizada y eventos puntuales (se desactivan solos después de enviarse).
- [x] Evitar recordatorios duplicados (marca `ultimoEnvio` con la fecha de hoy).

**Entregable:** el bot te avisa solo, sin que nadie escriba nada, a la hora programada. ✅ Código en `whatsapp-bot/src/scheduler/`.

## Fase 5 — Resiliencia en PC local ✅
Como corre en tu propia máquina, esta fase es clave para que no se caiga:

- [x] PM2 para mantener el proceso vivo y reiniciarlo si crashea (`ecosystem.config.cjs`, `npm run pm2:start`).
- [x] Arranque automático al encender la PC vía `pm2-startup install` + `pm2 save` (documentado en el README).
- [x] Logs con `logs/out.log` y `logs/error.log`.
- [x] Backup automático diario (3:00 a.m.) de `auth_info/` y `data/bot.db` a `backups/<fecha>/`, con poda de los más viejos (`BACKUP_KEEP`). Código en `whatsapp-bot/src/backup/`.
- [x] Aviso si el bot se desconecta de internet/WhatsApp por mucho tiempo: al reconectar, si estuvo caído más de `DOWNTIME_ALERT_MIN` minutos, lo registra en logs y te escribe a `OWNER_CHAT_ID` (si lo configuraste en `.env`).

**Entregable:** el bot sobrevive reinicios de PC y errores sin intervención manual. ✅ Ver `whatsapp-bot/README.md` sección "Dejarlo corriendo 24/7".

## Fase 6 — Pulido ✅ (salvo botones interactivos, ver nota)
- [x] Tono "amigo": mensajes cálidos, emojis, confirmaciones claras (ya en todos los comandos).
- [x] Soporte multi-chat: cada horario está aislado por `chatId`, así que varias personas o grupos pueden usar el mismo bot sin pisarse.
- [x] Exportar/importar horarios (JSON): `!exportar` manda un `.json` descargable, `!importar` (respondiendo a ese archivo) lo recupera. Código en `whatsapp-bot/src/commands/exportar.ts` y `importar.ts`.
- [x] Lenguaje natural para consultas: ya no hace falta el `!` para *preguntar* por el horario/eventos (ej. "¿cuál es mi horario?", "qué eventos hay esta semana"). Código en `whatsapp-bot/src/commands/intencion.ts`. Crear/borrar/pausar siguen usando `!` a propósito, por ser acciones que cambian datos.
- [x] Horario y eventos ya no se mezclan: la intención detecta un **tema** (horario vs. evento) además del alcance, así "mi horario" no trae de regalo el calendario cívico y viceversa (`!listar`/`!hoy`/`!semana` con `!` sí siguen mostrando ambos juntos, a propósito). Preguntar por "mi horario" sin más detalle asume que quieres el de **hoy** (default más natural); preguntar por "eventos" sin más detalle sigue mostrando **todos** los próximos, porque no son diarios. Para el horario completo: decir "todo mi horario" o usar `!listar`/`!semana`.
- [x] Datos de ejemplo automáticos: si un chat pregunta por su horario y no tiene nada guardado, se le crea un horario de secundaria peruana (áreas curriculares MINEDU) + eventos del calendario cívico oficial del Perú. Código en `whatsapp-bot/src/db/seed.ts`.
- [x] Identidad del bot + horario por grado y sección: se presenta como **Ceneciano**, el asistente del Colegio Nacional de Cabanillas (Puno). La primera vez que un chat pide su horario, pregunta el grado (1°-5°) y luego la sección (A-E) en dos pasos, y siembra el horario de ESA combinación (25 aulas posibles: 101-105, 201-205, ... 501-505). Grado y sección quedan guardados (tabla `perfiles`, con migración segura vía `ALTER TABLE` para bases que ya existían solo con grado) para no volver a preguntarlo. El calendario cívico es igual para todas las secciones. Código en `whatsapp-bot/src/commands/perfil.ts`, `whatsapp-bot/src/db/perfiles.ts` y `whatsapp-bot/src/db/seed.ts`.
- [x] Fechas en español + "faltan X días": las fechas puntuales ya no se muestran en ISO crudo (`2026-08-30`) sino como `30 de agosto (en 19 días)`. Código en `whatsapp-bot/src/commands/format.ts` (`formatearFecha`, `diasFaltantes`, `faltanTexto`). `!semana` y "qué eventos hay" ya no se limitan a los próximos 7 días — muestran todas las fechas próximas guardadas.
- [x] Menú rápido ante mensajes sin reconocer: antes, un mensaje que no era comando `!` ni coincidía con horario/eventos se ignoraba en silencio; ahora responde con un mini menú (saludo de Ceneciano + ejemplos de qué escribir), para que cualquiera que le hable por primera vez sepa cómo usarlo.
- [x] Alcance "mañana": `!manana` y lenguaje natural ("y de mañana?", "¿qué tengo mañana?") funcionan igual que "hoy" pero para el día siguiente. Código en `whatsapp-bot/src/commands/hoy.ts` (`resumenManana`, generalizado junto con `resumenHoy`). A diferencia de otros temas, "hoy"/"mañana" solos (sin decir "horario") ya cuentan como pregunta de horario — es la forma natural de seguir la conversación.
- [x] Se quitó `!agregar`: crear horarios ya no es una acción disponible por chat — se maneja internamente (ver nota en Fase 3). El resto de comandos de gestión (`!pausar`/`!reactivar`/`!borrar`/`!exportar`/`!importar`) siguen igual.
- [ ] Comando `!menu` con botones o lista — **omitido a propósito**: WhatsApp dejó de soportar de forma confiable los mensajes interactivos (botones/listas) fuera de la API oficial de Meta, y Baileys advierte que pueden dejar de funcionar en cualquier momento. `!ayuda` ya cumple la misma función como menú de texto.
- [ ] Enviar el horario como imagen (tabla bonita) — **pendiente, a definir**: factible con un canvas ligero (`@napi-rs/canvas`) o con HTML+Puppeteer (mejor resultado visual, pero descarga Chromium ~300MB). Sin implementar todavía.

## Fase 7 — Pruebas y entrega
- [ ] Usarlo una semana real con tus propios horarios (Lunes a Viernes) — **esto solo lo puedes hacer tú**, usando el bot de verdad.
- [ ] Ajustar textos y tiempos de aviso según lo que se sienta natural — a partir de lo que notes en el uso real.
- [x] README con instrucciones de instalación y uso. Código/documentación en `whatsapp-bot/README.md`.

## Fase 8 — Dockerización (clonar en otra PC y que corra directo) ✅
Objetivo: `git clone` + `docker compose up` en una PC nueva, sin instalar Node ni hacer nada más.

- [x] `Dockerfile` multi-stage (`node:24-alpine`): una etapa compila TypeScript (`npm run build`), la otra corre solo con dependencias de producción. No hace falta toolchain nativo (no hay módulos con `binding.gyp` en el proyecto — `node:sqlite` es parte del propio Node).
- [x] `.dockerignore` para no mandar `node_modules/`, datos reales (`auth_info/`, `data/`, `backups/`) ni el `.git` al build.
- [x] `docker-compose.yml`: un solo servicio, `restart: unless-stopped` (reemplaza a PM2 dentro del contenedor), volúmenes para `auth_info/`, `data/` y `backups/` (persisten en el host aunque se reconstruya la imagen), `.env` opcional vía `env_file` (no falla si no existe).
- [x] **Corregido de paso:** `abrirImagen()` (el intento de abrir `qr.png` con el visor del sistema) podía tumbar el proceso completo si el comando no existía (ej. sin `xdg-open` dentro de un contenedor Alpine) — `spawn()` no lanza el error de forma síncrona, así que sin un listener de `'error'` Node lo trataba como excepción no capturada. Se agregó el listener; ahora simplemente no hace nada si no hay entorno gráfico.
- [x] `qr.png` se movió de la raíz del proyecto a `data/qr.png`, para quedar en el mismo volumen que ya se monta para la base de datos (evita tener que montar un archivo suelto, que Docker maneja mal si no existe todavía en el host).
- [x] Probado end-to-end: build de la imagen, arranque con volúmenes vacíos (genera QR, no crashea sin entorno gráfico), `qr.png`/`bot.db` persisten correctamente en el host a través del volumen, y sobrevive a un `docker compose restart`.

**Entregable:** ✅ `whatsapp-bot/Dockerfile`, `whatsapp-bot/docker-compose.yml`, `whatsapp-bot/.dockerignore`. Instrucciones en `whatsapp-bot/README.md`, sección "Correr con Docker".

> ⚠️ Durante la prueba de esta fase, la primera corrida se hizo por error montando `auth_info/`/`data/` **reales** del proyecto (no una carpeta de prueba), así que el contenedor se conectó unos segundos a la sesión real de WhatsApp antes de detenerlo. Los datos no se corrompieron, pero un mensaje real entrante durante esos segundos generó un horario nuevo para un chat real. Las pruebas siguientes ya se hicieron con carpetas completamente aisladas.

## Fase 9 — Panel de administrador (docentes, horarios, calendario) ✅
Objetivo: gestionar el currículo (por grado+sección), el calendario cívico y los docentes desde un panel web, sin tocar código. Decisiones confirmadas con el usuario antes de construir: edición por **plantilla** (no por chat individual ya sembrado), docentes como directorio simple (sin login propio), acceso solo en red local (usuario/contraseña simple), y un frontend tipo **SPA moderno** (elegido explícitamente sobre HTML simple del servidor).

- [x] Esquema aditivo nuevo (`db.ts`): tablas `docentes`, `plantilla_horario` (con FK a `docentes`, `ON DELETE SET NULL`), `calendario_civico`, `semilla_estado`. `PRAGMA foreign_keys = ON`. Sin `CHECK` de rango en grado/sección a propósito, para que las pruebas puedan usar un combo "centinela" (99/"Z") sin arriesgar tocar currículo real — la validación 1-5/A-E vive en la capa de rutas de la API.
- [x] `seed.ts` reescrito: el currículo y el calendario cívico que antes eran arrays de TypeScript hardcodeados ahora se siembran UNA vez (`sembrarPlantillasPorDefecto`, guardado en `semilla_estado`) como filas editables en `plantilla_horario`/`calendario_civico`. `sembrarHorarioSeccion`/`sembrarCalendarioSiFalta` leen de ahí, no del código — un alumno que se registre después de una edición ve el horario actualizado.
- [x] CRUD nuevo: `db/docentes.ts`, `db/plantillaHorario.ts` (incluye `actualizarClasePlantilla` — no existía "update" para `eventos` — y `clonarSeccion` para copiar un horario completo entre secciones), `db/calendarioCivico.ts`.
- [x] Backend `src/admin/`: Express **en el mismo proceso** que el bot (comparte la misma conexión `node:sqlite`, evita dos escritores concurrentes al archivo). Login usuario/contraseña fijo desde `.env` (`ADMIN_USER`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET`), comparado con `crypto.timingSafeEqual` sobre hash SHA-256 (no el string crudo, que haría lanzar `timingSafeEqual` por largo distinto). Sesión con `express-session` (`MemoryStore`, alcanza para un admin único local). Si faltan las 3 variables, el panel no arranca (advertencia clara en logs) pero el bot de WhatsApp sigue funcionando normal.
- [x] Frontend `admin-panel/`: React + TypeScript + Vite + Mantine (tablas/modales/formularios ya resueltos) + React Router + TanStack Query. 5 páginas: login, dashboard (conteos), docentes, horarios (selector grado×sección + grilla + clonar), calendario cívico. Proxy de Vite (`/api` → puerto del backend) en dev; en producción Express sirve el build estático + catch-all SPA.
- [x] Docker: nueva etapa `admin-build` en el `Dockerfile` que compila el SPA (`vite build`) y se copia a `admin-static/` en la imagen final; puerto (`ADMIN_PORT`, por defecto 4500) expuesto en `docker-compose.yml` vía `${ADMIN_PORT:-4500}`.
- [x] **Corregido de paso:** los tests existentes (`test-manual.ts`) tenían aserciones con el contenido sembrado hardcodeado (`=== 28`, `"Exporté 30"`, etc.) — como ahora ese contenido vive en tablas editables, se volvieron dinámicas (leen el conteo real de `plantilla_horario`/`calendario_civico` en vez de asumirlo). También se encontró y arregló una fragilidad preexistente en las pruebas del scheduler: un test que construía una fecha "dentro de 95 minutos" podía cruzar la medianoche y quedar fechado mañana, y un evento `puntual` fechado mañana el scheduler ni siquiera lo considera "de hoy" — el test ahora limita el offset para nunca cruzar medianoche.
- [x] `scripts/test-admin.ts` nuevo: CRUD completo sobre el combo centinela 99/"Z" (incluye verificar `ON DELETE SET NULL` al borrar un docente vinculado), más las rutas Express probadas con `fetch` real contra un servidor de prueba (`app.listen(0)`, puerto efímero) — login, sesión, CRUD vía HTTP, logout, y que la API rechace grado/sección fuera de rango aunque la capa DB no lo exija.
- [x] Probado end-to-end en Docker real (imagen completa con SPA compilado): login, CRUD vía HTTP, SPA sirviendo assets JS/CSS, ruteo client-side (`/docentes` devuelve el `index.html` para que React Router lo maneje, pero `/api/loquesea` sigue devolviendo 404 en vez de ser tapado por el catch-all), y el caso sin `ADMIN_*` configurado (panel apagado, bot funcionando normal, puerto sin responder).

**Entregable:** ✅ `whatsapp-bot/src/admin/`, `whatsapp-bot/admin-panel/`, tablas nuevas en `db.ts`. Instrucciones en `whatsapp-bot/README.md`, sección "Panel de administrador".

> ⚠️ Durante la construcción de esta fase se borró por error `data/bot.db` (que ya tenía datos reales de producción) por hábito de limpieza de pruebas anteriores. Se detectó de inmediato y se restauró desde el backup automático más reciente (`backups/2026-08-11_21-12-19/`); los datos de los 2 chats reales quedaron intactos, aunque cualquier actividad real entre ese backup y el momento del borrado no se pudo recuperar.

## Fase 10 — Reuniones de padres de familia (CRUD completo: panel + WhatsApp) ✅
Objetivo: programar reuniones de padres (título, fecha, hora, lugar, para qué grado/sección, minutos de aviso previo) con CRUD completo tanto desde el panel de administrador como desde el propio bot de WhatsApp — a diferencia de horarios/calendario, que solo se editan desde el panel. Decisión confirmada con el usuario: solo el chat admin (`OWNER_CHAT_ID`) puede crear/editar/borrar reuniones por WhatsApp; cualquier chat registrado puede consultar (de solo lectura) sus próximas reuniones.

- [x] Esquema aditivo (`db.ts`): tabla `reuniones` (titulo, fecha, hora, lugar, grado/seccion nullable = "todos", avisoPrevioMin) + columna `reunionId` en `eventos` (`REFERENCES reuniones(id) ON DELETE CASCADE`, migrada con `ALTER TABLE` envuelto en try/catch para bases ya existentes). Verificado en aislado que el CASCADE de `node:sqlite` sí funciona antes de confiar en él para la limpieza.
- [x] `db/reuniones.ts`: CRUD + **reparto (fan-out)** — al crear o editar una reunión, se genera de inmediato una copia `puntual` en `eventos` (con `reunionId` para poder rastrearla) para cada chat ya registrado que calce el grado/sección (o todos, si son `null`), usando `listarChatsPorGradoSeccion` (nuevo, en `perfiles.ts`). Editar borra los recordatorios repartidos y los vuelve a crear desde cero (no intenta adivinar qué cambió); borrar la reunión los borra solos por CASCADE.
- [x] Comando `!reunion` (`commands/reuniones.ts` + `router.ts`): wizard paso a paso (grado → sección → título → fecha → hora → lugar → minutos de aviso, con `cancelar` en cualquier momento) para `agregar`/`editar <id>`, más `borrar <id>` y `listar` (con ids) — los 4 solo para el chat admin. Sin subcomando (`!reunion` a secas), cualquier chat ve sus próximas reuniones según su propio grado/sección.
- [x] Backend admin: `/api/reuniones` (GET/POST/PUT/DELETE), con su propia validación de rango (grado 1-5, sección A-E, sección sin grado inválida) igual que `plantilla-horario` — la capa DB no restringe rango a propósito, para que las pruebas puedan usar el combo centinela 99/"Z" sin riesgo.
- [x] Frontend: página `/reuniones` (tabla + modal), tarjeta nueva en el dashboard, entrada en el menú lateral.
- [x] `scripts/test-admin.ts` extendido: CRUD completo de `reuniones` a nivel DB (fan-out exacto por sección, ampliación a "todo el grado", re-reparto sin duplicados al editar, cascada al borrar); pruebas del comando `!reunion` vía WhatsApp simulado (autorización admin vs. no-admin, wizard completo de principio a fin, cancelar a medio wizard); y CRUD vía HTTP real contra un servidor de prueba.
- [x] Probado end-to-end en Docker real (imagen completa, volúmenes aislados): login, crear reunión vía HTTP, listar, `GET /api/resumen` con el conteo de reuniones.

**Riesgo cuidado a propósito:** el wizard de WhatsApp y la API sí exigen grado 1-5 real (no aceptan el combo centinela 99/"Z" como docentes/horarios), así que las pruebas nunca pueden repartir un recordatorio de prueba a un chat real por accidente. Se resolvió calculando en cada corrida, contra la base real, un grado 1-5 que en ese momento no tenga *ningún* chat registrado, y usando solo un chat propio de la prueba dentro de ese grado — así el fan-out jamás puede alcanzar a un chat de producción. (Confirmado al correr las pruebas: los 2 chats reales están en grado 1 y grado 5, justo los que la prueba evita.)

**Entregable:** ✅ `whatsapp-bot/src/db/reuniones.ts`, `whatsapp-bot/src/commands/reuniones.ts`, `whatsapp-bot/src/admin/routes/reuniones.ts`, `whatsapp-bot/admin-panel/src/pages/Reuniones.tsx`. Instrucciones en `whatsapp-bot/README.md`, sección "Reuniones de padres de familia".

## Fase 11 — Catálogo de cursos por grado + generador automático de horario ✅
Objetivo: en vez de armar el horario de las 25 combinaciones grado×sección clase por clase a mano, definir primero el **catálogo de cursos de cada grado** (nombre, docente, veces por semana) y que el panel arme automáticamente el horario de las 5 secciones. Decisión confirmada con el usuario: **un solo docente dicta el curso en las 5 secciones (A-E) de su grado**, cada una en un horario distinto — no un docente distinto por sección.

- [x] Esquema aditivo (`db.ts`): tabla `cursos` (grado, nombre, docenteId `ON DELETE SET NULL`, vecesPorSemana, avisoPrevioMin). Sin relación directa con `plantilla_horario` — es un catálogo aparte que el generador *lee* para producir filas ahí.
- [x] `db/cursos.ts`: CRUD estándar (crear/listar por grado/obtener/actualizar/eliminar), mismo estilo que `docentes.ts`.
- [x] `db/plantillaHorario.ts` → `generarHorarioGrado(grado)`: borra el horario actual de las 5 secciones de ese grado y lo arma de nuevo desde el catálogo de `cursos`, eligiendo día(s)+hora al azar entre los 6 bloques diarios ya usados por la semilla (08:00 a 12:00). Dos reglas de no-choque: dentro de una sección, nunca dos cursos comparten (día, hora); y el mismo docente nunca queda dictando en dos secciones a la misma hora (comparte un solo "mapa de ocupación" a lo largo de las 5 secciones, ya que es la misma persona rotando). Si un curso no cabe completo (demasiada carga para el cupo disponible), se reporta en `avisos` en vez de fallar silenciosamente o forzar un choque — verificado con una prueba de estrés (un docente con 35 sesiones/semana pedidas contra un máximo real de 30) que sigue sin producir ni un solo choque.
- [x] Backend admin: `/api/cursos` (GET/POST/PUT/DELETE, GET admite `?grado=`) + `POST /api/cursos/generar-horario` `{grado}`, con la misma validación de rango 1-5 que el resto. Conteo `cursos` agregado a `GET /api/resumen`.
- [x] Frontend: página `/cursos` (selector de grado, tabla+modal de cursos con docente y veces/semana, botón "Generar horario para este grado" que muestra el resultado y cualquier aviso de cupo insuficiente), tarjeta en el dashboard, entrada en el menú.
- [x] **Bug encontrado y corregido de paso:** `listarPlantilla(grado, seccion)` solo filtraba cuando se le pasaban *ambos* argumentos — llamarla con nada más que `grado` caía a un `else` que devolvía la tabla entera sin filtrar. Ningún llamador existente lo disparaba (todos pasaban ambos o ninguno), pero se encontró al escribir una prueba directa del generador y se corrigió para que cada filtro (grado solo, grado+sección, ninguno) funcione de forma independiente.
- [x] `scripts/test-admin.ts` extendido: CRUD de `cursos` sobre el combo centinela grado 99 (incluye `ON DELETE SET NULL` al borrar el docente vinculado); `generarHorarioGrado` probado con carga normal (cero choques, cero avisos) y con una prueba de estrés (docente sobrecargado, confirma avisos sin choques); regenerar reemplaza el horario anterior del grado en vez de acumularlo; rutas HTTP de `/api/cursos` (CRUD seguro con un grado real ya que es aditivo y rastreable) y de `/api/cursos/generar-horario` (solo se prueba el rechazo por grado inválido — nunca se llama con un grado real, porque a diferencia del resto, esta operación SÍ borra y reescribe datos reales de currículo).
- [x] Probado end-to-end en Docker real (imagen completa, volúmenes aislados): login, crear docente, crear 3 cursos para un grado, generar horario, confirmar que las 5 secciones quedaron con clases sin cruces.

**Riesgo cuidado a propósito:** `generarHorarioGrado` empieza con `DELETE FROM plantilla_horario WHERE grado = ?` — a diferencia de las pruebas de reuniones (donde lo arriesgado era el *reparto* a chats reales), acá lo arriesgado es que la operación en sí **borra currículo real** de un grado. Por eso las pruebas automatizadas nunca la llaman con un grado 1-5 real, ni siquiera contra una base de prueba aislada primero — solo con el combo centinela 99 (que la propia función no valida, esa validación vive en la ruta HTTP) o, para la ruta HTTP, solo se prueba que rechace grados inválidos.

**Entregable:** ✅ `whatsapp-bot/src/db/cursos.ts`, `whatsapp-bot/src/admin/routes/cursos.ts`, `whatsapp-bot/admin-panel/src/pages/Cursos.tsx`, función `generarHorarioGrado` en `whatsapp-bot/src/db/plantillaHorario.ts`. Instrucciones en `whatsapp-bot/README.md`, sección "Cursos por grado y generación automática de horario".

> ⚠️ Durante esta fase también se encontró y arregló un problema de despliegue (no de código): el contenedor Docker en uso llevaba corriendo desde el 11 de agosto, antes de que existieran el panel de administrador y las reuniones — nunca se había reconstruido tras esas fases, así que el panel simplemente no respondía (puerto expuesto pero sin nada escuchando adentro). Recordatorio para el futuro: tras cualquier cambio de código, `docker compose up -d --build` (no solo `up -d`) para que el contenedor en uso tome el código nuevo.

> ⚠️ También se encontró (por separado) un bucle de reconexión constante (código 440 de Baileys, "connectionReplaced") — la causa era un `npm run dev` corriendo en el host al mismo tiempo que el contenedor Docker, ambos compartiendo la misma sesión de WhatsApp en `auth_info/` y expulsándose mutuamente cada segundo. No es un bug del código: solo debe correr **una** instancia del bot contra la misma carpeta `auth_info/` a la vez.

## Fase 12 — Currículo completo de un colegio real + docentes con grado + revisión del aviso automático ✅
Objetivo: dejar el colegio ficticio completamente armado con las 11 áreas curriculares oficiales de secundaria en Perú (verificadas contra fuentes de MINEDU, no inventadas), agregar un campo `grado` a los docentes para poder filtrarlos, y auditar de punta a punta que el calendario cívico y las reuniones de padres realmente lleguen como aviso de WhatsApp.

- [x] **Currículo completo**: se armaron **55 docentes** (uno por cada combinación grado×área — el mismo profesor nunca queda en dos grados a la vez, ya que el generador no coordina conflictos entre grados distintos) y **55 cursos** (las 11 áreas oficiales del CNEB × 5 grados), con una carga semanal recortada respecto al máximo teórico de MINEDU (24/30 slots en vez de 30/30) para dejarle margen al generador aleatorio. Se generó el horario de los 5 grados (25 combinaciones grado×sección): **355 bloques, 0 avisos de cupo, 0 choques**, verificado a mano.
- [x] **Docentes: columna `grado`** — esquema aditivo (`ALTER TABLE docentes ADD COLUMN grado INTEGER`, nullable para no romper docentes ya creados). Ahora es **obligatorio 1-5** para docentes nuevos (validado en la ruta de la API, igual que el resto). `GET /api/docentes?grado=` filtra. El panel usa este filtro en 3 lugares: la propia página Docentes (filtro visible + columna nueva), y los selectores de docente en Cursos y Horarios (antes mostraban los 55 de golpe; ahora solo los del grado que se está editando). Los 55 docentes ya creados se migraron (`backfill`) leyendo el grado desde el curso al que ya estaban enlazados.
- [x] **Auditoría del flujo hasta el aviso de WhatsApp**: se trazó en vivo (con datos centinela, sin tocar chats reales) `calendario_civico → sembrarCalendarioSiFalta → eventos → scheduler → sock.sendMessage` y `crearReunion → repartirReunion (fan-out) → eventos (reunionId) → scheduler → sock.sendMessage`, imprimiendo el mensaje real que recibiría un padre en ambos casos.
- [x] **Bug real encontrado y corregido**: el aviso automático (`scheduler/reminder.ts`) solo decía título + hora — **nunca incluía la `descripcion`** (aula/docente en clases, lugar en reuniones), aunque sí se guardaba y sí se mostraba al escribir `!listar` a mano. Para una reunión de padres, el lugar es justo el dato más importante del aviso. Se corrigió para que el aviso automático también incluya la descripción cuando existe, con una prueba nueva en `test-manual.ts` que lo deja cubierto de forma permanente.

**Entregable:** ✅ columna `grado` en `docentes` (`db/docentes.ts`, `admin/routes/docentes.ts`, `admin-panel/src/pages/Docentes.tsx`), fix en `whatsapp-bot/src/scheduler/reminder.ts`, currículo completo de las 55 áreas cargado en la base real.

## Fase 13 — Consultar el horario de OTRO salón (WhatsApp) ✅
Objetivo: que cualquier chat (registrado o no) pueda preguntar por el horario de un grado/sección que no es el suyo, sin tocar su propio registro. El lenguaje natural existente se deja igual — esto es un flujo aparte: el bot pregunta grado y sección paso a paso (como ya hace al registrarte), y muestra ese horario de solo lectura.

- [x] `commands/otroSalon.ts` (nuevo): wizard de 2 pasos (grado → sección) con `cancelar` en cualquier momento, igual de estilo que `perfil.ts`/`reuniones.ts`. Lee directo de `plantilla_horario` (vía `listarPlantilla`) — nunca llama `guardarPerfil` ni `sembrarHorarioSeccion`, así que **nunca modifica el perfil ni los eventos propios del chat que pregunta**. El resultado se muestra agrupado por día (Lunes a Viernes), con el docente si el curso tiene uno asignado.
- [x] Dos formas de activarlo: comando `!otrosalon` y lenguaje natural (`esConsultaOtroSalon`: reconoce "otro salón", "otra sección", "otro grado", "otro curso", con o sin tilde). Se revisa **antes** de `detectarIntencion` a propósito — una frase como "el horario de otro salón" también menciona "horario", y si no tuviera prioridad, `detectarIntencion` la habría tomado como pedir el horario propio.
- [x] **Robustez ("que no se cuelgue"):** probado con una batería de entradas patológicas contra el wizard completo (string vacío, solo espacios, `null`/`undefined`/`NaN`/`Infinity` como texto, notación científica, hexadecimal, dígitos arábigos, intento de inyección SQL, HTML/script, 5000 emojis seguidos, strings de 100 000 caracteres) — cero excepciones, siempre vuelve a preguntar de forma controlada. La detección del disparador (`esConsultaOtroSalon`) usa una regex simple sin grupos anidados, sin riesgo de backtracking catastrófico.
- [x] `scripts/test-manual.ts` extendido: unidad (`esConsultaOtroSalon` con variantes y entradas raras) + integración vía router completo (disparador en lenguaje natural sin exigir registro, entradas inválidas en cada paso, `cancelar`, `!otrosalon`, resultado real de un grado/sección con currículo cargado, y — el chequeo más importante — que ni iniciar ni completar la consulta altere el perfil ni los eventos propios del chat, incluyendo un chat que YA estaba registrado con su propio horario).

**Entregable:** ✅ `whatsapp-bot/src/commands/otroSalon.ts`, wiring en `whatsapp-bot/src/commands/router.ts` (comando + lenguaje natural + textos de ayuda actualizados).

> ⚠️ Durante la investigación de esta fase se encontró (por un error propio, no del código) un `disk I/O error` real pero transitorio: un script de diagnóstico corrido directo contra `data/bot.db` **mientras el contenedor seguía corriendo** chocó justo con el tick del minuto del scheduler. El bot lo capturó, se saltó ese único minuto de recordatorios, y se recuperó solo sin reiniciar ni perder datos — pero confirma que hay que seguir la regla ya establecida: `docker compose stop` antes de tocar `data/bot.db` directo desde un script del host, siempre.

## Fase 14 — Selector de calendario real en el panel ✅
Objetivo: reemplazar los campos de fecha de texto libre ("AAAA-MM-DD", validados a mano por regex) por un selector de calendario real en **todos** los formularios del panel que piden una fecha — se sentía forzado escribir el formato a mano.

- [x] Instalado `@mantine/dates` (misma versión que el resto de Mantine, `^7.17.0`) + `dayjs` (peer dependency). `DatesProvider` configurado en `main.tsx` con `locale: "es"` y `firstDayOfWeek: 1`, así **todo** selector de fecha del panel sale en español (meses, días) sin tener que configurarlo página por página.
- [x] `admin-panel/src/utils/fecha.ts` (nuevo): `fechaAISO`/`isoAFecha` para convertir entre el `Date` que usa el picker y el string `"AAAA-MM-DD"` que espera la API — a propósito en hora **local**, no `toISOString()` (que es UTC y puede correr el día según el huso horario del navegador).
- [x] Reemplazado en las 2 páginas que pedían una fecha: **Calendario cívico** y **Reuniones de padres**. El formato mostrado es natural ("10 de septiembre de 2026"), con calendario desplegable al hacer clic.
- [x] Sin cambios en la API ni en el esquema: el string que se envía sigue siendo `"AAAA-MM-DD"` igual que antes, así que es un cambio puramente de UI.

**Entregable:** ✅ `whatsapp-bot/admin-panel/src/utils/fecha.ts`, `DateInput` en `Calendario.tsx`/`Reuniones.tsx`, `DatesProvider` en `main.tsx`.

## Fase 15 — Un docente puede dictar en varios grados a la vez ✅
Objetivo: corregir un supuesto de diseño de la Fase 12 — ahí se asumió "1 docente = 1 grado" (necesario en ese momento para que el generador nunca tuviera que coordinar conflictos entre grados distintos). En la práctica un mismo profesor sí puede dictar cursos en más de un grado, así que había que sacar esa restricción **y** hacer que el generador la respete de verdad.

- [x] **Esquema aditivo**: `docentes.grado` (INTEGER, un solo valor) queda sin usar; se agrega `docentes.grados` (TEXT, JSON como `"[1,3,5]"` — mismo patrón que `eventos.dias`/`plantilla_horario.dias`). Los 55 docentes reales se migraron (`backfill`) de `grado` a `grados` con un script aparte.
- [x] `db/docentes.ts`, `admin/routes/docentes.ts`: CRUD y filtro (`GET /api/docentes?grado=`) ahora trabajan con la lista completa — el filtro pasa de "grado === X" a "grados incluye X". Validación: al menos un grado, cada uno 1-5.
- [x] Panel: el selector de grado de un docente pasa de `Select` (uno) a `Checkbox.Group` (varios) — mismo estilo que los checkboxes de días en Horarios. La tabla y los selectores de docente en Cursos/Horarios funcionan igual que antes sin cambios adicionales, porque ya filtraban por "¿este docente dicta este grado?" en vez de compararlo con un valor único.
- [x] **El fix que de verdad importaba**: `generarHorarioGrado(grado)` ahora precarga, para cada docente involucrado, los horarios que YA tiene comprometidos en **otros grados** (consultando `plantilla_horario WHERE docenteId=? AND grado != grado_actual`) antes de ubicar sus cursos en este grado. Antes esto era innecesario (un docente nunca podía aparecer en dos grados); ahora es la única forma de que dos grados generados por separado no choquen entre sí para el mismo profesor. Verificado con un docente dictando en 2 grados a la vez: cero choques cruzados, tanto en la primera generación como al regenerar uno de los dos grados después.
- [x] `scripts/test-admin.ts` extendido: CRUD de docentes con `grados: number[]` (crear, filtrar por cada uno de sus grados, actualizar), y el caso de generación con un docente en dos grados (sin choques, ni siquiera regenerando uno de los dos).

**Entregable:** ✅ columna `docentes.grados`, `Checkbox.Group` en `Docentes.tsx`, `precargarCompromisosDeOtrosGrados` en `whatsapp-bot/src/db/plantillaHorario.ts`.

## Fase 16 — Desvincular WhatsApp desde el panel + nuevo menú de bienvenida ✅
Objetivo: dos pedidos aparte. (1) poder desvincular el número de WhatsApp del bot **desde el panel** (sin tocar la terminal ni borrar carpetas a mano) y que muestre ahí mismo el QR nuevo para volver a vincular. (2) cambiar el texto del menú que aparece cuando alguien saluda ("hola") por uno más formal — solo la vista/redacción, sin tocar qué comandos existen.

- [x] **`src/bot/connection.ts`**: nuevas referencias a nivel de módulo (`sockActual`, `handlersActuales`, `conectado`) para poder actuar desde afuera. `desvincularWhatsApp()` intenta `sock.logout()` (le avisa a WhatsApp que el dispositivo se desvinculó de verdad, no solo que se cayó la conexión) y, tanto si eso funciona como si no hay conexión activa, termina en `limpiarSesionYReconectar()`: borra `auth_info/` + el `qr.png` viejo, y llama a `startBot()` de nuevo — que al no encontrar sesión pide un QR nuevo automáticamente. La rama de "sesión cerrada" del evento `connection.update` (que ya existía, para cuando el logout lo dispara el celular) ahora usa esta misma función, en vez de solo mostrar un mensaje y quedarse esperando.
- [x] Rutas nuevas `/api/whatsapp/estado` (conectado + si hay QR guardado), `/api/whatsapp/qr` (sirve `data/qr.png`) y `POST /api/whatsapp/desvincular`.
- [x] Panel: tarjeta "Conexión de WhatsApp" en el Dashboard — badge de estado, el QR se muestra ahí mismo si está desconectado (se refresca solo cada 4s), y botón "Desvincular" con modal de confirmación (deshabilitado si ya está desconectado, para no invitar a hacer clic en algo que no tiene nada que desvincular).
- [x] **Probado de verdad end-to-end en Docker aislado** (nunca contra la sesión real): login → `POST /api/whatsapp/desvincular` → confirmado desde dentro del contenedor que `auth_info/` quedó vacía y se generó un `qr.png` nuevo, todo en segundos, sin reiniciar el contenedor.
- [x] `scripts/test-admin.ts`: se agregaron pruebas de las rutas de solo lectura (`/estado`, `/qr`) — **a propósito no se prueba `POST /api/whatsapp/desvincular` en el suite automatizado**, porque incluso en el caso "sin conexión activa" termina borrando `auth_info/` de verdad, y este script corre contra la carpeta real del proyecto.
- [x] Menú de bienvenida (`MENU_RAPIDO` en `router.ts`, el que aparece al decir "hola" o cualquier mensaje casual): reemplazado por el texto formal pedido, en tono de "usted". Sigue siendo solo una vista de lo que ya se puede preguntar — no agrega comandos, y `!reunion`/`!ayuda` se mantienen como comandos con `!` tal cual se pidió. Las pruebas que dependían del texto viejo (`test-manual.ts`) se actualizaron para no romperse.

**Entregable:** ✅ `desvincularWhatsApp`/`obtenerEstadoConexion` en `whatsapp-bot/src/bot/connection.ts`, `whatsapp-bot/src/admin/routes/whatsapp.ts`, tarjeta de conexión en `whatsapp-bot/admin-panel/src/pages/Dashboard.tsx`, `MENU_RAPIDO` actualizado en `whatsapp-bot/src/commands/router.ts`.

---

### Estructura de carpetas (ya implementada)
```
whatsapp-bot/
├── src/
│   ├── bot/            # connection.ts: Baileys, QR, reconexión, aviso de caída
│   ├── commands/        # router.ts + hoy(+manana)/semana/format/exportar/importar/intencion/perfil/reuniones/otroSalon
│   ├── scheduler/       # reminder.ts: cron job de recordatorios
│   ├── backup/          # backup.ts: backups diarios automáticos
│   ├── admin/            # server.ts (Express) + auth.ts + routes/{docentes,cursos,plantillaHorario,calendarioCivico,resumen,reuniones,whatsapp}.ts
│   ├── db/              # db.ts (esquema) + eventos.ts + perfiles.ts + seed.ts + docentes.ts + cursos.ts + plantillaHorario.ts (incl. generarHorarioGrado) + calendarioCivico.ts + reuniones.ts
│   ├── config.ts        # lee .env (OWNER_CHAT_ID, BACKUP_KEEP, DOWNTIME_ALERT_MIN, ADMIN_*)
│   └── index.ts
├── admin-panel/           # SPA aparte: React + Vite + TS + Mantine (su propio package.json/tsconfig.json)
│   └── src/
│       ├── api/           # cliente fetch + funciones tipadas por recurso
│       ├── pages/         # Login, Dashboard, Docentes, Cursos, Horarios, Calendario, Reuniones
│       ├── components/    # Layout (AppShell), RequireAuth (guard de rutas)
│       └── hooks/         # useSesion (login/logout/sesión vía TanStack Query)
├── scripts/
│   ├── test-manual.ts   # smoke test del bot sin WhatsApp real
│   └── test-admin.ts    # smoke test del panel de admin (CRUD DB, generador de horario, wizard WhatsApp, rutas Express)
├── .env.example           # plantilla de configuración opcional
├── auth_info/              # sesión de WhatsApp (no se sube a git; volumen en Docker)
├── data/                    # bot.db + qr.png (no se sube a git; volumen en Docker)
├── backups/                 # backups diarios (no se sube a git; volumen en Docker)
├── logs/                    # logs de PM2 (no se sube a git; solo si NO usas Docker)
├── Dockerfile               # build multi-stage (node:24-alpine): build (bot) + admin-build (SPA) + runtime
├── docker-compose.yml       # un servicio + volúmenes persistentes + puerto del panel
├── .dockerignore
├── ecosystem.config.cjs     # config de PM2 (alternativa a Docker)
├── package.json
└── tsconfig.json
```

### Riesgos a tener en cuenta
- Baileys es una librería **no oficial**: WhatsApp podría banear el número si detecta uso automatizado agresivo (spam, muchos mensajes salientes). Para un bot personal de recordatorios el riesgo es bajo, pero mejor usar un número secundario.
- El bot depende de que tu PC esté encendida y con internet — la Fase 5 existe justo para minimizar ese punto débil.
