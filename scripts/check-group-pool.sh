#!/usr/bin/env bash
set -e
echo "[db] system_config group.pool.*"
sudo -u postgres psql -d ibiki -v ON_ERROR_STOP=1 -c "SELECT key, value FROM system_config WHERE key LIKE 'group.pool.%' ORDER BY key;"
echo "[db] users (id, email, role, group_id)"
sudo -u postgres psql -d ibiki -v ON_ERROR_STOP=1 -c "SELECT id, email, role, group_id FROM users ORDER BY role, id LIMIT 50;"
echo "[db] client_profiles (user_id, credits, business_name)"
sudo -u postgres psql -d ibiki -v ON_ERROR_STOP=1 -c "SELECT user_id, credits, business_name FROM client_profiles ORDER BY user_id LIMIT 50;"
