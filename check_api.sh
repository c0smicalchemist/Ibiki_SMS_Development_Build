#!/bin/bash
set -e
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ibiki_dash@proton.me", "password":"c0smic4382"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
for url in /api/health /api/admin/clients; do
  echo -n "$url => "
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' --max-time 4 "http://127.0.0.1:5000${url}?token=$TOKEN" -H "Authorization: Bearer $TOKEN"
done