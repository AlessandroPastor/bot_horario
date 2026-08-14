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

### (Opcional) Mover el mismo colegio a otra PC, con la misma sesión y los mismos datos

Esto es **completamente opcional** — el `docker compose up` de arriba ya deja el bot funcionando en la PC nueva por sí solo. La diferencia es con qué datos arranca:

- **Sin este paso** (lo de arriba, nada más): sesión de WhatsApp **nueva** (hay que escanear un QR) y base de datos **vacía** (sin los docentes/cursos/horarios que ya cargaste — hay que armarlos de nuevo desde el panel).
- **Con este paso**: se lleva la sesión y la base de datos **tal cual están en esta PC** — no hace falta escanear QR ni volver a cargar el currículo.

Úsalo solo si quieres mover exactamente el mismo colegio (misma sesión de WhatsApp, mismos docentes/cursos/horarios ya cargados) de una PC a otra. Si vas a instalar un colegio nuevo desde cero, sáltate esta parte. Hay dos scripts que hacen todo el trabajo:

**En esta PC** (la que ya tiene todo configurado):
```powershell
.\scripts\exportar-para-otra-pc.ps1
```
Detiene el contenedor un momento (para copiar la base de datos sin riesgo), empaqueta la sesión de WhatsApp + la base de datos + el `.env` en un solo `respaldo-completo_AAAA-MM-DD_HH-mm-ss.zip`, y vuelve a levantar el contenedor.

**En la PC nueva** (con Docker Desktop ya instalado):
```powershell
git clone https://github.com/AlessandroPastor/bot_horario.git
# copia el .zip generado arriba dentro de bot_horario\whatsapp-bot\ (USB, red compartida, etc.)
cd bot_horario\whatsapp-bot
.\scripts\instalar-desde-paquete.ps1
```
Descomprime el paquete y levanta el contenedor. El bot reconecta solo con la sesión que trajiste (sin QR nuevo), y el panel (`http://localhost:4500`) ya tiene todo el currículo cargado.

> El `.zip` que generan estos scripts contiene la sesión de WhatsApp y las contraseñas del panel — trátalo como algo sensible (no lo subas a ningún lado público) y bórralo cuando termines de moverlo.

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
- `!reunion` — ver las próximas reuniones de padres que te tocan (según tu grado/sección). Crear, editar y borrar reuniones también se puede hacer por WhatsApp, pero solo desde el chat administrador — ver "Reuniones de padres de familia" más abajo.
- `!otrosalon` — ver el horario de OTRO grado/sección (no el tuyo). Te pregunta grado y sección, y te muestra ese horario sin tocar tu propio registro. También funciona en lenguaje natural: "el horario de otro salón", "otra sección", "otro grado". Cualquier chat puede usarlo, incluso sin haberse registrado todavía.
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

Si te escriben algo que no es ni un comando `!` ni una pregunta sobre horario/eventos (ej. "hola", "gracias", cualquier cosa suelta), Ceneciano ya no se queda callado — responde con un menú de bienvenida mostrando qué puede hacer:

```
👋 Estimado(a) usuario(a), le damos la bienvenida.

Soy Ceneciano, el asistente virtual del Colegio Nacional de Cabanillas.

A continuación, le presento las opciones disponibles de consulta:

📅 Horario de hoy: Muestra el horario de clases correspondiente al día actual.
📅 Horario de mañana: Muestra el horario de clases del día siguiente.
🗓️ Calendario cívico: Muestra los eventos y actividades institucionales programadas.
🏫 Horario por aula: Permite consultar la programación de otros grados y secciones.
👨‍👩‍👧 !reunion — Muestra el cronograma de próximas reuniones de padres de familia.
📋 !ayuda — Muestra el menú completo de comandos del sistema.

Escriba o seleccione la opción de su preferencia para iniciar.
```

Es solo una vista de lo que ya se puede preguntar en lenguaje natural (nada de esto agrega comandos nuevos) — así cualquiera que le escriba por primera vez sabe de inmediato qué decirle.

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
_3°B de Secundaria — Aula 302 — Prof. Pérez_
```

El aviso también incluye el aula/docente (o el lugar, si es una reunión de padres) cuando ese dato existe — no solo el título y la hora.

Y si el bot estuvo apagado o desconectado varias horas (por ejemplo, lo prendiste recién a las 3:24 p.m. y tenías una clase a las 8:00 a.m.), **ya no manda avisos "de mentira"** de clases que pasaron hace rato — los marca como atendidos en silencio y sigue con el día normal. Solo avisa si el momento de avisar fue hace menos de 10 minutos; más allá de eso, ya no tiene sentido interrumpirte con algo viejo.

## Datos de ejemplo automáticos: colegio + grado + sección

El bot se presenta como **Ceneciano**, el asistente del **Colegio Nacional de Cabanillas (Puno)**. La primera vez que un chat pregunta por su horario (con `!listar`/`!hoy`/`!semana` o en lenguaje natural) y no tiene nada guardado, pasa esto:

1. Se presenta y pide el grado: *"👋 ¡Hola! Soy Ceneciano, tu asistente del Colegio Nacional de Cabanillas (Puno). Para mostrarte tu horario, cuéntame: ¿de qué grado eres?"* — espera un número del **1 al 5** (1° a 5° de secundaria).
2. Luego pide la sección: una letra de la **A a la E**.
3. Con grado y sección completos (ej. *3°B*), crea automáticamente el horario semanal de ESA sección (por defecto: Matemática, Comunicación, Inglés, Ciencia y Tecnología, Ciencias Sociales, DPCC, Educación Física, Arte y Cultura, Educación para el Trabajo, Religión y Tutoría — de lunes a viernes), en su propia aula (101-105 para 1°, 201-205 para 2°, ... 501-505 para 5°, una por cada combinación grado+sección). Este contenido ahora es **editable desde el panel de administrador** (ver más abajo) — lo de arriba es solo el punto de partida por defecto.
4. También agrega, una sola vez por chat, las fechas del calendario cívico (por defecto, el oficial del Perú: Santa Rosa de Lima, Combate de Angamos, Todos los Santos, etc.) como eventos puntuales — esas sí son iguales para todas las secciones, no dependen de la respuesta, y también son editables desde el panel.
5. El grado y la sección quedan guardados (tabla `perfiles`), así que la próxima vez que preguntes por tu horario ya no te lo vuelve a preguntar.

Es solo un punto de partida para no arrancar en blanco — son horarios normales, así que se pueden pausar o borrar con `!listar` + `!borrar <id>` como cualquier otro.

## Panel de administrador (docentes, cursos, horarios, calendario)

Para no tener que editar código cada vez que cambia algo, hay un panel web donde se administra:

- **Docentes** — nombre, los grados que dicta (uno o varios, 1°-5°, al menos uno obligatorio) y materia/área y contacto opcionales, para vincular a cada curso/clase (aparece como "Matemática — Prof. Pérez" en los horarios que recibe cada alumno). Un mismo docente puede dictar cursos en más de un grado — marca todos los que le correspondan con los checkboxes. Esto también sirve de filtro: al elegir el docente de un curso u horario, solo se muestran los que dictan ese grado (útil apenas hay varias decenas de docentes).
- **Cursos** — el catálogo de materias de cada grado (ver "Cursos por grado y generación automática de horario" más abajo): la forma recomendada de armar el horario.
- **Horarios por grado y sección** — el currículo real, clase por clase: para cada combinación de grado (1°-5°) y sección (A-E), qué clases hay, a qué hora, qué días, con qué docente y cuántos minutos antes avisar. Se llena solo si generas el horario desde "Cursos", pero también se puede editar clase por clase a mano acá (por ejemplo para ajustar algo puntual después de generar). Como hay 25 combinaciones casi idénticas, también se puede **clonar** el horario de una sección a otra en un clic.
- **Calendario cívico** — las fechas puntuales (feriados, aniversarios) que se le avisan a todo el mundo.

**Importante:** esto edita la *plantilla* — lo que le toca a cualquier alumno que se registre (o vuelva a registrarse) de ahí en adelante. No modifica retroactivamente los horarios que un chat ya tiene guardados; para eso siguen estando `!pausar`/`!borrar` desde WhatsApp.

### Cursos por grado y generación automática de horario

La forma recomendada de armar el horario no es escribir clase por clase — es en dos pasos:

1. **Define los cursos de cada grado** (pestaña "Cursos"): elige el grado, y por cada materia indica su nombre, qué docente la dicta y cuántas veces por semana se dicta. **El mismo docente dicta esa materia en las 5 secciones (A-E)** de ese grado, cada una en un horario distinto — no hace falta (ni se puede) elegir un docente diferente por sección.
2. Cuando termines de cargar los cursos de un grado, dale a **"Generar horario"**. El panel arma automáticamente el horario de las 5 secciones, eligiendo día(s) y hora al azar entre los bloques disponibles, cuidando que el mismo docente nunca quede en dos horarios a la vez: ni "en dos secciones a la misma hora" dentro de este grado, ni en otro grado distinto que también dicte (el generador revisa lo que ese docente ya tiene comprometido en los demás grados antes de ubicarlo en este).

Si algún curso pide más sesiones de las que caben sin cruzarse (por ejemplo, un docente con demasiadas materias/secciones a cargo), el panel te avisa exactamente cuáles no se pudieron ubicar completas, en vez de forzar un cruce o fallar en silencio — puedes ajustar la carga (menos veces por semana, otro docente) y volver a generar.

> Generar horario **reemplaza por completo** el horario actual de las 5 secciones de ese grado (lo borra y arma uno nuevo) — no lo combina con clases que hayas agregado a mano ahí. Si ya ajustaste algo manualmente en "Horarios" para ese grado, generar de nuevo lo pierde. Puedes seguir afinando resultados puntuales a mano en "Horarios" después de generar, siempre que no vuelvas a generar ese grado.

### Cómo activarlo

Por defecto el panel **no arranca** — hace falta configurar 3 variables en `.env` (copia `.env.example` si no lo tienes):

```
ADMIN_USER=tu_usuario
ADMIN_PASSWORD=una_contraseña_segura
ADMIN_SESSION_SECRET=cualquier_texto_largo_y_random
```

Sin esas 3, el bot de WhatsApp funciona exactamente igual — solo el panel queda apagado (verás una advertencia en los logs recordándotelo). Con ellas configuradas y el bot corriendo (con o sin Docker), entra desde el navegador a `http://localhost:4500` (o la IP de esa PC en tu red si entras desde otro dispositivo) e inicia sesión con ese usuario/contraseña.

> Pensado **solo para tu red local** — no hay HTTPS ni multiusuario. No expongas ese puerto a Internet (si usas Docker, revisa `docker-compose.yml`: el puerto se expone en todas las interfaces por defecto).

### Desvincular WhatsApp desde el panel

En el Dashboard hay una tarjeta "Conexión de WhatsApp" con el estado actual (Conectado/Desconectado) y un botón **Desvincular** (pide confirmación antes de actuar, porque corta el servicio hasta volver a escanear). Al desvincular:

1. Se cierra la sesión de WhatsApp de verdad (no solo se corta la conexión — WhatsApp también se entera de que el dispositivo se desvinculó).
2. Se borra automáticamente la sesión guardada (`auth_info/`) y el QR viejo.
3. El bot arranca una reconexión sola y genera un QR nuevo — sin que tengas que reiniciar el contenedor ni tocar carpetas a mano.

Mientras está desconectado, el mismo QR aparece directo en esa tarjeta del panel (se refresca solo cada pocos segundos), además de en la terminal y en `data/qr.png` como siempre. Sirve tanto para cambiar el bot a otro número de WhatsApp como para simplemente empezar de cero si algo quedó en mal estado.

## Reuniones de padres de familia

A diferencia de horarios/calendario (que solo se editan desde el panel), las reuniones de padres tienen **CRUD completo tanto desde el panel como desde WhatsApp**:

- **Desde el panel** (pestaña "Reuniones de padres"): título, fecha, hora, lugar opcional, para qué grado/sección (o "todos"), y minutos de aviso previo.
- **Desde WhatsApp**, con `!reunion`:
  - Sin nada más (`!reunion`) — cualquier chat registrado ve sus próximas reuniones, según su propio grado/sección.
  - `!reunion agregar` / `!reunion editar <id>` — inicia un wizard paso a paso (grado → sección → título → fecha → hora → lugar → minutos de aviso; escribe `cancelar` para salir). **Solo funciona desde el chat configurado en `OWNER_CHAT_ID`** (ver abajo) — cualquier otro chat recibe un aviso de que ese comando es solo para el administrador.
  - `!reunion borrar <id>` / `!reunion listar` — también solo desde ese chat admin.

En cuanto se crea o edita una reunión (desde donde sea), se avisa **de inmediato** — como un recordatorio más de WhatsApp — a todos los chats ya registrados que calcen con el grado/sección elegidos. Borrar una reunión borra también esos recordatorios ya repartidos.

> Para poder usar `!reunion agregar/editar/borrar/listar` desde WhatsApp hace falta tener `OWNER_CHAT_ID` configurado en `.env` (ver sección de abajo) — es el mismo chat que ya se usa para avisos del sistema (reconexión, etc.), reutilizado aquí como "el chat del administrador". Sin esa variable, esos 4 subcomandos quedan inaccesibles por chat (pero siguen disponibles desde el panel), y `!reunion` sin nada más sigue funcionando para cualquiera.

## Configuración opcional (`.env`)

Copia `.env.example` a `.env` si quieres ajustar algo (todo tiene un valor por defecto razonable, así que este paso es opcional):

```bash
cp .env.example .env
```

- `OWNER_CHAT_ID` — tu chat (o un grupo) al que el bot avisa de eventos del sistema, por ejemplo "me reconecté tras estar caído". También es el único chat autorizado para crear/editar/borrar reuniones de padres por WhatsApp (`!reunion agregar/editar/borrar/listar`). Déjalo vacío para desactivar el aviso de sistema y esos subcomandos (el resto del bot sigue funcionando igual).
- `BACKUP_KEEP` — cuántos backups diarios conservar (por defecto 7).
- `DOWNTIME_ALERT_MIN` — minutos de desconexión seguidos a partir de los cuales avisa al reconectar (por defecto 5).
- `ADMIN_USER` / `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` — credenciales del panel de administrador. Sin las 3, el panel no arranca (ver sección de arriba).
- `ADMIN_PORT` — puerto del panel de administrador (por defecto 4500).

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

Corre dos scripts encadenados, ambos seguros de correr contra tu base de datos real (limpian sus propios datos de prueba al terminar):

- `scripts/test-manual.ts` — simula mensajes entrantes (`!listar`, `!hoy`, `!manana`, `!semana`, `!exportar`/`!importar`, pausar/reactivar/borrar, aislamiento entre chats, y el disparo del scheduler) sin necesitar una sesión real de WhatsApp.
- `scripts/test-admin.ts` — CRUD de docentes/horarios/calendario cívico (usando un grado/sección "centinela" fuera de rango, 99/Z, que nunca choca con currículo real), más las rutas del panel de administrador probadas con `fetch` real contra un servidor de prueba.

## Siguientes pasos

Todo lo del roadmap está implementado salvo lo que solo se puede hacer usando el bot de verdad (ver `../ROADMAP.md`, Fase 7): probarlo una semana con tus horarios reales y ajustar textos/tiempos de aviso según se sienta natural.
