CONF=/etc/nginx/sites-enabled/ibiki-sms
[ -f "$CONF" ] && {
  echo USING:$CONF
  sed -n '1,200p' "$CONF"
  echo '--- directives overview ---'
  grep -n -E 'proxy_pass|root|location|expires|add_header' "$CONF" || true
} || { echo 'Nginx site file not found'; }
