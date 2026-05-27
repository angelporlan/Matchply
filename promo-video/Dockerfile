# ==========================================================================
# Dockerfile para Renderizado Determinista de HyperFrames
# Requisitos: Node.js 22+, FFmpeg, Chromium, y fuentes para renderizar texto.
# ==========================================================================

FROM node:22-bullseye-slim

# Instalar Chromium, FFmpeg, fuentes de texto y librerías de soporte
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    fonts-freefont-ttf \
    fonts-liberation \
    fonts-dejavu \
    fontconfig \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar variables de entorno para que Puppeteer/Chrome usen el ejecutable del sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox"

# Crear directorio de trabajo
WORKDIR /app

# Copiar configuración de dependencias de node
COPY package.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código del video promocional
COPY . .

# Crear el directorio de salida para el video renderizado
RUN mkdir -p dist

# Comando predeterminado para compilar la composición a MP4
CMD ["npx", "hyperframes", "render", "--output", "dist/promo-nextprof.mp4"]
