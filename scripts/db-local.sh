#!/usr/bin/env bash
set -euo pipefail

action="${1:-setup}"
database="site-creator-d1"
persist_args=()
if [[ -n "${POS360_D1_PERSIST_TO:-}" ]]; then
  persist_args=(--persist-to "$POS360_D1_PERSIST_TO")
fi

migrate() {
  for migration in drizzle/*.sql; do
    npx wrangler d1 execute "$database" --local "${persist_args[@]}" --file "$migration"
  done
}

seed() {
  npx wrangler d1 execute "$database" --local "${persist_args[@]}" --file db/demo-data.sql
}

case "$action" in
  migrate) migrate ;;
  seed) seed ;;
  setup) migrate; seed ;;
  *) echo "Uso: $0 migrate|seed|setup" >&2; exit 2 ;;
esac
