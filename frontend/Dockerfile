# Stage 1: Build (falls wir später einen Build-Schritt hätten, z.B. für Tailwind Purge)
# Aktuell nicht nötig, da wir CDN/statische Dateien haben.

# Stage 2: Production Environment using Nginx
FROM nginx:1.25-alpine

# Arbeitsverzeichnis im Container (optional, aber gute Praxis)
WORKDIR /usr/share/nginx/html

# Entferne die Standard Nginx Willkommensseite
RUN rm /etc/nginx/conf.d/default.conf

# Kopiere unsere eigene Nginx Konfiguration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Kopiere die Frontend-Dateien in das Verzeichnis, das Nginx ausliefert
COPY index.html .
COPY script.js .
# Falls du später CSS-Dateien oder Bilder hast, kopiere sie auch:
# COPY styles.css .
# COPY images/ ./images

# Nginx lauscht standardmäßig auf Port 80
EXPOSE 80

# Der Basis-Image startet Nginx bereits. Kein CMD nötig, außer wir wollen Optionen ändern.
# CMD ["nginx", "-g", "daemon off;"] # Standard-CMD im Basis-Image