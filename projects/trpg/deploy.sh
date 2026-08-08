#!/bin/bash
# Deploy script for TRPG
# Builds frontend, copies dist to Caddy-servable location, restarts server

set -e

PROJECT_DIR="/root/.local/.openclaw/workspace/projects/trpg"
DIST_TARGET="/var/www/apps/trpg"

echo "🔨 Building frontend..."
cd "$PROJECT_DIR"
npm run build

echo "📦 Copying dist to $DIST_TARGET..."
rm -rf "$DIST_TARGET"/*
cp -r dist/* "$DIST_TARGET/"
chmod -R 755 "$DIST_TARGET"

echo "🔄 Restarting PM2 server..."
pm2 restart trpg

echo "✅ Deploy complete!"
echo "   URL: https://trpg.steppa.online/"
echo "   API: https://trpg.steppa.online/api/health"
