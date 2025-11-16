#!/bin/bash

###############################################################################
# Switch to Cloud Supabase Environment
#
# This script switches the application to use cloud Supabase.
# It copies .env.cloud to .env and validates the configuration.
#
# Usage:
#   ./scripts/switch-to-cloud.sh
#
# Prerequisites:
#   - .env.cloud file must exist (backup of original cloud configuration)
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
echo "🔄 Switching to Cloud Supabase Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env.cloud exists
if [ ! -f "$PROJECT_ROOT/.env.cloud" ]; then
    echo -e "${RED}❌ Error: .env.cloud file not found${NC}"
    echo "   Please create .env.cloud backup first"
    echo "   Reference: docs/stories/12.4.api-connection-update.md"
    exit 1
fi

# Backup current .env if it exists and is different from .env.cloud
if [ -f "$PROJECT_ROOT/.env" ]; then
    if ! cmp -s "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.cloud"; then
        echo -e "${BLUE}📦 Backing up current .env to .env.backup${NC}"
        cp "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.backup"
        echo -e "${GREEN}   ✅ Backup created${NC}"
    else
        echo -e "${YELLOW}ℹ️  Current .env is already using cloud configuration${NC}"
    fi
fi

# Copy .env.cloud to .env
echo -e "${BLUE}📄 Copying .env.cloud to .env${NC}"
cp "$PROJECT_ROOT/.env.cloud" "$PROJECT_ROOT/.env"
echo -e "${GREEN}   ✅ Environment file updated${NC}"

# Validate configuration
echo ""
echo -e "${BLUE}🔍 Validating configuration...${NC}"

# Check for cloud Supabase URL
if grep -q "SUPABASE_URL=https://" "$PROJECT_ROOT/.env"; then
    CLOUD_URL=$(grep "SUPABASE_URL=" "$PROJECT_ROOT/.env" | cut -d'=' -f2)
    echo -e "${GREEN}   ✅ SUPABASE_URL configured for cloud${NC}"
    echo -e "      URL: $CLOUD_URL"
else
    echo -e "${RED}   ❌ Warning: SUPABASE_URL does not point to cloud${NC}"
fi

# Check for cloud API keys (should NOT be demo keys)
if grep -q "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24i" "$PROJECT_ROOT/.env"; then
    echo -e "${YELLOW}   ⚠️  Warning: Using demo ANON_KEY (should be production key)${NC}"
else
    echo -e "${GREEN}   ✅ SUPABASE_ANON_KEY configured for cloud${NC}"
fi

# Check if local Docker containers are running
echo ""
echo -e "${BLUE}🐳 Checking local Docker containers...${NC}"

if docker info > /dev/null 2>&1; then
    if docker-compose ps | grep -q "supabase"; then
        echo -e "${YELLOW}   ℹ️  Local Supabase containers are still running${NC}"
        echo -e "${BLUE}   You may want to stop them to save resources:${NC}"
        echo -e "      docker-compose down"
    else
        echo -e "${GREEN}   ✅ No local Supabase containers running${NC}"
    fi
else
    echo -e "${GREEN}   ✅ Docker is not running (no local containers)${NC}"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Successfully switched to Cloud Supabase!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "☁️  Cloud Supabase Connection:"
if [ -n "$CLOUD_URL" ]; then
    echo "   URL: $CLOUD_URL"
fi
echo ""
echo "🔄 Switch back to local:"
echo "   ./scripts/switch-to-local.sh"
echo ""
echo "💾 Optional: Stop local Docker containers:"
echo "   docker-compose down"
echo ""
