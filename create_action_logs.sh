#!/bin/bash
set -e
DB='postgresql://ibiki_user:c0smic4382@localhost:5432/ibiki'
SQL='CREATE TABLE IF NOT EXISTS action_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id TEXT,
  actor_role TEXT,
  target_user_id TEXT,
  action TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);'
echo "$SQL" | psql "$DB" -v ON_ERROR_STOP=1 -q || { echo PSQL_FAILED; exit 1; }
echo ACTION_LOGS_READY
