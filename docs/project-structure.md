# 思源标签管家 · 工程结构与架构映射 (Project Structure)

> 最新刷新日期：2026-09-26  
> 架构状态：已完成现代前端分层解耦重构（符合单一职责原则 SRP 与高内聚低耦合标准）

---

## 1. 目录树全景

```text
siyuan-tag-manager/
├── docs/                                   # 核心设计、架构与重构文档
│   ├── 01-tag-analysis-report.md           # 原生缺陷剖析与突破方案报告
│   ├── 02-system-architecture-design.md    # 系统分层架构与数据模型设计
│   ├── 03-development-plan-and-roadmap.md  # 研发路线图与测试规范
│   ├── 04-ui-ux-design-specification...    # UI/UX 深度体验规范与优化方案
│   ├── project-structure.md                # [本文件] 模块结构与职责映射
│   ├── refactor-plan.md                    # 结构化代码重构执行计划与日志
│   ├── tag-style-and-alias-guide.md        # 标签双主题样式与别名引擎深度指南
│   ├── user-guide-groups-batch-and-ref.md  # [实战手册] 标签组、批量打标与引用智能识别用户指南
│   └── README.md                           # 文档中心索引
├── src/                                    # 源代码目录
│   ├── components/                         # UI 组件库
│   │   ├── dialogs/                        # 模态弹窗与浮动操作菜单
│   │   │   ├── TagBatchModal.vue           # 批量文档打标对话框
│   │   │   ├── TagMergeModal.vue           # 标签重构与规范化合并对话框
│   │   │   ├── TagRowMenu.vue              # 资产行内浮动右键/更多操作菜单
│   │   │   ├── TagSaveViewModal.vue        # 智能筛选视图命名保存弹窗
│   │   │   └── TagStyleModal.vue           # 双主题调色板与别名设置弹窗
│   │   ├── tabs/                           # 4 大主工作台 Tab 视图
│   │   │   ├── TagTreeView.vue             # TAB 1: 标签全景资产树（检索/排序/层级）
│   │   │   ├── TagFilterView.vue           # TAB 2: 多维交叉布尔筛选与卡片流
│   │   │   ├── TagGraphView.vue            # TAB 3: 认知图谱与生命周期时序分析
│   │   │   └── TagHygieneView.vue          # TAB 4: 标签健康体检与一键治理
│   │   └── SiyuanTheme/                    # 原生主题防御与基础图标系统
│   │       ├── icons.ts                    # 显式线框 SVG 矢量定义表
│   │       └── SyLineIcon.vue              # 防 CSS 污染显式线框图标组件
│   ├── composables/                        # 响应式状态与逻辑复用层 (Composition API)
│   │   ├── useTagData.ts                   # 标签全库资产获取、元数据持久化与删除
│   │   ├── useTagFilter.ts                 # 多维布尔筛选条件流转、卡片跳转与智能视图
│   │   └── useTagHygiene.ts                # 知识库健康体检计算与自动化修复
│   ├── services/                           # 核心无状态业务逻辑层 (纯 TypeScript)
│   │   ├── TagApiClient.ts                 # 内核 HTTP 适配通信、鉴权与降级适配器
│   │   ├── TagBatchService.ts              # 批量文档打标解析与事务执行引擎
│   │   ├── TagCooccurrenceService.ts       # 标签共现网络构建与 Jaccard 相似度计算
│   │   ├── TagDocConverterService.ts       # 标签升格为主题聚合实体文档服务
│   │   ├── TagDomDecorator.ts              # 正文文档标签 DOM 属性装饰与 MutationObserver 监听
│   │   ├── TagFilterEngine.ts              # 多维布尔表达式 SQL 构建与选择解析
│   │   ├── TagGovernanceService.ts         # 标签命名规范化、大小写冲突与体检引擎
│   │   ├── TagPinyinAliasService.ts        # 拼音首字母模糊匹配与多别名索引
│   │   ├── TagTimelineService.ts           # 标签时序活跃度与生命周期演变统计
│   │   ├── TagTreeService.ts               # 树状层级构建与多维排序算法
│   │   └── TagVisualService.ts             # 双主题色彩规则生成与动态样式注入
│   ├── styles/                             # 样式与设计系统
│   │   ├── components.scss                 # 标签管家专用组件与工作台布局 SCSS
│   │   └── palette.ts                      # 8 组精调双主题自适应预设色盘数据
│   ├── types/                              # TypeScript 静态类型与接口声明
│   │   ├── tag.ts                          # 标签实体、节点、图谱、体检数据模型
│   │   └── ui.ts                           # 视图 Tab、弹窗参数、菜单状态模型
│   ├── utils/                              # 通用工具函数
│   │   └── tooltip.ts                      # 自适应微型 Tooltip 指令 (vTooltip)
│   ├── App.vue                             # 顶层轻量工作台骨架（导航编排与弹窗宿主）
│   ├── index.scss                          # 全局样式入口（徽章系统、防污染、主题变量）
│   ├── index.ts                            # 插件顶层入口（Dock 注册、图标、命令、生命周期）
│   ├── kernel.ts                           # 思源 Goja 内核插件入口
│   └── main.ts                             # Dock 面板挂载/卸载管理 (mountPanel)
├── tests/                                  # 自动化测试套件 (Vitest)
│   ├── mocks/siyuan.ts                     # 思源内核 API 隔离桩
│   ├── main-dock.spec.ts                   # Dock 与插件实例管理测试
│   ├── tag-api-client.spec.ts              # 内核 API 适配客户端单测
│   ├── tag-batch.spec.ts                   # 批量打标服务单测
│   ├── tag-cooccurrence.spec.ts            # 共现图谱与算法单测
│   ├── tag-doc-converter.spec.ts           # 升格聚合文档服务单测
│   ├── tag-filter-engine.spec.ts           # 多维布尔筛选引擎单测
│   ├── tag-governance.spec.ts              # 治理规范与体检引擎单测
│   ├── tag-pinyin-alias.spec.ts            # 拼音首字母与别名检索单测
│   ├── tag-timeline-heat.spec.ts           # 时序活跃度统计单测
│   ├── tag-tree.spec.ts                    # 树形层级构建算法单测
│   ├── tag-visual.spec.ts                  # 双主题样式规则生成单测
│   ├── ui-components.spec.ts               # UI 拆分组件集成契约测试
│   ├── ui-composables.spec.ts              # UI 状态流转与 Composable 契约测试
│   └── ui-ux-line-icon.spec.ts             # 线框图标防污染与渲染契约单测
├── package.json                            # 依赖与脚本定义
├── plugin.json                             # 思源插件元数据配置
├── tsconfig.json                           # TypeScript 编译器配置
└── vite.config.ts                          # Vite 构建与打包配置
```

---

## 2. 分层架构职责映射

| 分层 | 包含模块 / 目录 | 核心职责 | 依赖方向 |
| :--- | :--- | :--- | :--- |
| **表现层 (Presentation Layer)** | `src/App.vue`<br>`src/components/tabs/*`<br>`src/components/dialogs/*` | 负责 UI 呈现、用户操作交互、键盘快捷键监听与状态挂载。 | 依赖 Composables 与 Types |
| **状态编排层 (Composables Layer)** | `src/composables/*` | 封装业务状态响应式流（`useTagData`、`useTagFilter`、`useTagHygiene`），提供跨组件共享状态与操作分发。 | 依赖 Services 与 Types |
| **纯领域服务层 (Domain Services)** | `src/services/*` | 纯 TypeScript 算法与逻辑（树构建、SQL 解析、拼音匹配、Jaccard 关联、时序分析、体检诊断）。 | 无 UI 依赖，可 100% 独立单测 |
| **基础设施与适配层 (Infrastructure)** | `src/services/TagApiClient.ts`<br>`src/index.ts`<br>`src/main.ts` | 负责与思源笔记宿主进程通信（HTTP SQL、原生 Dock、快捷键、顶栏）。 | 依赖思源开放 API 与宿主注入 |
| **设计系统层 (Design System)** | `src/styles/*`<br>`src/index.scss`<br>`src/components/SiyuanTheme/*` | 提供双主题高对比度色彩（WCAG AA+）、显式线框防污染图标、微型 Tooltip 与毛玻璃模态规范。 | 全局应用 |

---

## 3. 关键重构成果对比

| 指标 | 重构前 | 重构后 | 提升价值 |
| :--- | :--- | :--- | :--- |
| **`App.vue` 行数** | 2,728 行（巨石文件） | 440 行（轻量骨架） | 代码量缩减 **84%**，单一职责明确 |
| **组件级模块化** | 0 个独立子组件（全部内嵌） | 9 个独立视图与弹窗组件 | 视图完全解耦，支持独立按需复用与维护 |
| **状态逻辑管理** | 散落在单文件中，变量超 40 个 | 抽象为 3 大 Composables 状态域 | 状态可追踪、逻辑清晰、消除隐式耦合 |
| **样式架构** | 1,238 行 scoped 样式杂糅 | 沉淀至 `components.scss` 与 `index.scss` | 彻底避免样式作用域泄漏与重复定义 |
| **自动化测试套件** | 11 套（52 个用例，UI/API 0 覆盖） | **14 套（69 个用例，全通过）** | 补充 API 客户端与 UI 组件/Composables 覆盖 |
| **冗余死代码** | 包含 590 行无引用 `api.ts` 与 6 个占位组件 | **100% 清理完毕** | 消除包袱，构建更精炼，开发认知负担最低 |
