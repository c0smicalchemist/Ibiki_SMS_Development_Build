cat >/root/apply_admin_role_patch.sh <<'EOF'
set -e
python3 - <<'PY'
import re
p = '/opt/ibiki-sms/client/src/pages/AdminDashboard.tsx'
s = open(p,'r',encoding='utf-8').read()
changed = False
s_new = re.sub(r'<Table>', '<Table className="text-sm">', s)
if s_new != s:
    s = s_new; changed = True
if '<TableHead>Role</TableHead>' not in s:
    s = s.replace('<TableHead>Webhook</TableHead>', '<TableHead>Webhook</TableHead>\n                <TableHead>Role</TableHead>')
    changed = True
if 'api/admin/users//role' not in s:
    role_block = '''
                      <TableCell>
                        <select defaultValue={client.role || 'client'} className="border rounded px-2 py-1 text-xs" onChange={(e) => {
                          apiRequest(/api/admin/users//role, { method: 'POST', body: JSON.stringify({ role: e.target.value }) })
                            .then(() => { queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] }); });
                        }}>
                          <option value="admin">Admin</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="client">User</option>
                        </select>
                      </TableCell>
'''
    idx = s.find('space-y-2 w-64')
    if idx != -1:
        end = s.find('</TableCell>', idx)
        if end != -1:
            s = s[:end+len('</TableCell>')] + role_block + s[end+len('</TableCell>'):]
            changed = True
    else:
        aidx = s.find('grid grid-cols-1 gap-2 items-start')
        if aidx != -1:
            insert_pos = s.rfind('</TableCell>', 0, aidx)
            if insert_pos != -1:
                s = s[:insert_pos+len('</TableCell>')] + role_block + s[insert_pos+len('</TableCell>'):]
                changed = True
open(p,'w',encoding='utf-8').write(s)
print('PATCHED' if changed else 'NOCHANGE')
PY
EOF
bash /root/apply_admin_role_patch.sh
