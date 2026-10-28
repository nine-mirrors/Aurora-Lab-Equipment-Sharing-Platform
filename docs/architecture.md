# 极光实验室设备共享平台 · 架构说明

> 本文档依据仓库当前代码整理，涉及的文件包括 `server/index.js`、`server/routes/*.js`、`server/db.js`、`server/migrate.js`、`server/seed.js`、`server/auth.js`、`server/credit.js`、`server/push.js`、`server/ai.js`、`README.md`、`package.json` 与 `src/router/index.js`。

## 1. 项目定位与技术栈

面向高校实验室的设备共享与借用管理平台，覆盖设备档案、借用申请、审批、取件、续借、归还、评价、报修维护、信用与黑名单、站内通知、浏览器推送、AI 助手与数据看板。前后端同仓库，可离线独立运行。

| 层次 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite、Vue Router、Pinia（含持久化插件）、Element Plus、ECharts、Axios |
| 后端 | Node.js、Express 5、Multer、Nodemailer、ali-oss、web-push |
| 持久化 | 单文件 JSON（`server/data/db.json`），临时文件 + rename 原子写入 |
| 鉴权 | scrypt 密码哈希 + HMAC-SHA256 签名 Token + `token_version` |
| AI | 通义千问（主）、DeepSeek（备）、本地规则降级 |
| 运行时 | Node.js `^20.19.0` 或 `>=22.12.0`（`package.json` engines） |

项目脚本（`package.json`）：

- `npm run dev`：仅启动 Vite
- `npm run server`：仅启动后端（默认 3000）
- `npm run dev:all`：`scripts/dev.mjs` 同时启动后端与 Vite（5173）
- `npm run build` / `npm run preview`
- `npm run seed [-- --force]`：重建演示数据
- `npm run test:unit` / `test:rules` / `test:api` / `test`
- `npm run lint`、`npm run verify`（lint + test + build）

## 2. 分层架构与目录职责

```
表现层（浏览器）
  src/views            页面：学生端 StudentDashboard / DeviceHall / applyRecord / studentProfile，
                       管理端 AdminDashboard / deviceManage / applyManage / maintenance / getUser / baseData / systemData
  src/views/**/components  页面私有组件（设备卡片、详情抽屉、业务弹窗等）
  src/layouts          DefaultLayout、AdminLayout
  src/components       布局、图表、指标卡、AI 助手、通用组件
  src/composables      useDebounce（搜索防抖）、usePagination（本地分页）
  src/stores           Pinia：User / Ui / Notification / Favorite / Ai
  src/router/index.js  路由表与角色守卫
  src/utils            request.js（Axios 与拦截器）、date.js、csv.js、device-presenter.js
  src/style            tokens.css（设计系统）与 main.css

接口层（Express 入口与中间件）
  server/index.js      安全响应头、CORS、JSON 解析、静态资源、限流挂载、路由挂载、
                       404 / 500 兜底、dist 单端口托管

业务层
  server/routes/       auth / devices / categories / bookings / admin / stats / ai /
                       workspace / uploads / push
  server/auth.js       scrypt 哈希、HMAC Token、requireAuth / requireNotBlacklisted
  server/credit.js     逾期结算、信用流水、自动暂停借用
  server/settings.js   系统设置读取与默认值回落（借用 / 续借 / 并发 / 取消 / 维护策略）
  server/services/     业务服务层（当前已抽出 booking-service，路由只做参数与响应）
  server/reminders.js  到期前一天提醒（按通知内容标记去重）
  server/logger.js     business / api / exception 三通道按天日志
  server/ai.js         对话、审批建议、主备切换与本地规则
  server/notify.js     站内通知与审计日志写入
  server/push.js       VAPID 密钥管理与 Web Push 发送
  server/mailer.js     SMTP 验证码邮件
  server/oss.js        阿里云 OSS 上传（未配置时由路由回退本地磁盘）
  server/rate-limit.js 进程内内存限流

数据层
  server/db.js         JSON 读取、缓存、保存、自增 ID
  server/seed.js       演示数据生成（幂等初始化）
  server/base-data.js  分类、院系、实验室、设备、学生基础数据
  server/migrate.js    旧数据字段补齐（schemaVersion 1 → 6）
  server/data/db.json  运行时数据
  server/data/vapid.json  VAPID 密钥（首次启动自动生成）
  server/data/uploads/    本地图片回退目录
```

前端请求统一走相对路径 `/api`（`src/utils/request.js`）：请求拦截器向非白名单接口注入 `Authorization: Bearer <token>`；响应拦截器把 `body.code >= 400` 转换为 reject；真实 401 会清空本地 Token 并跳转登录页。路由守卫按 `meta.public` 与 `meta.role` 控制登录与管理员访问，未登录访问受限页面跳转 `/login?redirect=...`，角色不符跳转 `/403`。

## 3. 数据模型

`server/data/db.json` 顶层包含 15 个业务集合，以及验证码临时集合 `codes`、`seq`（各集合自增计数）与 `meta`（`schemaVersion` 等）。集合之间以 `user_id`、`device_id`、`department_id`、`lab_id` 等字段进行弱关联（JSON 无外键约束）。

### 3.1 users（用户）

| 字段 | 说明 |
| --- | --- |
| `id` | 自增主键 |
| `account` | 登录账号，唯一（代码注册时校验） |
| `password` | `salt:hash`，scrypt（salt 8 字节 hex，hash 32 字节 hex） |
| `name` | 姓名 |
| `role` | `student` / `admin` |
| `email` | 邮箱，注册与找回密码使用，代码校验唯一 |
| `phone` | 手机号 |
| `avatar` | Base64 Data URL（前端压缩后保存） |
| `credit_score` | 信用分，缺省 100 |
| `blacklisted` / `blacklist_reason` / `blacklisted_at` | 借用限制状态 |
| `token_version` | Token 版本号，登出 / 改密 / 重置密码后自增 |
| `created_at` | 创建时间 |

关系：`bookings.user_id`、`maintenance.user_id`、`notifications.user_id`、`favorites.user_id`、`credit_logs.user_id`、`login_logs.user_id`、`push_subscriptions.user_id` 均指向 `users.id`。

### 3.2 devices（设备）

关键字段：`id`、`name`、`category`（按分类名称关联 `categories.name`）、`description`、`location`、`lab_id`（关联 `labs.id`）、`image`、`total_qty`、`available_qty`、`is_active`（1/0）、`maintenance_status`（`none` / `pending` / `repairing`）、`maintenance_reason`、`maintenance_started_at`、`created_at`、`updated_at`。

学生评价接口还会写入 `rating_total`、`rating_count`、`rating`；列表/详情返回的 `rating` 与 `reviewCount` 由 `server/routes/devices.js` 依据已完成评价的借用记录实时聚合（四舍五入到 1 位小数）。

库存语义：`available_qty` 在审批通过时减 1、归还审核通过时加 1（不超过 `total_qty`）；`total_qty` 不允许小于当前借出数量。

### 3.3 bookings（借用申请）

| 字段 | 说明 |
| --- | --- |
| `id`、`device_id`、`device_name`、`category` | 设备快照 |
| `user_id`、`user_name` | 申请人快照 |
| `borrow_start`、`borrow_end` | `YYYY-MM-DD`，首尾日均占用 |
| `purpose` | 借用用途 |
| `status` | `pending` / `approved` / `returning` / `returned` / `rejected` / `cancelled` |
| `reason` | 拒绝原因（借用拒绝或归还驳回时写入） |
| `return_reject_reason` | 归还审核未通过原因 |
| `pickup_code` | 6 位取件码，审批通过时生成 |
| `return_code` | 6 位归还码，提交归还时生成 |
| `picked_up_at` | 确认取件时间 |
| `extension_status` | `''` / `pending` / `approved` / `rejected` |
| `requested_end`、`extension_reason` | 续借目标日期与理由 |
| `extension_reject_reason`、`extension_reviewed_at` | 续借审核结果 |
| `review_rating`、`review_comment`、`reviewed_at` | 设备评价（1–5 星） |
| `overdue_charged_days` | 已按天结算的逾期天数，避免重复扣分 |
| `created_at`、`approved_at`、`returned_at` | 流程时间戳 |
| 其他运行时字段 | `cancelled_at`、`return_requested_at`、`extension_requested_at`、`rejected_at` |

关系：`user_id` → `users.id`，`device_id` → `devices.id`；`credit_logs.ref_id` 在信用流水里记录关联的申请编号。

### 3.4 maintenance（维护工单）

`id`、`device_id`、`device_name`、`category`、`user_id`、`user_name`、`reason`、`detail`、`status`（`pending` / `processing` / `done` / `rejected`）、`note`、`handler_name`、`created_at`、`started_at`、`finished_at`、`handled_at`。关联 `devices.id` 与报修人 `users.id`。

### 3.5 notifications（站内通知）

`id`、`user_id`、`type`（`info` / `success` / `warn` / `error` / `notice` / `system`）、`title`、`content`、`link`、`read`、`created_at`、`read_at`。由 `notify()` 写入，调用方负责统一 `saveDB()`；同时异步触发 Web Push。

### 3.6 audit_logs（管理员审计）

`id`、`actor_id`、`actor_name`、`actor_role`、`action`、`target_type`、`target_id`、`target_name`、`detail`、`ip`、`created_at`。当前代码写入的 action 包括：

- `device.create`、`device.update`、`device.offline`
- `device.maintenance.start`、`device.maintenance.finish`
- `booking.approve`、`booking.reject`
- `return.approve`、`return.reject`
- `extension.approve`、`extension.reject`
- `user.blacklist.add`、`user.blacklist.remove`
- `maintenance.start`、`maintenance.finish`、`maintenance.reject`
- `announcement.create`、`announcement.update`、`announcement.delete`
- `department.create`、`department.update`、`department.delete`
- `lab.create`、`lab.update`、`lab.delete`

### 3.7 favorites（收藏关系）

`id`、`user_id`、`device_id`、`device_name`、`created_at`。后端提供 `GET /api/favorites`、`POST /api/favorites/:deviceId`、`DELETE /api/favorites/:deviceId`；前端 `src/stores/Favorite.js` 仍保留 Pinia 本地缓存，登录后与服务端合并并补齐未同步收藏。账号注销时后端会清理该用户的收藏记录。

### 3.8 announcements（平台公告）

`id`、`title`、`content`、`level`（`important` / `warning` / `info`）、`author`、`is_active`、`published_at`。学生端只读 `GET /api/announcements`（仅启用项）；管理端通过 `/api/admin/announcements` 完成新增、编辑、启停与删除。

### 3.9 credit_logs（信用流水）

`id`、`user_id`、`change`、`balance`、`reason`、`ref_type`（默认 `booking`）、`ref_id`、`created_at`。`balance` 为变动后的余额，最低 0，没有上限。

### 3.10 login_logs（登录日志）

`id`、`user_id`（失败且账号不存在时为 `null`）、`account`、`name`、`ip`、`user_agent`（截断 200 字符）、`success`（1/0）、`created_at`。登录成功与失败都会写入。

### 3.11 settings（系统设置）

`id`、`key`、`value`、`label`、`updated_by`、`updated_at`。种子数据包含 `max_borrow_days`、`max_active_bookings`、`overdue_penalty`、`allow_self_cancel`、`maintenance_block_booking`、`ai_review_enabled`、`notification_email`、`max_renew_days`、`booking_advance_days`、`auto_overdue_reminder`。借用创建与续借会读取 `max_borrow_days`、`max_active_bookings`、`booking_advance_days`、`max_renew_days`、`allow_self_cancel`、`maintenance_block_booking`；信用结算读取 `overdue_penalty`；AI 审批建议读取 `ai_review_enabled`。`notification_email` 控制业务通知邮件，`auto_overdue_reminder` 控制到期前一天提醒；两项均已接入实际逻辑。

### 3.12 departments（院系）

`id`、`name`、`code`、`description`、`created_at`。被 `labs.department_id` 引用；管理端通过 `/api/admin/departments` 增删改查，删除前会检查关联实验室。

### 3.13 labs（实验室场地）

`id`、`name`、`building`、`room`、`department_id`、`department_name`、`manager`、`phone`、`capacity`、`status`（`open` / `maintenance` / `closed`）、`open_hours`、`created_at`。被 `devices.lab_id` 引用；管理端通过 `/api/admin/labs` 增删改查，删除前会检查关联设备。

### 3.14 categories（设备分类）

`id`、`name`（唯一性由接口校验）、`code`、`description`、`sort_order`、`is_active`、`created_at`。设备通过 `category` 名称关联；管理端新增设备时若分类不存在会自动补建。

### 3.15 push_subscriptions（推送订阅）

`id`、`user_id`、`endpoint`、`keys`（`{ p256dh, auth }`）、`user_agent`、`created_at`。同一用户 + endpoint 会覆盖更新而非重复插入；推送端点必须为 HTTPS，长度不超过 1000。

### 3.16 codes（邮箱验证码）

`email`（小写）、`type`（`register` / `reset_password`）、`code`、`attempts`、`created_at`、`expires_at`。按 `email + type` 唯一（发送时先删除旧记录），有效期 10 分钟，重发间隔 60 秒，错误尝试 5 次后作废。该集合无自增 `id`，仅在 `seq` 中无对应键。

### 3.17 seq 与 meta

- `seq`：`users`、`devices`、`bookings`、`maintenance`、`notifications`、`audit_logs`、`favorites`、`announcements`、`credit_logs`、`login_logs`、`settings`、`push_subscriptions` 等集合的自增计数器，通过 `nextId(key)` 递增。
- `meta`：当前 `schemaVersion` 为 6，另有 `seeded_at`、`migrated_at`、`updated_at`。

当前 `server/data/db.json` 演示数据规模：21 个用户、7 个院系、19 个实验室、14 个分类、88 台设备、160 条借用、8 条维护、96 条通知、88 条审计、90 条收藏、8 条公告、133 条信用流水、88 条登录日志、10 条设置、0 条推送订阅、0 条验证码。借用记录覆盖 pending / approved / returning / returned / rejected / cancelled 全部状态，并包含 pending / approved / rejected 三种续借状态与 1 个黑名单账号。

## 4. 借用状态机

```
                 ┌──────────── admin approve ────────────┐
                 │  (库存 -1，生成 pickup_code)           ▼
pending ─────────┤                                    approved ── student pickup ──> picked_up_at（状态不变）
   │             └──────────── admin reject ──> rejected          │
   │                                                              ├── student extend ──> extension_status=pending
   └── student cancel ──> cancelled                               │        ├─ admin approve ──> borrow_end 延长
                                                                  │        └─ admin reject  ──> extension_status=rejected
                                                                  │
                                                                  ├── student return ──> returning（生成 return_code）
                                                                  │        ├─ admin approve ──> returned（库存 +1，逾期结算）
                                                                  │        └─ admin reject  ──> approved（记录 return_reject_reason）
```

规则要点：

- 只有 `pending` 可取消、可审批；只有 `approved` 可申请续借、可申请归还、可确认取件；只有 `returned` 可评价，且每条申请只能评价一次。
- 同一用户对同一设备不能同时存在 `pending` / `approved` / `returning` 的申请。
- 续借需满足：当前未逾期、没有待审续借、新日期晚于当前 `borrow_end`、从 `borrow_start` 起总时长不超过 90 天、且新时段库存不冲突。
- 归还审核通过前会先执行一次逾期结算，再登记 `returned`；归还驳回则回到 `approved` 并写入 `return_reject_reason`/`reason`。
- 审核通过时校验设备存在、已上架、不在 `repairing`、`available_qty > 0`，通过后扣减库存并生成取件码。
- 归还审核通过后库存加 1，但不超过 `total_qty`；按期归还（归还日期不晚于 `borrow_end`）奖励信用 +1。

库存占用口径：`approved` 与 `returning` 计入已占用；`pending` 不扣库存，但在可用日历中单独以 `pending` 数量展示；`rejected`、`cancelled` 不占用。

## 5. 认证与安全

### 5.1 密码与 Token

- 密码：`crypto.scryptSync(password, salt, 32)`，存储为 `salt:hash`；校验使用 `timingSafeEqual`。
- Token：`base64url(JSON.stringify({uid, role, ver, exp})) + "." + HMAC-SHA256(payload)`，有效期 7 天（`7 * 24 * 3600` 秒）。
- `LAB_SECRET` 未配置时使用进程级随机 32 字节密钥，重启后全部登录态失效，并在控制台告警。
- `token_version` 在登出、修改密码、找回密码时自增，旧 Token 因 `ver` 不一致立即失效。
- Token 仅从 `Authorization: Bearer <token>` 读取，用户不存在或版本不匹配均视为未登录。

### 5.2 权限与黑名单

- `requireAuth()`：未登录返回真实 HTTP 401 `{code:401}`；传入角色数组时角色不符返回真实 HTTP 403。
- `requireNotBlacklisted`：未登录 401；`blacklisted` 为真时返回真实 HTTP 403，并提示限制原因。该中间件在入口层挂载到 `/api/uploads` 与 `/api/ai`；借用 / 续借路由内部另行判断黑名单，返回 HTTP 200 + `code:403`。
- 管理员接口统一使用 `requireAuth(['admin'])`。

### 5.3 限流（进程内内存）

| 前缀 | 窗口 | 上限 |
| --- | --- | --- |
| `/api/auth/login` | 5 分钟 | 30 次 |
| `/api/auth/register` | 10 分钟 | 10 次 |
| `/api/auth/forget-password` | 10 分钟 | 10 次 |
| `/api/auth/send-email-code` | 10 分钟 | 10 次 |
| `/api/ai` | 1 分钟 | 30 次 |
| `/api/uploads` | 10 分钟 | 40 次 |

Key 为 `method:挂载前缀+路径:IP`；超限返回真实 HTTP 429，并带 `Retry-After`。仅在 `TRUST_PROXY=1` 时信任代理头。

### 5.4 验证码

- 6 位数字；10 分钟有效；同一邮箱同类型 60 秒内不可重发；错误 5 次后删除记录；验证成功后消费。
- 配置 SMTP 时通过 Nodemailer 发送；未配置（或 `MAIL_DISABLED=1`）时验证码只打印到服务端控制台。
- 仅当邮件未启用、请求来自回环地址且 `NODE_ENV !== 'production'` 时，接口才在 `data.devCode` 返回验证码，供本机演示与自动化测试使用。

### 5.5 上传校验

- Multer 内存存储，单文件上限 5MB，`fileFilter` 要求 `image/*`。
- 读取文件头识别真实类型：JPEG（`FF D8 FF`）、PNG（8 字节魔数）、GIF（`GIF87a`/`GIF89a`）、WEBP（`RIFF....WEBP`）；不匹配直接拒绝。
- 配置 OSS 时上传至 `OSS_PREFIX/YYYY/MM/<uuid>.<ext>`；未配置时写入 `server/data/uploads/<uuid>.<ext>`，并通过 `/uploads` 静态目录公开。

### 5.6 安全响应头与入口防护

`server/index.js` 对所有响应设置：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- 非 `/api` 页面额外设置 CSP：`default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'`

其他：CORS 仅允许 `CORS_ORIGIN` 白名单（默认 `http://localhost:5173,http://127.0.0.1:5173`）；JSON 请求体上限 2MB；未知 `/api` 路径返回真实 404；异常统一 500；生产模式下若 `admin`/`student` 仍使用 `123456`，默认拒绝启动（除非 `ALLOW_DEMO_PASSWORD=1`）。

## 6. 信用分与自动拉黑

`server/credit.js` 规则：

1. **逾期结算**：启动时执行一次；此后任意 `/api` 请求若距上次结算超过 60 秒再执行。只处理 `approved` / `returning` 且 `borrow_end < 今天` 的申请，逾期天数 = 今天 − `borrow_end`，只对新增天数扣分，并写入 `overdue_charged_days`。
2. **扣分**：每天扣 `abs(overdue_penalty)`，该配置默认 `-5`，即每天 5 分；`balance` 最低为 0。
3. **自动暂停**：结算后余额低于 60 分且用户不是管理员，自动置 `blacklisted = true`，记录原因与时间，并发送站内通知。管理员可在管理端解除。
4. **奖励**：归还审核通过且归还日期不晚于 `borrow_end`，+1 分；完成设备评价 +1 分（每条申请仅一次）。
5. 每次变动都写入 `credit_logs`（含 `change`、`balance`、`reason`、`ref_id`）。

## 7. AI 主备切换与本地降级

- 服务商配置来自环境变量：
  - `qwen`：`QWEN_API_KEY`（或 `DASHSCOPE_API_KEY`）、`QWEN_MODEL`（默认 `qwen-flash`）、`QWEN_BASE_URL`（默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`）
  - `deepseek`：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`（默认 `deepseek-chat`）、`DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com/v1`）
- 调用链：请求指定服务商优先，其次另一家；只保留已配置 API Key 的服务商。每次请求超时 15 秒。
- 对话（`chat`）：合并系统提示词与最近 10 条 `user`/`assistant` 消息（每条截断 2000 字符），携带真实上下文（设备概况、最多 26 台可借设备、该用户最近 12 条申请）。`temperature=0.4`、`max_tokens=800`。返回 `reply`、命中的 `devices`、实际 `provider`、`providerLabel`、`model` 与 `notice`。
- 审批建议（`reviewBooking`）：携带申请人历史统计、设备状态、时间冲突日期；要求模型只返回 JSON（`recommendation` / `score` / `summary` / `reasons` / `risks` / `suggested_note`），`temperature=0.2`、`max_tokens=700`；服务端对 `recommendation`、分数区间、数组长度做兜底与裁剪。
- 降级：未配置任何 Key、请求失败或返回内容不可解析时，使用本地规则。对话走关键词意图匹配（推荐设备、申请进度、逾期、续借、归还、评价、借用流程等）；审批建议走确定性规则（黑名单、下架、维护、无库存、时间冲突、逾期次数、历史拒绝比例、用途过短、借用天数），输出 `provider: 'local'`、`providerLabel: '本地规则'/'本地智能'`、`model: 'rule-based'`，并在 `notice` 说明原因。
- `GET /api/ai/status` 返回各服务商的 `configured`、`keyEnvs` 与 `defaultProvider`、`hasCloudProvider`。

## 8. 通知与 Web Push

- `notify(userId, {...})` 写入 `notifications` 后立即异步调用 `pushToUser`，失败被忽略，不阻塞业务。
- 通知触发点：申请提交、审批通过/拒绝、归还完成/驳回、续借通过/拒绝、报修提交与处理、黑名单加入/移除、信用分过低等。
- VAPID 密钥优先级：环境变量 `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` → `server/data/vapid.json` → 首次启动自动生成并写入该文件（权限 `0o600`）。默认 subject 为 `mailto:lab-admin@example.com`（可用 `VAPID_SUBJECT` 覆盖）。
- 订阅校验：必须包含 `endpoint`、`keys.p256dh`、`keys.auth`，端点必须为 HTTPS 且不超过 1000 字符；同一用户同一 endpoint 覆盖更新。
- 发送：`web-push` 推送 `{title, body, url, tag}`，TTL 3600 秒；收到 404/410 的失效订阅会被删除。
- 前端由 `public/sw.js` 接收推送，用户需在浏览器授权后订阅。

## 9. 部署方式

### 9.1 开发

```bash
npm install
npm run dev:all     # 后端 3000 + Vite 5173（Vite 代理 /api）
```

### 9.2 单端口演示 / 生产

```bash
npm run build
npm run server      # 默认 http://localhost:3000
```

`server/index.js` 在检测到 `dist/` 时托管静态资源，并对非 `/api` 的 GET 请求回退 `index.html`。

### 9.3 环境变量（`.env.example`）

`LAB_SECRET`、`CORS_ORIGIN`、`TRUST_PROXY`、`PORT`、`LAB_DB_FILE`、`MAIL_DISABLED`、`ALLOW_DEMO_PASSWORD`、`QWEN_API_KEY`/`QWEN_MODEL`/`QWEN_BASE_URL`、`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL`/`DEEPSEEK_BASE_URL`、`SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM_NAME`、`OSS_ACCESS_KEY_ID`/`OSS_ACCESS_KEY_SECRET`/`OSS_REGION`/`OSS_BUCKET`/`OSS_ENDPOINT`/`OSS_PUBLIC_BASE_URL`/`OSS_PREFIX`、`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`。

`.env` 由 `server/env.js` 轻量解析（不覆盖已存在的进程环境变量），并作为入口首个导入。

### 9.4 已知边界

- **单进程 JSON 持久化**：`saveDB()` 先写 `db.json.tmp` 再 rename，保证单进程写入原子性；内存中持有整库缓存，多实例/多进程并发会互相覆盖，生产建议替换 PostgreSQL/MySQL。
- **限流为进程内内存**：重启清零，多实例不共享；反向代理后需设置 `TRUST_PROXY=1` 才能正确识别客户端 IP。
- **演示密码保护**：生产环境默认拒绝 `123456` 演示账号启动，但设置 `ALLOW_DEMO_PASSWORD=1` 会绕过。
- **无数据库事务**：跨集合写入（如审批扣库存 + 通知 + 审计）在同一进程内同步完成，但异常中断可能留下部分写入。
- **配置项未全部生效**：`settings` 中除 `overdue_penalty` 外，其余键目前仅作展示；90 天借用上限、维护拦截等为硬编码。
- **收藏无后端接口**：`favorites` 集合仅演示数据与注销清理，前端收藏保存在 localStorage/Pinia。
- **公告只读**：没有公告创建/编辑/删除接口。
- **院系与实验室无接口**：仅作为演示数据被设备引用。
- **邮箱与 OSS 可选**：未配置 SMTP 时验证码输出到控制台；未配置 OSS 时图片落本地磁盘。
- **Token 无刷新机制**：固定 7 天，登出/改密即失效，需要重新登录。

## 10. 测试体系

| 类型 | 位置 | 内容 |
| --- | --- | --- |
| 单元测试 | `tests/unit/date.test.mjs` | 6 个用例：日期格式化、空值占位、相对时间等 |
| 规则测试 | `tests/rules/availability.test.mjs` | 4 个用例：首尾日冲突、单日占用、多库存、拒绝/取消不占库存 |
| 规则测试 | `tests/rules/credit.test.mjs` | 3 个用例：按天扣分不重复、低于 60 自动拉黑、归还与评价奖励 |
| 规则测试 | `tests/rules/settings.test.mjs` | 3 个用例：字符串 / 数字 / 布尔设置的读取与默认值回落 |
| 规则测试 | `tests/rules/reminders.test.mjs` | 2 个用例：到期前一天提醒去重、关闭设置后不提醒 |
| 组件测试 | `tests/component/*.spec.js` | 10 个用例：StatusPill 状态映射、EmptyState 交互、PageHeader 插槽 |
| 接口测试 | `scripts/api-test.mjs` | 39 个步骤，独立临时数据库与端口（默认 3188），覆盖健康检查、鉴权、权限隔离、注册验证码、设备、申请审批、库存扣减/回补、归还、拒绝、资料、头像、改密、登出、设备上下架、公告/院系/实验室管理、系统设置、收藏同步、用户注销保护、黑名单拦截、找回密码、404 与 429 |
| E2E 测试 | `tests/e2e/smoke.spec.js` | 4 条 Playwright 冒烟用例：学生申请分栏、管理员续借审核、基础数据公告增删与设置、错误密码提示 |
| CI | `.github/workflows/ci.yml` | push 到 `main`/`master` 与 PR 时执行：`npm ci` → lint → 单元 + 规则 + 组件 + 接口测试 → build → 安装 Chromium → E2E（Node 22） |

`npm test` 依次执行单元、规则、组件与接口测试；`npm run verify` 额外包含 lint、数据检查与生产构建；`npm run test:e2e` 使用构建产物在 3100 端口启动独立测试数据库。`npm run check:data` 会检查演示数据是否覆盖全部借用、续借、维护与黑名单状态，避免出现“页面有、数据空”的情况。

## 11. 与常见五层目录的对照

参考移动端项目常见的 `pages / components / service / model / common` 分层，本项目的对应关系如下：

| 参考分层 | 本项目目录 | 说明 |
| --- | --- | --- |
| 页面层 pages | `src/views/` | 学生端与管理端业务页面 |
| 组件层 components | `src/components/`、`src/layouts/` | 通用组件、图表、布局与导航 |
| 服务层 service | `src/api/`、`src/utils/request.js` | 按业务模块封装接口与 Axios 实例 |
| 数据层 model | `src/stores/`、`server/data`、`server/migrate.js` | 前端状态模型 + 服务端 JSON 数据模型与迁移 |
| 工具层 common | `src/utils/`、`src/style/`、`src/directives/` | 日期、图片压缩、主题令牌与自定义指令 |

差异说明：本项目是 Web 前后端一体结构，接口层同时包含 Express 路由；页面组件按业务域放在 `src/views/*/components/`，跨页面复用逻辑放在 `src/composables/`，对应关系登记在 `docs/components.md` 与 `docs/COMPOSABLES_GUIDE.md`。暂未单独建立 `src/constants/`，状态文案与颜色映射仍由使用方维护，避免为单处使用增加跨文件跳转成本。

## 12. 开发流程完成度

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 开发环境准备 | 已完成 | Node 20/22、Vite、Express、ESLint、测试脚本 |
| 架构设计 | 已完成 | 四层后端 + 五类前端目录、数据模型、状态机 |
| 功能需求分析 | 已完成 | 学生端、管理端、维护、信用、通知、AI |
| 项目创建 | 已完成 | 前后端同仓库、单端口可运行 |
| 代码开发 | 已完成 | 78 个接口、15 个业务页面、15 个业务集合 |
| 错误修复 | 持续进行 | 已修复安全、权限、信用、AI 降级、数据空状态等问题 |
| 运行调试 | 已完成 | lint（0 警告）、39 项接口测试、18 项单元/规则测试、10 项组件测试、构建通过 |
| 规范整改 | 已完成 | 单文件 ≤600 行、搜索防抖、弹窗组件化、重复文件名清理、组件与 Composable 文档、三通道日志、借用服务层 |
| 打包上线 | 打包完成，待提交 | ZIP 已生成并通过 CRC/运行验证；报名系统上传与提交审核由团队完成 |
