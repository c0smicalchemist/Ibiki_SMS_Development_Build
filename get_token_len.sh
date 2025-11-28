#!/bin/bash
set -e
JSON=''{"email":"ibiki_dash@proton.me","password":"c0smic4382"}''
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login -H 'Content-Type: application/json' -d "$JSON" | sed -n 's/.*"token":"\([^"\]*\)".*/\1/p')
echo TOKEN_LEN=${#TOKEN}
