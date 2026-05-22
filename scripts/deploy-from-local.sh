#!/usr/bin/env bash
# 在本机 Mac/Linux 执行：把代码同步到 GCP VM 并启动 compose
# 用法：./scripts/deploy-from-local.sh [ssh目标]
# 默认：fofo@34.177.94.143，密钥：~/.ssh/gcloud

set -euo pipefail

SSH_TARGET="${1:-fofo@34.177.94.143}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/gcloud}"
REMOTE_DIR="${REMOTE_DIR:-~/jiaohuan-xinsheng}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)

echo "==> 同步代码到 ${SSH_TARGET}:${REMOTE_DIR}"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p $REMOTE_DIR"
rsync -avz --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'apps/api/.venv' \
  --exclude 'apps/web/node_modules' \
  --exclude 'apps/web/dist' \
  --exclude '.env' \
  --exclude '.env.prod' \
  "$ROOT/" "$SSH_TARGET:$REMOTE_DIR/"

echo "==> 远程构建并启动（需已存在 .env.prod）"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s <<EOF
set -euo pipefail
cd $REMOTE_DIR
if [ ! -f .env.prod ]; then
  echo "缺少 .env.prod，请先：cp .env.prod.example .env.prod && nano .env.prod"
  exit 1
fi
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml ps
EOF

echo ""
echo "部署完成。浏览器访问：http://34.177.94.143 （或你的 VM 公网 IP）"
echo "健康检查：curl http://34.177.94.143/health"
