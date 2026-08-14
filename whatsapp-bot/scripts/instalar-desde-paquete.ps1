# Instala el bot en una PC nueva a partir de un .zip generado con
# exportar-para-otra-pc.ps1 - trae la misma sesion de WhatsApp y los mismos
# datos (docentes, cursos, horarios) de la PC original, sin escanear un QR
# nuevo ni empezar de cero.
#
# Nota: este archivo usa solo caracteres ASCII a proposito (sin tildes/enie)
# para evitar problemas de codificacion en PowerShell 5.1 segun la
# configuracion regional de cada PC.
#
# Uso: clona el repo primero, pon el .zip dentro de whatsapp-bot/, y corre
# esto desde ahi:
#   .\scripts\instalar-desde-paquete.ps1

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\docker-compose.yml")) {
    Write-Host "Corre este script desde la carpeta whatsapp-bot (no encontre docker-compose.yml aqui)."
    exit 1
}

$zip = Get-ChildItem -Filter "respaldo-completo_*.zip" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $zip) {
    Write-Host "No encontre ningun respaldo-completo_*.zip en esta carpeta."
    Write-Host "Copia aqui el .zip que generaste con exportar-para-otra-pc.ps1 y vuelve a correr esto."
    exit 1
}

Write-Host ("Encontre: " + $zip.Name)

try {
    docker --version | Out-Null
} catch {
    Write-Host "No encontre Docker instalado. Instala Docker Desktop primero:"
    Write-Host "  https://www.docker.com/products/docker-desktop/"
    exit 1
}

if ((Test-Path ".\auth_info") -or (Test-Path ".\data") -or (Test-Path ".\.env")) {
    Write-Host ""
    Write-Host "Ya existe auth_info, data o .env en esta carpeta - si sigues, el contenido del .zip los sobrescribe."
    $confirmar = Read-Host "Continuar y sobrescribir? (s/n)"
    if ($confirmar -ne "s") {
        Write-Host "Cancelado."
        exit 0
    }
}

Write-Host ("Descomprimiendo " + $zip.Name + "...")
Expand-Archive -Path $zip.FullName -DestinationPath "." -Force

Write-Host "Levantando el contenedor (primera vez: puede tardar unos minutos construyendo la imagen)..."
docker compose up -d --build

Write-Host ""
Write-Host "Listo. En unos segundos:"
Write-Host "  - Panel de administrador: http://localhost:4500"
Write-Host "  - El bot deberia reconectar solo con la sesion que trajiste (sin pedir QR nuevo)."
Write-Host ""
Write-Host "Para ver que todo este bien: docker compose logs -f"
