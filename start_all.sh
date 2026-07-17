#!/bin/bash
# ===================================================
#   Craft-Core Production Services Startup Script (Linux)
# ===================================================

# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}   Craft-Core Production Services Startup Script${NC}"
echo -e "${GREEN}===================================================${NC}"
echo

# 1. Prerequisite checks
echo "Checking environment prerequisites..."
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}[ERROR] PM2 is not installed or not in PATH!${NC}"
    echo "Please install PM2 globally via: npm install -g pm2"
    exit 1
fi
echo -e "${GREEN}PM2 is available.${NC}"
echo

# 2. Stop existing processes
echo -e "${YELLOW}[1/4] Stopping existing PM2 processes...${NC}"
pm2 delete craft-core-bot >/dev/null 2>&1
pm2 delete craft-core-backend >/dev/null 2>&1
# Clean up deprecated processes if any
pm2 delete craft-core-frontend >/dev/null 2>&1
pm2 delete craft-core-docs >/dev/null 2>&1
echo "Stopped."
echo

# 3. Build Backend
echo -e "${YELLOW}[2/4] Building Backend (TypeScript Compilation)...${NC}"
cd web-dashboard/backend || exit 1
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Backend build failed!${NC}"
    exit 1
fi
cd ../..
echo

# 4. Build Frontend
echo -e "${YELLOW}[3/4] Building Dashboard Frontend (Vite Production Build)...${NC}"
cd web-dashboard/frontend || exit 1
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Frontend build failed!${NC}"
    exit 1
fi
cd ../..
echo

# 4.5. Deploy Static Files to /var/www/craft-core (for Caddy)
echo -e "${YELLOW}[3.5/4] Deploying static assets for Caddy...${NC}"
mkdir -p /var/www/craft-core/dashboard
rm -rf /var/www/craft-core/dashboard/*
cp -r web-dashboard/frontend/dist/* /var/www/craft-core/dashboard/

if [ -d "website/out" ]; then
    mkdir -p /var/www/craft-core/website
    rm -rf /var/www/craft-core/website/*
    cp -r website/out/* /var/www/craft-core/website/
fi

if [ -d "docs/.vitepress/dist" ]; then
    mkdir -p /var/www/craft-core/docs
    rm -rf /var/www/craft-core/docs/*
    cp -r docs/.vitepress/dist/* /var/www/craft-core/docs/
fi

# Adjust permissions so caddy user can read them
chown -R caddy:caddy /var/www/craft-core 2>/dev/null || true
chmod -R 755 /var/www/craft-core 2>/dev/null || true
echo -e "${GREEN}Deployment to /var/www/craft-core completed.${NC}"
echo

# 5. Start PM2 services
echo -e "${YELLOW}[4/4] Starting PM2 Daemons...${NC}"
echo "Starting Discord Bot..."
pm2 start src/index.js --name craft-core-bot --cwd discord-bot

echo "Starting Web Dashboard Backend..."
pm2 start dist/server.js --name craft-core-backend --cwd web-dashboard/backend
echo

# 6. Save PM2 processes for startup persistence
echo -e "${GREEN}Saving PM2 process list for boot autostart persistence...${NC}"
pm2 save
echo

echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}   All production services are running under PM2!${NC}"
echo
echo -e "   * Portal Website: Hosted on Cloudflare Pages"
echo -e "   * Wiki Docs: Hosted on Cloudflare Pages"
echo -e "   * Dashboard Frontend: Served statically by Caddy"
echo -e "   * Dashboard Backend & WebSocket: Managed by PM2"
echo
echo -e "   ${YELLOW}To enable Linux boot-up autostart:${NC}"
echo -e "   Run the following command to generate the systemd startup script:"
echo -e "   ${GREEN}pm2 startup${NC}"
echo -e "   (Then copy, paste, and run the command it outputs in the terminal)"
echo
echo -e "   Useful Commands:"
echo -e "   - Monitor: pm2 status"
echo -e "   - Logs:    pm2 logs"
echo -e "   - Restart: pm2 restart all"
echo -e "${GREEN}===================================================${NC}"
