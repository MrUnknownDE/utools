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

### Frontend (local, without Docker)

```bash
cd frontend
npm install
npm run build   # builds Tailwind CSS (app/dist/) + copies vendor libs/fonts (app/vendor/, app/dist/fonts/)
```

`frontend/app/` can then be served by any static file server for local iteration; the backend must be running separately for `/api/*` calls to work.

No lint or test scripts are configured.

## Architecture

### Structure

```
utools/
├── backend/          # Node.js Express API (port 3000)
│   ├── server.js       # Entry point: Express setup, Sentry, middleware, route mounting
│   ├── maxmind.js      # Singleton MaxMind reader initialization/reload (GeoLite2-City + ASN)
│   ├── geoipUpdater.js # Downloads GeoLite2 DBs on first boot + daily refresh job
│   ├── utils.js        # IP/domain/MAC validation helpers
│   └── routes/         # One file per API endpoint
├── frontend/         # Nginx static server (port 8080)
│   ├── app/            # Vanilla JS SPA — one static index.html shell, everything
│   │   │                 else is a hand-rolled client-side router
│   │   ├── index.html    # Shared header/nav/footer shell + #app mount point
│   │   ├── router.js     # Client-side router (swaps #app content, nav highlighting)
│   │   ├── shared.js     # Shared helpers (fetch base, copy-to-clipboard, renderLed,
│   │   │                   createLookupPage factory, dual-stack detection)
│   │   ├── src/input.css # Tailwind entry + "Patchbay" design tokens/components
│   │   ├── pages/*.js    # One module per route (home, subnet, dns, whois, mac, asn, diagnose)
│   │   ├── assets/       # Self-hosted favicon etc.
│   │   ├── dist/, vendor/ # Build output (Tailwind CSS, fonts, Leaflet/D3) — generated, not committed
│   ├── scripts/build-vendor.js # Copies Leaflet/D3/font files out of node_modules at build time
│   ├── package.json  # Tailwind CLI build (`npm run build`) — no JS bundler, pages use native ES modules
│   └── nginx.conf    # Clean URL rewrites (SPA fallback to index.html) + /api/* reverse proxy to backend:3000
├── compose.yml       # Production: pulls from Docker Hub
├── compose.build.yml # Build: builds images locally
└── build.sh          # Local build + deploy script
```

### Request Flow

```
Browser → Nginx (port 8080)
           ├── static files → frontend/app/
           └── /api/*  →  Express backend (port 3000)
                              ├── MaxMind .mmdb files (self-downloaded, daily refresh)
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
- **MaxMind readers** are initialized at startup (`maxmind.js`) and reused across requests.
- **MaxMind databases** are downloaded by the backend itself (`geoipUpdater.js`) on first boot if missing, then refreshed on a daily schedule (default 03:00 UTC, `MAXMIND_UPDATE_HOUR_UTC`) via the MaxMind download API, with the readers hot-reloaded in place — no image rebuild needed. Requires `MAXMIND_ACCOUNT_ID` / `MAXMIND_LICENSE_KEY`; without them, auto-update is skipped and `.mmdb` files must be placed in `backend/data/` manually. Persisted to `/app/data` (Docker volume) so restarts don't force a re-download.
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
| `MAXMIND_ACCOUNT_ID` | — | MaxMind account ID (enables daily DB auto-update) |
| `MAXMIND_LICENSE_KEY` | — | MaxMind license key (enables daily DB auto-update) |
| `MAXMIND_UPDATE_HOUR_UTC` | `3` | UTC hour the daily GeoLite2 update job runs at |

### CI/CD

- **`docker-build-push.yml`**: Triggered on push to `main`. Builds multi-arch images (`linux/amd64`, `linux/arm64`) and pushes to Docker Hub as `mrunknownde/utools-backend` and `mrunknownde/utools-frontend` with `:latest` and `:<short-sha>` tags.
