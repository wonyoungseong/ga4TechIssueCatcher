#!/bin/bash

# rollback-to-cloud.sh
# Emergency rollback script to switch from local Supabase back to cloud Supabase
# This script provides a safe rollback mechanism with automatic validation and cleanup

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Emergency Rollback to Cloud Supabase                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Validate .env.cloud exists
echo -e "${BLUE}Step 1: Validating cloud configuration file...${NC}"
if [ ! -f ".env.cloud" ]; then
    echo -e "${RED}❌ .env.cloud file not found!${NC}"
    echo ""
    echo "Please create .env.cloud with your cloud Supabase configuration:"
    echo "  SUPABASE_URL=https://vmezpiybidirjxkehwer.supabase.co"
    echo "  SUPABASE_ANON_KEY=<your-cloud-anon-key>"
    echo "  SUPABASE_SERVICE_ROLE_KEY=<your-cloud-service-role-key>"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Cloud configuration file found${NC}"
echo ""

# Step 2: Stop local Supabase services
echo -e "${BLUE}Step 2: Stopping local Supabase services...${NC}"
if command -v supabase &> /dev/null; then
    # Check if Supabase is running
    if docker ps | grep -q supabase; then
        echo "  Stopping local Supabase..."
        supabase stop
        echo -e "${GREEN}✅ Local Supabase services stopped${NC}"
    else
        echo -e "${YELLOW}ℹ️  Local Supabase is not running${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  Supabase CLI not installed, skipping service stop${NC}"
fi
echo ""

# Step 3: Create backup of current .env
echo -e "${BLUE}Step 3: Creating backup of current .env...${NC}"
if [ -f ".env" ]; then
    BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_FILE"
    echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}ℹ️  No existing .env file to backup${NC}"
fi
echo ""

# Step 4: Switch to cloud configuration
echo -e "${BLUE}Step 4: Switching to cloud configuration...${NC}"
cp .env.cloud .env
echo -e "${GREEN}✅ Copied .env.cloud to .env${NC}"
echo ""

# Step 5: Validate cloud configuration
echo -e "${BLUE}Step 5: Validating cloud configuration...${NC}"
if grep -q "SUPABASE_URL=https://" .env; then
    CLOUD_URL=$(grep "SUPABASE_URL" .env | cut -d'=' -f2)
    echo -e "${GREEN}✅ Cloud URL configured: $CLOUD_URL${NC}"
else
    echo -e "${RED}❌ Invalid cloud URL in .env${NC}"
    echo "Expected: SUPABASE_URL=https://..."
    echo "Please check .env.cloud configuration"
    exit 1
fi

# Check anon key
if grep -q "SUPABASE_ANON_KEY=" .env && [ -n "$(grep "SUPABASE_ANON_KEY=" .env | cut -d'=' -f2)" ]; then
    echo -e "${GREEN}✅ Cloud anon key configured${NC}"
else
    echo -e "${RED}❌ Missing or invalid SUPABASE_ANON_KEY${NC}"
    exit 1
fi

# Check service role key
if grep -q "SUPABASE_SERVICE_ROLE_KEY=" .env && [ -n "$(grep "SUPABASE_SERVICE_ROLE_KEY=" .env | cut -d'=' -f2)" ]; then
    echo -e "${GREEN}✅ Cloud service role key configured${NC}"
else
    echo -e "${RED}❌ Missing or invalid SUPABASE_SERVICE_ROLE_KEY${NC}"
    exit 1
fi
echo ""

# Step 6: Provide cleanup guidance
echo -e "${BLUE}Step 6: Next Steps${NC}"
echo ""
echo -e "${GREEN}✅ Successfully rolled back to cloud Supabase!${NC}"
echo ""
echo "Current environment:"
echo "  Database: $CLOUD_URL"
echo "  Mode: Cloud (Production)"
echo ""
echo "⚠️  Optional cleanup steps:"
echo ""
echo "1. Remove local Supabase data (if no longer needed):"
echo "   ${YELLOW}supabase stop --no-backup${NC}"
echo "   ${YELLOW}docker volume prune -f${NC}"
echo ""
echo "2. Verify cloud connection:"
echo "   ${YELLOW}node scripts/test-cloud-connection.js${NC}"
echo ""
echo "3. Restart application:"
echo "   ${YELLOW}npm run server${NC}  # Terminal 1"
echo "   ${YELLOW}npm start${NC}       # Terminal 2"
echo ""
echo "4. To switch back to local:"
echo "   ${YELLOW}./scripts/switch-to-local.sh${NC}"
echo ""

# Step 7: Display success summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ${GREEN}✅ Rollback Complete${BLUE}                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
