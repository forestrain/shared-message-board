# 交换心声

留言板 H5 应用（公开 / 组内 / 私有板，留言与回复）。产品说明见 [`docs/mvp-prd.md`](docs/mvp-prd.md)，技术方案见 [`docs/architecture.md`](docs/architecture.md)。

## 技术选型（已定）

| 层级 | 技术 |
|------|------|
| 后端 | Python **FastAPI** |
| 数据库 | **PostgreSQL** |
| 前端 | **React**（Vite）+ **antd-mobile** |
| 会话 | **httpOnly Cookie**（`sid`）+ **`auth_sessions` 表**（服务端）；Redis 后置 |

## 仓库结构

```
apps/
  api/                 # FastAPI、SQLAlchemy、Alembic
  web/                 # React + Vite + antd-mobile
docs/
docker-compose.yml     # 本地 PostgreSQL
.env.example
```

## 本地启动（简要）

**1. 数据库**

```bash
docker compose up -d
cp .env.example apps/api/.env
```

按需修改 `apps/api/.env` 中的 `DATABASE_URL`（默认 `localhost:5432`，与 compose 一致）。

**2. 后端**

详见 [`apps/api/README.md`](apps/api/README.md)。建议 **Python 3.10+**。

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**3. 前端**

需安装 Node.js。详见 [`apps/web/README.md`](apps/web/README.md)。

```bash
cd apps/web
npm install
npm run dev
```

用浏览器打开 **http://127.0.0.1:5173**（与 `CORS_ORIGINS` 一致，便于携带 Cookie）。页面可测 `/health`、注册、登录、`/api/v1/users/me`、退出。

## 已实现（MVP 骨架）

- 用户：`users` 表；注册 / 登录 / 登出；Cookie 会话 `auth_sessions`。
- 接口：`GET /health`，`POST /api/v1/auth/register|login|logout`，`GET /api/v1/users/me`。
- **公开留言板**：`boards` 表；`GET /api/v1/boards`（分页，无需登录）、`POST /api/v1/boards`（需登录）、`GET|PATCH|DELETE /api/v1/boards/{id}`（读公开板无需登录；改删仅创建者）。前端首页含列表与创建表单。
- **公开板帖子**：`posts` 表（`deleted_at` 软删）；`GET /api/v1/boards/{id}/posts`（无需登录）、`POST /api/v1/boards/{id}/posts`（需登录）、`DELETE /api/v1/posts/{id}`（作者或板主）。前端路由 `/boards/:boardId` 详情页展示板信息与帖子列表。

## 部署到 Google Cloud VM

见 [`docs/deploy-gcp-vm.md`](docs/deploy-gcp-vm.md)（Docker Compose + Nginx 同域反代，VM 示例 IP `34.177.94.143`）。

```bash
# VM 首次：安装 Docker
./scripts/bootstrap-gcp-vm.sh

# 配置 .env.prod 后
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

本机同步部署：`./scripts/deploy-from-local.sh fofo@34.177.94.143`

## 下一步实现

按 [`docs/mvp-prd.md`](docs/mvp-prd.md) 增加 boards、groups、`board_acl`、帖子与回复及统一读权限校验。
