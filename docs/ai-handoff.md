# 项目交接与对话记录摘要

> 本文件用于把当前开发上下文迁移到 `D:\Code\Aurora-Lab-Equipment-Sharing-Platform`。
> 原始会话记忆文件已归档到 `docs/ai-memory/`。

## 当前状态

- 项目：极光 · 实验室设备共享平台（Vue 3 + Express 5）
- 提交材料已完成并上传，后续不再维护截图、视频、PPT、打包 ZIP 与在线演示地址
- 代码仓库迁移到 `D:\Code\Aurora-Lab-Equipment-Sharing-Platform`，保留该目录已有的 `.git` 与 GitHub 远程
- 当前分支：`main`，远程：`https://github.com/nine-mirrors/Aurora-Lab-Equipment-Sharing-Platform.git`

## 已完成的关键工作

1. 借用全生命周期：pending → approved → returning → returned，含拒绝、取消、续借审核、归还核验、评价
2. 信用体系：逾期按天扣分、流水幂等、低于 60 分自动暂停借用；按期归还 +1、评价 +1
3. 权限与安全：HMAC Token + token_version、登出/改密失效、黑名单拦截上传/AI/资料修改、验证码随机化与尝试上限、安全响应头、上传魔数校验
4. AI：通义千问主用、DeepSeek 备用，按顺序自动切换，失败回退本地规则
5. Web Push：VAPID 未配置时自动生成并持久化到 `server/data/vapid.json`
6. 演示数据：160 条借用，覆盖 pending / approved / returning / returned / rejected / cancelled，含三种续借状态与 1 个黑名单账号
7. 测试：6 项单元、12 项业务规则、39 项接口测试；`npm run check:data` 检查数据覆盖
8. 工程化：ESLint、GitHub Actions CI、`npm run verify`、接口与架构文档

## 常用命令

```bash
npm install
npm run dev:all      # 前端 5173 + 后端 3000
npm run build        # 构建 dist
npm run server       # 单端口托管 dist + API
npm run verify       # lint + 数据检查 + 单元/规则/接口测试 + 构建
npm run check:data   # 仅检查演示数据完整性
```

演示账号：`student / 123456`、`admin / 123456`。生产模式会拒绝以默认密码启动，需设置 `ALLOW_DEMO_PASSWORD=1` 或先改密。

## 已知边界

- JSON 单文件持久化，只适合单进程；多实例需换数据库
- 内存限流重启清零，多实例不共享
- 浏览器推送需要 HTTPS/localhost 与用户授权
- `push_subscriptions` 与 `codes` 在演示数据中为 0 属正常（运行时生成 / 临时表）
- 尚未拆分 5 个千行 Vue 页面，也还没有组件级/E2E 测试，属于后续工程化项
