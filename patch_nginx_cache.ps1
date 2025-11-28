CONF=/etc/nginx/sites-enabled/ibiki-sms
cp  .bak.
python3 - <<'PY'
import re
p='/etc/nginx/sites-enabled/ibiki-sms'
s=open(p,'r').read()
changed=False
# Ensure add_header at server level
if 'add_header Cache-Control "no-store, must-revalidate" always;' not in s:
    s=re.sub(r'(server\s*\{[^}]*server_name[\s\S]*?;)', r"\1\n    add_header Cache-Control \"no-store, must-revalidate\" always;", s, count=1)
    changed=True
# Add location for static assets with no-store if not present
if 'location ~* \\.(js|css|png|svg|ico)$' not in s:
    block='''
    location ~* \.(js|css|png|svg|ico)$ {
        expires -1;
        etag off;
        add_header Cache-Control "no-store, must-revalidate" always;
        try_files  / @app;
    }
'''
    s=re.sub(r'(server\s*\{)', r"\1\n"+block, s, count=1)
    changed=True
open(p,'w').write(s)
print('PATCHED' if changed else 'NOCHANGE')
PY
nginx -t && systemctl reload nginx && echo RELOADED || (echo NGINX_TEST_FAILED; exit 1)
