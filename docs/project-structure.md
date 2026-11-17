# 思源标签管家 · 工程结构与架构映射 (Project Structure)

> 最新刷新日期：2026-11-18（第二轮重构收尾）  
> 架构状态：分层解耦持续深化——服务层传输/文本处理/配置持久化全面收敛，UI 层弹窗编排与子域逻辑沉淀为 9 个 Composable

---

## 1. 目录树全景

```text
siyuan-tag-manager/
├── docs/                                   # 核心设计、架构与重构文档
│   ├── project-structure.md                # [本文件] 模块结构与职责映射
│   ├── refactor-plan.md                    # 结构化代码重构执行计划与日志（两轮闭环）
│   └── ...                                 # 功能设计与路线图文档
├── src/                                    # 源代码目录
│   ├── components/                         # UI 组件库
│   │   ├── dialogs/                        # 模态弹窗与浮动操作菜单
│   │   │   ├── TagBatchModal.vue           # 批量文档打标对话框（文档选取子域已抽离）
│   │   │   ├── TagCompanionBar.vue         # 伴生推荐浮条（由 TagCompanionOverlay 挂载）
│   │   │   ├── TagCompanionModal.vue       # 伴生推荐设置弹窗
│   │   │   ├── TagGroupModal.vue           # 标签组维护对话框
│   │   │   ├── TagMergeModal.vue           # 标签重构与规范化合并对话框
│   │   │   ├── TagRenameModal.vue          # 标签重命名对话框
│   │   │   ├── TagReparentModal.vue        # 层级重构对话框
│   │   │   ├── TagRowMenu.vue              # 资产行内浮动右键/更多操作菜单
│   │   │   ├── TagSaveViewModal.vue        # 智能筛选视图命名保存弹窗
│   │   │   ├── TagSettingsModal.vue        # 偏好设置（删除策略等）
│   │   │   └── TagStyleModal.vue           # 双主题调色板与别名设置弹窗
│   │   ├── tabs/                           # 4 大主工作台 Tab 视图
│   │   │   ├── TagTreeView.vue             # TAB 1: 标签全景资产树（核心逻辑抽离至 4 个 Composable）
│   │   │   ├── TagFilterView.vue           # TAB 2: 多维交叉布尔筛选与卡片流
│   │   │   ├── TagGraphView.vue            # TAB 3: 认知图谱与生命周期时序分析
│   │   │   ├── TagHygieneView.vue          # TAB 4: 标签健康体检与一键治理
│   │   │   └── TagRefPromotePanel.vue      # 引用识别为标签诊断器（自包含子组件）
│   │   └── SiyuanTheme/                    # 原生主题防御与基础图标系统
│   │       ├── icons.ts                    # 显式线框 SVG 矢量定义表
│   │       └── SyLineIcon.vue              # 防 CSS 污染显式线框图标组件
│   ├── composables/                        # 响应式状态与逻辑复用层（9 个 Composable）
│   │   ├── useDocSelection.ts              # 批量打标三模式文档选取/子文档扫描/目标合并
│   │   ├── useHeatVisualization.ts         # 热度词云/排行榜范围过滤与字号分级换算
│   │   ├── useInlineRename.ts              # 全景树行内重命名校验与级联确认
│   │   ├── useModalOrchestration.ts        # 工作台弹窗编排与全局 Escape 分层关闭链
│   │   ├── useScrollPersistence.ts         # 全景树浏览位置保存/恢复
│   │   ├── useTagData.ts                   # 标签全库资产、元数据与配置写操作
│   │   ├── useTagFilter.ts                 # 多维布尔筛选条件流转、卡片跳转与智能视图
│   │   ├── useTagHygiene.ts                # 健康体检结果与自动化修复
│   │   └── useTreeDragDrop.ts              # 拖拽层级重构状态机（三段指示线/落位确认）
│   ├── services/                           # 核心领域服务层（22 个纯 TypeScript 模块）
│   │   ├── TagApiClient.ts                 # 内核 HTTP 传输客户端（postRaw 信封/request 规范化）
│   │   ├── TagBatchService.ts              # 批量打标 + executeBatchTagging 统一执行链路
│   │   ├── TagBlockAppender.ts             # 伴生采纳时块尾追加 #tag#
│   │   ├── TagCompanionCache.ts            # 共现图谱内存倒排索引缓存池
│   │   ├── TagCompanionOverlay.ts          # 伴生浮条视图挂载/定位/文档头 chip 注入
│   │   ├── TagCompanionRecommender.ts      # 伴生推荐决策（上下文排除/缓存查询/兜底）
│   │   ├── TagCompanionService.ts          # 伴生推荐全局事件检测与采纳调度
│   │   ├── TagCooccurrenceService.ts       # 共现图谱算法 + fetchCooccurrenceGraph 编排
│   │   ├── TagConfigStore.ts               # 配置统一存储（读-合并-写，防整文件覆盖）
│   │   ├── TagCreationService.ts           # 标签创建校验与上下文注入
│   │   ├── TagDeletionService.ts           # 三种模式删除标签（剥#/换字/彻底删）
│   │   ├── TagDocConverterService.ts       # 标签升格为主题聚合文档
│   │   ├── TagDomDecorator.ts              # 正文标签 DOM 属性装饰与 MutationObserver
│   │   ├── TagDropService.ts               # 拖拽打标：文档/块目标解析 + 全局拖放监听
│   │   ├── TagFilterEngine.ts              # 布尔筛选 SQL 构建 + queryMatchedBlocks 编排
│   │   ├── TagGovernanceService.ts         # 命名规范化、相似度聚类与健康体检引擎
│   │   ├── TagGroupService.ts              # 标签组 CRUD/上下文探测/组打标
│   │   ├── TagNavigationService.ts         # 块跳转：openTab + 滚动居中 + 高亮动效
│   │   ├── TagPinyinAliasService.ts        # 拼音首字母模糊匹配与多别名索引
│   │   ├── TagRefPromoteService.ts         # 扫描块引用匹配标签并批量写入文档属性
│   │   ├── TagTimelineService.ts           # 标签时序活跃度与生命周期统计
│   │   ├── TagTreeService.ts               # 树状层级构建/拍平/重命名映射
│   │   └── TagVisualService.ts             # 双主题色彩规则生成与动态样式注入
│   ├── styles/                             # 样式与设计系统
│   │   ├── components.scss                 # 工作台与组件共用 SCSS（含 is-top-N 语义色）
│   │   └── palette.ts                      # 8 组精调双主题预设色盘 + DEFAULT_GROUP_COLOR
│   ├── types/                              # TypeScript 静态类型与接口声明
│   │   ├── api.d.ts                        # 内核 API 数据结构
│   │   ├── companion.ts                    # 伴生推荐配置与候选类型
│   │   ├── tag.ts                          # 标签实体、节点、图谱、体检数据模型
│   │   └── ui.ts                           # 视图 Tab、弹窗参数、菜单状态模型
│   ├── utils/                              # 通用工具函数
│   │   ├── batchTagBridge.ts               # 文档树右键 → 侧栏轻量事件桥
│   │   ├── batchTagModalManager.ts         # 独立批量打标弹窗生命周期管理
│   │   ├── tagText.ts                      # 标签文本叶子工具（stripTagHash/parseIalTags/escapeSqlLiteral 全库唯一实现）
│   │   └── tooltip.ts                      # 自适应微型 Tooltip 指令 (vTooltip)
│   ├── App.vue                             # 顶层轻量工作台骨架（弹窗编排抽离后 865 行）
│   ├── index.scss                          # 全局样式入口（徽章系统、防污染、主题变量）
│   ├── index.ts                            # 插件顶层入口（Dock 注册、图标、命令、生命周期）
│   ├── kernel.ts                           # 思源 Goja 内核插件入口
│   └── main.ts                             # Dock 面板挂载/卸载管理 (mountPanel)
├── tests/                                  # 自动化测试套件（Vitest，31 个 spec / 328 用例）
│   ├── helpers/
│   │   └── ssr.ts                          # SSR 渲染共享工具（createTestApp/renderComponent + tooltip 桩）
│   ├── mocks/
│   │   └── siyuan.ts                       # 思源内核 API 隔离桩（vite test 模式 alias 生效）
│   ├── main-dock.spec.ts                   # Dock 与插件实例管理测试
│   ├── tag-api-client.spec.ts              # 传输客户端单测（信封/规范化/降级）
│   ├── tag-batch.spec.ts                   # 批量打标纯函数单测
│   ├── tag-companion-overlay.spec.ts       # 伴生浮条状态机与生命周期对称性
│   ├── tag-companion.spec.ts               # 伴生子系统四模块合并覆盖
│   ├── tag-config-store.spec.ts            # 配置读-合并-写与数据丢失缺陷回归
│   ├── tag-cooccurrence.spec.ts            # 共现图谱与算法单测
│   ├── tag-creation.spec.ts                # 标签创建单测
│   ├── tag-deletion.spec.ts                # 删除策略单测
│   ├── tag-doc-converter.spec.ts           # 升格聚合文档单测
│   ├── tag-dom-decorator.spec.ts           # DOM 装饰器单测
│   ├── tag-drop.spec.ts                    # 拖拽打标单测
│   ├── tag-filter-engine.spec.ts           # 布尔筛选引擎单测（含迁移后的 queryMatchedBlocks）
│   ├── tag-governance.spec.ts              # 治理规范与体检引擎单测
│   ├── tag-group.spec.ts                   # 标签组单测
│   ├── tag-navigation.spec.ts              # 块跳转单测
│   ├── tag-pinyin-alias.spec.ts            # 拼音别名检索单测
│   ├── tag-ref-promote.spec.ts             # 引用升格单测
│   ├── tag-text.spec.ts                    # 标签文本叶子工具单测（边界/一致性）
│   ├── tag-timeline-heat.spec.ts           # 时序活跃度单测
│   ├── tag-transport.spec.ts               # 传输层收敛单测（鉴权头回归/执行链路统一）
│   ├── tag-tree.spec.ts                    # 树形构建单测
│   ├── tag-visual.spec.ts                  # 双主题样式规则单测
│   ├── ui-components.spec.ts               # UI 组件 SSR 渲染契约测试（31 文件中最重）
│   ├── ui-composables.spec.ts              # 数据/筛选 Composable 契约测试
│   ├── ui-doc-selection.spec.ts            # 文档选取子域单测
│   ├── ui-modal-orchestration.spec.ts      # 弹窗编排与 Escape 优先级单测
│   ├── ui-ref-promote-panel.spec.ts        # 引用诊断子组件单测
│   ├── ui-tree-composables.spec.ts         # 全景树 4 Composable 单测
│   └── ui-ux-line-icon.spec.ts             # 线框图标防污染单测
├── package.json                            # 依赖与脚本定义
├── plugin.json                             # 思源插件元数据配置
├── tsconfig.json                           # TypeScript 编译器配置
└── vite.config.ts                          # Vite 构建与打包配置
```

---

## 2. 分层架构职责映射

| 分层 | 包含模块 / 目录 | 核心职责 | 依赖方向 |
| :--- | :--- | :--- | :--- |
| **表现层 (Presentation)** | `src/App.vue`<br>`src/components/tabs/*`<br>`src/components/dialogs/*` | UI 呈现与用户交互；App.vue 仅保留 Tab 导航、业务 handler 与图谱编排，弹窗状态托管给 useModalOrchestration | 依赖 Composables 与 Types |
| **状态编排层 (Composables)** | `src/composables/*`（9 个） | 跨组件状态域（数据/筛选/体检）+ 组件内子域（树拖拽/重命名/滚动/热度/弹窗/文档选取），全部为可独立单测的纯逻辑单元 | 依赖 Services 与 Types；生命周期钩子由组件层注册 |
| **纯领域服务层 (Domain Services)** | `src/services/*`（21 个领域模块） | 纯算法与领域编排：树构建、SQL 组装、拼音匹配、Jaccard 关联、时序分析、体检诊断、伴生推荐 | 无 UI 依赖；网络访问经 `transport`/`requestFn` 注入 |
| **基础设施与适配层 (Infrastructure)** | `src/services/TagApiClient.ts`<br>`src/services/TagConfigStore.ts`<br>`src/index.ts`<br>`src/main.ts` | 内核 HTTP 传输（postRaw 信封/request 规范化）、配置持久化（读-合并-写）、Dock/快捷键/顶栏 | 唯一允许触碰 fetch 与思源宿主 API 的层 |
| **共享工具层 (Utils)** | `src/utils/tagText.ts`<br>`src/utils/tooltip.ts`<br>`src/utils/batchTagBridge.ts`<br>`src/utils/batchTagModalManager.ts` | 标签文本处理全库唯一实现、Tooltip 指令、批量弹窗事件桥与管理器 | 叶子模块，被各层引用 |
| **设计系统层 (Design System)** | `src/styles/*`<br>`src/index.scss`<br>`src/components/SiyuanTheme/*` | 双主题 WCAG AA+ 色彩、语义变量（`--tm-badge-*`）、防污染线框图标、Tooltip 规范 | 全局应用 |

### 关键依赖治理成果（第二轮重构）

1. **传输唯一出口**：全部 22 个服务的网络访问收敛为 `TagApiClient.postRaw`（信封契约，兼容 requestFn 注入测试）或 `TagApiClient.request`（规范化），鉴权头单点注入，消除了 11 份 fetch 拷贝与 2 处缺 Authorization 头缺陷。
2. **层级方向修正**：`queryMatchedBlocks` 迁入 TagFilterEngine、`fetchCooccurrenceGraph` 迁入 TagCooccurrenceService（传输函数注入），TagApiClient 不再反向依赖领域编排。
3. **文本处理唯一实现**：`utils/tagText.ts` 收敛 8 处 `#` 剥离、5 处 IAL 解析、7 处 SQL 转义内联正则，杜绝语义漂移。
4. **配置写入唯一语义**：`TagConfigStore.updateConfig` 读-合并-写，修复智能视图保存覆盖丢失分组/自定义标签/伴生配置的数据丢失缺陷。

---

## 3. 两轮重构核心指标对比

| 指标 | 首轮重构前 (2026-09) | 第二轮重构前 (2026-11) | 第二轮重构后 (当前) |
| :--- | :--- | :--- | :--- |
| 最大单文件 | App.vue 2,728 行 | TagTreeView.vue 1,450 行 | TagTreeView.vue 1,012 行 |
| `App.vue` 行数 | 2,728 行（巨石） | 984 行 | 865 行 |
| Composable 数量 | 3 个（数据/筛选/体检） | 3 个 | **9 个**（新增树交互 ×4、弹窗编排、文档选取等） |
| 服务层 fetch 封装拷贝 | — | 11 份（2 份缺鉴权） | **0 份**（唯一传输出口） |
| 配置写入语义 | — | saveSmartView 整文件覆盖丢数据 | 读-合并-写（TagConfigStore） |
| 测试套件 | 14 套 / 69 用例 | 24 套 / 240 用例 | **31 套 / 328 用例（全绿）** |
| 测试共享工具 | 无 | 无 | `tests/helpers/ssr.ts`（SSR 渲染 + 指令桩） |
| 守则合规 | 图标合规 | emoji 🥇🥈🥉/裸 hex/`➔` 残留 | **全部清理**（SyLineIcon + `--tm-*` 语义变量） |

---

## 4. 开发与验证命令

```bash
pnpm test        # 运行 Vitest 全量测试（31 套 / 328 用例）
pnpm test:watch  # 监听模式
pnpm typecheck   # TypeScript 静态检查（tsc --noEmit）
pnpm build       # 生产打包（产物 dist/ + package.zip）
pnpm dev         # 监听模式热重载构建
```

> 架构细节与重构决策记录见 [refactor-plan.md](./refactor-plan.md)；首轮拆分历史见该文件的"第一轮计划"引言与 Git 提交记录。
