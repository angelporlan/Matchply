#!/bin/bash

# ==========================================================================
# Script de automatización de compilación de video con Docker temporal
# ==========================================================================

# Salir inmediatamente si ocurre un error
set -e

echo "🚀 Iniciando proceso de renderizado del video promocional de NextProf.AI..."

# 1. Comprobar si Docker está instalado y activo
if ! [ -x "$(command -v docker)" ]; then
  echo "❌ Error: Docker no está instalado en este sistema. Por favor, instálalo e inténtalo de nuevo." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "❌ Error: Docker está instalado pero el demonio no está en ejecución. Por favor, inicia Docker." >&2
  exit 1
fi

echo "✅ Docker está activo."

# 2. Crear el directorio de salida en el host si no existe
mkdir -p dist

# 3. Construir la imagen de Docker temporal
echo "🐳 Construyendo la imagen temporal de Docker (esto puede tardar un momento la primera vez)..."
docker build -t nextprof-promo-builder .

# 4. Correr el contenedor en modo temporal/desechable (--rm) 
# y montar el volumen 'dist' para recuperar el vídeo en el host
echo "🎥 Renderizando video dentro del contenedor aislado..."
docker run --rm \
  -v "$(pwd)/dist:/app/dist" \
  nextprof-promo-builder

# 5. Confirmación final
if [ -f "dist/promo-nextprof.mp4" ]; then
  echo "✨ ¡Éxito! El video promocional se ha generado correctamente."
  echo "📍 Ubicación del video final: $(pwd)/dist/promo-nextprof.mp4"
else
  echo "❌ Error: No se pudo encontrar el video generado en dist/promo-nextprof.mp4"
  exit 1
fi
