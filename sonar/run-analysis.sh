#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SONAR_HOST_URL="${SONAR_HOST_URL:-http://o4sn9bs961jvxn32hs18a81p.89.168.29.98.sslip.io:9000}"
RUN_TESTS="${RUN_TESTS:-true}"

cd "$PROJECT_ROOT"

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo -e "${RED}Missing SONAR_TOKEN.${NC}"
  echo "Create a SonarQube user token and export it before running:"
  echo "  export SONAR_TOKEN=..."
  echo "Optional:"
  echo "  export SONAR_HOST_URL=$SONAR_HOST_URL"
  exit 1
fi

echo -e "${BLUE}=== SonarQube analysis for LLMind2 ===${NC}"
echo "Host: $SONAR_HOST_URL"

if [ "$RUN_TESTS" = "true" ]; then
  echo -e "${BLUE}=== 1/3 Backend tests and coverage ===${NC}"
  if docker compose ps --services --filter status=running 2>/dev/null | grep -q '^backend$'; then
    docker compose exec -T backend pytest --cov=app --cov-report=xml:/app/coverage.xml
    docker cp llmind_backend:/app/coverage.xml backend/coverage.xml
    python3 - <<'PY'
from pathlib import Path
path = Path("backend/coverage.xml")
if path.exists():
    content = path.read_text()
    content = content.replace("<source>/app/app</source>", "<source>backend/app</source>")
    content = content.replace("<source>/app</source>", "<source>backend</source>")
    path.write_text(content)
PY
    echo -e "${GREEN}Backend coverage ready.${NC}"
  else
    echo -e "${YELLOW}Backend container is not running; skipping backend coverage.${NC}"
  fi

  echo -e "${BLUE}=== 2/3 Frontend tests and coverage ===${NC}"
  if [ -d frontend/node_modules ]; then
    (cd frontend && npm run test:coverage)
    echo -e "${GREEN}Frontend coverage ready.${NC}"
  else
    echo -e "${YELLOW}frontend/node_modules not found; skipping frontend coverage.${NC}"
  fi
else
  echo -e "${YELLOW}RUN_TESTS=false: skipping test/coverage generation.${NC}"
fi

echo -e "${BLUE}=== 3/3 SonarScanner ===${NC}"
docker run --rm \
  -v "$PROJECT_ROOT:/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dproject.settings=sonar/sonar-project.properties \
  -Dsonar.host.url="$SONAR_HOST_URL" \
  -Dsonar.token="$SONAR_TOKEN"

echo -e "${GREEN}=== Analysis submitted successfully ===${NC}"
echo "Open: $SONAR_HOST_URL/dashboard?id=llmind2"
