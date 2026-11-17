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

| 编号 | 问题 | 修复方案 | 状态 | 提交 |
|------|------|---------|------|------|
| P0-1 | queryLoading 卡死 | 空筛选分支复用 seq 协议并复位 loading | 待修复 | — |
| P0-2 | Escape 链缺树内对话框/输入框冒泡 | escapeClosers 支持外部注册 + executing 守卫 + 输入框 .stop | 待修复 | — |
| P0-3 | 伴生索引失效闭环断裂 | triggerRecommendation 消费 dirty + 打标操作统一 markDirty + 构建序号防误清 | 待修复 | — |
| P0-4 | 身份迁移协议分叉 | 提取 migrateTagReferences，normalize/merge/autoResolve 全部走同一入口 | 待修复 | — |
| P1-1 | 假异步守卫 | onBatchReparent/onRenameTag 改为可 await 契约 | 待修复 | — |
| P1-2 | 气泡复活竞态 | triggerRecommendation 加 seq 令牌 + await 后复验条件 | 待修复 | — |
| P1-3 | 轮询链无取消 | centerBlockInView 加静态 seq 取消令牌；startTagDrag 加会话哨兵 | 待修复 | — |
| P1-4 | 采纳静默失败 | 检查返回值/失败回滚 markAccepted/串行化 isAccepting | 待修复 | — |
| P1-5 | 共享 loading | 改引用计数 busy + refreshTags 加 seq | 待修复 | — |
| P1-6 | 批量防并发缺失 | executeBatchTagging 服务级串行守卫 + App 入口守卫 | 待修复 | — |
| P1-7 | 独立弹窗状态同步 | onSuccess 派发全局事件，Dock 内 App 监听刷新 | 待修复 | — |
| P1-8 | 扫描失败显示成功 | scanned 成功后才置位 | 待修复 | — |
| P2-1 | Esc 打断执行中弹窗 | 并入 P0-2（canClose 守卫） | 待修复 | — |
| P2-2 | 配置写入竞态 | updateConfig 串行化队列 | 待修复 | — |
| P2-3 | resize 监听泄漏 | onUnmounted 清理 | 待修复 | — |
| P2-4 | tooltip DOM 泄漏 | destroyTooltip() + onunload 调用 | 待修复 | — |
| P2-5 | allCollapsed 失同步 | toggleNodeCollapse 后重算 | 待修复 | — |
| P2-6 | 批量弹窗残留状态 | open-watch 清理搜索态 | 待修复 | — |
| P2-7 | confirmDialog 回调残留 | @close 改用 closeConfirmDialog | 待修复 | — |
| P2-8 | hoverTimer 串源 | cursor-idle 独立定时器 | 待修复 | — |
| P2-9 | 滚动位置内存态 | 跳过（现状行为可接受，避免无谓改动） | 跳过 | — |

---

## 四、中期重构方向（本次不实施，记录备查）

1. 引入 `useAsyncTask` 原语（seq + 引用计数 busy + error 枚举）统一替换散落的 try/finally 布尔模式。
2. 弹窗编排升级为带 z 序的显式对话框仓库（11 个弹窗 + 2 个树内对话框共用）。
3. App.vue 的「内核操作 → 本地状态迁移 → 持久化 → refreshAllData」链条下沉为 `TagWorkbenchOrchestrator`。
4. 测试补强方向：异步竞态时序用例、身份迁移完整性快照、缓存失效闭环用例。
