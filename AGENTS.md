# AGENTS.md · 编程智能体快速上手指南

本文档专为编程智能体（AI Agent）提供本仓库的精炼关键上下文，以便快速定位代码并遵循工程规范。

## 1. 项目概览

- **项目名称**：思源笔记标签管家 (siyuan-tag-manager)
- **技术栈**：Vue 3 (`<script setup lang="ts">`) + TypeScript 5 + Vite 6 + Sass + Vitest
- **核心定位**：思源笔记专业级标签全景资产管理、多维布尔筛选、认知共现图谱与健康治理工作台。

## 2. 架构与目录导航

- **插件入口与宿主生命周期**：
  - `src/index.ts`：思源笔记顶层插件入口，负责注册 Dock、TopBar、快捷命令、专属图标与动态样式；
  - `src/main.ts`：Dock 容器挂载/卸载管理 (`mountPanel` / `unmountPanel` / `toggleTagManagerDock`)。
- **UI 表现层**：
  - `src/App.vue`：轻量工作台骨架（顶栏、Tab 导航路由与弹窗挂载宿主）；
  - `src/components/tabs/`：4 大工作台 Tab（`TagTreeView` 资产树、`TagFilterView` 多维筛选、`TagGraphView` 认知图谱、`TagHygieneView` 健康治理）；
  - `src/components/dialogs/`：弹窗与右键菜单（`TagStyleModal`、`TagSaveViewModal`、`TagBatchModal`、`TagMergeModal`、`TagRowMenu`）；
  - `src/components/SiyuanTheme/`：`SyLineIcon.vue`（防 CSS 污染显式线框图标）与 `icons.ts`。
- **状态与逻辑复用层 (Composables)**：
  - `src/composables/useTagData.ts`：全库标签、元数据、删除与升格文档；
  - `src/composables/useTagFilter.ts`：多维布尔筛选条件池、卡片检索、智能视图；
  - `src/composables/useTagHygiene.ts`：健康体检评分、问题识别与一键合并修复。
- **纯领域服务层 (Services)**：
  - `src/services/TagApiClient.ts`：思源 SQL/HTTP 适配客户端（含鉴权与降级）；
  - 其他 22 个纯 TypeScript 领域服务位于 `src/services/*.ts`，无 UI 依赖。
- **设计系统与全局样式**：
  - `src/index.scss`：主样式入口，声明双主题 WCAG AA+ 变量；
  - `src/styles/components.scss`：工作台与所有组件共用样式；
  - `src/styles/palette.ts`：8 组精调双主题预设色盘。

## 3. 开发与测试常用命令

```bash
pnpm test        # 运行 Vitest 单元测试 (31 套用例文件，330 个测试)
pnpm build       # 执行生产打包 (产物位于 dist/，生成 package.zip)
pnpm typecheck   # 静态类型检查 (tsc --noEmit)
pnpm dev         # 监听模式热重载构建
```

## 4. 关键开发守则

1. **图标防污染防御**：严禁直接使用 `<svg>` 或 Emoji，统一采用 `<SyLineIcon name="..." />`，其内置 `fill:none!important; stroke:currentColor` 防御思源全局 CSS 污染。
2. **主题自适应**：所有新增颜色必须同时兼容亮色与暗色模式，引用 `src/index.scss` 声明的 `--tm-badge-*` 语义变量，确保对比度达到 WCAG AA 级以上。
3. **测试先行**：修改 `services/` 或 `composables/` 核心逻辑时，必须先在 `tests/*.spec.ts` 补充对应场景测试。

## Reference Projects

重要：在涉及解析思源笔记文档块结构和内容、确认API时，务必查看developer_docs目录下开发者文档 和 siyuan-note 项目源码确认，不要凭猜测开发和测试。

路径按开发机器取用其一（两套路径指向同一批参考工程，不同机器布局不同）：

- siyuan-note（思源笔记源码项目）
  - Windows 开发机：`D:\MyCodingProjects\siyuan-note`
  - Linux 开发机：`/home/quincyzou/projects/siyuan-note`
- `developer_docs/`：思源笔记插件开发者文档
  - 仓库根目录，并已列入 `.gitignore`（仅本机参考，不入库、不推送）。
- 核对内核行为时以 siyuan-note 的 Go 源码为准（`kernel/server/serve.go`、`kernel/model/assets.go`），`app/src` 为前端实现参考；developer_docs 未覆盖的细节不要凭猜测推断。
