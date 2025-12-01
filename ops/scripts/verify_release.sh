set -euo pipefail
cd /opt/ibiki-sms
echo ==== commit ====
git rev-parse HEAD
echo ==== remote ====
git ls-remote origin Ibiki_Production_Final | awk '{print $1}'
echo ==== index label ====
grep -n "Favourites" dist/public/index.html || true
echo ==== js label ====
grep -R -n "Favourites" dist/public/assets | head -n 5 || true
echo ==== pm2 show ====
pm2 show ibiki-sms | sed -n '1,80p'
