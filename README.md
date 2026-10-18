# 商盟系统 · 代金券积分平台（管理后台）

单仓多包（npm workspaces）：`server`（NestJS + Prisma + MySQL） + `web`（Vue3 + Vite + Element Plus）。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/01-技术方案.md](docs/01-技术方案.md) | 技术栈、目录结构、开发顺序、Mock 边界 |
| [docs/02-数据库设计.md](docs/02-数据库设计.md) | 28 个模型的字段与关系、Prisma enum、约束清单 |
| [docs/03-API接口.md](docs/03-API接口.md) | 全部接口清单、权限码清单 |
| [docs/04-业务规则与验收用例.md](docs/04-业务规则与验收用例.md) | **业务硬约束 H1–H7、Seed 要求、验收用例 A1–A10** |
| [docs/05-部署手册.md](docs/05-部署手册.md) | Docker 镜像、compose 编排、Nginx 配置、从零部署命令清单 |
| [docs/08-快速启动指南.md](docs/08-快速启动指南.md) | clone、配置 .env、一键启动、跑测试 |
| [docs/09-S8支付资质材料清单.md](docs/09-S8支付资质材料清单.md) | 微信支付商户进件材料（资质未齐前不开发） |

> 硬约束必须在后端落地，前端隐藏菜单仅为体验优化，不构成安全边界。

## 快速开始

```bash
npm install                 # 安装全部 workspace 依赖
npm run prisma:generate     # 生成 Prisma Client
npm run prisma:migrate      # 建库建表（需先配置 server/.env 的 DATABASE_URL）
npm run prisma:seed         # 写入演示数据
npm run dev:server          # http://localhost:3000  Swagger: /api/docs
npm run dev:web             # http://localhost:5173
```

前端默认 `VITE_USE_MOCK=true`，**无需后端即可运行**；改为 `false` 即走真实后端。

## Docker 部署

```bash
cp .env.example .env            # 修改密码与密钥
docker compose build screen     # 可选：前端独立镜像（默认不参与运行时）
docker compose up -d --build    # mysql → server → gateway
```

| 入口 | 地址 |
|---|---|
| 管理后台 | http://localhost |
| 接口文档 | http://localhost/api/docs |
| SSE 通知 | `POST /api/v1/sse/ticket`（JWT）→ `GET /api/v1/sse/notifications?ticket=xxx` |

镜像（构建上下文均为**仓库根目录**）：

```bash
docker build -f server/Dockerfile -t shangmeng-server .
docker build -f web/Dockerfile -t shangmeng-screen .              # 前端独立镜像
docker build -f deploy/Dockerfile.gateway -t shangmeng-gateway .  # 网关（内含前端产物）
```

> 前端服务名 `screen`，源码目录仍为 `web`；`gateway` 镜像自带 dist，不使用共享卷。
> SSE 鉴权为「JWT → 60 秒一次性 ticket → 按 userId/merchantId 维度隔离推送」，`API_TOKEN` 仅供外部系统对接。
> 完整命令、备份恢复与排错见 [docs/05-部署手册.md](docs/05-部署手册.md)。

## 演示账号（seed）

| 账号 | 密码 | 角色 |
|---|---|---|
| admin | Test@123456 | 主体商家管理员 |
| sub01 | Test@123456 | 附属商家（**已授权**发放主体券） |
| sub02 | Test@123456 | 附属商家（**未授权**） |
| clerk01 | Test@123456 | 店员（S-101 中心店） |

## 当前进度

- [x] S0 脚手架：workspaces、NestJS 骨架、Vite+EP 骨架、Prisma schema + 迁移 SQL + seed
- [x] S1 商家与权限：auth（权限五表 + 登录 + JwtAuthGuard / RolesGuard / MerchantScopeGuard）、入驻审核 / 商家管理 / 授权管理 / 操作日志
- [x] S2 代金券：券模板管理 / 券码预生成 / 券实例发放 / 核销与冲正（S2.4 全量回归 60 条断言全过）
- [x] S3 积分与订单：积分账户与 FIFO 流水 / 积分兑换 / 过期清零定时任务 / 订单管理与异常订单处理
- [x] S4 采购对账报表：S4.1 采购记录 ✅、S4.2 对账账单 ✅（18/0）、S4.3.1 后端接口+Swagger ✅、S4.3.2 报表页 ✅、S4.3.3 工作台图表 ✅（ECharts 按需引入：卡片+趋势+双饼+Top5，角色差异化 + dashboard:view 门禁）；**S4 收口回归 S3.1–S4.2 合计 140/0**（`docs/screenshots/s4-regression.txt`）
- [x] S5 附属侧 + 通知 + 用户管理：S5.1–S5.5 ✅
- [x] S6-A 技术债 + 联调 ✅，S6 H5 简版 ✅
- [x] S7 SSE 实时通知 ✅（全量回归 355/0）
- [x] AI 辅助：经营日报、智能录单、异常订单归因、执照识别（云 OCR 未接，代码标了 `TODO(prod)`）
- [ ] S8 微信支付：资质审核中，暂不启动。材料见 [docs/09-S8支付资质材料清单.md](docs/09-S8支付资质材料清单.md)
- [x] S9 上线准备：Mock 标记、演示种子、秒杀压测脚本、快速启动指南

> **当前进度：S0–S7 与 AI 已完成。** S8 等支付资质。本地怎么跑见 [docs/08-快速启动指南.md](docs/08-快速启动指南.md)。上下文见 [`docs/00-AI-Context.md`](docs/00-AI-Context.md)。
> 分阶段验收记录与用例证据见 [docs/06-验收清单.md](docs/06-验收清单.md)；验收脚本归档于 `docs/archive/test-scripts/`。
