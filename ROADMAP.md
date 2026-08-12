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

---

### Estructura de carpetas (ya implementada)
```
whatsapp-bot/
├── src/
│   ├── bot/            # connection.ts: Baileys, QR, reconexión, aviso de caída
│   ├── commands/        # router.ts + hoy(+manana)/semana/format/exportar/importar/intencion/perfil
│   ├── scheduler/       # reminder.ts: cron job de recordatorios
│   ├── backup/          # backup.ts: backups diarios automáticos
│   ├── db/              # db.ts (esquema) + eventos.ts (CRUD) + perfiles.ts (grado+sección por chat) + seed.ts (datos demo)
│   ├── config.ts        # lee .env (OWNER_CHAT_ID, BACKUP_KEEP, DOWNTIME_ALERT_MIN)
│   └── index.ts
├── scripts/
│   └── test-manual.ts   # smoke test sin WhatsApp real (npm test)
├── .env.example           # plantilla de configuración opcional
├── auth_info/              # sesión de WhatsApp (no se sube a git; volumen en Docker)
├── data/                    # bot.db + qr.png (no se sube a git; volumen en Docker)
├── backups/                 # backups diarios (no se sube a git; volumen en Docker)
├── logs/                    # logs de PM2 (no se sube a git; solo si NO usas Docker)
├── Dockerfile               # build multi-stage (node:24-alpine)
├── docker-compose.yml       # un servicio + volúmenes persistentes
├── .dockerignore
├── ecosystem.config.cjs     # config de PM2 (alternativa a Docker)
├── package.json
└── tsconfig.json
```

### Riesgos a tener en cuenta
- Baileys es una librería **no oficial**: WhatsApp podría banear el número si detecta uso automatizado agresivo (spam, muchos mensajes salientes). Para un bot personal de recordatorios el riesgo es bajo, pero mejor usar un número secundario.
- El bot depende de que tu PC esté encendida y con internet — la Fase 5 existe justo para minimizar ese punto débil.
