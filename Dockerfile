FROM node:18-alpine AS base

# Instalar dependencias necesarias para compilar librerías nativas si se requiere
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copiar el código fuente
COPY . .

# Exponer el puerto de desarrollo/producción
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Comando de desarrollo
CMD ["npm", "run", "dev"]
