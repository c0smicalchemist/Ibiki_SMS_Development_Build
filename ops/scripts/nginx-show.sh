set -euo pipefail

FILE=/etc/nginx/sites-available/ibiki-clean
echo "== showing $FILE =="
nl -ba "$FILE" | sed -n '1,200p'
