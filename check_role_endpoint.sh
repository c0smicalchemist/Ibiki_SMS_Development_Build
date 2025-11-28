#!/bin/bash
set -e
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ibiki_dash@proton.me","password":"c0smic4382"}' | sed -n 's/.*"token":"\([^"\]*\)".*/\1/p')
CID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:5000/api/admin/clients?token=$TOKEN" | sed -n 's/.*"id":"\([^"\]*\)".*/\1/p' | head -n 1)
[ -z "$CID" ] && echo "No CLIENT_ID" && exit 1
curl -s -o /dev/null -w 'HTTP %{http_code}\n' --max-time 4 -X POST "http://127.0.0.1:5000/api/admin/users/$CID/role?token=$TOKEN" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"role":"client"}'
