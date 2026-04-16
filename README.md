# CareerFace Web（前端）

面向 **AI 模拟面试 / 测评** 场景的 Web 客户端，基于 **Next.js App Router** 构建，与 `web-backend` 提供的 REST API 协同工作。

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | [Next.js](https://nextjs.org/) 15（App Router） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS、Radix UI |
| 国际化 | [next-intl](https://next-intl-docs.vercel.app/) |
| 状态 | Zustand |
| 认证（客户端） | Supabase JS（与后端 Supabase 项目对齐时使用） |

## 环境要求

- **Node.js**：建议 **20 LTS** 及以上（与 Next.js 15 兼容）
- **包管理**：仓库含 `yarn.lock`，推荐使用 **Yarn**；亦可用 `npm` / `pnpm`（需自行处理 lockfile 策略）

## 快速开始

```bash
cd web-frontend

# 安装依赖（推荐）
yarn install

# 本地开发（默认 http://localhost:3000）
yarn dev
# 若使用 npm：npm run dev
```

其他常用脚本：

```bash
yarn build    # 生产构建
yarn start    # 启动生产构建产物（需先 build）
yarn lint     # ESLint
```

## 与后端联调

1. 在本地启动 API 服务（见 `../web-backend/README.md`），默认监听 **http://127.0.0.1:8000**。
2. 将前端的 API / WebSocket 基地址指向本地后端。

**配置位置**：`src/lib/publicConfig.ts` 中的 `PUBLIC_CONFIG`：

- **`apiBaseUrl`**：须包含 `/api/v1` 前缀，例如 `http://localhost:8000/api/v1`。
- **`wsBaseUrl`**：后端站点根地址（**不含** `/api/v1`），例如 `http://localhost:8000`。页面内会将 `http`/`https` 转为 `ws`/`wss` 用于 WebSocket。

连接云端部署时，将上述两项替换为实际的后端域名即可。

## 目录结构（摘要）

```
src/
├── app/                 # App Router 页面与布局（含 [locale] 多语言路由）
├── components/          # UI 组件
├── lib/                 # 工具与公共配置（含 publicConfig）
└── ...
```

## 安全说明

- `publicConfig.ts` 中的 **Supabase anon key** 等属于可出现在浏览器端的公开配置，但仍需遵循 Supabase 项目的 **RLS 与 API 策略**。
- **切勿**将服务端密钥、数据库密码写入前端代码或提交到仓库。

## 相关仓库

- 后端 API：`../web-backend`

## 许可证

以项目根目录或组织约定为准；若未单独声明，默认与主产品保持一致。
