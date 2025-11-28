sed -i "s#apiRequest(/api/admin/users//role#apiRequest(`\/api\/admin\/users\/\${client.id}\/role#g" /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
