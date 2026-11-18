# 隐式状态机全景审计与修复计划

> 审计日期：2026-11-18
> 范围：`src/` 全部 composables、services、组件（约 1.5 万行）
> 方法：全量精读核心状态文件 + 两轮全局模式扫描（状态标志/定时器/竞态防护/监听注册注销/持久化读写）交叉验证

本文档分两部分：第一部分是当前隐式状态机的完整清单与隐藏问题分析；第二部分是修复计划跟踪表。修复完成后请同步更新跟踪表状态。

---

## 一、隐式状态机清单（12 个）

| # | 状态机 | 隐式状态载体 | 位置 |
|---|--------|-------------|------|
| 1 | 弹窗编排机 | 11 个独立 `visible` 布尔 + 固定优先级 Escape 数组 | `useModalOrchestration.ts:24-142` |
| 2 | 全局 loading 机 | 单个 `loading` 布尔被 6 条异步流写入 | `useTagData.ts:26`、`App.vue:822` |
| 3 | 筛选查询机 | `querySeq` 竞态序号 + `queryLoading` 布尔 | `useTagFilter.ts:25-60` |
| 4 | 拖拽重构机 | `draggingTagLabel`/`dragIndicator`/`isDraggingOverScrollerBlank`/`isExecutingReparent` 5 个松散标志 | `useTreeDragDrop.ts:38-50` |
| 5 | 伴生推荐机 | `hoverTimer` 单例定时器 + Overlay `visible/activeIndex/acceptedLabels` | `TagCompanionService.ts:34-41`、`TagCompanionOverlay.ts:16-22` |
| 6 | 共现索引缓存机 | `ready/dirty/isBuilding` 三布尔 | `TagCompanionCache.ts:15-20` |
| 7 | 块定位轮询机 | setTimeout 递归重试链 + `retries` 闭包变量 | `TagNavigationService.ts:67-104` |
| 8 | 标签身份迁移协议 | 重命名需手动同步 6 处状态（metadataMap/customTags/tagGroups/savedViews/activeFilter/CSS） | `useTagData.ts:388-479`、`App.vue:737-773` |
| 9 | Esc 传播协议 | 捕获/冒泡阶段混用：companion 捕获拦截、内联输入只 `.prevent` 不 `.stop` | `TagCompanionService.ts:205-210`、`TagTreeView.vue:326` |
| 10 | 弹窗执行标志机 | `executing` 分散在 batch/merge/rename 三个弹窗 state 内 | `types/ui.ts` + `App.vue` |
| 11 | KeepAlive 页签机 | `currentTab` + `graphData.nodes.length>0` 作为"已加载"判据 | `App.vue:420,432,859` |
| 12 | 插件宿主生命周期机 | onload/onunload + dock init/destroy + 3 个 body 级单例（浮条/独立弹窗/tooltip） | `index.ts`、`main.ts`、`tooltip.ts` |

**已做对的部分**（保持不回退）：

- `runQuery`/`useDocSelection` 的 seq 竞态防护；
- `TagConfigStore` 读-合并-写语义；
- 全部 5 组事件监听注册/注销严格成对（eventBus×4、TagDropService×4、TagCompanionService×9、App×2、standalone modal×1）。

---

## 二、隐藏问题

### P0 — 确定性 Bug

- **P0-1 queryLoading 卡死**（`useTagFilter.ts:29-36`）：空筛选分支在 `++querySeq` 之后提前 return，使所有在途查询的 seq 失效；失效查询的 finally 因 seq 不匹配不会复位 `queryLoading`，标志永久卡在 true，「检索中...」转圈不停。
- **P0-2 树内局部对话框不在 Escape 链中**（`App.vue:340` + `useModalOrchestration.ts:144-154`）：`reparentConfirmState`/`cascadeRenameConfirmState` 是 TagTreeView 局部状态，不在 escapeClosers 中；按 Esc 落入 `onEscapeFallback` → 折叠整个 Dock 面板而非关闭对话框，重开面板后对话框仍停留打开态。同理，内联重命名/筛选搜索输入框 `@keydown.esc` 只 prevent 不 stop，冒泡到 window 同样触发面板折叠。
- **P0-3 伴生索引 dirty 标志永远不被消费**（`TagCompanionCache.ts:157-177` + `index.ts:228`）：双重缺陷——(a) `ensureIndexLoaded` 仅在 `isReady()===false` 时被调用，markDirty 后 ready 仍为 true，dirty 标志在首次构建后永远无人消费，推荐结果整个会话期陈旧；(b) markDirty 只挂在 onDataChanged（插件配置变更），批量打标/伴生采纳/拖拽打标等正文变更不触发失效；(c) `buildIndex` 无条件置 dirty=false，构建期间到达的 markDirty 会被在途构建错误清零。
- **P0-4 自动规范化/合并/一键修复绕过身份迁移协议**（`App.vue:808-818, 678-703`、`useTagHygiene.ts:14-41`）：`handleAutoNormalizeTag` 直接调内核 renameTag 后只 refreshAllData，`handleRenameTag` 建立的五步迁移（metadataMap/customTags/tagGroups/savedViews/activeFilter）一步未执行——旧标签样式/别名/图标、标签组引用、智能视图条件全部指向已不存在的旧名，刷新后静默丢失。三条重命名入口只有一条遵守协议。

### P1 — 竞态与假状态机

- **P1-1 假异步守卫**（`useTreeDragDrop.ts:250-267`、`useInlineRename.ts:94-100`）：`onBatchReparent`/`onRenameTag` 未 await，`isExecutingReparent`/`isSubmittingRename` 在同步帧内复位——防重入守卫实际只覆盖同 tick，确认框在异步工作仍在飞行时就关闭。
- **P1-2 推荐气泡可从已关闭状态复活**（`TagCompanionService.ts:503-534`）：`triggerRecommendation` 在 `await ensureIndexLoaded` 期间所有前置条件（原生提示激活、enabled、用户已 hide）都可能变化，await 后未复验就无条件 show。
- **P1-3 跳转轮询链无取消令牌**（`TagNavigationService.ts:77-104`）：快速连续跳块时旧链把视口拉回上一个块。同类：`useTreeDragDrop.ts:66` 的 setTimeout(0) 若在 dragend 清理后触发，`draggingTagLabel` 残留幽灵拖拽态。
- **P1-4 伴生采纳失败被静默吞掉**（`TagCompanionService.ts:575-608`）：`applyTagToBlockEnd` 返回 boolean 被忽略；块级打标失败无 toast 但 markAccepted 已提前执行、advance 照常推进；连续快速点两个 chip 并发采纳导致 activeIndex 双重推进。
- **P1-5 共享 loading 布尔无引用计数**（`useTagData.ts:26` + `App.vue:822`）：`refreshAllData` 三段各自置位/复位，按钮转圈闪烁；重叠操作先结束者提前复位。`refreshTags` 无 seq 防护，并发刷新后写胜出。
- **P1-6 批量打标防并发缺失**（`App.vue:705-720` + `TagBatchService.ts:116-141`）：批量执行中经 bridge 重开弹窗会把 `executing` 重置为 false，可触发并发二次执行。
- **P1-7 独立批量弹窗成功后无状态同步**（`index.ts:174-181`）：未传 `onSuccess`，打标成功后 Dock 内面板计数、healthResult、伴生索引全部陈旧。
- **P1-8 扫描失败显示成功态**（`TagRefPromotePanel.vue:166-167`）：`scanned=true` 在 await 前置位，扫描抛错后落入「全库检查完成」空成功分支。

### P2 — 设计缺陷与残留

- **P2-1** Escape 关闭可打断执行中的弹窗（`useModalOrchestration.ts:138-139` 无 executing 守卫）。
- **P2-2** `TagConfigStore.updateConfig` 读-合并-写无串行化，两个并发写者可丢失更新。
- **P2-3** `TagFilterView.vue:448-449` resize 的 window mousemove/mouseup 无 onUnmounted 清理。
- **P2-4** `tooltip.ts:29` 全局气泡 div 插入 body 后插件卸载永不回收。
- **P2-5** `allCollapsed` 与逐节点折叠手动操作不同步（`TagTreeView.vue:880-891`）。
- **P2-6** 批量弹窗重开残留上次搜索状态（`useDocSelection` open-watch 不清理 `docSearchKeyword/searchDocResults/searched`）。
- **P2-7** `confirmDialog` 经模板 `@close` 关闭时残留 `onConfirm` 回调（`App.vue:240`）。
- **P2-8** 两个 hover 触发源共享单个 `hoverTimer` 互相清除（`TagCompanionService.ts:290,332`）。
- **P2-9** `TagTreeService.lastScrollTop` 命名为"持久化"实为内存态（记录在案，暂不改动行为）。

---

## 三、修复计划跟踪表

> 状态取值：`待修复` / `已修复` / `跳过（原因）`
> 修复完成日期：2026-11-18；全部修复已通过 353 项单元测试（32 个用例文件）、`pnpm typecheck`、`pnpm build` 与 `npx eslint src tests` 全绿验证。

| 编号 | 问题 | 修复方案 | 状态 | 提交 |
|------|------|---------|------|------|
| P0-1 | queryLoading 卡死 | 空筛选分支复用 seq 协议并复位 loading | 已修复 | `81a598f` |
| P0-2 | Escape 链缺树内对话框/输入框冒泡 | escapeClosers 支持外部注册（registerEscapeCloser）+ 执行中弹窗 canClose 守卫 + 输入框 .stop | 已修复 | `007100d` |
| P0-3 | 伴生索引失效闭环断裂 | triggerRecommendation 消费 dirty + 打标操作统一 markDirty + dirtyGeneration 防构建误清 | 已修复 | `5364a98` |
| P0-4 | 身份迁移协议分叉 | 提取 migrateTagReferences，normalize/merge/autoResolve 全部走同一入口并持久化 | 已修复 | `0414046` |
| P1-1 | 假异步守卫 | onBatchReparent/onRenameTag 改为可 await 契约；TagTreeView 注入 reparentExecutor/renameExecutor（Vue emit 不回传 Promise，已实测确认） | 已修复 | `ae2ecc8` |
| P1-2 | 气泡复活竞态 | triggerRecommendation 加 triggerSeq 令牌 + await 后复验条件，hide() 作废在途触发 | 已修复 | `5364a98` |
| P1-3 | 轮询链无取消 | centerBlockInView 加静态 jumpSeq 取消令牌；startTagDrag 加 dragSession 会话哨兵 | 已修复 | `e06fe00` |
| P1-4 | 采纳静默失败 | 检查块级写入返回值/失败回滚 markAccepted 且不推进指针/isAccepting 串行化 | 已修复 | `5364a98` |
| P1-5 | 共享 loading | 改 loadingDepth 引用计数 + computed；refreshTags 加 refreshSeq 竞态防护 | 已修复 | `114fdfe` |
| P1-6 | 批量防并发缺失 | executeBatchTagging 服务级串行守卫 | 已修复 | `445fa88` |
| P1-7 | 独立弹窗状态同步 | notifyTagDataChanged 全局事件，Dock 内 App 监听刷新 | 已修复 | `445fa88` |
| P1-8 | 扫描失败显示成功 | scanned 成功后才置位 | 已修复 | `58e060b` |
| P2-1 | Esc 打断执行中弹窗 | 并入 P0-2（canClose 守卫） | 已修复 | `007100d` |
| P2-2 | 配置写入竞态 | updateConfig 串行化写入队列，队尾吸收失败 | 已修复 | `7d2c982` |
| P2-3 | resize 监听泄漏 | 清理句柄 + onUnmounted 强制回收 | 已修复 | `7d2c982` |
| P2-4 | tooltip DOM 泄漏 | destroyTooltip() + onunload 调用 | 已修复 | `7d2c982` |
| P2-5 | allCollapsed 失同步 | toggleNodeCollapse 后按折叠集重算 | 已修复 | `7d2c982` |
| P2-6 | 批量弹窗残留状态 | open-watch 清理搜索关键词/结果/完成标记 | 已修复 | `7d2c982` |
| P2-7 | confirmDialog 回调残留 | @close 改用 closeConfirmDialog | 已修复 | `007100d` |
| P2-8 | hoverTimer 串源 | 悬浮/光标停留定时器分离存储，mouseout/hide 统一回收 | 已修复 | `5364a98` |
| P2-9 | 滚动位置内存态 | 跳过（现状行为可接受，避免无谓改动） | 跳过 | — |

### 修复提交清单（时序）

```
81a598f fix(filter): 修复清空筛选打断在途查询时 queryLoading 永久卡死
007100d fix(escape): 统一 Escape 关闭架构，树内对话框与执行中弹窗纳入关闭链
5364a98 fix(companion): 打通共现索引失效闭环并修复推荐气泡竞态与采纳静默失败
0414046 fix(migration): 统一标签身份迁移协议，规范化/合并/一键修复不再绕过
ae2ecc8 fix(async): 拖拽重构与行内重命名假异步守卫改为真实 await
114fdfe fix(async): 全局 loading 改引用计数并给 refreshTags 加竞态防护
e06fe00 fix(nav): 块定位轮询链加取消令牌并消除拖拽幽灵态残留
445fa88 fix(batch): 批量打标串行防重入并同步独立弹窗执行结果到 Dock 工作台
58e060b fix(ref-promote): 扫描失败不再误显示为空成功态
7d2c982 fix(hygiene): 清理配置写入竞态与生命周期残留
9a22ecc / 5a08870 / b4b724d / d9796b7 style: lint 门禁基线对齐
```

### 新增测试覆盖（共 23 项新用例）

- `tests/ui-tag-filter.spec.ts`（新增文件）：seq 竞态时序 5 项（含 loading 卡死回归、迟到结果丢弃、失败复位）。
- `tests/ui-modal-orchestration.spec.ts`：动态注册项优先级/注销、canClose 吞事件、执行中弹窗保护、confirmDialog 取消语义。
- `tests/tag-companion.spec.ts`：dirty 消费闭环、构建期脏标记保护、采纳失败回滚、并发串行化。
- `tests/ui-composables.spec.ts`：迁移合并语义与去重级联、并发刷新丢弃与忙碌计数。
- `tests/ui-tree-composables.spec.ts`：挂起期守卫/重复触发忽略/失败不展开祖先链、拖拽幽灵态不复活。
- `tests/tag-navigation.spec.ts`：旧轮询链作废。
- `tests/tag-batch.spec.ts`：并发重入拒绝、空参快速拒绝。
- `tests/ui-ref-promote-panel.spec.ts`：扫描成功/失败状态。
- `tests/tag-config-store.spec.ts`：并发写入串行化、失败不阻塞。
- `tests/ui-doc-selection.spec.ts`：弹窗重开清理搜索态。

---

## 四、中期重构方向（本次不实施，记录备查）

1. 引入 `useAsyncTask` 原语（seq + 引用计数 busy + error 枚举）统一替换散落的 try/finally 布尔模式——本次修复已在 `useTagData`（loadingDepth）与 `runQuery`（seq）落地局部实现，可后续抽为通用原语。
2. 弹窗编排升级为带 z 序的显式对话框仓库（11 个弹窗 + 2 个树内对话框共用）——本次 `registerEscapeCloser` 动态注册机制已是雏形。
3. App.vue 的「内核操作 → 本地状态迁移 → 持久化 → refreshAllData」链条下沉为 `TagWorkbenchOrchestrator`——本次 `migrateTagReferences` 统一迁移函数是第一步。
4. 测试补强方向：异步竞态时序用例、身份迁移完整性快照、缓存失效闭环用例——本次已补 23 项回归用例（见第三节清单）。

---

## 五、实施过程中的关键决策记录

1. **Vue emit 不回传 Promise**（经实测 Vue 3.5.41 runtime-core 确认：`emit` 调用 handler 的返回值被丢弃），因此假异步守卫修复采用与 `getTagStyle` 一致的**函数 prop 注入执行器**模式（`reparentExecutor`/`renameExecutor`），emit 保留为未注入时的回退通道。
2. **Escape 关闭链采用「动态注册项」而非完整对话框仓库重构**：`registerEscapeCloser` 让各 Tab 内部局部可关闭面（树内确认框、行内编辑态）以最小侵入挂入统一链条，为未来的对话框仓库留出接口。
3. **伴生索引重建不设冷却期**：`markDirty` 后的下一次触发即重建。若大库场景出现频繁重建的性能问题，可在 `ensureIndexLoaded` 增加 `lastBuiltTime` 冷却窗口，属于单点增强。
4. **`migrateTagReferences` 的合并语义**：目标元数据已存在时保留目标样式字段并合并别名集合（源字段仅在目标缺失时并入），标签组/自定义标签全程大小写不敏感去重，防止合并产生重复引用。
