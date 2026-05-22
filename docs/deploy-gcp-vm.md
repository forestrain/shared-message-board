# Google Cloud VM 部署指南（交换心声）

适用：**Ubuntu VM** + **Docker Compose** + 单机 **PostgreSQL**（容器内，数据卷持久化）。

架构：

```
浏览器 → VM:80 (Nginx gateway)
           ├─ /        → React 静态 (dist)
           ├─ /api/*   → FastAPI (api:8000)
           └─ /health、/docs → FastAPI
         api → db:5432 (PostgreSQL 容器)
```

你的 VM 示例：

```bash
ssh -i ~/.ssh/gcloud fofo@34.177.94.143
```

公网 IP：`34.177.94.143`（若变更，请同步改 `.env.prod` 里的 `CORS_ORIGINS`）。

---

## 1. GCP 控制台（必做）

1. **VPC 防火墙**：为 VM 所在网络添加入站规则  
   - 允许 **TCP 80**（HTTP）来源 `0.0.0.0/0`（或你的办公网 IP）  
   - 后续 HTTPS 再加 **TCP 443**  
2. **不要**对公网开放 **5432**（数据库只在 Docker 内网）。  
3. **SSH**：建议密钥登录；22 端口来源尽量收窄，不要长期 `0.0.0.0/0`（与 Windows RDP 同理）。

---

## 2. VM 首次初始化（在 VM 上执行一次）

```bash
# 上传或 git clone 项目后，在仓库根目录：
chmod +x scripts/bootstrap-gcp-vm.sh
./scripts/bootstrap-gcp-vm.sh
```

然后 **退出 SSH 再登录一次**（使用户加入 `docker` 组），验证：

```bash
docker compose version
```

---

## 3. 配置生产环境变量

在仓库根目录：

```bash
cp .env.prod.example .env.prod
nano .env.prod   # 或 vim
```

至少修改：

| 变量 | 说明 |
|------|------|
| `POSTGRES_PASSWORD` | 强密码 |
| `SESSION_SECRET` | 长随机串 |
| `CORS_ORIGINS` | `http://34.177.94.143`（或你的域名，与浏览器地址一致） |

若已上 HTTPS，设 `SESSION_SECURE=true`，且 `CORS_ORIGINS` 用 `https://...`。

---

## 4. 在 VM 上直接部署

```bash
cd ~/jiaohuan-xinsheng   # 你的项目路径
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

查看状态：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

验证：

```bash
curl -s http://127.0.0.1/health
# 期望：{"status":"ok"}
```

浏览器打开：**http://34.177.94.143**

---

## 5. 从本机 Mac 一键同步部署（可选）

在本机项目根目录：

```bash
chmod +x scripts/deploy-from-local.sh
# 先在 VM 上准备好 .env.prod（第一次可 ssh 上去 cp 并编辑）
./scripts/deploy-from-local.sh fofo@34.177.94.143
```

环境变量可覆盖：

```bash
SSH_KEY=~/.ssh/gcloud REMOTE_DIR=~/jiaohuan-xinsheng ./scripts/deploy-from-local.sh
```

---

## 6. 常用运维命令

```bash
# 重新构建并启动
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 只看 API 日志
docker compose -f docker-compose.prod.yml logs -f api

# 停止
docker compose -f docker-compose.prod.yml down

# 停止并删除数据库卷（慎用，会清空数据）
docker compose -f docker-compose.prod.yml down -v
```

数据库迁移在 **api 容器启动时** 自动执行 `alembic upgrade head`。

---

## 7. HTTPS（可选）

在 VM 上可用 **Caddy** 或 **certbot + Nginx** 在 443 终止 TLS，反代到本机 `127.0.0.1:80`；或将 `gateway` 服务改为挂载证书。上线后务必：

- `SESSION_SECURE=true`
- `CORS_ORIGINS` 改为 `https://你的域名`

---

## 8. 与阿里云 RDS 的区别

本 compose **在 VM 内自带 Postgres 容器**。若你改用 **Cloud SQL**，需：

- 去掉 `db` 服务；
- 将 `api` 的 `DATABASE_URL` 改为 Cloud SQL 连接串；
- Cloud SQL 授权 VM 内网或 Cloud SQL Auth Proxy。

---

## 9. 故障排查

| 现象 | 处理 |
|------|------|
| 浏览器打不开 | 检查 GCP 防火墙是否放行 **80** |
| `502` / 接口失败 | `docker compose logs api`，确认 `db` 健康 |
| 登录后掉线 | `CORS_ORIGINS` 是否与访问 URL 一致；Cookie `Secure` 与 HTTP/HTTPS 是否匹配 |
| 构建很慢 | 首次 `npm ci` + `pip install` 正常，可加大 VM 规格 |

相关文件：`docker-compose.prod.yml`、`deploy/Dockerfile.gateway`、`apps/api/Dockerfile`。
