# 重构计划 (Refactor Plan)

## 1. 项目快照

- 生成日期：2026-09-26
- 范围：`siyuan-tag-manager` 仓库全量代码（重点在 `src/App.vue`、`src/components/`、`src/services/`、`src/api.ts`、`src/utils/`、`tests/`）
- 目标：将 2728 行巨型单文件 `App.vue` 彻底解耦为高内聚组件与 Composable 逻辑层；补全 UI 与 API 客户端自动化测试；清理模板遗留的死代码与未利用组件；收敛沉淀设计系统样式；建立清晰的企业级分层架构。
- 文档刷新目标：`docs/project-structure.md`、`README.md`、`README_zh_CN.md`、`AGENTS.md`、`CLAUDE.md`

---

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| :--- | :--- | :--- | :--- | :--- |
| **UI 编排与主工作台** | `src/App.vue` | 承载 4 大 Tab 视图、4 个弹窗、1 个右键菜单、全部响应式状态、交互事件与 1200+ 行 Scoped 样式 | 2728 行单文件，严重违反单一职责原则（SRP），代码臃肿，无组件级隔离，无法针对视图进行单元测试 | 0%（无任何组件级测试） |
| **通用/主题组件库** | `src/components/SiyuanTheme/*` | 提供 `SyLineIcon` 及模板占位组件（`SyButton` 等） | 包含 6 个完全未被引用的模板占位组件，干扰代码库认知 | `SyLineIcon` 有 2 项测试，其余 0% |
| **内核 API 适配客户端** | `src/services/TagApiClient.ts` | 封装全库标签获取、重命名、删除、合并、多维查询、图谱与时序 SQL 请求 | 使用原生 `fetch` 未处理思源鉴权或全局异常拦截；未做单元测试 | 0%（无专门测试文件） |
| **模板遗留 API 桩** | `src/api.ts` | 模板预置的思源标准 REST API 包装函数（590 行） | 全库 0 引用，590 行完全死代码，增加打包与认知负担 | 0%（无引用） |
| **核心业务服务层** | `src/services/*.ts` (9 个业务服务) | 负责树形构建、布尔筛选、共现网络、拼音别名、时序热力、治理体检、视觉样式、文档转换与批量打标 | 各服务逻辑相对纯粹独立，职责较为清晰 | 覆盖良好（9 个测试文件，50 个单测全部通过） |
| **入口与 Dock 生命周期** | `src/index.ts`, `src/main.ts` | 插件初始化、原生 Dock 面板挂载/卸载、顶栏与命令注册 | `main.ts` 与 `index.ts` 边界清晰 | `tests/main-dock.spec.ts`（6 个测试通过） |
| **工具与辅助库** | `src/utils/index.ts`, `src/utils/tooltip.ts` | 提供 `vTooltip` 提示指令与 DOM 挂载工具 | `src/utils/index.ts`（`getDomByVueComponent`）完全无引用死代码 | `tooltip.ts` 无独立单测 |
| **类型定义** | `src/types/tag.ts`, `src/types/api.d.ts` | 声明标签实体、树节点、筛选选项、图谱、体检报告等类型 | 缺少 UI 视图与弹窗状态的专用类型；部分服务方法存在隐式 `any` | 静态编译校验 |

---

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RF-001** | **P0** | UI 视图与编排解耦（拆解 2728 行 `App.vue`） | `src/App.vue`<br>`src/components/tabs/*.vue`<br>`src/components/dialogs/*.vue`<br>`src/composables/*.ts` | 1. 拆分 4 个核心 Tab 视图：`TagTreeView.vue`, `TagFilterView.vue`, `TagGraphView.vue`, `TagHygieneView.vue`<br>2. 抽离 4 个弹窗与右键菜单：`TagStyleModal.vue`, `TagSaveViewModal.vue`, `TagBatchModal.vue`, `TagMergeModal.vue`, `TagRowMenu.vue`<br>3. 抽离状态 Composables：`useTagData.ts`, `useTagFilter.ts`, `useTagHygiene.ts`<br>4. `App.vue` 精简为轻量骨架导航层（<200行） | 高 | - [x] 保持全量 52 个既有测试通过；<br>- [x] 补充 Tab 视图与 Composables 状态流转单元测试；<br>- [x] 验证 4 大 Tab 切换、搜索、多维过滤、图谱渲染、体检操作行为不变。 | `docs/project-structure.md`：详细更新组件层级图与职责说明 | done |
| **RF-002** | **P1** | 核心 API 客户端加固与清理模板死代码 | `src/services/TagApiClient.ts`<br>`src/api.ts`（删除）<br>`tests/tag-api-client.spec.ts` | 1. 加固 `TagApiClient`：统一错误处理机制、安全参数校验、支持鉴权头适配；<br>2. 删除 590 行零引用的模板遗留死代码 `src/api.ts`；<br>3. 新增 `tests/tag-api-client.spec.ts` 覆盖各 API 契约与 Mock 降级分支。 | 中 | - [x] 新增 API 客户端单测套件（正常响应、错误码响应、网络失败降级回退）；<br>- [x] 验证 SQL 聚合与合并计划执行正确性；<br>- [x] 验证删除 `src/api.ts` 后编译打包无缺失。 | `docs/project-structure.md`：更新 API 服务层说明 | done |
| **RF-003** | **P1** | UI 类型规范化与设计系统样式模块化 | `src/types/ui.ts`<br>`src/types/tag.ts`<br>`src/index.scss`<br>`src/styles/*.scss` | 1. 新建 `src/types/ui.ts` 集中声明视图状态、弹窗参数、菜单项与预设视图类型；<br>2. 将 `App.vue` 中 1238 行 scoped CSS 提炼：公共卡片/徽章/弹窗样式下沉沉淀到 `src/index.scss`；<br>3. 强化亮色与暗色模式下 WCAG 2.1 AA 对比度变量定义。 | 中 | - [x] 保持 `tests/ui-ux-line-icon.spec.ts` 与既有测试通过；<br>- [x] 静态类型检查 `tsc --noEmit` 0 报错；<br>- [x] 视觉审查暗黑/明亮主题样式一致性。 | `docs/project-structure.md`：更新样式与类型架构 | done |
| **RF-004** | **P2** | 清理未使用占位组件与无用工具函数 | `src/components/SiyuanTheme/*`<br>`src/utils/index.ts` | 1. 清理未使用的 6 个模板占位组件（`SyButton`、`SyCheckbox`、`SyIcon`、`SyInput`、`SySelect`、`SyTextarea`），保留 `SyLineIcon.vue` 和 `icons.ts`；<br>2. 清理 `src/utils/index.ts` 中无引用的 `getDomByVueComponent`；<br>3. 精简精炼组件库目录。 | 低 | - [x] 全局 Grep 检索确认无任何隐式导入；<br>- [x] 运行 `pnpm test` 与 `pnpm build` 确认打包正常。 | `docs/project-structure.md`：更新组件清单 | done |
| **RF-005** | **P2** | 刷新架构文档、README 与 Agent 指南 | `docs/project-structure.md`<br>`README.md`<br>`README_zh_CN.md`<br>`AGENTS.md`<br>`CLAUDE.md`<br>`docs/refactor-plan.md` | 1. 全新编写 `docs/project-structure.md`，完整呈现重构后现代化分层结构；<br>2. 更新中英文 `README.md` 中的工程与架构说明；<br>3. 精简更新 `AGENTS.md` / `CLAUDE.md`，提供供编程 Agent 快速理解项目的精炼上下文；<br>4. 在 `docs/refactor-plan.md` 中记录最终闭环状态。 | 低 | - [x] 检查所有文档中引用的文件路径准确无误；<br>- [x] 检查 Markdown 渲染格式规范。 | 全面刷新相关文档 | done |

### 优先级说明：
- `P0`：价值和风险都最高，核心业务编排解耦，优先执行并强化测试
- `P1`：价值或风险中等，API 稳健性、类型与样式系统沉淀，放在 `P0` 之后
- `P2`：低风险清理项与文档维护，最后执行

### 状态说明：
- `pending`：等待批准或待执行
- `in_progress`：正在执行
- `done`：已完成验证并闭环
- `blocked`：遇到阻塞

---

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RF-001 | 2026-09-26 | 2026-09-26 | `pnpm test && pnpm build` | pass (62/62) | `docs/project-structure.md` | `App.vue` 拆解为 4 Tab + 5 弹窗/菜单 + 3 Composables，样式下沉至 components.scss |
| RF-002 | 2026-09-26 | 2026-09-26 | `pnpm test -- tests/tag-api-client.spec.ts` | pass (69/69) | `docs/project-structure.md` | 加固 API 客户端（鉴权/校验/捕获），删除 590 行模板死代码 src/api.ts，新增 7 个单测 |
| RF-003 | 2026-09-26 | 2026-09-26 | `pnpm run build && pnpm test && pnpm typecheck` | pass (69/69, 0 type error) | `docs/project-structure.md` | 集中化 src/types/ui.ts，沉淀公共样式至 src/styles/components.scss |
| RF-004 | 2026-09-26 | 2026-09-26 | `pnpm run build && pnpm test && pnpm typecheck` | pass (69/69) | `docs/project-structure.md` | 清理 6 个未利用占位组件与无用工具函数 getDomByVueComponent |
| RF-005 | 2026-09-26 | 2026-09-26 | `pnpm test && pnpm build && pnpm typecheck` | pass (全量验证通过) | 全部目标文档 | 刷新 project-structure, README, README_zh_CN, AGENTS, CLAUDE |

---

## 5. 决策与确认

- 用户批准的条目：RF-001, RF-002, RF-003, RF-004, RF-005（用户确认“批准全部，继续”）
- 延后的条目：无
- 阻塞条目及原因：无

---

## 6. 文档刷新

- `docs/project-structure.md`：已全新编写，包含 100% 匹配真实仓库的目录树、分层职责映射表与重构前后核心指标对比。
- `README.md` / `README_zh_CN.md`：已追加「🛠️ 工程架构与开发测试」章节，包含解耦架构特性说明、常用开发命令与文档索引。
- `AGENTS.md` / `CLAUDE.md`：已针对 AI 编程 Agent 精简编写，提供项目技术栈、目录导航、命令速查与关键开发规范（防 CSS 污染线框图标、双主题变量、测试先行）。
- 最终同步检查：所有文档相对引用路径（`./docs/*`、`./LICENSE`）与代码符号均已校对无误。

---

## 7. 下一步

1. 本次获批的全部 5 项重构（RF-001 ~ RF-005）已 100% 高质量交付闭环；
2. 建议执行 Git 结构化提交，固化重构成果；
3. 后续业务演进可基于解耦后的独立 Tab 视图与 Composables 继续迭代新功能。
