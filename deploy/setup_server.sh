#!/usr/bin/env bash
set -e
APP_DIR=${APP_DIR:-/opt/ibiki}
PORT=${PORT:-5000}
DB_URL=${DB_URL:-}
DB_USER=${DB_USER:-}
DB_PASS=${DB_PASS:-}

sudo mkdir -p "$APP_DIR"
if [ "$(pwd)" != "$APP_DIR" ]; then
  sudo rsync -a --delete ./ "$APP_DIR"/
fi
cd "$APP_DIR"

sudo apt-get update -y
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo apt-get install -y postgresql

sudo systemctl enable postgresql
sudo systemctl start postgresql

if [ -n "$DB_USER" ] && [ -n "$DB_PASS" ]; then
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'ibiki'" | grep -q 1 || sudo -u postgres createdb ibiki
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO $DB_USER" || true
fi

if [ -n "$DB_URL" ]; then
  printf "NODE_ENV=production\nPORT=%s\nDATABASE_URL=%s\n" "$PORT" "$DB_URL" | sudo tee "$APP_DIR/.env.production" >/dev/null
fi

npm install
npm run build

sudo tee /etc/systemd/system/ibiki.service >/dev/null <<'EOF'
[Unit]
Description=Ibiki SMS Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/ibiki
Environment=NODE_ENV=production
EnvironmentFile=/opt/ibiki/.env.production
ExecStart=/usr/bin/node /opt/ibiki/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ibiki
sudo systemctl restart ibiki
