# Stage 1: Build CSS (Tailwind) + self-host vendor assets (Leaflet/D3/fonts)
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY app/ ./app/
COPY scripts/ ./scripts/

RUN npm run build

# Stage 2: Production Environment using Nginx
FROM nginx:1.31.0-alpine

# Arbeitsverzeichnis im Container (optional, aber gute Praxis)
WORKDIR /usr/share/nginx/html

# Entferne die Standard Nginx Willkommensseite
RUN rm /etc/nginx/conf.d/default.conf

# Kopiere unsere eigene Nginx Konfiguration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Kopiere die Frontend-Dateien (inkl. der von Stage 1 gebauten CSS-/Vendor-/Font-Artefakte)
COPY --from=builder /app/app/ .

# Nginx lauscht standardmäßig auf Port 80
EXPOSE 80

# Der Basis-Image startet Nginx bereits. Kein CMD nötig, außer wir wollen Optionen ändern.
# CMD ["nginx", "-g", "daemon off;"] # Standard-CMD im Basis-Image
