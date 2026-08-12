# Bot de WhatsApp — Recordatorio de Eventos y Horarios

Bot personal de WhatsApp (vía Baileys) para recordarte eventos y horarios de lunes a viernes (o fechas puntuales), con comandos para listar, pausar y borrar horarios. Ver el detalle de cada fase en `../ROADMAP.md`.

## Correr con Docker (recomendado para clonarlo en otra PC)

Si vas a clonar este repo en otra computadora y solo quieres que el bot ande, sin instalar Node ni nada más, esta es la forma más simple. Solo necesitas [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) o Docker Engine + Compose (Linux) instalado en esa PC — nada más.

```bash
git clone <la-url-de-tu-repo>
cd whatsapp-bot
docker compose up
```

Eso construye la imagen y arranca el bot. La primera vez, sin el flag `-d`, vas a ver el **QR en vivo en la terminal** — escanéalo desde WhatsApp (`Ajustes → Dispositivos vinculados → Vincular un dispositivo`). Si se ve cortado, abre `data/qr.png` desde el explorador de archivos de esa PC (se genera solo, en la misma carpeta clonada).

Una vez vinculado, déjalo corriendo en segundo plano:

```bash
docker compose up -d      # arranca en segundo plano
docker compose logs -f    # ver logs en vivo (Ctrl+C para salir de los logs; el bot sigue corriendo)
docker compose down       # detenerlo
docker compose restart    # reiniciarlo
```

No hace falta instalar Node, correr `npm install` a mano, ni configurar PM2 — Docker se encarga de todo eso dentro del contenedor. `restart: unless-stopped` en `docker-compose.yml` hace que el bot se reinicie solo si crashea, y que vuelva a arrancar cuando Docker Desktop inicia (por ejemplo, al prender la PC, si Docker Desktop está configurado para iniciar con Windows).

**Qué se guarda fuera del contenedor** (para que sobreviva si reconstruyes la imagen): `auth_info/` (sesión de WhatsApp), `data/` (base de datos + `qr.png`) y `backups/` — quedan como carpetas normales dentro del repo clonado, montadas como volúmenes. Si haces `docker compose down` esos datos siguen intactos; solo tendrías que volver a escanear el QR si borras `auth_info/` a mano.

**Configuración opcional:** si quieres usar variables de entorno (ver sección `.env` más abajo), crea el archivo `.env` en la misma carpeta antes de `docker compose up` — Docker Compose lo detecta solo si existe; si no existe, el bot arranca igual con los valores por defecto.

> Si en esa PC vas a **programar/editar el bot** (no solo correrlo), usa el flujo con `npm run dev` de la siguiente sección en vez de Docker.

## Instalación (desarrollo local, sin Docker)

```bash
npm install
```

## Correr en modo desarrollo

```bash
npm run dev
```

La primera vez va a imprimir un **código QR en la terminal** y además generar `data/qr.png`, abriéndolo automáticamente con el visor de imágenes del sistema (si hay uno disponible) — es la forma más confiable de escanearlo, porque el QR en la terminal se puede ver cortado o gigante si la ventana no es lo bastante ancha. Escanéalo desde WhatsApp:

`Ajustes → Dispositivos vinculados → Vincular un dispositivo`

> Si no se abrió solo, busca `data/qr.png` dentro de la carpeta `whatsapp-bot/` y ábrelo a mano. El código expira cada cierto tiempo (~20-60s) y se genera uno nuevo automáticamente mientras no lo escanees; si se te pasó, solo espera a que aparezca uno nuevo en el archivo o reinicia `npm run dev` (o `docker compose logs -f` si lo corres con Docker).

Una vez vinculado, la sesión se guarda en `auth_info/` (no se sube a git) y no vas a necesitar escanear el QR de nuevo mientras esa carpeta exista.

## Comandos del bot

Una vez vinculado, escríbele estos comandos desde WhatsApp:

- `!listar` — muestra todos tus horarios guardados.
- `!hoy` — lo que toca hoy.
- `!manana` — lo que toca mañana.
- `!semana` — resumen de lunes a viernes + fechas puntuales próximas.
- `!pausar <id>` / `!reactivar <id>` — pausar o reactivar sin borrar.
- `!borrar <id>` — elimina un horario.
- `!exportar` — te manda un archivo `.json` con todos tus horarios (respaldo manual).
- `!importar` — respóndele (reply) a ese `.json` con este comando para recuperar los horarios ahí guardados.
- `!ayuda` — lista de comandos.

> No hay comando para *crear* horarios desde el chat (ya no existe `!agregar`). Los horarios (clases por grado/sección y calendario cívico) se manejan internamente — ver `src/db/seed.ts` — no por los alumnos vía WhatsApp. `!importar` sigue disponible para restaurar un `.json` exportado previamente.

El bot revisa cada minuto si algún horario debe avisar (respetando los minutos de aviso previo que configuraste) y te escribe solo, sin que nadie tenga que pedirlo. Los horarios están aislados por chat: cada chat solo ve y administra los suyos.

## También entiende lenguaje natural (sin `!`)

Para *consultar* no hace falta acordarse del signo `!`. Si le escribes algo que mencione "horario", "horarios", "evento", "eventos", "clase", "clases" — o simplemente "hoy"/"mañana" solos — el bot responde solo. Distingue dos cosas:

**Tema** — si mencionas horario/clases te muestra solo tus clases; si mencionas eventos te muestra solo el calendario cívico; si mencionas ambos (o usas `!listar`/`!hoy`/`!manana`/`!semana` con `!`) te los muestra juntos. Así ya no se mezclan cuando pides solo uno de los dos.

**Alcance** — cuánto te muestra:
- "¿cuál es mi horario?" (sin decir más) → **el de hoy**, porque es lo más natural cuando preguntas así.
- "¿qué clases tengo hoy?" → hoy.
- "y de mañana?" / "¿qué tengo mañana?" → mañana (funciona igual sin decir "horario", como seguimiento natural de la conversación).
- "quiero ver todo mi horario" / "horario completo" → la semana completa.
- "qué horario tengo esta semana" → la semana completa.
- "qué eventos hay" (sin decir más) → **todos los próximos**, porque los eventos son fechas puntuales, no algo diario.

Para la lista completa siempre están disponibles los comandos `!listar` (todo, con ids) y `!semana` (agrupado por día).

Pausar, reactivar, borrar, exportar e importar sí siguen usando comandos con `!`, porque son acciones que cambian datos y conviene que sean explícitas.

## Cualquier mensaje que no reconozca muestra un menú rápido

Si te escriben algo que no es ni un comando `!` ni una pregunta sobre horario/eventos (ej. "hola", "gracias", cualquier cosa suelta), Ceneciano ya no se queda callado — responde con un mini menú mostrando qué puede hacer:

```
👋 ¡Hola! Soy Ceneciano, tu asistente del Colegio Nacional de Cabanillas (Puno).
Esto es lo que puedo hacer por ti:

💬 "¿cuál es mi horario?" — tus clases de hoy
💬 "y de mañana?" — tus clases de mañana
💬 "¿qué eventos hay?" — el calendario cívico del colegio
📋 !ayuda — ver todos los comandos

Escríbeme cualquiera de esas opciones para empezar 😊
```

Así cualquiera que le escriba por primera vez (sin saber los comandos exactos) sabe de inmediato qué decirle.

## Fechas en español, con cuánto falta

Las fechas puntuales (calendario cívico, eventos de una sola vez) ya no se muestran en formato crudo `2026-08-30` — se ven así:

```
#12 — *Santa Rosa de Lima (patrona del Perú y América)*
📅 30 de agosto (en 19 días) a las 08:00
```

El "faltan X días" se calcula solo (¡hoy!, mañana, en N días, o hace N días si ya pasó). Además, `!semana` y "qué eventos hay" ya no limitan la lista a los próximos 7 días — muestran **todas** las fechas próximas guardadas, para no dejar ninguna fuera.

## Recordatorios con el tiempo real (no "de mentira")

El mensaje de recordatorio ya no repite el minutaje que configuraste al crear el horario — calcula cuánto falta **de verdad** en el momento en que avisa:

```
⏰ Recordatorio: *Matemática* empieza en 1 hora y 35 minutos (10:15).
```

Y si el bot estuvo apagado o desconectado varias horas (por ejemplo, lo prendiste recién a las 3:24 p.m. y tenías una clase a las 8:00 a.m.), **ya no manda avisos "de mentira"** de clases que pasaron hace rato — los marca como atendidos en silencio y sigue con el día normal. Solo avisa si el momento de avisar fue hace menos de 10 minutos; más allá de eso, ya no tiene sentido interrumpirte con algo viejo.

## Datos de ejemplo automáticos: colegio + grado + sección

El bot se presenta como **Ceneciano**, el asistente del **Colegio Nacional de Cabanillas (Puno)**. La primera vez que un chat pregunta por su horario (con `!listar`/`!hoy`/`!semana` o en lenguaje natural) y no tiene nada guardado, pasa esto:

1. Se presenta y pide el grado: *"👋 ¡Hola! Soy Ceneciano, tu asistente del Colegio Nacional de Cabanillas (Puno). Para mostrarte tu horario, cuéntame: ¿de qué grado eres?"* — espera un número del **1 al 5** (1° a 5° de secundaria).
2. Luego pide la sección: una letra de la **A a la E**.
3. Con grado y sección completos (ej. *3°B*), crea automáticamente el horario semanal de ESA sección (Matemática, Comunicación, Inglés, Ciencia y Tecnología, Ciencias Sociales, DPCC, Educación Física, Arte y Cultura, Educación para el Trabajo, Religión y Tutoría — de lunes a viernes), en su propia aula (101-105 para 1°, 201-205 para 2°, ... 501-505 para 5°, una por cada combinación grado+sección).
4. También agrega, una sola vez por chat, las fechas del calendario cívico oficial del Perú (Santa Rosa de Lima, Combate de Angamos, Todos los Santos, etc.) como eventos puntuales — esas sí son iguales para todas las secciones, no dependen de la respuesta.
5. El grado y la sección quedan guardados (tabla `perfiles`), así que la próxima vez que preguntes por tu horario ya no te lo vuelve a preguntar.

Es solo un punto de partida para no arrancar en blanco — son horarios normales, así que se pueden pausar o borrar con `!listar` + `!borrar <id>` como cualquier otro.

## Configuración opcional (`.env`)

Copia `.env.example` a `.env` si quieres ajustar algo (todo tiene un valor por defecto razonable, así que este paso es opcional):

```bash
cp .env.example .env
```

- `OWNER_CHAT_ID` — tu chat (o un grupo) al que el bot avisa de eventos del sistema, por ejemplo "me reconecté tras estar caído". Déjalo vacío para desactivar ese aviso.
- `BACKUP_KEEP` — cuántos backups diarios conservar (por defecto 7).
- `DOWNTIME_ALERT_MIN` — minutos de desconexión seguidos a partir de los cuales avisa al reconectar (por defecto 5).

## Backups automáticos

Todos los días a las 3:00 a.m. (y una vez al conectar por primera vez) el bot copia `auth_info/` y `data/bot.db` a `backups/<fecha>/`, y borra los backups más viejos dejando solo los últimos `BACKUP_KEEP`. No necesitas hacer nada — solo evita borrar la carpeta `backups/` a mano si quieres conservar el histórico.

## Aviso de desconexión prolongada

Si el bot pierde la conexión con WhatsApp por más de `DOWNTIME_ALERT_MIN` minutos (por ejemplo, se te fue el internet), al reconectarse te avisa por WhatsApp (si configuraste `OWNER_CHAT_ID`) y siempre lo deja registrado en los logs, para que sepas que pudo habérsete pasado algún recordatorio en ese rango.

## Dejarlo corriendo 24/7 en tu PC (PM2, sin Docker)

> Si estás usando Docker (sección de arriba), **no necesitas nada de esto** — `restart: unless-stopped` ya hace lo mismo. Esta sección es para cuando corres el bot directo con Node, sin contenedor.

Como el bot corre en tu propia máquina, conviene usar [PM2](https://pm2.keymetrics.io/) para que:
- se reinicie solo si crashea,
- arranque automáticamente cuando enciendes la PC.

### 1. Instalar PM2 globalmente

```bash
npm install -g pm2 pm2-windows-startup
```

### 2. Compilar y arrancar con PM2

```bash
npm run pm2:start
```

Esto compila el proyecto (`tsc`) y arranca `dist/index.js` bajo PM2 usando `ecosystem.config.cjs`. Ver logs con:

```bash
npm run pm2:logs
```

> La primera vez seguirás necesitando escanear el QR — revísalo con `npm run pm2:logs` (el QR se imprime ahí también) o corre `npm run dev` una vez primero para vincular la sesión antes de pasar a PM2.

### 3. Autoarranque al encender la PC

```bash
pm2-startup install
pm2 save
```

Con esto, Windows relanza PM2 al iniciar sesión y PM2 revive automáticamente el bot guardado con `pm2 save`.

### 4. Comandos útiles de PM2

```bash
pm2 status              # ver si el bot está corriendo
npm run pm2:logs        # ver logs en vivo
npm run pm2:stop        # detenerlo
pm2 restart whatsapp-bot
```

Los logs también quedan en `logs/out.log` y `logs/error.log`, y la sesión de WhatsApp (`auth_info/`) y la base de datos (`data/bot.db`) sobreviven a reinicios porque no se borran entre despliegues — solo evita borrar esas carpetas (ni `backups/`).

## Probar la lógica sin WhatsApp

```bash
npm test
```

Corre `scripts/test-manual.ts`: simula mensajes entrantes (`!listar`, `!hoy`, `!manana`, `!semana`, `!exportar`/`!importar`, pausar/reactivar/borrar, aislamiento entre chats, y el disparo del scheduler) sin necesitar una sesión real de WhatsApp. Limpia sus propios datos de prueba al terminar, así que es seguro correrlo contra tu base de datos real.

## Siguientes pasos

Todo lo del roadmap está implementado salvo lo que solo se puede hacer usando el bot de verdad (ver `../ROADMAP.md`, Fase 7): probarlo una semana con tus horarios reales y ajustar textos/tiempos de aviso según se sienta natural.
