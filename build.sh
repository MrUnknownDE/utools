docker compose down
export GIT_COMMIT_SHA=$(git rev-parse --short HEAD)
docker compose -f compose.yml up -d --build