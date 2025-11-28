#!/bin/bash
set -e
python3 - <<'PY'
import re
p='/opt/ibiki-sms/client/src/pages/AdminDashboard.tsx'
with open(p,'r',encoding='utf-8') as f:
    s=f.read()
orig=s
changed=False
# 1) Add Role header after Webhook (if not already present)
if ('<TableHead>Role</TableHead>' not in s) and ('<TableHead className="whitespace-nowrap">Role</TableHead>' not in s):
    s=re.sub(r'(\s*<TableHead>Webhook</TableHead>)', r"\1\n                <TableHead>Role</TableHead>", s, count=1)
    changed=True
# 2) Fix role URL if broken
s_new=re.sub(r'apiRequest\((?:`)?/api/admin/users//role', r'apiRequest(`/api/admin/users/${client.id}/role', s)
if s_new!=s:
    s=s_new; changed=True
# 3) Insert Role select column if missing (before Actions grid)
if 'api/admin/users/${client.id}/role' not in s:
    role_block='''\n                      <TableCell>\n                        <select defaultValue={client.role || 'client'} className="border rounded px-2 py-1 text-xs" onChange={(e) => {\n                          apiRequest(`/api/admin/users/${client.id}/role`, { method: 'POST', body: JSON.stringify({ role: e.target.value }) })\n                            .then(() => { queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] }); });\n                        }}>\n                          <option value="admin">Admin</option>\n                          <option value="supervisor">Supervisor</option>\n                          <option value="client">User</option>\n                        </select>\n                      </TableCell>\n'''
    aidx=s.find('grid grid-cols-')
    if aidx!=-1:
        insert_pos=s.rfind('</TableCell>',0,aidx)
        if insert_pos!=-1:
            s=s[:insert_pos+len('</TableCell>')]+role_block+s[insert_pos+len('</TableCell>'):]
            changed=True
# 4) Add Favorites tag under Inbox card title (non-breaking UI hint)
if 'Favorites' not in s:
    s=s.replace('Inbox</CardTitle>', 'Inbox</CardTitle>\n              <div className="mt-1"><span className="inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px]">Favorites</span></div>')
    changed=True
if changed:
    with open(p,'w',encoding='utf-8') as f:
        f.write(s)
print('PATCHED' if changed else 'NOCHANGE')
PY
cd /opt/ibiki-sms
npm run build || (echo BUILD_FAILED; exit 1)
pm2 restart ibiki-sms --update-env
ls -la dist/public/assets | head -n 12
