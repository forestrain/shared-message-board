#!/usr/bin/env bash
# 在 VM 项目根目录执行，自动加载 .env.prod
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env.prod ]; then
  echo "缺少 .env.prod，请先：cp .env.prod.example .env.prod && nano .env.prod"
  exit 1
fi
exec docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"
