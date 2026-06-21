#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 1/3 Running Backend Tests & Generating Coverage ===${NC}"
# Run pytest in the backend container
docker compose exec backend pytest

# Copy the coverage report XML from the container to the host
docker cp llmind_backend:/app/coverage.xml backend/coverage.xml
# Align file paths for SonarQube scanner
python3 -c "
with open('backend/coverage.xml', 'r') as f:
    content = f.read()
content = content.replace('<source>/app/app</source>', '<source>backend/app</source>')
with open('backend/coverage.xml', 'w') as f:
    f.write(content)
"
echo -e "${GREEN}✓ Backend coverage.xml ready and paths aligned.${NC}\n"

echo -e "${BLUE}=== 2/3 Running Frontend Tests & Generating Coverage ===${NC}"
# Run Jest coverage in the frontend directory on host
cd frontend
npm run test:coverage
cd ..
echo -e "${GREEN}✓ Frontend lcov.info ready.${NC}\n"

echo -e "${BLUE}=== 3/3 Launching SonarQube Scanner CLI ===${NC}"
echo "Requesting analysis token from SonarQube API..."
TOKEN_RESPONSE=$(curl -s -u admin:admin -X POST "http://localhost:9000/api/user_tokens/generate?name=llmind2-token-$(date +%s)" || echo "")
SONAR_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")

if [ -z "$SONAR_TOKEN" ]; then
  echo -e "${RED}Warning: Failed to generate token via API, trying default fallback...${NC}"
  SONAR_TOKEN="squ_d2654433c208df049de1d31e03d1b95fcb6918e5"
fi

# Run SonarScanner via Docker container
# Use host.docker.internal to access localhost:9000 on macOS
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "$(pwd):/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dproject.settings=sonar/sonar-project.properties \
  -Dsonar.host.url=http://host.docker.internal:9000 \
  -Dsonar.token="$SONAR_TOKEN" || {
    echo -e "${RED}Scanner execution failed. Please check if SonarQube is running at http://localhost:9000 and the analysis token is valid.${NC}"
    exit 1
  }

echo -e "${GREEN}=== Analysis Finished! ===${NC}"
echo -e "Check results at: http://localhost:9000"
