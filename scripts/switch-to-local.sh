#!/bin/bash

###############################################################################
# Switch to Local Supabase Environment
#
# This script switches the application to use local Supabase running in Docker.
# It copies .env.local to .env and validates the configuration.
#
# Usage:
#   ./scripts/switch-to-local.sh
#
# Prerequisites:
#   - .env.local file must exist
#   - Docker Desktop must be running
#   - Supabase stack should be started: docker-compose up -d
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Switching to Local Supabase Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env.local exists
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
    echo -e "${RED}❌ Error: .env.local file not found${NC}"
    echo "   Please create .env.local file first"
    echo "   Reference: docs/stories/12.4.api-connection-update.md"
    exit 1
fi

# Backup current .env if it exists and is different from .env.local
if [ -f "$PROJECT_ROOT/.env" ]; then
    if ! cmp -s "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.local"; then
        echo -e "${BLUE}📦 Backing up current .env to .env.backup${NC}"
        cp "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.backup"
        echo -e "${GREEN}   ✅ Backup created${NC}"
    else
        echo -e "${YELLOW}ℹ️  Current .env is already using local configuration${NC}"
    fi
fi

# Copy .env.local to .env
echo -e "${BLUE}📄 Copying .env.local to .env${NC}"
cp "$PROJECT_ROOT/.env.local" "$PROJECT_ROOT/.env"
echo -e "${GREEN}   ✅ Environment file updated${NC}"

# Validate configuration
echo ""
echo -e "${BLUE}🔍 Validating configuration...${NC}"

# Check for required environment variables
if grep -q "SUPABASE_URL=http://localhost" "$PROJECT_ROOT/.env"; then
    echo -e "${GREEN}   ✅ SUPABASE_URL configured for local${NC}"
else
    echo -e "${RED}   ❌ Warning: SUPABASE_URL does not point to localhost${NC}"
fi

if grep -q "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24i" "$PROJECT_ROOT/.env"; then
    echo -e "${GREEN}   ✅ SUPABASE_ANON_KEY configured for local${NC}"
else
    echo -e "${RED}   ❌ Warning: SUPABASE_ANON_KEY does not match local configuration${NC}"
fi

# Check if Docker is running
echo ""
echo -e "${BLUE}🐳 Checking Docker status...${NC}"

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}   ❌ Docker is not running${NC}"
    echo -e "${YELLOW}   Please start Docker Desktop${NC}"
    exit 1
fi

echo -e "${GREEN}   ✅ Docker is running${NC}"

# Check if Supabase containers are running
if docker-compose ps | grep -q "supabase"; then
    echo -e "${GREEN}   ✅ Supabase containers are running${NC}"
else
    echo -e "${YELLOW}   ⚠️  Supabase containers are not running${NC}"
    echo ""
    echo -e "${BLUE}   Starting Supabase stack...${NC}"
    cd "$PROJECT_ROOT"
    docker-compose up -d
    echo ""
    echo -e "${GREEN}   ✅ Supabase stack started${NC}"
    echo -e "${YELLOW}   ℹ️  Wait 10-15 seconds for services to initialize${NC}"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Successfully switched to Local Supabase!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Local Supabase URLs:"
echo "   API Gateway:    http://localhost:8001"
echo "   Studio:         http://localhost:3003"
echo "   Database:       localhost:5433"
echo "   Storage API:    http://localhost:5002"
echo ""
echo "🧪 Test connection:"
echo "   node scripts/test-local-connection.js"
echo ""
echo "🔄 Switch back to cloud:"
echo "   ./scripts/switch-to-cloud.sh"
echo ""
