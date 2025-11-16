#!/bin/bash

# Local Supabase Validation Script
# Tests all services after docker-compose startup

set -e

echo "🔍 Validating Local Supabase Setup..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker is running
echo "📦 Checking Docker daemon..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker daemon is not running${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo -e "${GREEN}✓ Docker daemon is running${NC}"
echo ""

# Check if containers are running
echo "🐳 Checking container status..."
CONTAINERS=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
if [ "$CONTAINERS" -lt 8 ]; then
    echo -e "${YELLOW}⚠ Not all containers are running (found $CONTAINERS/9)${NC}"
    echo "Run: docker-compose --env-file .env.local up -d"
    exit 1
fi
echo -e "${GREEN}✓ All containers are running ($CONTAINERS/9)${NC}"
echo ""

# Test endpoints
echo "🌐 Testing service endpoints..."

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}

    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        echo -e "${GREEN}✓ $name${NC} - $url"
        return 0
    else
        echo -e "${RED}✗ $name${NC} - $url (Failed)"
        return 1
    fi
}

# Test each endpoint
FAILED=0

test_endpoint "Kong Gateway" "http://localhost:8000" "404" || ((FAILED++))
test_endpoint "Storage API" "http://localhost:5000/storage/v1/version" "200" || ((FAILED++))
test_endpoint "PostgREST" "http://localhost:3000" "200" || ((FAILED++))
test_endpoint "Supabase Studio" "http://localhost:3001" "200" || ((FAILED++))
test_endpoint "Auth Service" "http://localhost:9999/health" "200" || ((FAILED++))
test_endpoint "Postgres Meta" "http://localhost:8080/health" "200" || ((FAILED++))

echo ""

# Check PostgreSQL
echo "🗄️  Checking PostgreSQL..."
if docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is accepting connections${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not ready${NC}"
    ((FAILED++))
fi

echo ""

# Summary
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ All services are healthy and operational!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "🎉 Supabase Studio: http://localhost:3001"
    echo "📚 API Gateway: http://localhost:8000"
    echo ""
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}✗ $FAILED service(s) failed validation${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Debug commands:"
    echo "  docker-compose ps              # Check container status"
    echo "  docker-compose logs [service]  # View service logs"
    echo ""
    exit 1
fi
