# 实验室设备共享与智能调度平台

面向高校实验室的设备共享与借用管理平台，覆盖设备档案、借用申请、审批、归还、库存与数据看板，前后端全部在本仓库内，可离线独立运行。

## 功能概览

- 认证：注册（邮箱验证码，支持 QQ 邮箱 SMTP）、登录、找回密码、修改密码、登出、注销账号
- 学生端：数据看板、设备大厅、借用申请、可用日历、设备评价、我的申请、归还申请、个人中心
- 管理端：数据总览、设备管理、申请管理（审批 / 归还 / 续借）、维护中心、用户管理、黑名单
- 设备全流程：申请 → 审批扣库存 → 取件码取件 → 续借 → 归还码核验 → 评价，全流程落盘
- 设备维护：学生报修 → 管理员受理 / 维修 → 恢复可借，维修期间自动拦截借用
- AI 助手：通义千问主用、DeepSeek 备用，按顺序自动切换，全部不可用时回退本地规则
- 站内通知：申请、审批、归还、续借、维护、黑名单事件自动写入并支持已读
- 浏览器推送：Web Push（VAPID + Service Worker），未配置密钥时首次启动自动生成，用户授权后接收审批、逾期与报修提醒；提供 manifest，可添加到主屏幕
- 信用与黑名单：逾期按天自动扣分并写入信用流水，低于 60 分自动暂停借用；黑名单账号无法申请、续借、上传、使用 AI 或修改资料
- 登录态管理：Token 带版本号，登出或改密后旧 Token 立即失效；未配置 `LAB_SECRET` 时使用进程级随机密钥而非硬编码默认值
- 接口限流：登录、注册、找回密码、验证码、AI 与上传接口内置限流，无需额外验证码服务
- 安全响应头：nosniff、SAMEORIGIN、Referrer-Policy、Permissions-Policy 与页面 CSP
- 工程质量：ESLint + 6 项单元测试 + 12 项业务规则测试 + 39 项接口自动化测试，GitHub Actions 自动执行 lint / test / build
- 文档：架构说明 `docs/architecture.md`，接口清单 `docs/api.md`
- 图片存储：设备图片上传至阿里云 OSS，未配置时自动回退本地磁盘
- 数据资产：15 个数据集合，覆盖用户、院系、实验室场地、设备、申请、维护、通知、审计、信用、登录与设置
- 管理端「系统数据」：查看数据表规模与管理员操作审计日志
- 管理端「基础数据」：公告、院系与实验室场地的增删改查，修改自动写入审计日志
- 管理端「系统设置」：在线修改借用/续借/并发/提醒/AI 等配置，保存后立即生效
- 收藏同步：收藏关系写入 `db.favorites`，登录后与本地缓存合并，跨设备保留
- 运行日志：`server/logs` 下按天输出 business / api / exception 三通道日志
- 到期提醒：借用到期前一天自动写入站内通知，可通过系统设置关闭
- 数据看板：借用趋势、分类分布、库存结构、分类利用率、热门设备利用率（学生端仅可见聚合指标，申请明细仅管理员可读）
- 专属设计系统：森野绿 / 青柠 / 陶土配色、明暗主题、自定义光标与完整组件规范（`/design`）
- 演示数据：21 个账号、7 个院系、19 个实验室场地、88 台设备、14 个分类、160 条借用记录，共 820+ 条业务数据，覆盖待审核、在借、归还中、已归还、已拒绝、已取消、续借审核与黑名单状态

## 技术栈

- 前端：Vue 3、Vite、Vue Router、Pinia、Element Plus、ECharts
- 后端：Node.js、Express，JSON 文件持久化（无数据库依赖）
- 鉴权：HMAC 签名 Token（`node:crypto`），scrypt 密码哈希
- AI：通义千问 / DeepSeek OpenAI 兼容接口，可回退本地规则
- 邮件：Nodemailer + QQ 邮箱 SMTP

## 目录结构

```
server/                 后端服务
  index.js              入口（默认端口 3000，存在 dist 时同时托管前端）
  db.js                 JSON 持久化
  seed.js               演示数据生成
  base-data.js          分类、实验室、设备与学生基础数据
  auth.js               Token 与密码工具
  mailer.js             SMTP 邮件发送
  ai.js                 AI 对话与审批建议
  notify.js             站内通知与审计日志写入
  routes/               auth / devices / categories / bookings / admin / stats / ai / workspace
  data/db.json          运行时数据（首次启动自动生成）
src/
  api/                  接口封装
  components/           布局、图表、指标卡、AI 助手、自定义光标
  layouts/              学生端与管理端布局
  router/               路由与角色守卫
  stores/               Pinia 状态
  style/tokens.css      设计系统与 Element Plus 主题
  views/                页面
scripts/
  dev.mjs               同时启动前后端
  api-test.mjs          接口自动化测试
```

## 启动

```bash
npm install

# 开发模式（前端 5173 + 后端 3000）
npm run dev:all

# 单端口演示（构建后由后端托管，访问 http://localhost:3000）
npm run build
npm run server
```

## 环境配置

复制 `.env.example` 为 `.env`，按需填写：

- `LAB_SECRET`：登录 Token 签名密钥，上线前必须替换为随机长字符串
- `CORS_ORIGIN`：允许跨域的前端地址，逗号分隔（仅前后端分域部署时需要）
- `TRUST_PROXY`：部署在 Nginx 等反向代理之后时设为 `1`，本地运行留空
- `QWEN_API_KEY` / `QWEN_MODEL`：通义千问（主用）
- `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL`：DeepSeek（备用）
- `SMTP_USER` / `SMTP_PASS`：QQ 邮箱地址与 SMTP 授权码（不是 QQ 登录密码）
- `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`：阿里云 OSS（RAM 子账号）
- `OSS_REGION` / `OSS_BUCKET` / `OSS_ENDPOINT`：OSS 地域、Bucket 与 Endpoint
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`：浏览器推送密钥；留空时首次启动自动生成并保存到 `server/data/vapid.json`

QQ 邮箱授权码获取：网页版 QQ 邮箱 → 设置 → 账户 → 开启 SMTP 服务 → 生成授权码。
未配置 SMTP 时，验证码改为随机生成：本机非生产环境会在接口响应与页面提示中返回，远程或生产环境仅输出到服务端控制台，不再使用固定验证码。
未配置 OSS 时，设备图片会自动保存到 `server/data/uploads`，不影响本地使用。

首次启动会自动生成演示数据（无需手动 seed）；如需重置，执行 `npm run seed -- --force`。
演示账号使用密码 `123456`：`NODE_ENV=production` 时服务会拒绝以该密码启动，需先改密或设置 `ALLOW_DEMO_PASSWORD=1` 仅用于受控演示。

## 演示账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 学生 | student | 123456 |
| 管理员 | admin | 123456 |

登录页提供演示账号一键填入。

## 数据与测试

```bash
# 重新生成演示数据（会覆盖 server/data/db.json）
npm run seed -- --force

# 全部测试：单元 + 业务规则 + 组件 + 接口
npm test

# 单独运行
npm run test:unit
npm run test:rules
npm run test:component
npm run test:api
npm run test:e2e

# 提交前完整门禁（lint + 全部测试 + 构建）
npm run verify

# 代码规范检查（ESLint）
npm run lint
```

测试覆盖登录鉴权、Token 版本失效、权限隔离、注册验证码、验证码限流 429、黑名单拦截、设备分页筛选、申请与审批、库存扣减与回补、归还与续借、资料与头像更新、修改密码、找回密码、设备上下架、用户注销保护、公告 / 院系 / 实验室管理、系统设置、收藏同步、404 处理等 39 项接口测试；另有 6 项日期工具单元测试、12 项业务规则测试（逾期扣分幂等、信用分自动拉黑、按期归还奖励、日期重叠边界、库存容量、无效状态不占库存、设置读取、到期提醒去重）、10 项组件测试与 4 条 Playwright E2E 冒烟测试（学生看板与申请分栏、管理员续借审核、基础数据公告增删与设置、错误密码提示）。GitHub Actions 配置见 `.github/workflows/ci.yml`。

## 说明

- 所有数据保存在 `server/data/db.json`，可通过环境变量 `LAB_DB_FILE` 指定其它路径；文件不存在时首次启动自动生成演示数据
- JSON 持久化通过“临时文件 + rename”保证单进程写入原子性；该方案面向课程演示与单实例部署，不适合多实例或多进程并发写入，生产环境建议替换为 PostgreSQL / MySQL 等数据库
- 运行需要 Node.js `^20.19.0 || >=22.12.0`；`npm install` 需要联网，运行阶段不依赖任何外部 CDN
- 本地上传目录 `/uploads` 为公开静态资源，文件名使用 UUID；本地回退模式最多保留 `UPLOAD_MAX_FILES`（默认 500）张图片，生产环境建议配置 OSS 并设置生命周期策略
- 头像在前端压缩为 160×160 的 Base64 后保存，无需文件服务
- 前端不引用任何外部图片或字体资源，断网环境下页面与图表仍可正常展示
