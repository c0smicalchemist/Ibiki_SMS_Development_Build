#!/usr/bin/env bash
set -e
sudo -u postgres psql -c "ALTER USER ibiki_user WITH PASSWORD 'ibiki_dev_pwd_2025';"
pm2 restart ibiki-sms
