#!/bin/bash
#
# Cron Job Wrapper Script for GA4 Tech Issue Catcher
#
# Epic 2: Browser Automation & Parallel Crawling
# Story 2.4: Cron Job Automation
#
# Usage: Add to crontab with:
# 0 3 * * * /opt/ga4-tech-issue-catcher/run-cron.sh >> /opt/ga4-tech-issue-catcher/logs/cron.log 2>&1
#

# Exit on any error
set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to project directory
cd "$SCRIPT_DIR"

# Load environment variables from .env file (AC2)
if [ -f "$SCRIPT_DIR/.env" ]; then
  echo "📋 Loading environment variables from .env..."
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
else
  echo "⚠️  Warning: .env file not found at $SCRIPT_DIR/.env"
fi

# Log start time (AC4)
echo ""
echo "========================================"
echo "🚀 Cron Job Started"
echo "📅 Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "📂 Working Directory: $(pwd)"
echo "🔧 Node Version: $(node --version)"
echo "========================================"
echo ""

# Execute Node.js application
if /usr/bin/env node "$SCRIPT_DIR/src/cron.js"; then
  # Log success completion (AC4)
  echo ""
  echo "========================================"
  echo "✅ Cron Job Completed Successfully"
  echo "📅 Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "========================================"
  echo ""
  exit 0
else
  # Log error completion (AC3, AC4)
  EXIT_CODE=$?
  echo ""
  echo "========================================"
  echo "❌ Cron Job Failed"
  echo "📅 Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "🔴 Exit Code: $EXIT_CODE"
  echo "========================================"
  echo ""
  exit $EXIT_CODE
fi
