set -euo pipefail

curl -Is https://ibiki.run.place/ | grep -i Strict-Transport-Security || true
