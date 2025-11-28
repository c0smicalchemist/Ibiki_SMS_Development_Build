cat >/root/apply_admin_compact_patch.sh <<'EOF'
set -e
python3 - <<'PY'
import re
p = '/opt/ibiki-sms/client/src/pages/AdminDashboard.tsx'
s = open(p,'r',encoding='utf-8').read()
changed = False
# Compact table
s_new = s.replace('<Table>', '<Table className="text-sm">')
if s_new != s:
    s = s_new; changed = True
# Header nowrap where present
headers = [
    ('<TableHead>Client Name</TableHead>', '<TableHead className="whitespace-nowrap">Client Name</TableHead>'),
    ('<TableHead>Email</TableHead>', '<TableHead className="whitespace-nowrap">Email</TableHead>'),
    ('<TableHead>API Key</TableHead>', '<TableHead className="whitespace-nowrap">API Key</TableHead>'),
    ('<TableHead>Status</TableHead>', '<TableHead className="whitespace-nowrap">Status</TableHead>'),
    ('<TableHead>Messages Sent</TableHead>', '<TableHead className="whitespace-nowrap">Messages</TableHead>'),
    ('<TableHead>Credits</TableHead>', '<TableHead className="whitespace-nowrap">Credits</TableHead>'),
    ('<TableHead>Assigned Numbers</TableHead>', '<TableHead className="whitespace-nowrap">Assigned Numbers</TableHead>'),
    ('<TableHead>Last Active</TableHead>', '<TableHead className="whitespace-nowrap">Last Active</TableHead>'),
    ('<TableHead>Delivery Mode</TableHead>', '<TableHead className="whitespace-nowrap">Delivery</TableHead>'),
    ('<TableHead>Webhook</TableHead>', '<TableHead className="whitespace-nowrap">Webhook</TableHead>'),
    ('<TableHead>Actions</TableHead>', '<TableHead className="whitespace-nowrap">Actions</TableHead>'),
]
for old,new in headers:
    if old in s and new not in s:
        s = s.replace(old,new); changed = True
# Role column header
if '<TableHead>Role</TableHead>' not in s and '<TableHead className="whitespace-nowrap">Role</TableHead>' not in s:
    s = s.replace('<TableHead className="whitespace-nowrap">Webhook</TableHead>', '<TableHead className="whitespace-nowrap">Webhook</TableHead>\n                <TableHead className="whitespace-nowrap">Role</TableHead>')
    changed = True
# Inputs compact
s_new = s.replace('className="w-24"', 'className="w-20 h-8"')
s_new = s_new.replace('className="w-36"', 'className="w-32 h-8"')
s_new = s_new.replace('className="w-40 font-mono text-xs"', 'className="w-40 h-8 font-mono text-[11px]"')
if s_new != s:
    s = s_new; changed = True
# Action grid compact
s_new = s.replace('grid grid-cols-1', 'grid grid-cols-2 md:grid-cols-1')
s_new = s_new.replace('min-w-[10rem]', 'min-w-[12rem]')
if s_new != s:
    s = s_new; changed = True
# Role selector block
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
if 'api/admin/users//role' not in s:
    # Insert after webhook block
    hook_idx = s.find('space-y-2 w-64')
    if hook_idx != -1:
        end = s.find('</TableCell>', hook_idx)
        if end != -1:
            s = s[:end+len('</TableCell>')] + role_block + s[end+len('</TableCell>'):]
            changed = True
    else:
        # Fallback: insert before actions grid
        aidx = s.find('grid grid-cols-')
        if aidx != -1:
            insert_pos = s.rfind('</TableCell>', 0, aidx)
            if insert_pos != -1:
                s = s[:insert_pos+len('</TableCell>')] + role_block + s[insert_pos+len('</TableCell>'):]
                changed = True
open(p,'w',encoding='utf-8').write(s)
print('PATCHED' if changed else 'NOCHANGE')
PY
EOF
bash /root/apply_admin_compact_patch.sh
