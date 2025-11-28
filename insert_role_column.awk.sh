awk 'BEGIN{insertedH=0; insertedB=0}
{
  print
  if ( ~ /<TableHead>Webhook<\/TableHead>/ && !insertedH) {
    print "                <TableHead>Role</TableHead>"
    insertedH=1
  }
  if ( ~ /<div className=\"grid grid-cols-1 gap-2 items-start\">/ && !insertedB) {
    print "                      </TableCell>"
    print "                      <TableCell>"
    print "                        <select defaultValue={client.role || 'client'} className=\"border rounded px-2 py-1 text-xs\" onChange={(e) => {"
    print "                          apiRequest(/api/admin/users//role, { method: 'POST', body: JSON.stringify({ role: e.target.value }) })"
    print "                            .then(() => { queryClient.invalidateQueries({ queryKey: ['\\/api\\/admin\\/clients'] }); });"
    print "                        }}">"
    print "                          <option value=\"admin\">Admin</option>"
    print "                          <option value=\"supervisor\">Supervisor</option>"
    print "                          <option value=\"client\">User</option>"
    print "                        </select>"
    print "                      </TableCell>"
    insertedB=1
  }
}' /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx > /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx.new && mv /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx.new /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
