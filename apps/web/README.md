# Web（React + Vite + antd-mobile）

本目录由模板文件初始化；本地需安装 Node.js（含 npm）。

```bash
cd apps/web
npm install
npm run dev
```

开发服务器默认 <http://127.0.0.1:5173>，已将 `/api` 与 `/health` 代理到 `http://127.0.0.1:8000`，以便携带 **httpOnly Cookie**（请使用 **127.0.0.1** 访问前端，与 `.env` 中 `CORS_ORIGINS` 一致）。

路由：`/` 首页，`/boards/:boardId` 板详情（帖子列表与发帖）。若依赖有变，先执行 `npm install`。

构建：

```bash
npm run build
npm run preview
```
