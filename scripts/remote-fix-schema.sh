#!/usr/bin/env bash
set -e
echo "[schema] fixing users table"
sudo -u postgres psql -d ibiki -v ON_ERROR_STOP=1 -c "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS username text;"
sudo -u postgres psql -d ibiki -v ON_ERROR_STOP=1 -c "CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(username);"
sudo -u postgres psql -d ibiki -v ON_ERROR_STOP=1 -c "ALTER TABLE IF EXISTS users ALTER COLUMN email DROP NOT NULL;"
echo "[schema] done"
