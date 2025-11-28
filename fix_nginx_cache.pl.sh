cp /etc/nginx/sites-enabled/ibiki-sms /etc/nginx/sites-enabled/ibiki-sms.bak
perl -0777 -i -pe "s/add_header\s+Cache-Control\s+\\\"no-store, must-revalidate\\\"\s+always;/add_header Cache-Control \"no-store, must-revalidate\" always;/g" /etc/nginx/sites-enabled/ibiki-sms
perl -0777 -i -pe "s/try_files\s+\/[\s]*@app;/try_files  =404;/g" /etc/nginx/sites-enabled/ibiki-sms
perl -0777 -i -pe "s/location\s+~\*\s+\\\.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\s*\{[\s\S]*?\}/location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot) {\n    expires -1;\n    etag off;\n    add_header Cache-Control \"no-store, must-revalidate\" always;\n    root \/opt\/ibiki-sms\/dist\/public;\n    try_files  =404;\n}/g" /etc/nginx/sites-enabled/ibiki-sms
perl -0777 -i -pe "s/(location\s*\/\s*\{[\s\S]*?try_files[^}]*;)/\n    add_header Cache-Control \"no-store, must-revalidate\";/g" /etc/nginx/sites-enabled/ibiki-sms
nginx -t && systemctl reload nginx && echo RELOADED
curl -I https://ibiki.run.place/admin | sed -n '1,20p'
