#!/bin/bash
set -e
python3 - <<'PY'
import re
p='/opt/ibiki-sms/client/src/pages/AdminDashboard.tsx'
s=open(p,'r',encoding='utf-8').read()
changed=False
# 1) Ensure toast import
if 'useToast' not in s:
    # Add import at top
    s='import { useToast } from "@/components/ui/use-toast"\n' + s
    changed=True
# 2) Ensure toast hook inside component
if 'const { toast } = useToast();' not in s:
    # Insert before queryClient usage
    s=re.sub(r'(const\s+queryClient\s*=\s*useQueryClient\(\);)', r'const { toast } = useToast();\n\1', s, count=1)
    changed=True
# 3) Enhance role select onChange to auto-save + toast
pattern=r'(onChange=\(e\) => \{[\s\S]*?apiRequest\(.*?/api/admin/users/\$\{client.id\}/role.*?\)[\s\S]*?\.then\(\(\) => \{[\s\S]*?queryClient\.invalidateQueries\(\{ queryKey: \[\'\/api\/admin\/clients\'\] \}\)\;[\s\S]*?\}\)\);)'
repl=lambda m: re.sub(r'\}\)\);', "  toast({ title: 'Saved', description: 'Role updated' });\n            }) ;", m.group(1))
s_new=re.sub(pattern, repl, s)
if s_new!=s:
    s=s_new; changed=True
# Fallback: if the .then lacks block braces, add toast after invalidate
s_new=re.sub(r"(queryClient\.invalidateQueries\(\{ queryKey: \[\'\/api\/admin\/clients\'\] \}\)\);)", r"\1\n            toast({ title: 'Saved', description: 'Role updated' });", s)
if s_new!=s:
    s=s_new; changed=True
open(p,'w',encoding='utf-8').write(s)
print('PATCHED' if changed else 'NOCHANGE')
PY
cd /opt/ibiki-sms
npm run build || (echo BUILD_FAILED; exit 1)
pm2 restart ibiki-sms --update-env
