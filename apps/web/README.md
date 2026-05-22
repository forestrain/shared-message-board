# Web（React + Vite + antd-mobile）

本目录由模板文件初始化；本地需安装 Node.js（含 npm）。

```bash
cd apps/web
npm install
npm run dev
```

开发服务器默认 <http://127.0.0.1:5173>，已将 `/api` 与 `/health` 代理到远程 API（见 `.env.development` 中 `VITE_API_PROXY_TARGET`，默认 **GCP VM** `http://34.177.94.143:8080`）。联调本机 API 时改为 `http://127.0.0.1:8000` 后重启 `npm run dev`。

请使用 **127.0.0.1:5173** 打开页面，以便 Cookie 与代理同源。

路由：`/` 首页，`/boards/:boardId` 板详情（帖子列表与发帖）。若依赖有变，先执行 `npm install`。

构建：

```bash
npm run build
npm run preview
```
