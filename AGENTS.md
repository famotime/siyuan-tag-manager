# AGENTS.md · 编程智能体快速上手指南

本文档专为编程智能体（AI Agent）提供本仓库的精炼关键上下文，以便快速定位代码并遵循工程规范。

## 1. 项目概览

- **项目名称**：思源笔记标签管家 (siyuan-tag-manager)
- **技术栈**：Vue 3 (`<script setup lang="ts">`) + TypeScript 5 + Vite 6 + Sass + Vitest
- **核心定位**：思源笔记专业级标签全景资产管理、多维布尔筛选、认知共现图谱与健康治理工作台。

## 2. 架构与目录导航

- **插件入口与宿主生命周期**：
  - `src/index.ts`：思源笔记顶层插件入口，负责注册 Dock、TopBar、快捷命令、专属图标与动态样式；
  - `src/main.ts`：Dock 容器挂载/卸载管理 (`mountPanel` / `unmountPanel` / `toggleTagManagerDock`)；
  - `src/kernel.ts`：思源 Goja 内核插件入口（打包至 `dist/kernel.js`）。
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
  - 其他 9 个纯 TypeScript 领域服务位于 `src/services/*.ts`，无 UI 依赖。
- **设计系统与全局样式**：
  - `src/index.scss`：主样式入口，声明双主题 WCAG AA+ 变量；
  - `src/styles/components.scss`：工作台与所有组件共用样式；
  - `src/styles/palette.ts`：8 组精调双主题预设色盘。

## 3. 开发与测试常用命令

```bash
pnpm test        # 运行 Vitest 单元测试 (14 套用例，69 个测试)
pnpm build       # 执行生产打包 (产物位于 dist/，生成 package.zip)
pnpm typecheck   # 静态类型检查 (tsc --noEmit)
pnpm dev         # 监听模式热重载构建
```

## 4. 关键开发守则

1. **图标防污染防御**：严禁直接使用 `<svg>` 或 Emoji，统一采用 `<SyLineIcon name="..." />`，其内置 `fill:none!important; stroke:currentColor` 防御思源全局 CSS 污染。
2. **主题自适应**：所有新增颜色必须同时兼容亮色与暗色模式，引用 `src/index.scss` 声明的 `--tm-badge-*` 语义变量，确保对比度达到 WCAG AA 级以上。
3. **测试先行**：修改 `services/` 或 `composables/` 核心逻辑时，必须先在 `tests/*.spec.ts` 补充对应场景测试。
