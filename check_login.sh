#!/bin/bash
set -e
JSON=''{"email":"ibiki_dash@proton.me","password":"c0smic4382"}''
HTTP=$(curl -s -o /dev/null -w ''%{http_code}'' -X POST http://127.0.0.1:5000/api/auth/login -H ''Content-Type: application/json'' -d "$JSON")
BODY_HEAD=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login -H ''Content-Type: application/json'' -d "$JSON" | sed -n ''1p'')
echo LOGIN_HTTP=$HTTP
echo BODY_HEAD=$BODY_HEAD
