# ✨ utools - IP Information & Diagnostics Webapp ✨

[![Build Status](https://github.com/mrunknownde/utools/actions/workflows/docker-build-push.yml/badge.svg)](https://github.com/mrunknownde/utools/actions/workflows/docker-build-push.yml)
[![Update MaxMind GeoLite2 DBs](https://github.com/MrUnknownDE/utools/actions/workflows/maxmind-update.yml/badge.svg)](https://github.com/MrUnknownDE/utools/actions/workflows/maxmind-update.yml)

A modern web application that displays detailed information about a client's IP address, including geolocation, ASN, rDNS, and provides network diagnostic tools like Ping, Traceroute, DNS Lookup, Subnet Calculation, and WHOIS Lookup. It also allows looking up information for any public IP address.

<!-- Optional: Füge hier einen Screenshot hinzu -->
<!-- ![Screenshot](link/to/your/screenshot.png) -->

### Preview: https://utools.mrunk.de

## 🚀 Features

*   **Client IP Info:** Automatically detects and displays the visitor's public IP address.
*   **Geolocation:** Shows Country, Region, City, Postal Code, Coordinates, and Timezone based on the IP.
*   **ASN Information:** Displays the Autonomous System Number (ASN) and organization name.
*   **Reverse DNS (rDNS):** Performs a reverse DNS lookup for the IP address.
*   **Interactive Map:** Visualizes the geolocation on an OpenStreetMap.
*   **IP Lookup:** Allows users to enter any public IP address to retrieve its Geo, ASN, and rDNS information.
*   **Traceroute:** Initiates a server-side traceroute (via SSE stream) to the client's IP (on click) or a looked-up IP.
*   **Ping:** Performs a server-side ping test to a looked-up IP.
*   **DNS Lookup:** Performs various DNS record lookups (A, AAAA, MX, NS, TXT, SOA) for a given domain.
*   **Subnet Calculator:** Calculates network details (Network Address, Broadcast Address, Usable Hosts, etc.) for a given IP and CIDR or Subnet Mask.
*   **WHOIS Lookup:** Retrieves WHOIS information for a given domain or IP address.
*   **Dockerized:** Both frontend and backend are containerized for easy deployment.
*   **Modern UI:** Built with Tailwind CSS for a clean and responsive interface.

## 🛠️ Tech Stack

*   **Backend:**
    *   Node.js
    *   Express.js
    *   MaxMind GeoLite2 Databases (for GeoIP and ASN)
    *   Pino (for logging)
    *   `whois-json` (for WHOIS lookups)
    *   `net`, `dns`, `child_process` (Node.js built-ins for Ping, Traceroute, rDNS, DNS Lookup)
    *   `@sentry/node` (optional error tracking)
*   **Frontend:**
    *   Vanilla JavaScript (ES6+)
    *   Tailwind CSS (via Play CDN for simplicity, can be built)
    *   Leaflet.js (for OpenStreetMap)
    *   Nginx (for serving static files and as a reverse proxy)
*   **Deployment:**
    *   Docker & Docker Compose
    *   GitHub Actions (for CI/CD - building and pushing images to GHCR)

## 🏁 Getting Started

You can run this application easily using Docker and Docker Compose.

### Prerequisites

*   [Docker](https://docs.docker.com/get-docker/) installed
*   [Docker Compose](https://docs.docker.com/compose/install/) installed (usually included with Docker Desktop)

### Option 1: Using Pre-built Images (Recommended)

This method uses the Docker images automatically built and pushed to GitHub Container Registry (GHCR) by the GitHub Actions workflow.

1.  **Create `compose.yml`:**
    Save the following content as `compose.yml` in a new directory on your machine:

    ```yaml
    services:
      # Backend Service (Node.js App)
      backend:
        # Verwendet ein bereits gebautes Image
        image: ghcr.io/mrunknownde/utools-backend:latest
        container_name: utools_backend
        restart: unless-stopped
        environment:
          # Setze Umgebungsvariablen für das Backend
          NODE_ENV: production # Wichtig für Performance und Logging
          PORT: 3000 # Port innerhalb des Containers
          LOG_LEVEL: info # Oder 'warn' für weniger Logs in Produktion
          PING_COUNT: 4
          # Sentry DSN aus der Umgebung/ .env Datei übernehmen
          SENTRY_DSN: "https://7ea70caba68f548fb96482a573006a7b@o447623.ingest.us.sentry.io/4509062020333568" # Wichtig für die Laufzeit
        dns:
          - 1.1.1.1    # Cloudflare DNS
          - 1.0.0.1    # Cloudflare DNS
          - 8.8.8.8    # Google DNS
          - 8.8.4.4    # Google DNS
        networks:
          - utools_network # Verbinde mit unserem benutzerdefinierten Netzwerk

      # Frontend Service (Nginx)
      frontend:
        # Verwendet ein bereits gebautes Image
        image: ghcr.io/mrunknownde/utools-frontend:latest
        container_name: utools_frontend
        restart: unless-stopped
        ports:
          # Mappe Port 8080 vom Host auf Port 80 im Container (wo Nginx lauscht)
          # Zugriff von außen (Browser) erfolgt über localhost:8080
          - "8080:80"
        depends_on:
          - backend # Stellt sicher, dass Backend gestartet wird (aber nicht unbedingt bereit ist)
        networks:
          - utools_network # Verbinde mit unserem benutzerdefinierten Netzwerk

    # Definiere ein benutzerdefiniertes Netzwerk (gute Praxis)
    networks:
      utools_network:
        driver: bridge
    ```

2.  **Start the Application:**
    Open a terminal in the directory where you saved the `compose.yml` file and run:
    ```bash
    docker compose up -d
    ```
    *(Note: Use `docker-compose` (with hyphen) if you have an older version)*
    This will download the images (if not already present) and start the containers in the background.

3.  **Access the Webapp:**
    Open your web browser and navigate to `http://localhost:8080`.

### Option 2: Building Images from Source

If you want to modify the code or build the images yourself, the project is now split into a build and a run configuration.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/mrunknownde/utools.git
    cd utools
    ```
2.  **Build and Start:**
    First, you build the images using `compose.build.yml`. Then, you start the services using the main `compose.yml`.

    ```bash
    # Set GIT_COMMIT_SHA for the build process
    export GIT_COMMIT_SHA=$(git rev-parse --short HEAD)

    # 1. Build the images
    docker compose -f compose.build.yml build

    # 2. Run the services using the newly built images
    docker compose -f compose.yml up -d
    ```
    You can also use the provided `build.sh` script which does these steps for you.

3.  **Access the Webapp:**
    Open your web browser and navigate to `http://localhost:8080`.

## ⚙️ Configuration

The application is configured mainly through environment variables set in the `compose.yml` file for the `backend` service:

*   `NODE_ENV`: Set to `production` for optimal performance and JSON logging.
*   `PORT`: The internal port the Node.js application listens on (default: `3000`).
*   `LOG_LEVEL`: Controls the logging verbosity (e.g., `debug`, `info`, `warn`, `error`).
*   `PING_COUNT`: Number of ping packets to send (default: `4`).
*   `SENTRY_DSN` (Optional): Your Sentry Data Source Name for error tracking. Can be set during build via args or at runtime via environment variable.
*   `dns` (in compose): Specifies DNS servers for the backend container, crucial for reliable rDNS lookups.

The MaxMind database paths (`GEOIP_CITY_DB`, `GEOIP_ASN_DB`) are set within the backend's Dockerfile but could potentially be overridden if needed (e.g., using volumes).

## 🌐 Data Sources

*   **Geolocation & ASN:** This tool uses GeoLite2 data created by MaxMind, available from [https://www.maxmind.com](https://www.maxmind.com).
    *   **Important:** The GeoLite2 databases require periodic updates. You need a MaxMind account (free) to download them. The Docker images contain the databases at build time. For long-term use, you should implement a process to update the `.mmdb` files within the `backend/data` directory (if using volumes) or rebuild the backend image regularly using the provided GitHub Action workflow (`maxmind-update.yml`).
*   **Map Tiles:** Provided by OpenStreetMap contributors.
*   **WHOIS Data:** Retrieved in real-time using the `whois-json` library, which queries standard WHOIS servers.
*   **DNS Data:** Retrieved in real-time using Node.js' built-in `dns` module.

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.