#!/bin/bash
set -e
python3 - <<'PY'
import re
p='/opt/ibiki-sms/client/src/pages/AdminDashboard.tsx'
s=open(p,'r',encoding='utf-8').read()
s_new=s.replace('apiRequest(/api/admin/users//role', 'apiRequest(/api/admin/users//role')
if s_new!=s:
    open(p,'w',encoding='utf-8').write(s_new)
    print('ROLE_URL_FIXED')
else:
    print('ROLE_URL_NOCHANGE')
PY
sed -n '660,700p' /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
cd /opt/ibiki-sms
npm run build || (echo BUILD_FAILED; exit 1)
pm2 restart ibiki-sms --update-env
echo PROD_RESTARTED
curl -I https://ibiki.run.place/admin | sed -n 1,20p
