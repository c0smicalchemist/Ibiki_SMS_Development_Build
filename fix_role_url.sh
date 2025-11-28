#!/bin/bash
set -e
python3 - <<'PY'
import re
p='/opt/ibiki-sms/client/src/pages/AdminDashboard.tsx'
s=open(p,'r',encoding='utf-8').read()
s_new=re.sub(r'apiRequest\(/api/admin/users//role', r'apiRequest(`/api/admin/users/${client.id}/role', s)
if s_new!=s:
    open(p,'w',encoding='utf-8').write(s_new)
    print('FIXED_ROLE_URL')
else:
    print('NOCHANGE')
PY
sed -n '660,700p' /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
