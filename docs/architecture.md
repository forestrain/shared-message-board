# 交换心声 — MVP 技术架构

本文档与 [`mvp-prd.md`](./mvp-prd.md) 对齐：**MVP 不包含微信登录**；认证以手机号/邮箱方案为主。微信相关能力在 MVP 之后单独设计（账号绑定、UnionId 等）。

---

## 0. 技术选型（已定）

| 层级 | 选型 |
|------|------|
| 后端 | Python **FastAPI**（单体 REST API） |
| 数据库 | **PostgreSQL** |
| 前端 | **React**（建议 **Vite** 脚手架）+ **移动端 UI 库**（如 Ant Design Mobile、React Vant 等，开工时在依赖里择一并全员统一） |
| 会话 | **httpOnly Cookie** + **服务端 Session**；**Redis 后置**；MVP 阶段 Session 后端存储可用 **进程内内存**（仅适合单机开发 / 小规模）或 **PostgreSQL 中的 session 表**，上线多实例前再换 Redis 等集中存储 |

---

## 1. 总体架构

```
┌─────────────────────────────────────┐
│  H5 前端（SPA，移动端优先）           │
│  React (Vite) + 移动端组件库          │
│  静态资源 CDN / 对象存储托管           │
└─────────────────┬───────────────────┘
                  │ HTTPS / JSON REST
                  ▼
┌─────────────────────────────────────┐
│  FastAPI 单体 API                   │
│  认证 · 用户 · Group · Board · Post   │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ PostgreSQL    │   │ Redis（可选）  │
│ 业务数据 +     │   │ 会话、限流、    │
│ MVP 可存 session│   │ 热点缓存       │
└───────────────┘   └───────────────┘
```

- **对象存储**：MVP 无文件上传可不接；预留后续 OSS / S3。
- **消息队列**：MVP 不需要。

---

## 2. 前端（H5）

| 项 | 建议 |
|----|------|
| 框架 | React 18 + **Vite** + React Router + 状态（Context / Zustand / Redux Toolkit 择一） |
| UI | 移动端组件库（Ant Design Mobile、React Vant、其他 React 生态 H5 库；实现前定稿一种） |
| 路由 | 登录态守卫；访问无权限板时统一错误页或 toast |
| 与后端 | `fetch` / axios；`credentials: 'include'` 以便携带 **httpOnly Cookie**；统一错误码处理 |

**微信环境**：MVP 不实现微信登录；H5 可在微信内置浏览器中作为普通网页打开。MVP 之后若接入微信登录，再补充 **OAuth 回调域、备案与开放平台** 等配置说明。

---

## 3. 后端

| 项 | 建议 |
|----|------|
| 形态 | **FastAPI** 单体应用；可用路由分包（`auth`、`users`、`groups`、`boards`、`posts`、`replies`） |
| API 风格 | REST，`/api/v1` 前缀 |
| 模块划分 | **Board 可读性判断**抽到单一模块（如 `board_access`），避免各路由重复判断 |
| 持久化 | **SQLAlchemy 2.x** + **Alembic** 迁移（或与 FastAPI 生态一致的等价组合） |
| Session | Cookie 仅存放 **opaque session id**；会话载荷存在 **服务端**（内存 / PostgreSQL / 日后 Redis）。勿把 Starlette 默认「整段 session 签进 Cookie」的方案当成服务端 Session，除非明确接受其语义与体积限制；可选用 `itsdangerous` 签 session id、或成熟 session 中间件 + DB/Redis 后端 |

### 3.1 认证与会话（MVP，已定）

- **httpOnly Cookie** 存放 session id；服务端校验会话。
- Session 存储：开发可用内存；多实例前改用 **PostgreSQL 表** 或 **Redis**。
- 前后端若不同域，需约定 **CORS** `credentials` 与 Cookie `SameSite=None; Secure`（仅 HTTPS）。
- **非 MVP 路线**：JWT 等方案本期不采用，除非后续有明确需求。

验证码或邮件发送依赖第三方服务时，密钥走环境变量，勿写入仓库。

### 3.2 MVP 之后：微信登录（预留思路，非本期开发）

- 微信 **网站应用** 或 **移动应用** OAuth，回调后端交换 `openid` / `unionid`。
- 与已有手机/邮箱账号的 **绑定表**（`user_identities`：`provider`, `openid`, `unionid`）及合并冲突策略需在独立技术设计中定义。

---

## 4. 数据存储（谁存什么）

### 4.1 业务主存：关系型数据库

**所有可查询、可审计的业务数据**以 **PostgreSQL** 为唯一权威来源（single source of truth），包括：

| 类别 | 存放内容 |
|------|-----------|
| 用户与认证 | `users` 表中的账号字段、密码哈希；MVP 若用 DB 存 Session，可有 `sessions` 表（或用框架自带后端） |
| 社交结构 | `groups`、`group_members`、邀请码等 |
| 内容与权限 | `boards`、`board_acl`、`posts`、`replies`（含软删字段 `deleted_at`） |

应用通过 ORM 或数据访问层读写；**不把留言正文、板配置等写入前端 localStorage 作为真相**，避免多端不一致与篡改。

### 4.2 可选：Redis

| 用途 | 说明 |
|------|------|
| 会话 | 采用「服务端 Session」时，session id 在 Cookie，**会话载荷**可放 Redis（或仅用签名 Cookie + DB，小规模也可） |
| 限流 | 登录、邀请码尝试等计数与 TTL |
| 缓存 | MVP 通常不必；列表 QPS 高时再对「公开板列表」等做缓存 + 失效策略 |

### 4.3 前端（H5）

- **浏览器**：仅存登录态（httpOnly Cookie 由浏览器管理；若用 JWT 则按所选方案存 access，refresh 建议 httpOnly 或旋转策略）。
- **内存 / Pinia**：列表分页、当前路由状态等，**刷新即重新请求 API**，不依赖本地持久化业务数据。

### 4.4 文件与备份

- **对象存储（OSS/S3）**：MVP 无用户上传文件，不接；以后图片等二进制走对象存储，**仅在 DB 存 URL 与元数据**。
- **备份**：使用云厂商 RDS 自动备份，或自建定期逻辑备份；与代码仓库分离。

---

## 5. 数据模型（逻辑）

| 实体 | 说明 |
|------|------|
| `users` | id，手机/邮箱，密码哈希（若用密码），昵称，created_at |
| `groups` | id，name，owner_id，invite_code，created_at |
| `group_members` | group_id，user_id，role，joined_at |
| `boards` | id，title，description，visibility（`public` / `group` / `private`），creator_id，group_id（可空，与 PRD 策略一致），created_at |
| `board_acl` | board_id，user_id（私有可见；可扩展 `can_write`） |
| `posts` | id，board_id，author_id，content，created_at，deleted_at |
| `replies` | id，post_id，author_id，content，created_at，deleted_at |

**索引建议**：`boards(group_id, visibility)`，`posts(board_id, created_at)`，`group_members(user_id)`，`board_acl(user_id)`。

---

## 6. API 草图（REST）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/logout` | 登出 |
| GET/POST | `/api/v1/groups` | 列表 / 创建 |
| POST | `/api/v1/groups/join` | body: `inviteCode` |
| GET/PATCH | `/api/v1/groups/:id` | 详情 / 更新（权限内） |
| GET/POST | `/api/v1/boards` | 列表（按场景 query）/ 创建 |
| GET/PATCH/DELETE | `/api/v1/boards/:id` | 详情 / 更新 / 删除 |
| GET/POST | `/api/v1/boards/:id/posts` | 帖子列表 / 发帖 |
| DELETE | `/api/v1/posts/:id` | 删帖（权限内） |
| GET/POST | `/api/v1/posts/:id/replies` | 回复列表 / 发表回复 |
| DELETE | `/api/v1/replies/:id` | 删回复（权限内） |

实际路径与字段名以实现为准，保持版本化与错误码一致即可。

---

## 7. 部署与工程化

- **环境**：`dev` / `staging` / `prod`，配置经环境变量注入。
- **CI**：lint、单测（核心权限与 ACL）、构建镜像或静态资源。
- **数据库迁移**：**Alembic**（与 SQLAlchemy 配套），迁移文件入仓。

---

## 8. 安全清单（MVP）

- 全站 HTTPS；密码存储使用 bcrypt / argon2 等。
- 邀请码尝试与登录接口 **限流**（IP + 账号维度可选）。
- 板详情与帖子列表：**必须在服务端**根据 `visibility` + `board_acl` + `group_members` 判定，不信任前端传参隐藏字段。

---

## 9. 文档维护

产品范围变更时同步更新 `mvp-prd.md`；接口与部署变更时同步更新本文档。微信登录接入后应新增「微信认证」章节并更新认证相关图示。
