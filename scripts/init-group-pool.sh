#!/usr/bin/env bash
set -e
echo "[db] initialize group pools from supervisor credits"
sudo -u postgres psql -d ibiki -v ON_ERROR_STOP=1 -c "
INSERT INTO system_config(key,value)
SELECT 'group.pool.'||u.group_id, SUM(cp.credits::numeric)::text
FROM users u JOIN client_profiles cp ON cp.user_id=u.id
WHERE u.role='supervisor'
GROUP BY u.group_id
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
"
echo "[db] current group pools"
sudo -u postgres psql -d ibiki -v ON_ERROR_STOP=1 -c "SELECT key, value FROM system_config WHERE key LIKE 'group.pool.%' ORDER BY key;"
