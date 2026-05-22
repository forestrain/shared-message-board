# API（FastAPI）

建议使用 **Python 3.10+**（3.9 需自行验证依赖兼容性）。

## 准备

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

在仓库根目录启动 PostgreSQL：

```bash
docker compose up -d
```

## 迁移

```bash
cd apps/api
source .venv/bin/activate
alembic upgrade head
```

## 运行

```bash
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- 健康检查：<http://127.0.0.1:8000/health>
- 文档：<http://127.0.0.1:8000/docs>

Cookie 会话名默认 `sid`，与前端代理联调时需保证 `CORS_ORIGINS` 包含前端来源（见 `.env.example`）。
