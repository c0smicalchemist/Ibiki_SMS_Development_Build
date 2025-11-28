perl -0777 -i -pe 's#apiRequest\(/api/admin/users//role#apiRequest(`/api/admin/users/${client.id}/role#' /opt/ibiki-sms/client/src/pages/AdminDashboard.tsx
