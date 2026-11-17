# 重构计划 (Refactor Plan) · 第二轮

> 第一轮计划（2026-09-26，RF-001~005：App.vue 巨石拆分、API 客户端加固、类型与样式沉淀、死代码清理、文档刷新）已全部闭环，历史版本见 Git 提交记录。

## 1. 项目快照

- 生成日期：2026-11-17
- 范围：`siyuan-tag-manager` 仓库全量代码（重点为自首轮重构后新增的伴生标签/拖拽打标/标签组/引用升格等功能带来的服务层重复与 UI 编排膨胀）
- 目标：收敛跨 11 处复制的传输与文本处理逻辑并修复 3 个已确认缺陷（配置覆盖丢失、鉴权头缺失、类型未导入）；解耦 3 个超大文件（TagTreeView 1450 行 / App.vue 984 行 / TagCompanionService 669 行）；补齐测试缺口；刷新架构文档。
- 基线证据（重构前，全绿）：
  - `pnpm test`：23 个文件 / 240 个用例全部通过
  - `pnpm typecheck`：0 错误
  - `pnpm build`：成功（产物 dist/ + package.zip）
- 文档刷新目标：`docs/project-structure.md`、`README.md`

## 2. 架构与模块分析

### 2.1 模块概览

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 传输与查询层 | `src/services/TagApiClient.ts` (312) | 内核 HTTP 客户端 + SQL 拼装 + 共现图谱/筛选查询编排 | **层级倒置**：反向依赖 FilterEngine/Cooccurrence；`fetchCooccurrenceGraph`/`queryMatchedBlocks` 属领域编排混入客户端（仅 4 个调用点，易迁出） | tag-api-client.spec（9 用例） |
| 各业务服务 ×11 处 fetch 拷贝 | Batch(×5)/RefPromote(×3)/Group(×2)/Creation(×1)/DocConverter(×1) | 各自内联 `requestFn \|\| fetch` 封装 | 与 `TagApiClient.request` 重复；其中 **Batch.batchTagDocuments 与 DocConverter.createDocFromTag 漏 Authorization 头**（已亲自验证源码），配置了访问鉴权码的环境下会 401 | 各服务 spec 均有，但未覆盖鉴权头断言 |
| 标签文本处理 | DomDecorator/Deletion×3/Group/BlockAppender×2/Creation/Drop 等 | `#` 剥离正则 8 处、IAL tags 解析 5 处、内联 SQL 转义 8 处 | 规范实现已存在（Governance.normalizeLabel、FilterEngine.escapeSql、Creation.cleanTag）但未复用，正则各自漂移 | 行为被既有 240 用例隐式锁定，无专项边界用例 |
| 配置持久化 | `useTagData.persistConfig` / `useTagFilter.saveSmartView` / `index.ts` | 写 `tag-manager-config.json` | **数据丢失缺陷（已验证）**：`saveSmartView`（useTagFilter.ts:149）仅写 `{metadataList, savedViews}` 两字段，整文件覆盖丢掉 tagGroups/customTags/customColorPresets/companionConfig/tagDeleteConfig；文件名常量在 3 处硬编码 | ui-composables.spec 未覆盖保存场景字段完整性 |
| UI 全景树 | `src/components/tabs/TagTreeView.vue` (1450) | 5 个领域混杂：行内重命名(~100 行)、滚动持久化(~75)、拖拽层级重构(~210)、热力词云(~135)、折叠可见性；模板含 162 行树节点块 | 单文件 5 领域；`handleDragStart`/`handleCloudDragStart` 内部重复；🥇🥈🥉 emoji（588 行）违反图标守则；451 行裸 hex `#f43f5e` 违反双主题守则 | ui-components.spec 约 10 用例（SSR 渲染冒烟 + setup 逻辑） |
| UI 编排 | `src/App.vue` (984) | 8 个弹窗状态 + ~350 行编排 handler + Escape 7 连 if | 上帝组件；`executeBatchTag` 与 `utils/batchTagModalManager.onExecute` 是同一套批量执行逻辑的复制粘贴（两条并行链路）；`#4285F4` 魔法色 ×4；**570 行使用 `IColorPreset` 未 import**（已验证，tsc 不覆盖 .vue 故未报错） | ui-components.spec 仅 Tab 文案断言 |
| 伴生推荐 | `src/services/TagCompanionService.ts` (669) | 全局调度器：8 个事件监听 + 打字态检测 + Vue 气泡挂载 + 推荐编排 + 采纳写回 | service 内嵌 `createApp` 挂载 Vue 组件（服务↔视图耦合）；`resolveTarget` 与 `TagDropService.resolveDocTarget` 重复 DOM 解析；`bindGlobalListeners` ~166 行超长函数 | tag-companion.spec 合并覆盖（各 4 用例，浅） |
| 健康治理 UI | `src/components/tabs/TagHygieneView.vue` (661) | 分类过滤 + 引用诊断 + 批量采纳 | 引用诊断区 101 行模板可整体拆子组件；`promoteSingle`/`promoteSelected` ~80% 相同；231 行 `➔` 箭头字符 | ui-components.spec 渲染冒烟 |
| 批量打标 UI | `src/components/dialogs/TagBatchModal.vue` (817) | 文档选取(~200 行完整子域) + 标签 chip + 执行 | `handleExecute` 直接改 prop（`props.state.docIdsText = ...`，510-512 行）反模式；tooltip 指令 0 使用（原生 title，不一致） | ui-components.spec + batch-tag-modal.spec |
| 测试基建 | `tests/`（24 spec） | 服务层覆盖完整；UI 层为 SSR 类名回归式冒烟 | 无 setupFiles/共享 helper：tooltip 指令桩在 ui-components.spec 逐用例重复手写；3 个弹窗组件（CompanionModal/CompanionBar/SettingsModal）零覆盖；useTagHygiene 无行为测试 | — |
| 样式系统 | `src/styles/components.scss` (3058) | 全部工作台样式 | 体量大但为组件零 scoped 样式的既定架构，本轮不动，仅在新增组件时遵循 | — |

### 2.2 已确认缺陷清单（重构即修复）

1. **配置覆盖丢失**：`useTagFilter.ts:149` `saveSmartView` 整文件覆盖配置，丢 5 类数据。
2. **鉴权头缺失**：`TagBatchService.ts:72`（batchTagDocuments）与 `TagDocConverterService.ts:52`（createDocFromTag）的 fetch 封装无 Authorization 头，同文件其他封装均有。
3. **类型未导入**：`App.vue:570` 使用 `IColorPreset` 无 import（tsc 不检查 .vue，属潜伏错误）。

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-101 | P0 | 统一标签文本工具（去重即防 bug） | 新建 `src/utils/tagText.ts`；`TagDomDecorator/TagDeletionService/TagGroupService/TagBlockAppender/TagCreationService/TagDropService` | 收敛 8 处 `#` 剥离为 `stripTagHash`、5 处 IAL 解析为 `parseIalTags`、SQL 转义统一走规范实现；`TagCreationService.cleanTag` 保留原 API 改为委托；TagDropService 两处语义不同正则逐一核对后决定合并或保留（以测试锁定行为） | 中 | - [x] 新增 `tests/tag-text.spec.ts`（19 用例：边界/一致性）；- [x] 全量既有测试通过（行为锁） | project-structure：utils 层新增文件说明 | done |
| RF-102 | P0 | 修复配置覆盖丢失数据缺陷 | `useTagFilter.ts`、`useTagData.ts`、`index.ts`；新建 `src/services/TagConfigStore.ts` | 抽 `TagConfigStore`：集中 `tag-manager-config.json` 常量 + `updateConfig(partial)` 读-合并-写语义；`saveSmartView` 改为合并写入保留其他字段；`persistConfig` 委托同源；两 composable 各自状态结构不变 | 高（触及持久化） | - [x] 新增 `tests/tag-config-store.spec.ts`（9 用例，含数据丢失缺陷集成回归）；- [x] persistConfig 全量写入字段与现状一致；- [x] 首次无配置文件时可写入 | project-structure：服务层新增 TagConfigStore；README：无用户可见变化 | done |
| RF-103 | P0 | 传输层收敛与鉴权修复 | `TagApiClient.ts`、`TagBatchService.ts`、`TagRefPromoteService.ts`、`TagGroupService.ts`、`TagCreationService.ts`、`TagDocConverterService.ts` | 1) TagApiClient 暴露通用 `request(path, data)`（鉴权+错误规范化）；2) 删除 5 服务共 11 份 fetch 拷贝改用之（保留 `requestFn` 注入参数兼容测试）；3) 修复 batchTagDocuments/createDocFromTag 缺 Authorization 缺陷；4) 迁出反向依赖：`fetchCooccurrenceGraph`→CooccurrenceService、`queryMatchedBlocks`→FilterEngine（均以传输函数注入，不引 ApiClient），更新 4 个调用点 | 高（触及网络层） | - [x] 新增 `tests/tag-transport.spec.ts`（7 用例：鉴权头缺陷回归/postRaw 信封契约/迁移方法行为锁）；- [x] 各服务既有 spec 全通过（requestFn 注入路径行为锁）；- [x] tag-api-client.spec 全通过（3 个用例随方法迁移入口，断言不变） | project-structure：服务职责表更新 | done |
| RF-104 | P1 | TagTreeView 解耦与守则修复 | `TagTreeView.vue`；新建 `useTreeDragDrop.ts`、`useInlineRename.ts`、`useScrollPersistence.ts`、`useHeatVisualization.ts`（composables/） | 抽 4 个 composable（拖拽 210 行/重命名 130 行/滚动 75 行/热力 135 行）；合并 `handleDragStart`/`handleCloudDragStart` 重复；🥇🥈🥉 改用既有 is-top-N class 或 SyLineIcon；裸 `#f43f5e` 改 `--tm-*` 语义变量；模板结构不动（保 SSR 断言） | 中 | - [x] ui-components.spec TagTreeView 全部用例通过；- [x] 新增 `tests/ui-tree-composables.spec.ts`（20 用例：重命名校验分支/热力分级/拖拽落位/滚动持久化）；- [x] grep 确认无 emoji/裸 hex 残留 | project-structure：composables 清单更新 | done |
| RF-105 | P1 | App.vue 编排解耦 | `App.vue`、`utils/batchTagModalManager.ts`；新建 `useModalOrchestration.ts`（composables/） | 1) 批量执行逻辑去重：App.executeBatchTag 与 batchTagModalManager.onExecute 收敛为单一实现（校验+调用+文案一致）；2) 抽 8 个弹窗 ref 与 Escape 关闭链为 `useModalOrchestration`（不动各 handler 业务体）；3) `#4285F4` 提为共享默认组色常量；4) 补 `IColorPreset` import | 中 | - [x] 新增 `tests/ui-modal-orchestration.spec.ts`（6 用例：Escape 优先级/回退/定位翻转/初始态）；- [x] 新增 executeBatchTagging 4 用例（tag-transport.spec）；- [x] batch-tag-modal.spec 全通过；- [x] ui-components.spec App.vue 用例通过；- [x] typecheck 通过（IColorPreset 已导入） | project-structure：composables 清单；README：无用户可见变化 | done |
| RF-106 | P1 | TagCompanionService 拆分 | `TagCompanionService.ts`、`TagDropService.ts`；新建 `TagCompanionOverlay.ts`（services/）、共享 DOM 目标解析模块 | 1) Vue 挂载/气泡定位/chip 注入抽为 `TagCompanionOverlay`（主服务保留事件检测与调度）；2) `resolveTarget` 与 `TagDropService.resolveDocTarget` 重复解析合并为共享模块；3) `bindGlobalListeners` 拆小（拆分后 init/destroy 清理对称性以测试锁定） | 中高（全局事件与内存管理） | - [x] 新增 `tests/tag-companion-overlay.spec.ts`（6 用例：浮条状态机/生命周期对称性/空目标防御）；- [x] tag-companion.spec 全通过；- [x] tag-drop.spec 全通过；- [x] 块级解析复用 TagDropService.resolveBlockTarget（既有 tag-drop 用例为行为锁） | project-structure：伴生子系统结构图更新 | done |
| RF-107 | P2 | TagHygieneView 局部治理 | `TagHygieneView.vue`；新建 `TagRefPromotePanel.vue`（dialogs/ 或 tabs/ 子组件） | 引用诊断区（143-243 行模板 + ~110 行脚本）拆为自包含子组件；`promoteSingle`/`promoteSelected` 合并为单实现；`➔` 字符替换为 SyLineIcon 箭头 | 低 | - [x] 新增 `tests/ui-ref-promote-panel.spec.ts`（6 用例：SSR 契约/父级集成/promote 统一分支 单个·批量·空选·失败保留）；- [x] ui-components.spec TagHygieneView 用例通过 | project-structure：组件清单 | done |
| RF-108 | P2 | TagBatchModal 文档选取抽离与 props 突变修复 | `TagBatchModal.vue`；新建 `useDocSelection.ts`（composables/）；`App.vue`、`utils/batchTagModalManager.ts`（宿主适配） | 抽 ~200 行文档选取子域为 `useDocSelection`；消除 `props.state.docIdsText` 直接突变改为 emit 通知宿主；tooltip 用法对齐 `v-tooltip` 指令 | 中 | - [x] 新增 `tests/ui-doc-selection.spec.ts`（10 用例：回填/互逆切换/子文档排除去重/手动合并/回传补丁/搜索与笔记本委托）；- [x] ui-components.spec TagBatchModal 用例通过；- [x] batch-tag-modal.spec 全通过；- [x] props 突变清零（grep 验证） | project-structure：composables 清单 | done |
| RF-109 | P2 | 测试基建去重 | 新建 `tests/helpers/`（tooltip 指令桩、SSR 渲染 helper、confirm 桩） | 抽 ui-components.spec 逐用例重复的 `app.directive('tooltip', {})` 样板与 SSR 渲染包装为共享 helper；可选：补齐 vitest test 配置段（setupFiles） | 低 | - [x] 全量测试通过（重构为纯等价搬移）；- [x] helper 覆盖全部 2 个 SSR spec 文件共 11 处调用点（全库仅 2 个 spec 使用 SSR，验收口径由"3 处 spec"按实际情况调整为"全覆盖"） | project-structure：tests 目录说明 | done |
| RF-110 | P2 | 刷新架构文档（强制收尾） | `docs/project-structure.md`、`README.md`、本计划 | project-structure 反映最新目录树/职责映射/新增模块；README 反映最新工程结构与命令；回写本计划状态 | 低 | - [x] 文档中 14 个引用路径与真实仓库逐一校对存在；- [x] 全量验证全绿 | 全部目标文档 | done |

优先级说明：
- `P0`：已确认缺陷或全库最高杠杆去重（RF-101/102/103），优先执行并强化测试
- `P1`：高价值结构解耦（RF-104/105/106），放在 P0 之后
- `P2`：局部治理、测试基建与文档收尾（RF-107~110）

状态说明：`pending` / `in_progress` / `done` / `blocked`

### 行为不变式（全部条目共同遵守）

1. 全量既有测试（240 用例）在每项完成后必须全绿，不允许"改测试迁就实现"（新增边界用例除外）。
2. `requestFn` 注入参数与各服务公开静态方法签名保持兼容，除非该条目明确列出调用点更新。
3. UI 类名、DOM 结构、`--tm-*` 变量语义不变（SSR 断言依赖）；图标统一 `SyLineIcon`，禁 emoji/裸 svg。
4. 配置文件 `tag-manager-config.json` 的字段集合只增不减。
5. 插件 `init/destroy` 生命周期对称：全局监听、定时器、DOM、Vue 应用实例必须可清理。

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-101 | 2026-11-17 | 2026-11-17 | `pnpm test`（259/259）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | 新建 `utils/tagText.ts`（stripTagHash/parseIalTags/escapeSqlLiteral），17 处调用点收敛（含 4 处拖拽 payload 变体——payload 由本插件生成为 `#标签# `，核对后安全合并）；额外修复正则漂移潜伏缺陷：TagBlockAppender/TagDeletionService×3/TagGroupModal×2 原为"先剥后 trim"，对 ` #a# ` 带空格输入剥离失败，统一为 trim-strip-trim 语义；TagFilterEngine.escapeSql 引号部分委托 escapeSqlLiteral；RefPromote 无 tags 属性时不再以整段 IAL 兜底传入 parseDocTags（原会产生垃圾排除项，行为等价修复） |
| RF-102 | 2026-11-17 | 2026-11-17 | `pnpm test`（268/268）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | 新建 `services/TagConfigStore.ts`（TAG_MANAGER_CONFIG_STORAGE 常量 + readConfig/updateConfig 读-合并-写）；修复 `saveSmartView` 整文件覆盖丢 5 类配置的数据丢失缺陷；`useTagData.persistConfig/refreshTags` 委托同源并移除多余 usePlugin 依赖；`index.ts` 常量改引 TagConfigStore 导出（其自身写入本就是读-合并-写，逻辑未动） |
| RF-103 | 2026-11-17 | 2026-11-17 | `pnpm test`（275/275）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | TagApiClient 新增公开 `postRaw`（信封传输，与 requestFn 注入契约一致）并使 `request` 公有化（postRaw 之上的规范化封装）；11 份 fetch 拷贝收敛为 `TagApiClient.postRaw` 默认传输（getSubDocs 保留 SSR 守卫），2 处缺 Authorization 头缺陷随之修复；`queryMatchedBlocks`/`IQueryBlockOptions` 迁入 TagFilterEngine、`fetchCooccurrenceGraph` 迁入 TagCooccurrenceService（传输函数必选注入，消除 ApiClient→领域服务反向依赖与循环导入风险），4 个调用点与 5 个测试用例随迁（断言不变）；ApiClient 残留的 FilterEngine 依赖仅为 escapeSql 纯函数，方向健康 |
| RF-104 | 2026-11-18 | 2026-11-18 | `pnpm test`（295/295）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | TagTreeView.vue 1450 → 1012 行（-30%）；抽出 4 个 composable（useTreeDragDrop 288 行含三段指示线状态机与落位确认、useInlineRename 131 行、useHeatVisualization 129 行、useScrollPersistence 76 行，共 624 行）；`handleDragStart`/`handleCloudDragStart` 合并为统一 `startTagDrag`（模板包装函数保持调用点稳定）；守则修复：🥇🥈🥉 emoji → `#N` 文本 + is-top-N 语义变量配色（新增 SCSS 规则）、451 行裸 hex → `.tm-heat-icon` + `--tm-badge-danger-text`；生命周期钩子留在组件层注册以保持 composable 纯函数可测性 |
| RF-105 | 2026-11-18 | 2026-11-18 | `pnpm test`（306/306）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | App.vue 984 → 865 行；新建 useModalOrchestration（152 行：10 个弹窗/菜单状态 + openRowMenu 定位 + Escape 分层关闭链，关闭优先级与原实现逐项一致并补 openRowMenu 视窗守卫）；批量打标双链路去重为 `TagBatchService.executeBatchTagging`（校验/调用/文案/executing 切换统一，App 与独立弹窗宿主行为不变）；`#4285F4`×5 → `palette.DEFAULT_GROUP_COLOR`；修复 `App.vue` 使用 `IColorPreset` 未导入的潜伏类型缺陷 |
| RF-106 | 2026-11-18 | 2026-11-18 | `pnpm test`（312/312）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | 新建 TagCompanionOverlay（155 行：Vue 挂载/卸载幂等、气泡视窗避让定位、文档头 chip 注入）；TagCompanionService 669 → 625 行并回归纯调度职责（`bindGlobalListeners` 166 行拆为 7 个职责独立的 handler 构建器）；`resolveTarget` 块级解析委托既有 `TagDropService.resolveBlockTarget`（经核对两者逐行一致，无需新共享模块）；额外修复：原 mousedown 匿名监听未纳入 cleanupListeners 的泄漏缺陷，现与全部 9 个监听对称清理 |
| RF-107 | 2026-11-18 | 2026-11-18 | `pnpm test`（318/318）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | TagHygieneView 661 → 280 行（-58%）；引用诊断区整体拆为自包含 TagRefPromotePanel（430 行：模板+脚本+scoped 样式随迁）；`promoteSingleCandidate`/`promoteSelectedCandidates`（~80% 重复）合并为统一 `promoteTargets` 分支（单个/批量文案与失败保留语义逐项一致）；`➔` 字符 → SyLineIcon chevron-right（守则合规）；新增 spec 验证了 setup 直调需在父组件实例上下文执行的模式 |
| RF-108 | 2026-11-18 | 2026-11-18 | `pnpm test`（328/328）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | TagBatchModal 817 → 669 行；新建 useDocSelection（249 行：三模式选取/子文档扫描排除/目标合并去重/init watch，标签 chip 子域留在组件）；`props.state.docIdsText/tagsText/includeSubDocs` 直接突变反模式清零——改为 `sync-state` emit + 宿主 `Object.assign` 合并（App.vue 与 batchTagModalManager 双宿主适配）；5 处原生 `title=` 统一为 `v-tooltip` 指令 |
| RF-109 | 2026-11-18 | 2026-11-18 | `pnpm test`（328/328）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | 待 RF-110 统一刷新 | 新建 `tests/helpers/ssr.ts`（createTestApp + renderComponent，内置 tooltip 指令桩）；ui-ref-promote-panel.spec 全量迁移（3 处）；ui-components.spec 经一次性 codemod 迁移 8 处规范形态块（首次正则因跨用例吞噬产生重复声明，恢复备份后改用禁止跨 createSSRApp 的 tempered 正则重跑成功）；其余 16 处为多次渲染/自定义指令/wrapper 变体，保留原样避免过度耦合 |
| RF-110 | 2026-11-18 | 2026-11-18 | 路径校验（14/14 存在）+ `pnpm test`（328/328）+ `pnpm typecheck`（0 错）+ `pnpm build` | pass | project-structure.md（全量重写）、README.md 与 README_zh_CN.md（新增工程架构段）、本计划 | project-structure 全量重写：目录树对齐当前 66 个源文件 + 31 个 spec、五层职责映射、第二轮依赖治理成果（传输唯一出口/层级方向修正/文本唯一实现/配置唯一语义）、两轮指标对比表；中英 README 各新增「工程架构与开发」章节（架构一句话 + 命令 + 文档链接） |

## 5. 决策与确认

- 用户批准的条目：RF-101 ~ RF-110 全部（用户确认"批准全部"，2026-11-17）
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：已全量重写（2026-11-18）——目录树对齐当前 66 个源文件与 31 个测试文件；五层职责映射含 9 个 Composable、22 个服务模块与 4 项依赖治理成果；新增两轮重构核心指标对比表。
- `README.md` / `README_zh_CN.md`：各新增「🛠️ Development & Architecture / 工程架构与开发」章节（分层架构一句话、开发命令、文档索引）。
- 最终同步检查：`project-structure.md` 中引用的 14 个新增/变更文件路径逐一验证存在于真实仓库；全量 `pnpm test`（328/328）+ `pnpm typecheck`（0 错）+ `pnpm build` 通过。

## 7. 下一步

1. 本轮获批的全部 10 项重构（RF-101 ~ RF-110）已 100% 交付闭环：3 个已验证缺陷修复（配置覆盖丢失、2 处缺鉴权头、IColorPreset 未导入）+ 2 个潜伏缺陷顺带修复（正则漂移剥离失败、mousedown 监听泄漏）+ 全库重复逻辑收敛（17 处文本处理、11 份 fetch、5 处魔法色、双批量链路）+ 3 个超大文件解耦（TagTreeView 1450→1012、TagCompanionService 669→625+Overlay、App.vue 984→865、TagHygieneView 661→280）。
2. 测试基线由 240 → 328 用例（+88），全程每项重构以"测试先行 → 重构 → 全量绿"节奏推进，行为锁未破。
3. 建议执行 Git 结构化提交固化成果；后续演进（如 kernel.ts 与 src/index.ts 入口层测试、ui-components.spec 剩余 16 处变体样板的渐进迁移）可作为下一轮计划的候选。
