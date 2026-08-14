# Empaqueta la sesion de WhatsApp (auth_info/), la base de datos (data/) y
# la configuracion (.env) en un solo .zip, listo para llevar a otra PC y
# que el bot siga funcionando ahi como si nunca se hubiera movido (mismo
# colegio, mismos docentes/cursos/horarios, sin volver a escanear el QR).
#
# Nota: este archivo usa solo caracteres ASCII a proposito (sin tildes/enie)
# para evitar problemas de codificacion en PowerShell 5.1 segun la
# configuracion regional de cada PC.
#
# Uso: desde la carpeta whatsapp-bot/, correr:
#   .\scripts\exportar-para-otra-pc.ps1

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\docker-compose.yml")) {
    Write-Host "Corre este script desde la carpeta whatsapp-bot (no encontre docker-compose.yml aqui)."
    exit 1
}

# Se detiene el contenedor antes de copiar: la base de datos (SQLite) no es
# segura de copiar mientras el proceso del bot la tiene abierta y escribiendo.
Write-Host "Deteniendo el contenedor para copiar los datos sin riesgo..."
docker compose stop

$itemsAIncluir = @()
foreach ($item in @(".\auth_info", ".\data", ".\.env")) {
    if (Test-Path $item) { $itemsAIncluir += $item }
}

if ($itemsAIncluir.Count -eq 0) {
    Write-Host "No encontre auth_info, data ni .env - no hay nada que empaquetar todavia."
    Write-Host "(Corriste el bot al menos una vez en esta PC?)"
    docker compose up -d
    exit 1
}

$fecha = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$nombreZip = "respaldo-completo_$fecha.zip"

Write-Host ("Empaquetando: " + ($itemsAIncluir -join ", ") + "...")
Compress-Archive -Path $itemsAIncluir -DestinationPath $nombreZip -Force

Write-Host "Reiniciando el contenedor en esta PC..."
docker compose up -d

Write-Host ""
Write-Host "Listo: $nombreZip"
Write-Host ""
Write-Host "Siguiente paso, en la OTRA PC:"
Write-Host "  1. git clone https://github.com/AlessandroPastor/bot_horario.git"
Write-Host "  2. Copia $nombreZip dentro de la carpeta bot_horario\whatsapp-bot (USB, red compartida, etc)"
Write-Host "  3. cd bot_horario\whatsapp-bot"
Write-Host "  4. .\scripts\instalar-desde-paquete.ps1"
