#!/bin/bash
set -e

echo "🚀 Starting Render build process..."

# Set Playwright browsers path for persistence
export PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/playwright

echo "📁 Playwright browsers path: $PLAYWRIGHT_BROWSERS_PATH"

# Create the directory if it doesn't exist
if [[ ! -d $PLAYWRIGHT_BROWSERS_PATH ]]; then
  echo "📦 Creating Playwright browsers directory..."
  mkdir -p $PLAYWRIGHT_BROWSERS_PATH
fi

# Install Playwright Chromium browser
echo "🌐 Installing Playwright Chromium..."
npx playwright install chromium

# Build frontend
echo "🎨 Building frontend..."
cd front/crawler-monitor && npm install && npm run build
cd ../..

echo "✅ Build completed successfully!"
