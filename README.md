# ✨ utools - IP Information & Diagnostics Webapp ✨

[![Build Status](https://github.com/mrunknownde/utools/actions/workflows/docker-build-push.yml/badge.svg)](https://github.com/mrunknownde/utools/actions/workflows/docker-build-push.yml)
[![Update MaxMind GeoLite2 DBs](https://github.com/MrUnknownDE/utools/actions/workflows/maxmind-update.yml/badge.svg)](https://github.com/MrUnknownDE/utools/actions/workflows/maxmind-update.yml)

A modern web application that displays detailed information about a client's IP address, including geolocation, ASN, rDNS, and provides network diagnostic tools like Ping, Traceroute, DNS Lookup, Subnet Calculation, and WHOIS Lookup. It also allows looking up information for any public IP address.

### Preview: https://utools.mrunk.de

## 🚀 Features

*   **Client IP Info:** Automatically detects and displays the visitor's public IP address.
*   **Geolocation:** Shows Country, Region, City, Postal Code, Coordinates, and Timezone based on the IP.
*   **ASN Information:** Displays the Autonomous System Number (ASN) and organization name.
*   **Reverse DNS (rDNS):** Performs a reverse DNS lookup for the IP address.
*   **Interactive Dark Mode Map:** Visualizes the geolocation on a dark-themed OpenStreetMap/CartoDB map.
*   **Glassmorphism UI:** Features a premium, modern transparent design with animated gradients.
*   **IP Lookup:** Allows users to enter any public IP address to retrieve its Geo, ASN, and rDNS information.
*   **Traceroute:** Initiates a server-side traceroute (via SSE stream) to the client's IP or a looked-up IP.
*   **Ping:** Performs a server-side ping test to a looked-up IP.
*   **DNS Lookup:** Performs various DNS record lookups (A, AAAA, MX, NS, TXT, SOA) for a given domain.
*   **Subnet Calculator:** Calculates network details (address ranges, usable hosts) for IPv4 subnets.
*   **WHOIS Lookup:** Retrieves WHOIS information for a given domain or IP address.
*   **MAC Address Lookup:** Identifies the vendor/manufacturer of a network interface using OUI data.
*   **Port Scan:** Scans common ports of a target IP (via SSE stream).
*   **Dockerized:** both frontend and backend are containerized for easy deployment.

## 📚 API Usage

The backend exposes several RESTful endpoints that return JSON data.

| Endpoint | Method | Params | Description |
| :--- | :--- | :--- | :--- |
| `/api/ipinfo` | `GET` | None | Returns info for the requestor's IP. |
| `/api/lookup` | `GET` | `targetIp` | Returns Geo/ASN info for a specific IP. |
| `/api/dns-lookup` | `GET` | `domain`, `type` | Resolves DNS records (A, AAAA, MX, etc.). |
| `/api/whois-lookup` | `GET` | `query` | Performs a WHOIS lookup for a domain or IP. |
| `/api/mac-lookup` | `GET` | `mac` | Returns the vendor for a MAC address. |
| `/api/ping` | `GET` | `targetIp` | Pings an IP address (returns 4 packets). |
| `/api/traceroute` | `GET` | `targetIp` | Streams traceroute hops via Server-Sent Events (SSE). |
| `/api/port-scan` | `GET` | `targetIp` | Streams port scan results via Server-Sent Events (SSE). |

### Examples

**Lookup an IP:**
```bash
curl "http://localhost:3000/api/lookup?targetIp=8.8.8.8"
```

**DNS Lookup:**
```bash
curl "http://localhost:3000/api/dns-lookup?domain=google.com&type=A"
```

**MAC Vendor Lookup:**
```bash
curl "http://localhost:3000/api/mac-lookup?mac=00:50:56:C0:00:08"
```

## 🛠️ Tech Stack

*   **Backend:** Node.js, Express.js, MaxMind GeoLite2, `oui`, `whois-json`, `@sentry/node`.
*   **Frontend:** Vanilla JS, Tailwind CSS, Leaflet.js.
*   **Deployment:** Docker, GitHub Actions.

## 🏁 Getting Started

### Using Pre-built Images (Recommended)

1.  **Create `compose.yml`:**
    (See provided `compose.yml` in repository)

2.  **Start:**
    ```bash
    docker compose up -d
    ```

3.  **Access:** `http://localhost:8080`

## ⚙️ Configuration

Key environment variables for the backend:
*   `NODE_ENV`: `production` or `development`.
*   `PORT`: Internal port (default 3000).
*   `RATE_LIMIT_MAX`: Requests per window (e.g., 50).
*   `SENTRY_DSN`: Optional Sentry integration.

## 🌐 Data Sources

*   **Geolocation:** [MaxMind GeoLite2](https://www.maxmind.com).
*   **Map Tiles:** [OpenStreetMap](https://www.openstreetmap.org) & [CartoDB](https://carto.com).
*   **MAC Data:** [IEEE OUI](https://standards.ieee.org/products-services/regauth/oui/index.html).

## 📜 License

MIT License.