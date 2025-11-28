#!/bin/bash
set -e
python3 - <<'PY'
import re
p='/opt/ibiki-sms/client/src/pages/AdminDashboard.tsx'
s=open(p,'r',encoding='utf-8').read()
s_new=re.sub(r'apiRequest\((?:`)?/api/admin/users//role,\s*', 'apiRequest(`/api/admin/users/${client.id}/role`, ', s)
changed=s_new!=s
if changed:
    open(p,'w',encoding='utf-8').write(s_new)
print('ROLE_URL_' + ('FIXED' if changed else 'NOCHANGE'))
PY
sed -n '660,720p' /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
cd /opt/ibiki-sms
npm run build || (echo BUILD_FAILED; exit 1)
pm2 restart ibiki-sms --update-env
