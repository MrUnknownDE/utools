docker compose down

# Setzt die Git-Commit-Variable für den Build-Prozess
export GIT_COMMIT_SHA=$(git rev-parse --short HEAD)
export SENTRY_DSN="https://7ea70caba68f548fb96482a573006a7b@o447623.ingest.us.sentry.io/4509062020333568"

# Schritt 1: Baue die Images mit der compose.build.yml
echo "--- Building Docker images ---"
docker compose -f compose.build.yml build

# Schritt 2: Starte die Container mit der compose.yml, die die gebauten Images verwendet
echo "--- Starting containers ---"
docker compose -f compose.yml up -d