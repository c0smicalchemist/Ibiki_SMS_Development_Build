CONF=/etc/nginx/sites-enabled/ibiki-sms
set -e
cp "$CONF" "$CONF.bak"
python3 - <<'PY'
import re
p='/etc/nginx/sites-enabled/ibiki-sms'
s=open(p,'r').read()
changed=False
# Normalize add_header quoting
s_new=s.replace('add_header Cache-Control \"no-store, must-revalidate\" always;', 'add_header Cache-Control "no-store, must-revalidate" always;')
if s_new!=s:
    s=s_new; changed=True
# Fix malformed try_files in first static block
s_new=s.replace('try_files  / @app;', 'try_files $uri =404;')
if s_new!=s:
    s=s_new; changed=True
# Replace long-cache static assets block with no-store
pattern=r"location\s+~\*\s+\\\.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\s*\{[\s\S]*?\}"
block='''location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot) {
    expires -1;
    etag off;
    add_header Cache-Control "no-store, must-revalidate" always;
    root /opt/ibiki-sms/dist/public;
    try_files $uri =404;
}'''
s_new=re.sub(pattern, block, s)
if s_new!=s:
    s=s_new; changed=True
# Ensure location / sets no-store
s_new=re.sub(r'(location\s*/\s*\{[^}]*try_files[^}]*;)', r"\1\n    add_header Cache-Control \"no-store, must-revalidate\";", s)
if s_new!=s:
    s=s_new; changed=True
open(p,'w').write(s)
print('PATCHED' if changed else 'NOCHANGE')
PY
nginx -t && systemctl reload nginx && echo RELOADED
