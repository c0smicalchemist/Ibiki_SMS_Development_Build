perl -0777 -i -pe "s|<Table>|<Table className=\"text-sm\">|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Client Name</TableHead>|<TableHead className=\"whitespace-nowrap\">Client Name</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Email</TableHead>|<TableHead className=\"whitespace-nowrap\">Email</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>API Key</TableHead>|<TableHead className=\"whitespace-nowrap\">API Key</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Status</TableHead>|<TableHead className=\"whitespace-nowrap\">Status</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Messages Sent</TableHead>|<TableHead className=\"whitespace-nowrap\">Messages</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Credits</TableHead>|<TableHead className=\"whitespace-nowrap\">Credits</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Assigned Numbers</TableHead>|<TableHead className=\"whitespace-nowrap\">Assigned Numbers</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Last Active</TableHead>|<TableHead className=\"whitespace-nowrap\">Last Active</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Delivery Mode</TableHead>|<TableHead className=\"whitespace-nowrap\">Delivery</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Webhook</TableHead>|<TableHead className=\"whitespace-nowrap\">Webhook</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Role</TableHead>|<TableHead className=\"whitespace-nowrap\">Role</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Group ID</TableHead>|<TableHead className=\"whitespace-nowrap\">Group ID</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableHead>Actions</TableHead>|<TableHead className=\"whitespace-nowrap\">Actions</TableHead>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableRow key=\{client.id\} data-testid=\{ow-client-\$\{client.id\}\}>|<TableRow key=\{client.id\} data-testid=\{ow-client-\$\{client.id\}\} className=\"align-middle\">|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|className=\"font-medium\">|className=\"font-medium py-2\">|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableCell>\{client.email\}</TableCell>|<TableCell className=\"py-2\">\{client.email\}</TableCell>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|className=\"font-mono text-xs max-w-\[16rem\] truncate\"|className=\"font-mono text-\[11px\] max-w-\[12rem\] truncate py-2\"|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<Button size=\"sm\" variant=\"ghost\" className=\"ml-2 px-2\"|<Button size=\"sm\" variant=\"ghost\" className=\"ml-2 px-2 h-6\"|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableCell>\{client.messagesSent.toLocaleString\(\)\}</TableCell>|<TableCell className=\"py-2\">\{client.messagesSent.toLocaleString\(\)\}</TableCell>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|className=\"w-24\"|className=\"w-20 h-8\"|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|className=\"w-36\"|className=\"w-32 h-8\"|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|className=\"w-40 font-mono text-xs\"|className=\"w-40 h-8 font-mono text-\[11px\]\"|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<Button\n\s*size=\"sm\"\n\s*variant=\"outline\"\n\s*onClick=\{|<Button size=\"sm\" variant=\"outline\" className=\"h-8\" onClick=\{|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableCell className=\"text-muted-foreground\">|<TableCell className=\"text-muted-foreground py-2\">|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|}}>Save</Button>|}} className=\"h-8 px-2\">Save</Button>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableCell className=\"align-top\">|<TableCell className=\"align-top py-2\">|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|className=\"space-y-1 w-52\"|className=\"space-y-1 w-48\"|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|className=\"border rounded px-2 py-1 text-xs\"|className=\"border rounded px-2 py-1 text-xs h-8\"|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|<TableCell>\n\s*<Input defaultValue=\{client.groupId \|\| ''\} placeholder=\"GROUP-ID\" className=\"w-36 text-xs\"|<TableCell className=\"py-2\">\n  <Input defaultValue=\{client.groupId \|\| ''\} placeholder=\"GROUP-ID\" className=\"w-32 h-8 text-xs\"|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|min-w-\[10rem\]|min-w-\[12rem\]|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|grid-cols-1|grid-cols-2 md:grid-cols-1|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|buttonClassName=\"w-full justify-start bg-green-600|buttonClassName=\"w-full h-8 justify-start bg-green-600|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|buttonClassName=\"w-full justify-start bg-orange-100|buttonClassName=\"w-full h-8 justify-start bg-orange-100|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|data-testid=\{utton-enable-\$\{client.id\}\}\>|data-testid=\{utton-enable-\$\{client.id\}\} className=\"h-8\"\>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|data-testid=\{utton-disable-\$\{client.id\}\}\>|data-testid=\{utton-disable-\$\{client.id\}\} className=\"h-8\"\>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|data-testid=\{utton-revoke-keys-\$\{client.id\}\}\>|data-testid=\{utton-revoke-keys-\$\{client.id\}\} className=\"h-8\"\>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
perl -0777 -i -pe "s|data-testid=\{utton-purge-\$\{client.id\}\}\>|data-testid=\{utton-purge-\$\{client.id\}\} className=\"h-8\"\>|g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
