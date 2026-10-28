# 极光实验室设备共享平台 · 接口文档

> 本文档逐条核对 `server/routes/` 与 `server/index.js` 中的真实路由整理，共 **78 个接口**。所有路径均以 `/api` 为前缀，默认后端地址 `http://localhost:3000`；开发模式下由 Vite 代理 `/api`。

## 1. 通用约定

### 1.1 请求

- 请求体：JSON（`Content-Type: application/json`），入口限制 2MB；上传接口为 `multipart/form-data`。
- 鉴权：受保护接口需携带 `Authorization: Bearer <token>`。Token 由登录 / 注册 / 修改密码接口返回，有效期 7 天。
- 权限标记：
  - **公开**：无需 Token。
  - **登录**：任意已登录用户（学生或管理员）。
  - **管理员**：仅 `role = admin`。
  - **登录（非黑名单）**：登录后再经过黑名单中间件，被限制账号返回真实 403。

### 1.2 响应约定

- 成功：HTTP 200，响应体 `{ "code": 200, "message": "...", "data": ... }`。
- 业务失败：多数为 **HTTP 200**，响应体 `{ "code": 400 | 403 | 404 | 409, "message": "...", "data": null }`。
- 鉴权失败：`requireAuth` / `requireNotBlacklisted` 返回**真实 HTTP 401 / 403**，响应体 `code` 与状态码一致。
- 限流：**真实 HTTP 429**，响应体 `{code:429}`，并带 `Retry-After` 响应头。
- 未知 `/api` 路径：**真实 HTTP 404**，`{code:404, message:'接口不存在'}`。
- 未捕获异常：**真实 HTTP 500**，`{code:500, message:'服务器内部错误'}`。

> 下文表格中的“400 / 403 / 404 / 409”默认指 HTTP 200 + 响应体 `code`；只有明确写“真实 401/403/429/500”时才是 HTTP 状态码。

前端 `src/utils/request.js` 的响应拦截器已将 `body.code >= 400` 统一转为 Promise reject；遇到真实 401 会清空本地 Token 并跳转登录页。

### 1.3 分页与日期

- 分页参数统一为 `page`（从 1 开始）与 `pageSize`；不同接口上限不同，见各接口说明。
- 日期参数与返回字段使用 `YYYY-MM-DD`；时间戳字段为 ISO 8601 字符串。
- 借用区间按天计，`borrow_start` 与 `borrow_end` 首尾日均占用。

### 1.4 限流规则

| 前缀 | 窗口 | 上限 |
| --- | --- | --- |
| `/api/auth/login` | 5 分钟 | 30 次 |
| `/api/auth/register` | 10 分钟 | 10 次 |
| `/api/auth/forget-password` | 10 分钟 | 10 次 |
| `/api/auth/send-email-code` | 10 分钟 | 10 次 |
| `/api/ai` | 1 分钟 | 30 次 |
| `/api/uploads` | 10 分钟 | 40 次 |

限流键为 `method:前缀+路径:IP`，内存实现、单进程生效；反向代理后需设置 `TRUST_PROXY=1`。

## 2. 认证模块（8 个）

### 2.1 接口列表

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | 公开 | 账号或邮箱登录 | `account`、`password` | `data.token`、`data.user`（公开用户信息） | 400 缺少参数 / 账号或密码不正确；429 限流 |
| POST | `/api/auth/register` | 公开 | 注册学生账号 | `account`、`name`、`email`、`password`、`email_code`（兼容 `code`）、`phone` 可选 | `data.token`、`data.user` | 400 信息不完整 / 账号少于 4 位 / 邮箱格式错误 / 密码少于 6 位 / 账号或邮箱已存在 / 验证码错误或过期；429 |
| POST | `/api/auth/send-email-code` | 公开 | 发送注册或重置密码验证码 | `email`、`type`：`register`（默认）或 `reset_password` | `data.channel`（`email`/`console`）、`data.devCode`（仅本机非生产且未配邮件时）、`data.expiresIn`（600） | 400 未填邮箱 / 格式错误 / 60 秒内重复发送 / 邮件发送失败；429 |
| POST | `/api/auth/forget-password` | 公开 | 通过邮箱验证码重置密码 | `account`、`email`、`code`、`password`、`password_confirmation` 可选 | `data: null`，提示旧登录态全部失效 | 400 参数缺失 / 两次密码不一致 / 账号与邮箱不匹配 / 验证码错误或过期；429 |
| POST | `/api/auth/logout` | 登录 | 退出登录并使当前 Token 失效 | 无 | `data: null` | 真实 401 |
| POST | `/api/auth/password` | 登录 | 修改密码 | `old_password`、`new_password`（≥6 位） | `data.token`（新 Token） | 400 参数缺失 / 新密码过短 / 原密码不正确；真实 401 |
| GET | `/api/auth/me` | 登录 | 获取当前用户信息 | 无 | `data`：`id`、`account`、`name`、`role`、`email`、`phone`、`avatar`、`credit_score`、`blacklisted`、`blacklist_reason`、`blacklisted_at`、`created_at` | 真实 401 |
| PUT | `/api/auth/profile` | 登录（非黑名单） | 修改个人资料 | `name`、`email`、`phone`、`avatar` 均可选 | `data`：更新后的公开用户信息 | 400 邮箱格式错误 / 邮箱被占用 / 手机号格式错误 / 头像格式或大小不符（Data URL，≤500KB）；真实 401；真实 403（黑名单） |

### 2.2 补充说明

- 登录支持账号或绑定邮箱，均不区分大小写；成功与失败都会写入 `login_logs`。
- 注册固定创建 `role: 'student'`，必须提供 `register` 类型验证码；账号长度 ≥4，密码长度 ≥6。
- 验证码有效期 10 分钟，同邮箱同类型 60 秒内不可重发，错误 5 次后作废；验证成功后立即消费。
- `devCode` 仅在“未启用邮件 + 回环地址 + `NODE_ENV !== 'production'`”时返回，其余环境不会下发。
- 找回密码、修改密码、登出都会使 `token_version` 自增，旧 Token 立即失效；修改密码会返回新 Token。
- `avatar` 仅接受 `data:image/(png|jpeg|webp);base64,...`，长度不超过 500KB；`phone` 需匹配 `^1\d{10}$`。

## 3. 设备模块（9 个）

### 3.1 接口列表

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/devices` | 登录 | 设备列表（分页 / 筛选） | `name`（匹配名称或描述）、`category`（精确）、`is_active`（`1`/`true`/`0`）、`available=1`、`page`、`pageSize`（默认 10，最大 2000） | `data.list`（含 `rating`、`reviewCount`）、`data.total` | 真实 401 |
| GET | `/api/devices/:id/availability` | 登录 | 指定月份每日可用情况 | 路径 `id`；`month`（`YYYY-MM`，缺省为当前 UTC 月） | `data.month`、`data.device`、`data.days[]`：`date`、`reserved`、`pending`、`remaining` | 404 设备不存在；真实 401 |
| GET | `/api/devices/:id/reviews` | 登录 | 设备评价列表 | 路径 `id` | `data.summary`（`rating`、`reviewCount`）、`data.list`（最近 30 条：`id`、`user_name`、`rating`、`comment`、`reviewed_at`、`purpose`） | 404 设备不存在；真实 401 |
| GET | `/api/devices/:id` | 登录 | 设备详情 | 路径 `id` | `data`：设备字段 + `rating` + `reviewCount` | 404 设备不存在；真实 401 |
| POST | `/api/devices/:id/report` | 登录 | 学生提交设备报修 | `reason`（必填）、`detail` 可选 | `data`：新建维护工单 | 404 设备不存在；400 未选择故障类型；409 设备已在维修 / 本人已有待处理报修；真实 401 |
| PATCH | `/api/admin/devices/:id/maintenance` | 管理员 | 直接标记设备维护开始 / 结束 | `action`：`start` / `finish`；`reason` 可选 | `data`：更新后的设备 | 404 设备不存在；400 已在维护 / 当前不在维护 / 未知操作；真实 401/403 |
| POST | `/api/admin/devices` | 管理员 | 新增（上架）设备 | `name`、`category` 必填；`description`、`total_qty`、`location`、`is_active`、`image` | `data`：新设备 | 400 名称或分类为空；真实 401/403 |
| PUT | `/api/admin/devices/:id` | 管理员 | 编辑设备档案 / 库存 / 上下架 | 任意上述字段 | `data`：更新后的设备 | 404 设备不存在；400 总数小于当前借出数量；真实 401/403 |
| DELETE | `/api/admin/devices/:id` | 管理员 | 下架设备（软删除） | 路径 `id` | `data`：`is_active = 0` 的设备 | 404 设备不存在；真实 401/403 |

### 3.2 补充说明

- 设备列表按 `id` 倒序；`rating` 与 `reviewCount` 由已评价借用记录实时聚合，无评价时 `rating` 为 `null`。
- `available=1` 仅返回 `available_qty > 0` 且不在 `repairing` 的设备。
- 可用日历中 `reserved` 统计 `approved` + `returning`，`pending` 单独计数，`remaining = max(0, total_qty - reserved)`。
- 报修时若设备 `maintenance_status` 为 `none`，会置为 `pending` 并记录原因；同一学生对同一设备不能重复提交 `pending`/`processing` 工单。
- 管理员维护 `start` 将设备置为 `repairing`；`finish` 恢复 `none`，并把该设备所有 `pending`/`processing` 工单标记为 `done`。
- 新增设备时 `total_qty` 缺省 1、最小 0，`available_qty = total_qty`；若分类名不存在会自动创建分类。
- 编辑库存时 `total_qty` 不能小于“已借出数量”（`total_qty - available_qty`），更新后重算 `available_qty`。
- 下架为软删除，仅将 `is_active` 置 0，不删除设备记录。

## 4. 分类模块（4 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/categories` | 登录 | 分类列表 | `is_active`（`1`/`true`/`0`）可选 | `data.list`（按 `sort_order` 升序） | 真实 401 |
| POST | `/api/admin/categories` | 管理员 | 新建分类 | `name` 必填；`code`、`description`、`sort_order`、`is_active` | `data`：新分类 | 400 名称为空；409 分类已存在；真实 401/403 |
| PUT | `/api/admin/categories/:id` | 管理员 | 编辑分类 | `name`、`description`、`sort_order`、`is_active` 均可选 | `data`：更新后的分类 | 404 分类不存在；真实 401/403 |
| DELETE | `/api/admin/categories/:id` | 管理员 | 删除分类 | 路径 `id` | `data: null` | 404 分类不存在；400 分类下仍有设备；真实 401/403 |

补充：

- 分类 `code` 未提供时自动生成 `C` + 时间戳后 5 位；`sort_order` 未提供时取当前数量 + 1。
- 删除前按分类名称检查 `devices.category`，仍有设备时拒绝。

## 5. 借用模块（学生端 8 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/bookings` | 登录 | 提交借用申请 | `device_id`、`borrow_start`、`borrow_end`、`purpose`、`agreement` | `data`：新建申请（`status: pending`） | 403 黑名单（响应体）；404 设备不存在；400 设备下架 / 无库存 / 日期缺失或格式错误 / 开始日期早于今天 / 结束早于开始 / 未同意协议 / 超过 `max_borrow_days` / 提前预约超过 `booking_advance_days`；409 维护中 / 同设备已有进行中申请 / 并发申请达到 `max_active_bookings` / 时段约满；真实 401 |
| GET | `/api/bookings/my` | 登录 | 我的申请列表 | `page`、`pageSize`（默认 10，最大 2000） | `data.list`、`data.total`；每条含 `is_overdue` | 真实 401 |
| GET | `/api/bookings/:id` | 登录 | 申请详情 | 路径 `id` | `data`：申请完整记录 | 404 不存在；403 无权查看（非本人且非管理员，响应体）；真实 401 |
| PATCH | `/api/bookings/:id/cancel` | 登录 | 取消待审核申请 | 路径 `id` | `data`：`status: cancelled`，含 `cancelled_at` | 404 不存在；403 非本人（响应体）；400 非待审核状态 / 管理员关闭了 `allow_self_cancel`；真实 401 |
| PATCH | `/api/bookings/:id/extend` | 登录 | 申请续借 | `new_end`、`reason` | `data`：`extension_status: pending`，含 `requested_end` | 403 黑名单 / 非本人（响应体）；404 不存在；400 非在借 / 已有待审续借 / 已逾期 / 日期非法或不晚于当前结束日 / 单次续借超过 `max_renew_days` / 总时长超过 `max_borrow_days`；409 后续时段约满；真实 401 |
| PATCH | `/api/bookings/:id/pickup` | 登录 | 凭取件码确认取件 | `code` | `data`：含 `picked_up_at`；已取件时直接成功 | 404 不存在；403 非本人（响应体）；400 非在借状态 / 取件码错误；真实 401 |
| PATCH | `/api/bookings/:id/return` | 登录 | 提交归还申请 | 无 | `data`：`status: returning`，含 `return_code`、`return_requested_at` | 404 不存在；403 非本人（响应体）；400 非在借状态；真实 401 |
| POST | `/api/bookings/:id/review` | 登录 | 评价已归还设备 | `rating`（1–5 整数）、`comment`（≤300 字） | `data`：含 `review_rating`、`review_comment`、`reviewed_at` | 404 不存在；403 非本人（响应体）；400 未归还 / 已评价 / 评分不在 1–5；真实 401 |

补充：

- 借用创建规则：设备必须存在、已上架、`available_qty > 0`；`maintenance_block_booking=1` 时 `repairing` 设备不可申请；日期必须为 `YYYY-MM-DD`，`borrow_start >= 今天` 且不超过 `booking_advance_days`，`borrow_end >= borrow_start`，总时长 ≤ `max_borrow_days`；用户进行中的申请数必须小于 `max_active_bookings`；`agreement === false` 会被拒绝。
- 同一用户对同一设备只允许一条 `pending` / `approved` / `returning` 记录。
- 续借单次延长不超过 `max_renew_days`，延长后的总时长仍受 `max_borrow_days` 限制。
- 逐日库存校验：任一天 `approved + returning` 数量达到 `total_qty` 即冲突，返回冲突日期。
- 取件不改变 `status`，只写 `picked_up_at`；若 `pickup_code` 已存在则必须匹配。
- 提交归还时若还没有 `return_code` 则生成 6 位码。
- 评价成功后信用 +1，并累加设备的 `rating_total`、`rating_count`，重算 `rating`。

## 6. 管理端模块（23 个）

### 6.1 申请管理（4 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/bookings/:type` | 管理员 | 分类型申请列表 | `type` 见下；`keyword`、`page`、`pageSize`（默认 10，最大 2000） | `data.list`、`data.total`（按创建时间倒序） | 404 未知列表类型（响应体）；真实 401/403 |
| PATCH | `/api/admin/bookings/:id/audit` | 管理员 | 审批借用申请 | `action`：`approve` / `reject`；`reason` 用于拒绝 | `data`：更新后的申请；通过时含 `pickup_code` | 404 申请不存在；400 非待审核 / 设备不存在 / 已下架 / 维护中 / 无库存 / 未知动作；真实 401/403 |
| PATCH | `/api/admin/bookings/:id/return-audit` | 管理员 | 归还核验 | `action`：`approve` / `reject`；`reason`；`code` 可选 | `data`：更新后的申请 | 404 不存在；400 非归还审核状态 / 归还码错误 / 未知动作；真实 401/403 |
| PATCH | `/api/admin/bookings/:id/extension` | 管理员 | 续借审核 | `action`：`approve` / `reject`；`reason` | `data`：更新后的申请 | 404 不存在；400 非待审续借 / 目标日期缺失 / 时段冲突 / 未知动作；真实 401/403 |

`type` 取值：

| type | 含义 |
| --- | --- |
| `pending` | 待审核 |
| `unreturned` | 在借未归还（`approved`） |
| `returning` | 归还审核中 |
| `returned` | 已归还 |
| `rejected` | 已拒绝 |
| `cancelled` | 已取消 |
| `extension-pending` | `approved` 且 `extension_status = pending` |
| `return-rejected` | `approved` 且存在 `return_reject_reason` |

补充：

- 审批通过会再次校验设备状态与库存，扣减 1 台库存、写 `approved_at`、生成取件码，并发送站内通知与审计日志。
- 归还审核通过前先执行逾期信用结算，再置 `returned`、写 `returned_at`、按期归还 +1 信用分、库存 +1（不超过总数）；归还码仅在请求提供 `code` 且记录已有 `return_code` 时校验。
- 归还驳回会回到 `approved`，写入 `return_reject_reason` 与 `reason`。
- 续借通过会再次做逐日冲突校验，通过后把 `borrow_end` 更新为 `requested_end`，`extension_status` 置 `approved`；驳回置 `rejected` 并记录原因。

### 6.2 用户管理（3 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/users` | 管理员 | 用户列表 | `keyword`（账号 / 姓名 / 邮箱）、`page`、`pageSize`（默认 10，最大 2000） | `data.list`（公开用户信息，按 id 倒序）、`data.total` | 真实 401/403 |
| PATCH | `/api/admin/users/:id/blacklist` | 管理员 | 加入 / 解除黑名单 | `action`：`add` / `remove`；`reason` 可选 | `data`：更新后的用户 | 404 用户不存在；400 目标为管理员 / 未知操作；真实 401/403 |
| DELETE | `/api/admin/users/:id` | 管理员 | 注销用户 | 路径 `id` | `data: null` | 404 用户不存在；400 管理员账号 / 仍有未归还设备；真实 401/403 |

补充：

- 加入黑名单默认原因为“违反实验室设备借用规定”，并发送站内通知。
- 注销会删除该用户的 `bookings`、`notifications`、`favorites`、`push_subscriptions`；`credit_logs`、`login_logs`、`audit_logs` 不级联删除。

### 6.3 维护中心（2 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/maintenance` | 管理员 | 维护工单列表与统计 | `status`（精确状态或 `all`）、`keyword`（设备名 / 报修人 / 原因） | `data.list`、`data.stats`（`pending`、`processing`、`doneToday`、`repairing`）、`data.repairingDevices` | 真实 401/403 |
| PATCH | `/api/admin/maintenance/:id` | 管理员 | 处理报修 | `action`：`start` / `finish` / `reject`；`note` | `data`：更新后的工单 | 404 工单不存在；400 状态不允许该动作 / 未知操作；真实 401/403 |

补充：

- 该列表不分页，按 `created_at` 倒序返回全部匹配工单。
- `start`：仅 `pending` → `processing`，同时设备置 `repairing`。
- `finish`：`pending`/`processing` → `done`，设备恢复 `none`，并关闭该设备其他待处理工单。
- `reject`：仅 `pending` → `rejected`；若设备无其他待处理工单，则设备恢复 `none`。

### 6.4 审计与数据规模（见“通知 / 公告”模块）

`GET /api/admin/audit-logs` 与 `GET /api/admin/database` 两个管理员接口位于 `server/routes/workspace.js`，详见第 9 节。

### 6.5 基础数据与设置（14 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/announcements` | 管理员 | 公告列表（含停用） | 无 | `data.list`（按发布时间倒序）、`data.total` | 真实 401/403 |
| POST | `/api/admin/announcements` | 管理员 | 发布公告 | `title`、`content`、`level`（`info`/`warning`/`important`）、`is_active` | `data`：新公告 | 400 标题或内容为空；真实 401/403 |
| PUT | `/api/admin/announcements/:id` | 管理员 | 编辑公告 / 启停 | 路径 `id`；`title`、`content`、`level`、`is_active` 均可选 | `data`：更新后的公告 | 404 公告不存在；400 标题或内容为空；真实 401/403 |
| DELETE | `/api/admin/announcements/:id` | 管理员 | 删除公告 | 路径 `id` | `data: null` | 404 公告不存在；真实 401/403 |
| GET | `/api/admin/departments` | 管理员 | 院系列表 | 无 | `data.list`、`data.total` | 真实 401/403 |
| POST | `/api/admin/departments` | 管理员 | 新增院系 | `name`、`code`、`description` | `data`：新院系 | 400 名称或编码为空；409 名称或编码重复；真实 401/403 |
| PUT | `/api/admin/departments/:id` | 管理员 | 编辑院系 | 路径 `id`；`name`、`code`、`description` 均可选 | `data`：更新后的院系（同步实验室冗余院系名） | 404 院系不存在；409 名称或编码重复；真实 401/403 |
| DELETE | `/api/admin/departments/:id` | 管理员 | 删除院系 | 路径 `id` | `data: null` | 404 院系不存在；409 院系下仍有实验室；真实 401/403 |
| GET | `/api/admin/labs` | 管理员 | 实验室列表 | 无 | `data.list`、`data.total` | 真实 401/403 |
| POST | `/api/admin/labs` | 管理员 | 新增实验室 | `name`、`building`、`room`、`department_id`、`manager`、`phone`、`capacity`、`status`、`open_hours` | `data`：新实验室（含 `department_name`） | 400 名称 / 楼栋 / 房间为空；409 名称重复；真实 401/403 |
| PUT | `/api/admin/labs/:id` | 管理员 | 编辑实验室 | 路径 `id`；字段均可选 | `data`：更新后的实验室 | 404 实验室不存在；409 名称重复；真实 401/403 |
| DELETE | `/api/admin/labs/:id` | 管理员 | 删除实验室 | 路径 `id` | `data: null` | 404 实验室不存在；409 实验室仍有关联设备；真实 401/403 |
| GET | `/api/admin/settings` | 管理员 | 系统设置列表 | 无 | `data.list`（`key`、`value`、`label`、`updated_by`、`updated_at`）、`data.total` | 真实 401/403 |
| PUT | `/api/admin/settings/:key` | 管理员 | 更新系统设置 | 路径 `key`；`value` | `data`：更新后的设置 | 404 设置项不存在；400 缺少值 / 布尔或数字格式不正确；真实 401/403 |

补充：

- 公告、院系、实验室的增删改都会写入 `audit_logs`。
- 公告 `is_active=0` 后不再出现在学生端 `GET /api/announcements`。
- 院系删除前会检查 `labs.department_id`，存在关联实验室时返回 409。
- 实验室 `status` 取值：`open`、`maintenance`、`closed`。
- 系统设置保存后立即生效；`notification_email` 控制业务通知邮件，`auto_overdue_reminder` 控制到期前一天提醒。

## 7. 统计模块（5 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/stats/overview` | 登录 | 总览指标 | 无 | `deviceCount`、`totalQty`、`availableQty`、`borrowedQty`、`utilizationRate`（百分比，1 位小数）、`pending`、`inUse`、`returning`、`overdue`、`studentCount`、`monthBookings`、`todayBookings`、`mine`（`total`、`pending`、`active`、`overdue`、`returned`、`month`） | 真实 401 |
| GET | `/api/stats/trend` | 登录 | 借用趋势 | `days`（7–90，默认 30） | `data`：数组，每项 `date`（`MM-DD`）、`fullDate`、`applications`、`approvals` | 真实 401 |
| GET | `/api/stats/categories` | 登录 | 分类库存分布 | 无 | `data`：数组，每项 `name`、`total`、`available`、`count`、`borrowed`、`rate`，按 `total` 倒序 | 真实 401 |
| GET | `/api/stats/utilization` | 登录 | 热门设备利用率 | 无 | `data`：前 8 台，每项 `id`、`name`、`category`、`total`、`available`、`borrowed`、`borrowCount`、`rate` | 真实 401 |
| GET | `/api/stats/recent` | 管理员 | 最近申请明细 | `limit`（1–20，默认 8） | `data`：申请记录数组（含申请人姓名、用途） | 真实 401/403 |

补充：

- 统计仅基于 `is_active = 1` 的设备；`overdue` 指 `approved` 且 `borrow_end < 今天`。
- 分类、利用率、趋势为聚合数据，学生也可读；`recent` 含个人信息，仅管理员可读。

## 8. AI 模块（3 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/ai/status` | 登录（非黑名单） | 查看 AI 服务商配置状态 | 无 | `data.providers[]`（`id`、`label`、`model`、`configured`、`keyEnvs`）、`data.defaultProvider`、`data.hasCloudProvider` | 真实 401/403 |
| POST | `/api/ai/chat` | 登录（非黑名单） | 智能助手对话 | `messages`（非空数组，含 `role`/`content`）、`provider`：`qwen` 或 `deepseek`（默认 qwen） | `data.reply`、`data.devices`、`data.provider`、`data.providerLabel`、`data.model`、`data.notice` | 400 消息为空 / 最后一条内容为空；真实 401/403；真实 500（未捕获异常） |
| POST | `/api/ai/review` | 管理员（非黑名单） | 生成借用审批建议 | `booking_id`（必填）、`provider` 可选 | `data.recommendation`（`approve`/`reject`/`manual`）、`data.score`、`data.summary`、`data.reasons`、`data.risks`、`data.suggested_note`、`data.conflictDate`、`data.provider`、`data.providerLabel`、`data.model`、`data.notice` | 400 缺少申请编号 / 申请不存在等（错误被捕获后以响应体 400 返回）；真实 401/403 |

补充：

- `/api/ai` 整体挂了限流（30 次/分钟）和黑名单中间件，因此黑名单账号连状态查询也会被真实 403 拦截。
- 对话仅取最近 10 条 `user` / `assistant` 消息；上下文包含设备概况、最多 26 台可借设备和该用户最近 12 条申请。
- 未配置云端 Key 或调用失败时自动使用本地规则，返回 `provider: "local"`，`notice` 说明原因；主模型失败会先尝试另一家，仍失败才降级。
- 审批建议最终仍由管理员确认，AI 结果仅供参考。

## 9. 通知 / 公告 / 信用 / 审计 / 收藏 / 公开设置（11 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/notifications` | 登录 | 当前用户通知 | `page`、`pageSize`（默认 30，最大 100） | `data.list`、`data.total`、`data.unread` | 真实 401 |
| PATCH | `/api/notifications/read-all` | 登录 | 全部标记已读 | 无 | `data.count` | 真实 401 |
| PATCH | `/api/notifications/:id/read` | 登录 | 单条标记已读 | 路径 `id` | `data`：更新后的通知 | 404 通知不存在或不属于本人；真实 401 |
| GET | `/api/announcements` | 登录 | 平台公告 | 无 | `data.list`（仅 `is_active`，按发布时间倒序）、`data.total` | 真实 401 |
| GET | `/api/me/credit-logs` | 登录 | 我的信用流水 | 无 | `data.score`、`data.list`（最近 50 条） | 真实 401 |
| GET | `/api/admin/audit-logs` | 管理员 | 审计日志 | `page`、`pageSize`（默认 20，最大 200）、`keyword`（操作人 / 对象 / 详情）、`action`（精确或 `all`） | `data.list`、`data.total` | 真实 401/403 |
| GET | `/api/admin/database` | 管理员 | 数据表规模 | 无 | `data.schemaVersion`、`data.tables[]`（`key`、`label`、`count`）、`data.total` | 真实 401/403 |
| GET | `/api/favorites` | 登录 | 我的收藏 | 无 | `data.ids`、`data.list`（`id`、`name`、`category`、`image`、`available_qty`、`total_qty`、`is_active`）、`data.total` | 真实 401 |
| POST | `/api/favorites/:deviceId` | 登录 | 收藏设备 | 路径 `deviceId` | `data.device_id`；重复收藏幂等 | 404 设备不存在；真实 401 |
| DELETE | `/api/favorites/:deviceId` | 登录 | 取消收藏 | 路径 `deviceId` | `data.device_id` | 真实 401 |
| GET | `/api/settings/public` | 登录 | 前端借用规则 | 无 | `data.max_borrow_days`、`data.max_renew_days`、`data.booking_advance_days` | 真实 401 |

补充：

- 通知按 `created_at` 倒序，`unread` 为当前用户未读数。
- 公告写接口位于 6.5 节，管理端可以新增、编辑、启停与删除公告。
- 收藏写入 `db.favorites`；前端登录后会与本地缓存合并，并补齐尚未同步的收藏。
- `credit_logs` 仅返回当前用户最近 50 条，`score` 取用户当前信用分。
- `/api/admin/database` 固定展示 15 张表（users、departments、labs、categories、devices、bookings、maintenance、notifications、announcements、favorites、credit_logs、login_logs、audit_logs、settings、push_subscriptions），按记录数倒序；不包含 `codes`、`seq`、`meta`。

## 10. 上传模块（1 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/uploads` | 登录（非黑名单） | 上传设备图片 / 头像原图 | `multipart/form-data`，文件字段名 `file` | `data.url`、`data.key`、`data.storage`（`oss`/`local`）、`data.size`、`data.mime` | 400 未选择文件 / 超过 5MB / 非图片 MIME / 文件头不是有效图片；500 存储失败（响应体）；真实 401/403；429 |

补充：

- 文件大小上限 5MB；仅接受 `image/*`，并通过文件头再次校验 JPEG / PNG / GIF / WEBP。
- 未配置 OSS 时写入 `server/data/uploads/`，返回 `/uploads/<uuid>.<ext>`；配置后返回 OSS 公网地址。
- 黑名单中间件在入口层先执行，被限制账号返回真实 403。

## 11. 推送模块（4 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/push/public-key` | 登录 | 获取 VAPID 公钥与订阅状态 | 无 | `data.publicKey`、`data.configured`、`data.subscriptions`（当前用户订阅数） | 真实 401 |
| POST | `/api/push/subscribe` | 登录 | 保存浏览器订阅 | `subscription`：`{ endpoint, keys: { p256dh, auth } }` | `data.id` | 400 订阅信息不完整 / 地址无效 / 非 HTTPS / 地址过长；真实 401 |
| POST | `/api/push/unsubscribe` | 登录 | 删除浏览器订阅 | `endpoint` | `data: null` | 400 缺少订阅地址；真实 401 |
| POST | `/api/push/test` | 登录 | 发送测试推送 | 无 | `data.sent`、`data.total` | 400 Web Push 未配置（响应体）；真实 401 |

补充：

- 同一用户同一 `endpoint` 会覆盖更新，不会重复插入。
- 推送端点必须为 HTTPS 且不超过 1000 字符；发送 TTL 为 3600 秒，失效订阅（404/410）会自动清理。
- 未配置环境变量时，`server/data/vapid.json` 会在首次启动自动生成 VAPID 密钥。

## 12. 账号与系统（2 个）

| 方法 | 路径 | 权限 | 用途 | 关键参数 | 成功返回 | 常见错误 |
| --- | --- | --- | --- | --- | --- | --- |
| DELETE | `/api/account` | 登录 | 注销当前账号 | `password` | `data: null` | 真实 404 账号不存在；400 管理员账号 / 密码不正确 / 存在未归还设备；真实 401 |
| GET | `/api/health` | 公开 | 健康检查 | 无 | `data.time`（ISO 时间） | 无 |

补充：

- 注销前会校验密码，并检查该用户是否仍有 `approved` / `returning` 的申请；有则拒绝。
- 注销成功后删除该用户的账号、借用记录、通知、收藏与推送订阅；`credit_logs`、`login_logs`、`audit_logs` 保留。
- 未匹配的 `/api` 请求统一返回真实 HTTP 404 `{code:404, message:'接口不存在'}`；服务端异常返回真实 HTTP 500。

## 13. 接口清单汇总

| 模块 | 数量 | 路由文件 |
| --- | --- | --- |
| 认证 | 8 | `server/routes/auth.js` |
| 设备 | 9 | `server/routes/devices.js` |
| 分类 | 4 | `server/routes/categories.js` |
| 借用（学生端） | 8 | `server/routes/bookings.js` |
| 管理端（申请 / 用户 / 维护） | 9 | `server/routes/admin.js` |
| 管理端基础数据与设置（公告 / 院系 / 实验室 / 设置） | 14 | `server/routes/admin-base.js` |
| 统计 | 5 | `server/routes/stats.js` |
| AI | 3 | `server/routes/ai.js` |
| 通知 / 公告 / 信用 / 审计 / 收藏 / 公开设置 | 11 | `server/routes/workspace.js`、`server/routes/favorites.js` |
| 上传 | 1 | `server/routes/uploads.js` |
| 推送 | 4 | `server/routes/push.js` |
| 账号与系统 | 2 | `server/index.js` |
| **合计** | **78** | 12 个路由文件 + 入口文件 |
