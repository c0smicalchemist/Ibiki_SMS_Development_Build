cat >/root/requireRole.fn <<'EOF'
function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient privileges" });
    }
    next();
  };
}
EOF
if ! grep -q 'function requireRole' /opt/ibiki-sms/server/routes.ts; then
  awk '1;/const EXTREMESMS_BASE_URL/{print ""; system("cat /root/requireRole.fn")}' /opt/ibiki-sms/server/routes.ts > /opt/ibiki-sms/server/routes.ts.new && mv /opt/ibiki-sms/server/routes.ts.new /opt/ibiki-sms/server/routes.ts
fi
