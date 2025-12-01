#!/usr/bin/env bash
set -e

DB_USER="ibiki_user"
DB_PASS="c0smic4382"
DB_NAME="ibiki"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
$$;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') THEN
    CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
  END IF;
END
$$;
SQL

sudo -u postgres psql -d ${DB_NAME} -v ON_ERROR_STOP=1 <<SQL
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

psql "postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" -c "SELECT 1;" || true

echo DB_ENSURE_OK
