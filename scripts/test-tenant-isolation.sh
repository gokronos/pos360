#!/usr/bin/env bash
set -euo pipefail

base_url="${POS360_TEST_URL:-http://localhost:5173}"
attempt() {
  local method="$1" path="$2" body="${3:-}"
  curl -sS -o /tmp/pos360-isolation-response.json -w '%{http_code}' -X "$method" \
    -H 'content-type: application/json' \
    -H 'x-pos360-tenant-id: tenant_ferreteria' \
    ${body:+--data "$body"} "$base_url$path"
}

read_status="$(attempt GET /api/products)"
write_status="$(attempt POST /api/products '{"sku":"SEC-001","name":"No autorizado","category":"Prueba","price":1,"cost":1}')"
context_status="$(curl -sS -o /tmp/pos360-isolation-context.json -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{"tenantId":"tenant_ferreteria","branchId":"branch_ferreteria"}' "$base_url/api/context")"

[[ "$read_status" == "403" ]] || { echo "Lectura cruzada no fue bloqueada: $read_status" >&2; exit 1; }
[[ "$write_status" == "403" ]] || { echo "Escritura cruzada no fue bloqueada: $write_status" >&2; exit 1; }
[[ "$context_status" == "403" ]] || { echo "Cambio de contexto no fue bloqueado: $context_status" >&2; exit 1; }
echo "Aislamiento aprobado: lectura=403 escritura=403 contexto=403"
