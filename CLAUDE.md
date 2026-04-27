# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**uTools** is a containerized full-stack web app for IP information and network diagnostics (geolocation, ASN, reverse DNS, ping, traceroute, port scan, WHOIS, DNS, subnet calculator, MAC lookup). Live at https://utools.mrunk.de.

## Commands

### Local Development & Deployment

```bash
# Build and start containers locally
./build.sh

# Or manually:
docker compose down
export GIT_COMMIT_SHA=$(git rev-parse --short HEAD)
export SENTRY_DSN="<your-dsn>"
docker compose -f compose.build.yml build
docker compose -f compose.yml up -d

# Start only (using pre-built images from Docker Hub)
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Backend (local, without Docker)

```bash
cd backend
cp example.env .env   # configure env vars
npm install
npm start             # or: node server.js
```

No lint or test scripts are configured.

### Git LFS

MaxMind databases are stored in Git LFS. After cloning, run:
```bash
git lfs pull
```

## Architecture

### Structure

```
utools/
├── backend/          # Node.js Express API (port 3000)
│   ├── server.js     # Entry point: Express setup, Sentry, middleware, route mounting
│   ├── maxmind.js    # Singleton MaxMind reader initialization (GeoLite2-City + ASN)
│   ├── utils.js      # IP/domain/MAC validation helpers
│   └── routes/       # One file per API endpoint
├── frontend/         # Nginx static server (port 8080)
│   ├── app/          # Vanilla HTML/JS/CSS (no build step)
│   │   ├── index.html / script.js   # Main IP info dashboard
│   │   └── *.html    # Tool-specific pages (dns, whois, mac, subnet, asn)
│   └── nginx.conf    # Clean URL rewrites + /api/* reverse proxy to backend:3000
├── compose.yml       # Production: pulls from Docker Hub
├── compose.build.yml # Build: builds images locally
└── build.sh          # Local build + deploy script
```

### Request Flow

```
Browser → Nginx (port 8080)
           ├── static files → frontend/app/
           └── /api/*  →  Express backend (port 3000)
                              ├── MaxMind .mmdb files (GeoLite2 from Git LFS)
                              ├── Sentry (error tracking)
                              └── System commands (ping, traceroute via exec)
```

### API Endpoints

| Endpoint | Response type | Notes |
|---|---|---|
| `GET /api/ipinfo/:ip` | JSON | Geo + ASN for an IP |
| `GET /api/lookup/:query` | JSON | Resolve domain → IP → geo |
| `GET /api/dns-lookup` | JSON | DNS records |
| `GET /api/whois-lookup` | JSON | WHOIS data |
| `GET /api/ping` | JSON | ICMP ping |
| `GET /api/traceroute` | **SSE** | Streaming hop-by-hop output |
| `GET /api/port-scan` | **SSE** | Streaming port scan results |
| `GET /api/asn-lookup` | JSON | ASN details (cached to filesystem) |
| `GET /api/mac-lookup` | JSON | MAC OUI vendor lookup |
| `GET /api/version` | JSON | Git commit SHA |

Streaming endpoints use Server-Sent Events (EventSource). Nginx is configured with `proxy_buffering off` for these.

### Key Implementation Details

- **Proxy trust:** `app.set('trust proxy', 2)` — backend sits behind Nginx + any upstream proxy.
- **MaxMind readers** are initialized once at startup (`maxmind.js`) and reused across requests.
- **ASN cache** is persisted to `/app/asn-cache` (Docker volume) to reduce external calls.
- **Rate limiting** is configured via env vars (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`).
- **Private IP detection** (RFC1918, loopback, link-local) is handled in `utils.js` before any lookup.
- **Sentry** is initialized before Express and wraps request/error handlers.
- The backend Dockerfile installs OS packages for `ping` and `traceroute` (`iputils-ping`, `traceroute`).

### Environment Variables (backend)

See `backend/example.env`. Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `GEOIP_CITY_DB` | `./data/GeoLite2-City.mmdb` | Path to MaxMind City DB |
| `GEOIP_ASN_DB` | `./data/GeoLite2-ASN.mmdb` | Path to MaxMind ASN DB |
| `PORT` | `3000` | Express listen port |
| `LOG_LEVEL` | `debug` | Pino log level |
| `PING_COUNT` | `4` | Packets per ping |
| `RATE_LIMIT_MAX` | `200` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `300000` | Rate limit window (5 min) |
| `SENTRY_DSN` | — | Sentry ingest URL |
| `ASN_CACHE_DIR` | — | Directory for ASN response cache |

### CI/CD

- **`docker-build-push.yml`**: Triggered on push to `main`. Builds multi-arch images (`linux/amd64`, `linux/arm64`) and pushes to Docker Hub as `mrunknownde/utools-backend` and `mrunknownde/utools-frontend` with `:latest` and `:<short-sha>` tags. Requires LFS checkout for MaxMind databases.
- **`maxmind-update.yml`**: Runs on the 1st of each month. Downloads updated GeoLite2 databases via `geoipupdate` and commits them back to Git LFS.
