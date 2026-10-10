# 商盟代金券积分系统 · AI 上下文（会话恢复用）

> **用途**：当 AI 会话上下文丢失时，先读本文件恢复项目状态，再开始工作。
> 最后更新：2026-10-10（S4 收口完成）。

---

## 1. 项目定位

微信小程序生态下的**商家联盟积分 / 代金券管理平台**。

- **主体商家（平台方）**：创建所有券、审核附属、配置积分规则。
- **附属商家**：默认只能核销；被授权后可发放主体券。
- **用户（C 端）**：消费得积分 → 积分兑券 → 到店核销。

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 后端 | NestJS 10 + Prisma 5 + MySQL 8（`server/`） |
| 前端 | Vue3 + Vite 6 + Element Plus + Vant + Pinia + vue-router（`web/`） |
| 图表 | ECharts 5（**按需引入**，见 `web/src/views/common/EChart.vue`） |
| 部署 | Docker Compose（gateway(nginx:80) / server:3000 / mysql:3306） |
| 工作目录 | **`D:\shangmeng`（唯一）** —— 不要碰 `D:\My game\商盟系统` |

## 3. 目录结构索引

```
server/src/modules/   auth · merchant · store · authorization · audit-log
                      coupon · point · order · purchase · settlement
                      report · dashboard(在 report 模块) · notification · sse · upload
server/prisma/        schema.prisma · migrations/ · seed.ts（固定主键，重跑稳定）
web/src/api/          各模块 API 封装（真实 /api/v1/*，无 mock）
web/src/views/main/   后台页（coupons/orders/points/purchases/settlements/reports/…）
web/src/views/h5/     C 端 H5（exchange / point-logs）
docs/                 00-AI-Context(本文件) · 01~06 · archive/test-scripts/ · screenshots/
```

## 4. 角色与权限模型

- 鉴权主体：`admin_users`（后台账号）+ `roles` + `permissions` + `role_permissions` + `admin_user_roles`。
- 数据主体：`users`（C 端用户，积分/券归属）——**与 admin_users 无鉴权关系**。
- 角色：`PLATFORM_ADMIN` / `MAIN_ADMIN` / `SUB_ADMIN` / `SUB_ADMIN_BASIC` / `STORE_CLERK`。
- 数据隔离：所有涉及商家数据的接口必须走 **S1 的 scope 机制**（`scope()` / merchantId·storeId 由 JWT 推导，**不信任前端传参**）。
- 权限双保险：前端路由 `meta.permission` + `v-permission`；后端 `@Permissions()`（JwtAuthGuard + RolesGuard）。

## 5. 已完成阶段（S0–S4）

| 阶段 | 内容 | 状态 |
|---|---|---|
| S0 | 脚手架 + Docker | ✅ |
| S1 | 商家与权限（登录/JWT/RBAC/入驻/授权/审计） | ✅ |
| S2 | 代金券（模板/券码/发放/核销/冲正） | ✅ |
| S3 | 积分与订单（账户/FIFO/兑换/过期/异常） | ✅ |
| S4.1 | 采购记录 | ✅ 16/0 |
| S4.2 | 对账账单（后端+前端） | ✅ 18/0 |
| S4.3.1 | 报表中心后端（6 报表 + dashboard + CSV） | ✅ 30/0 + 隔离 4/4 |
| S4.3.2.1 | 6 报表前端页 | ✅ |
| S4.3.3 | 工作台图表（ECharts） | ✅ |

## 6. 当前进度 & 下一步

- **当前**：**S5 进行中**。S4 收口完成（回归 140/0）；**S5.1 C 端用户鉴权** 已完成（14/0，`docs/screenshots/s51-api-cases.txt`）。
- **回归入口**：`npm run regression`（seed 一次 → 顺序跑 S1/S2/S3.1/S3.2/S3.3/S3.4/S4.1/S4.2；S5.1 另有 `tmp-s51-cases.mjs`）。
- **下一步**：S5.2 用户管理 → S5.3 门店变更 → S5.4 通知 + 附属侧补齐（每批停下验收）。

## 7. 关键约定（必须遵守）

1. 改动只针对 `D:\shangmeng`；不要碰 `D:\My game\商盟系统`。
2. 每次改动跑：`vue-tsc --noEmit`（前端，`cd web`）、`nest build`（后端，`npm run build -w server`）。
3. 数据隔离：走 S1 scope，不信任前端传参。
4. 权限：路由 `meta.permission` + `v-permission` 双保险。
5. 无 mock：前端真实调 `/api/v1/*`（gateway :80），DevTools Network 可证。
6. 每完成一批停下等验收，不要一口气做完。
7. 捕获唯一键冲突（P2002）**必须精确匹配约束名**，禁止「泛化 P2002 → 具体业务错误」（S4 收口教训，见 docs/06「S4 收口反思」）。

## 8. 运行 / 部署 / 验收命令

```powershell
# 起服务（首次或改了源码后）
docker compose up -d --build server gateway          # 后端/前端改动后重建镜像
docker compose exec server npm run prisma:seed       # 重置演示数据（固定主键）
docker compose exec server npx prisma migrate deploy --schema server/prisma/schema.prisma  # 应用迁移

# 质量门
cd web; npx vue-tsc --noEmit; npx vite build
npm run build -w server

# 回归（seed 一次 → 顺序执行，任一失败即停）
#   S3.2 → S3.1 → S3.3 → S3.4 → S4.1 → S4.2
node docs/archive/test-scripts/tmp-s32-cases.mjs   # …… 依次
```

- **演示账号**（密码均 `Test@123456`）：`admin`(主体) / `sub01`(已授权附属) / `sub02`(未授权附属) / `clerk01`(店员) / `platform`(平台)。
- **稳定主键**：merchant 1/2/3/4；store 101/102/201；admin 1/2/3/4/5；user 1001/1002；模板 1001/1002/1003/2001/1004。
- **验收脚本**：`docs/archive/test-scripts/tmp-s3x/s4x-cases.mjs`；证据 `docs/screenshots/*`。

## 9. C 端鉴权现状（S5.1 已实现）

- **结论：C 端已引入独立登录**（S5.1，2026-10-10）。
- `users` 表仍是**业务主体**（积分账户 / 券实例 / 订单归属）；`admin_users` 是后台鉴权主体。**鉴权已分开**：
  - 后台令牌：`POST /auth/login`，载荷含 `sub`=adminUser.id（无 `kind`）。
  - C 端令牌：`POST /auth/user-login`（微信 code2session），载荷 `kind:'USER'` + `userId`=users.id。
- **双向隔离**：后台接口（全局 `JwtAuthGuard`）拒绝 `kind:'USER'` 令牌；C 端接口 `/h5/**`（`UserJwtAuthGuard`）拒绝后台令牌。
- C 端接口（`/api/v1/h5/**`）一律以**令牌 userId** 为准；`POST /h5/exchange` 若带 `userId` 且与令牌不符 → 403。
- 前端：`utils/h5Request.ts`（`userToken`）+ `api/h5.ts` + `views/h5/login.vue`；`/h5/**` 路由守卫改用 `userToken`（与后台登录态解耦）。
- 开发/模拟：未配置 `WX_APPID/WX_SECRET` 时 `WxService` 确定性模拟（`openid=dev_openid_<code>`）。
- `users.openid/unionid` 已存在（`0_init`），unionid 为 S8「支付即积分」铺路。

## 10. S5 启动清单

S5 范围（约 2 周）：
- **S5.1 用户管理**：主体后台用户列表 / 详情 / 消费·积分·券记录。
- **S5.2 门店变更申请**：附属提交 → 主体审核 → 生效。
- **S5.3 通知落地**：站内信、SSE 推送、通知中心、已读未读。
- **S5.4 附属侧完善**：本店订单 / 核销 / 采购 / 对账页面补齐。

**S5 起点必做**（S4 收口遗留）：
1. **明确 C 端 `users` 与后台 `admin_users` 的鉴权关系**（见第 9 节，含是否引入 C 端独立登录）。
2. **补写 S1 / S2 / S4.3 的回归脚本**（本轮只覆盖了 S3.1–S4.2；S1/S2/S4.3 无脚本），并入全量回归。
3. 关注后台「用户管理」页（`/main/users`，当前为占位 `P('S5')`）。

**S5 起点基线**：回归 140/0、S4 全部子阶段 ✅、`docs/06` S4 收口总表与反思已就位。

## 11. 已知遗留 / 待办

- S4 收口已修：`originBatchId` 唯一键冲突、`ensureAccount` 并发竞态 + P2002 精确化、`toCsv` 全字段加引号、S3.3 边界用例稳健性、S3.4/S3.1 回归脚本。
- 待补：S1 / S2 / S4.3 回归脚本（S5 起点）。
- 前端 S4.3.2.1 / S4.3.3 的浏览器视觉截图 + Network 截图（人工验收补）。
- 迁移注意：本项目迁移文件与 DB 曾出现 drift，改 schema 优先写迁移而非 `migrate dev`。
