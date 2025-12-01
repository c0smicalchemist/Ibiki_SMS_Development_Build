set -euo pipefail

echo "== www domain Location =="
curl -Is http://www.ibiki.run.place/admin | grep -i Location || true
