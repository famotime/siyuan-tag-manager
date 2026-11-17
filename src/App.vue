<template>
  <div class="tag-manager-container" @click="closeRowMenu">
    <!-- 顶部工作台标题栏与快捷操作 -->
    <header class="tm-header">
      <div class="tm-title-row">
        <div class="tm-brand">
          <span class="tm-brand-icon">
            <SyLineIcon name="tag" :size="16" />
          </span>
          <span class="tm-brand-title">标签管家</span>
          <span class="tm-tag-badge">{{ allTags.length }} 个标签</span>
        </div>
        <div class="tm-actions">
          <button
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'批量为文档打标'"
            @click="batchModal.visible = true"
          >
            <SyLineIcon name="layers-plus" :size="14" />
          </button>
          <button
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'伴生推荐设置'"
            @click="companionModalVisible = true"
          >
            <SyLineIcon name="sparkles" :size="14" />
          </button>
          <button
            class="tm-icon-btn tm-btn-sm"
            :disabled="loading"
            v-tooltip="'刷新全库标签数据'"
            @click="refreshAllData"
          >
            <SyLineIcon name="refresh-cw" :size="14" :spin="loading" />
          </button>
          <button
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'标签管家偏好设置'"
            @click="openPluginSettings"
          >
            <SyLineIcon name="settings" :size="14" />
          </button>
          <button
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'折叠标签管家侧栏'"
            @click="closePanel"
          >
            <SyLineIcon name="close" :size="14" />
          </button>
        </div>
      </div>

      <!-- 选项卡导航 (统一显式线框图标) -->
      <nav class="tm-nav-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tm-nav-tab"
          :class="{ active: currentTab === tab.id }"
          @click="switchTab(tab.id)"
        >
          <SyLineIcon :name="tab.iconName" :size="14" />
          <span class="tm-tab-name">{{ tab.name }}</span>
          <span v-if="tab.badge !== undefined && tab.badge > 0" class="tm-tab-badge">
            {{ tab.badge }}
          </span>
        </button>
      </nav>
    </header>

    <!-- 主体内容区域 -->
    <main class="tm-body">
      <KeepAlive>
        <!-- TAB 1: 标签全景资产树 -->
        <TagTreeView
          v-if="currentTab === 'tree'"
          :all-tags="allTags"
          :loading="loading"
          :selected-tags="activeFilter.includeTags"
          :tag-groups="tagGroups"
          :get-tag-style="getTagStyle"
          :get-tag-icon="getTagIcon"
          :register-escape-closer="registerEscapeCloser"
          @tag-click="onTagClick"
          @quick-filter="onQuickFilter"
          @clear-selected="clearFilterTags"
          @switch-to-filter="switchTab('filter')"
          @open-menu="openRowMenu"
          @open-create-group="openCreateGroupDialog"
          @open-edit-group="openEditGroupDialog"
          @delete-group="handleDeleteGroup"
          @apply-group="handleApplyGroup"
          @create-tag="handleCreateTag"
          @edit-style="openStyleDialog"
          @remove-tag="handleTreeRemoveTag"
          @batch-reparent="applyReparentMoves"
          @rename-tag="onTreeRenameTag"
        />

        <!-- TAB 2: 多维交叉筛选与即时卡片流 -->
        <TagFilterView
          v-else-if="currentTab === 'filter'"
          v-model:selected-smart-view-id="selectedSmartViewId"
          :all-tags="allTags"
          :active-filter="activeFilter"
          :matched-blocks="matchedBlocks"
          :query-loading="queryLoading"
          :saved-views="savedViews"
          @apply-smart-view="applySmartView"
          @open-save-view="openSaveViewDialog"
          @clear-filter="clearFilterTags"
          @switch-filter-mode="switchFilterMode"
          @toggle-condition="toggleTagCondition"
          @cycle-condition="cycleTagCondition"
          @remove-tag="removeFilterTag"
          @toggle-tag="toggleTagFilter"
          @jump-block="jumpToBlock"
        />

        <!-- TAB 3: 关联洞察与生命周期分析 -->
        <TagGraphView
          v-else-if="currentTab === 'graph'"
          v-model:selected-graph-tag="selectedGraphTag"
          :all-tags="allTags"
          :graph-data="graphData"
          :timeline-stats="timelineStats"
          :associated-tags="associatedTags"
          :top-links="topLinks"
          :tag-combinations="tagCombinations"
          @focus-tag-change="onFocusTagChange"
          @combine-filter="combineFilterWithAssociated"
          @save-as-group="handleSaveAsGroup"
        />

        <!-- TAB 4: 标签治理与健康体检 -->
        <TagHygieneView
          v-else-if="currentTab === 'hygiene'"
          :health-result="healthResult"
          :all-tags="allTags"
          @auto-resolve="onAutoResolveIssue"
          @remove-tag="handleTreeRemoveTag"
          @open-rename="openRenameDialog"
          @auto-normalize="handleAutoNormalizeTag"
          @refresh-tags="refreshAllData"
        />
      </KeepAlive>
    </main>

    <!-- 浮动行内菜单 -->
    <TagRowMenu
      :state="rowMenu"
      @action="handleRowAction"
      @close="closeRowMenu"
    />

    <!-- 样式与别名设置弹窗 -->
    <TagStyleModal
      :state="styleModal"
      :custom-presets="customColorPresets"
      @close="styleModal.visible = false"
      @save="saveTagStyle"
      @reset="onResetTagStyle"
      @save-preset="onSaveCustomColorPreset"
      @remove-preset="onRemoveCustomColorPreset"
    />

    <!-- 保存智能视图弹窗 -->
    <TagSaveViewModal
      :state="saveViewModal"
      :include-tags="activeFilter.includeTags"
      :optional-tags="activeFilter.optionalTags"
      :exclude-tags="activeFilter.excludeTags"
      @close="saveViewModal.visible = false"
      @confirm="confirmSaveSmartView"
    />

    <!-- 批量打标弹窗 -->
    <TagBatchModal
      :state="batchModal"
      :all-tags="allTags"
      :tag-groups="tagGroups"
      @close="batchModal.visible = false"
      @sync-state="(patch) => Object.assign(batchModal, patch)"
      @execute="executeBatchTag"
    />

    <!-- 标签组维护弹窗 -->
    <TagGroupModal
      :state="groupModal"
      :all-tags="allTags"
      @close="groupModal.visible = false"
      @save="handleSaveGroup"
    />

    <!-- 合并重构对话弹窗 -->
    <TagMergeModal
      :state="mergeModal"
      @close="mergeModal.visible = false"
      @confirm="confirmMerge"
    />

    <!-- 重命名对话弹窗 -->
    <TagRenameModal
      :state="renameModal"
      @close="renameModal.visible = false"
      @confirm="confirmRenameTag"
    />

    <!-- 配置子标签层级归属弹窗 -->
    <TagReparentModal
      :visible="reparentModal.visible"
      :source-label="reparentModal.label"
      :all-tags="allTags"
      @close="reparentModal.visible = false"
      @confirm="handleReparentTag"
    />

    <!-- 伴生推荐设置弹窗 -->
    <TagCompanionModal
      :visible="companionModalVisible"
      :config="companionConfig"
      @close="companionModalVisible = false"
      @save="onSaveCompanionConfig"
    />

    <!-- 偏好设置弹窗 (包含非文档级标签删除偏好) -->
    <TagSettingsModal
      :visible="settingsModalVisible"
      :config="tagDeleteConfig"
      @close="settingsModalVisible = false"
      @save="onSaveTagDeleteConfig"
    />

    <!-- 通用自绘确认对话框（替代 Electron 下存在指针丢失问题的原生 confirm） -->
    <TagConfirmModal
      :visible="confirmDialog.visible"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-text="confirmDialog.confirmText"
      :danger="confirmDialog.danger"
      @close="closeConfirmDialog"
      @confirm="handleConfirmDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagHealthIssue, ITagMetadata, ITagGroup, ITagCombination, ITagDeleteConfig } from './types/tag';
import type { ITagCompanionConfig } from './types/companion';
import type {
  TabType,
} from './types/ui';
import type { IColorPreset } from './styles/palette';
import { DEFAULT_GROUP_COLOR } from './styles/palette';

// 核心服务与工具
import { TagApiClient } from './services/TagApiClient';
import { TagFilterEngine } from './services/TagFilterEngine';
import { TagGovernanceService } from './services/TagGovernanceService';
import { TagBatchService } from './services/TagBatchService';
import { TagGroupService } from './services/TagGroupService';
import { TagTreeService } from './services/TagTreeService';
import { TagCooccurrenceService } from './services/TagCooccurrenceService';
import type { ITagGraphData } from './services/TagCooccurrenceService';
import { TagTimelineService } from './services/TagTimelineService';
import type { ITagTimelineStats } from './services/TagTimelineService';
import { toggleTagManagerDock } from './main';
import { batchTagBridge } from './utils/batchTagBridge';

// 状态 Composables
import { useTagData } from './composables/useTagData';
import { useTagFilter } from './composables/useTagFilter';
import { useTagHygiene } from './composables/useTagHygiene';
import { useModalOrchestration } from './composables/useModalOrchestration';

// 视图与弹窗子组件
import SyLineIcon from './components/SiyuanTheme/SyLineIcon.vue';
import TagTreeView from './components/tabs/TagTreeView.vue';
import TagFilterView from './components/tabs/TagFilterView.vue';
import TagGraphView from './components/tabs/TagGraphView.vue';
import TagHygieneView from './components/tabs/TagHygieneView.vue';
import TagRowMenu from './components/dialogs/TagRowMenu.vue';
import TagStyleModal from './components/dialogs/TagStyleModal.vue';
import TagSaveViewModal from './components/dialogs/TagSaveViewModal.vue';
import TagBatchModal from './components/dialogs/TagBatchModal.vue';
import TagGroupModal from './components/dialogs/TagGroupModal.vue';
import TagMergeModal from './components/dialogs/TagMergeModal.vue';
import TagRenameModal from './components/dialogs/TagRenameModal.vue';
import TagReparentModal from './components/dialogs/TagReparentModal.vue';
import TagCompanionModal from './components/dialogs/TagCompanionModal.vue';
import TagSettingsModal from './components/dialogs/TagSettingsModal.vue';
import TagConfirmModal from './components/dialogs/TagConfirmModal.vue';
import { TagDeletionService } from './services/TagDeletionService';

// 1. 数据状态与 Composables 初始化
const {
  allTags,
  loading,
  metadataMap,
  tagGroups,
  customColorPresets,
  companionConfig,
  tagDeleteConfig,
  saveCompanionConfig,
  saveTagDeleteConfig,
  saveCustomColorPreset,
  removeCustomColorPreset,
  refreshTags,
  addCustomTag,
  getTagIcon,
  getTagStyle,
  saveTagMetadata,
  saveTagGroups,
  handleRemoveTag,
  handleConvertToDoc,
  handleBatchReparent,
  handleRenameTag,
} = useTagData();

// 弹窗编排状态与全局 Escape 关闭链（抽离至 useModalOrchestration）
const {
  companionModalVisible,
  settingsModalVisible,
  rowMenu,
  styleModal,
  saveViewModal,
  batchModal,
  mergeModal,
  renameModal,
  groupModal,
  reparentModal,
  confirmDialog,
  openRowMenu,
  closeRowMenu,
  openConfirmDialog,
  closeConfirmDialog,
  handleConfirmDialog,
  registerEscapeCloser,
  handleGlobalKeydown,
} = useModalOrchestration({
  onEscapeFallback: () => closePanel(),
});

const {
  activeFilter,
  matchedBlocks,
  queryLoading,
  savedViews,
  selectedSmartViewId,
  runQuery,
  handleTagClick,
  switchFilterMode,
  toggleTagFilter,
  toggleTagCondition,
  cycleTagCondition,
  removeFilterTag,
  clearFilterTags,
  applySmartView,
  saveSmartView,
  jumpToBlock,
} = useTagFilter();

async function onSaveCompanionConfig(config: ITagCompanionConfig) {
  await saveCompanionConfig(config, savedViews.value);
  companionModalVisible.value = false;
}

async function onSaveTagDeleteConfig(config: ITagDeleteConfig) {
  await saveTagDeleteConfig(config, savedViews.value);
  settingsModalVisible.value = false;
  showMessage('偏好设置已保存', 3000, 'info');
}

const { healthResult, updateHealthResult, autoResolveIssue } = useTagHygiene();

// 2. 局部视图控制状态（弹窗状态已抽离至 useModalOrchestration）
const currentTab = ref<TabType>('tree');

// 3. 图谱与时序状态
const graphData = ref<ITagGraphData>({ nodes: [], links: [] });
const tagCombinations = ref<ITagCombination[]>([]);
const selectedGraphTag = ref('');
const associatedTags = ref<Array<{ label: string; weight: number; jaccard: number }>>([]);
const timelineStats = ref<ITagTimelineStats | null>(null);

const tabs = computed(() => [
  { id: 'tree' as const, name: '全景', iconName: 'folder-tree' },
  {
    id: 'filter' as const,
    name: '筛选',
    iconName: 'filter-funnel',
    badge: activeFilter.value.includeTags.length + activeFilter.value.excludeTags.length,
  },
  { id: 'graph' as const, name: '洞察', iconName: 'git-fork-nodes' },
  {
    id: 'hygiene' as const,
    name: '治理',
    iconName: 'shield-check',
    badge: healthResult.value.issues.length,
  },
]);

const topLinks = computed(() => {
  return [...graphData.value.links]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 15);
});

// 4. 事件响应与业务编排
async function refreshAllData() {
  await refreshTags((tags) => {
    updateHealthResult(tags);
    if (tags.length > 0 && !selectedGraphTag.value) {
      selectedGraphTag.value = tags[0].label;
    }
  });

  if (activeFilter.value.includeTags.length > 0 || activeFilter.value.excludeTags.length > 0) {
    await runQuery();
  }
  if (currentTab.value === 'graph' || graphData.value.nodes.length > 0) {
    await loadGraphData();
    if (selectedGraphTag.value) {
      loadTimelineStats(selectedGraphTag.value);
    }
  }
}

function switchTab(tabId: TabType) {
  currentTab.value = tabId;
  closeRowMenu();
  if (tabId === 'graph') {
    if (graphData.value.nodes.length === 0) {
      loadGraphData();
    }
    if (selectedGraphTag.value) {
      loadTimelineStats(selectedGraphTag.value);
    }
  }
}

function onTagClick(label: string, event: MouseEvent) {
  const isMultiSelect = Boolean(event && (event.ctrlKey || event.metaKey || event.shiftKey));
  if (!isMultiSelect) {
    currentTab.value = 'filter';
  }
  handleTagClick(label, event);
}

function onQuickFilter(label: string) {
  // 不立即跳转多维筛选，而是在后台增加/切换筛选项，跟按住 Ctrl 点击操作保持一致
  handleTagClick(label, { ctrlKey: true } as MouseEvent);
}

function handleTreeRemoveTag(label: string) {
  const modeDesc = TagDeletionService.getDeleteModeDescription(tagDeleteConfig.value);
  openConfirmDialog({
    title: '删除标签',
    message: `确定要彻底删除标签 "${label}" 吗？当前将按设置【${modeDesc}】处理正文中的标签标记。`,
    confirmText: '确认删除',
    danger: true,
    onConfirm: () => {
      handleRemoveTag(label).then((success) => {
        if (success) refreshAllData();
      });
    },
  });
}

function handleRowAction(action: 'style' | 'doc' | 'graph' | 'merge' | 'remove' | 'reparent' | 'promote-root', label: string) {
  closeRowMenu();
  if (action === 'style') {
    openStyleDialog(label);
  } else if (action === 'doc') {
    handleConvertToDoc(label);
  } else if (action === 'graph') {
    viewTagNetwork(label);
  } else if (action === 'merge') {
    openMergeDialog(label);
  } else if (action === 'remove') {
    handleTreeRemoveTag(label);
  } else if (action === 'reparent') {
    reparentModal.value = { visible: true, label };
  } else if (action === 'promote-root') {
    const moves = TagTreeService.calculateReparentMoves(label, null, allTags.value);
    if (moves.length > 0) {
      applyReparentMoves(moves);
    }
  }
}

function handleReparentTag(targetParentLabel: string | null) {
  const moves = TagTreeService.calculateReparentMoves(
    reparentModal.value.label,
    targetParentLabel,
    allTags.value,
  );
  if (moves.length > 0) {
    applyReparentMoves(moves);
  }
}

function openStyleDialog(label: string) {
  const meta = metadataMap.value.get(label);
  styleModal.value = {
    visible: true,
    label,
    presetId: meta?.groupId || meta?.presetId || '',
    backgroundColor: meta?.backgroundColor || '',
    textColor: meta?.textColor || '',
    darkBackgroundColor: meta?.darkBackgroundColor || '',
    darkTextColor: meta?.darkTextColor || '',
    icon: meta?.icon || '',
    aliasesText: (meta?.aliases || []).join(', '),
  };
}

function onResetTagStyle() {
  showMessage('已重置标签色彩主题为最初状态（保留符号前缀和别名），点击“保存并即时生效”后生效', 2500, 'info');
}

async function onSaveCustomColorPreset(preset: IColorPreset) {
  await saveCustomColorPreset(preset, savedViews.value);
  showMessage(`已保存新主题预设 "${preset.name}"`, 2500, 'info');
}

async function onRemoveCustomColorPreset(presetId: string) {
  await removeCustomColorPreset(presetId, savedViews.value);
  showMessage('已移除自定义主题预设', 2500, 'info');
}

async function saveTagStyle() {
  const { label, presetId, backgroundColor, textColor, darkBackgroundColor, darkTextColor, icon, aliasesText } = styleModal.value;
  const aliases = aliasesText.split(',').map(s => s.trim()).filter(Boolean);

  const meta: ITagMetadata = {
    label,
    presetId: presetId || undefined,
    groupId: presetId || undefined,
    backgroundColor: backgroundColor || undefined,
    textColor: textColor || undefined,
    darkBackgroundColor: darkBackgroundColor || undefined,
    darkTextColor: darkTextColor || undefined,
    icon: icon || undefined,
    aliases,
    updatedAt: Date.now(),
  };

  await saveTagMetadata(meta, savedViews.value);
  styleModal.value.visible = false;
  showMessage(`已成功更新标签 "#${label}#" 的双主题样式与别名！`, 3000, 'info');
}

function openSaveViewDialog() {
  const parts: string[] = [];
  if (activeFilter.value.includeTags.length > 0) {
    parts.push(activeFilter.value.includeTags.join('+'));
  }
  if (activeFilter.value.optionalTags?.length > 0) {
    parts.push(`(${activeFilter.value.optionalTags.join('|')})`);
  }
  saveViewModal.value = {
    visible: true,
    title: `${parts.join('+') || '自定义'} 视图`,
  };
}

async function confirmSaveSmartView(title: string) {
  const ok = await saveSmartView(title, Array.from(metadataMap.value.values()));
  if (ok) {
    saveViewModal.value.visible = false;
  }
}

// 标签组相关操作
function openCreateGroupDialog() {
  groupModal.value = {
    visible: true,
    isEdit: false,
    groupId: undefined,
    name: '',
    color: DEFAULT_GROUP_COLOR,
    icon: '',
    tags: [],
  };
}

function openEditGroupDialog(group: ITagGroup) {
  groupModal.value = {
    visible: true,
    isEdit: true,
    groupId: group.id,
    name: group.name,
    color: group.color || DEFAULT_GROUP_COLOR,
    icon: group.icon || '',
    tags: [...group.tags],
  };
}

async function handleSaveGroup(payload: { name: string; tags: string[]; color?: string; icon?: string }) {
  if (groupModal.value.isEdit && groupModal.value.groupId) {
    const res = TagGroupService.updateGroup(tagGroups.value, groupModal.value.groupId, payload);
    if (res.error) {
      showMessage(res.error, 3000, 'error');
      return;
    }
    await saveTagGroups(res.groups, savedViews.value);
    showMessage(`已更新标签组「${payload.name}」`, 3000, 'info');
  } else {
    const res = TagGroupService.createGroup(tagGroups.value, payload);
    if (res.error) {
      showMessage(res.error, 3000, 'error');
      return;
    }
    await saveTagGroups(res.groups, savedViews.value);
    showMessage(`已成功创建标签组「${payload.name}」，可在“标签全景”的标签组中查看`, 3000, 'info');
  }
  groupModal.value.visible = false;
}

function handleDeleteGroup(groupId: string) {
  const g = tagGroups.value.find(item => item.id === groupId);
  openConfirmDialog({
    title: '删除标签组',
    message: `确定要删除标签组「${g?.name || '此组'}」吗？（不会删除标签本身）`,
    confirmText: '确认删除',
    danger: true,
    onConfirm: async () => {
      const next = TagGroupService.deleteGroup(tagGroups.value, groupId);
      await saveTagGroups(next, savedViews.value);
      showMessage(`已删除标签组「${g?.name || ''}」`, 3000, 'info');
    },
  });
}

async function handleApplyGroup(group: ITagGroup) {
  if (!group.tags || group.tags.length === 0) {
    showMessage(`标签组「${group.name}」内暂无标签`, 3000, 'info');
    return;
  }

  const active = TagGroupService.getActiveContext();
  if (!active.docId) {
    showMessage('未检测到当前打开的文档，请先在思源中打开文档', 4000, 'error');
    return;
  }

  // 仅以思源原生 IAL tags 属性方式注入当前活动文档根块，去除对具体内容块的打标
  const res = await TagGroupService.applyGroupToDoc(active.docId, group.tags);
  if (res.success) {
    const docName = active.docTitle ? `《${active.docTitle}》` : '当前文档';
    showMessage(`已为 ${docName} 套用标签组「${group.name}」(${group.tags.length} 个标签)`, 3000, 'info');
    await refreshAllData();
  } else {
    showMessage(`套用失败: ${res.error}`, 4000, 'error');
  }
}

async function handleCreateTag(label: string) {
  const res = await addCustomTag(label, savedViews.value);

  if (res.success) {
    showMessage(`已成功创建新标签 "#${res.label}#" 并添加至侧面板！`, 3000, 'info');
  } else {
    showMessage(res.error || '创建标签失败', 4000, 'error');
  }
}

function openMergeDialog(sourceLabel: string) {
  mergeModal.value = {
    visible: true,
    sourceLabel,
    targetLabel: '',
    setAsAlias: true,
    executing: false,
  };
}

async function confirmMerge(payload: { targetLabel: string; setAsAlias: boolean }) {
  const { sourceLabel } = mergeModal.value;
  const { targetLabel, setAsAlias } = payload;
  const { plan, error } = TagGovernanceService.generateMergePlan(targetLabel, [sourceLabel], allTags.value, setAsAlias);

  if (error || !plan) {
    showMessage(error || '合并计划创建失败', 4000, 'error');
    return;
  }

  mergeModal.value.executing = true;
  try {
    const res = await TagApiClient.executeMergePlan(plan);
    if (res.success) {
      showMessage(`成功合并标签 "${sourceLabel}" 到 "${targetLabel}"`, 3000, 'info');
      mergeModal.value.visible = false;
      await refreshAllData();
    } else {
      showMessage(`部分合并失败: ${res.errors.join('; ')}`, 6000, 'error');
    }
  } catch (err: any) {
    showMessage(`合并执行异常: ${err.message || err}`, 4000, 'error');
  } finally {
    mergeModal.value.executing = false;
  }
}

async function executeBatchTag(payload?: { docIds: string[]; tags: string[] }) {
  const docIds = payload?.docIds || batchModal.value.docIdsText.split('\n').map(s => s.trim()).filter(Boolean);
  const tags = payload?.tags || batchModal.value.tagsText.split(',').map(s => s.trim()).filter(Boolean);

  // 校验、执行与提示统一收敛至 TagBatchService.executeBatchTagging
  const ok = await TagBatchService.executeBatchTagging(docIds, tags, (executing) => {
    batchModal.value.executing = executing;
  });
  if (ok) {
    batchModal.value.visible = false;
    batchModal.value.targetDocs = [];
    batchModal.value.docIdsText = '';
    batchModal.value.tagsText = '';
    await refreshAllData();
  }
}

function onAutoResolveIssue(issue: ITagHealthIssue) {
  autoResolveIssue(issue, allTags.value, () => {
    refreshAllData();
  });
}

function openRenameDialog(label: string) {
  renameModal.value = {
    visible: true,
    oldLabel: label,
    newLabel: label,
    executing: false,
  };
}

function migrateFilterByMoves(moves: Array<{ oldLabel: string; newLabel: string }>) {
  const migrateList = (list: string[]) => {
    let next = list;
    for (const m of moves) {
      const oldPrefix = `${m.oldLabel}/`;
      next = next.map((t) => {
        if (t === m.oldLabel) return m.newLabel;
        if (t.startsWith(oldPrefix)) return `${m.newLabel}/${t.slice(oldPrefix.length)}`;
        return t;
      });
    }
    return next;
  };

  activeFilter.value.includeTags = migrateList(activeFilter.value.includeTags);
  if (activeFilter.value.optionalTags) {
    activeFilter.value.optionalTags = migrateList(activeFilter.value.optionalTags);
  }
  if (activeFilter.value.excludeTags) {
    activeFilter.value.excludeTags = migrateList(activeFilter.value.excludeTags);
  }
}

function migrateActiveFilter(oldLabel: string, newLabel: string) {
  migrateFilterByMoves([{ oldLabel, newLabel }]);
}

/**
 * 执行层级重构并同步迁移当前筛选条件（统一入口：拖拽落位、行菜单与 reparent 弹窗共用）
 */
async function applyReparentMoves(moves: Array<{ oldLabel: string; newLabel: string }>) {
  const res = await handleBatchReparent(moves);
  if (res.success) {
    migrateFilterByMoves(moves);
  }
  return res;
}

async function onTreeRenameTag(oldLabel: string, newLabel: string) {
  const res = await handleRenameTag(oldLabel, newLabel, savedViews.value);
  if (res.success) {
    migrateActiveFilter(oldLabel, newLabel);
    showMessage(`已成功将标签 "#${oldLabel}#" 重命名为 "#${newLabel}#"！`, 3000, 'info');
    await refreshAllData();
  } else {
    showMessage(`重命名失败: ${res.error || '未知错误'}`, 4000, 'error');
  }
}

async function confirmRenameTag(newLabel: string) {
  const oldLabel = renameModal.value.oldLabel;
  if (!oldLabel || !newLabel || oldLabel === newLabel) return;

  renameModal.value.executing = true;
  try {
    const res = await handleRenameTag(oldLabel, newLabel, savedViews.value);
    if (res.success) {
      migrateActiveFilter(oldLabel, newLabel);
      showMessage(`已成功将标签 "#${oldLabel}#" 重命名为 "#${newLabel}#"`, 3000, 'info');
      renameModal.value.visible = false;
      await refreshAllData();
    } else {
      showMessage(`重命名失败: ${res.error || '未知错误'}`, 4000, 'error');
    }
  } catch (err: any) {
    showMessage(`重命名失败: ${err.message || err}`, 4000, 'error');
  } finally {
    renameModal.value.executing = false;
  }
}

async function handleAutoNormalizeTag(label: string, target?: string) {
  const norm = target || TagGovernanceService.normalizeLabel(label);
  if (!norm || norm === label) return;
  try {
    await TagApiClient.renameTag(label, norm);
    showMessage(`已成功将标签 "#${label}#" 规范化为 "#${norm}#"`, 3000, 'info');
    await refreshAllData();
  } catch (err: any) {
    showMessage(`规范化失败: ${err.message || err}`, 4000, 'error');
  }
}

// 5. 关联洞察与生命周期
async function loadGraphData() {
  loading.value = true;
  try {
    const res = await TagCooccurrenceService.fetchCooccurrenceGraph(
      (url: string, data: any) => TagApiClient.request(url, data),
    );
    graphData.value = res.graph;
    tagCombinations.value = res.combinations || [];
    updateAssociatedTags();
  } catch (err: any) {
    showMessage(`加载共现关联失败: ${err.message || err}`, 4000, 'error');
  } finally {
    loading.value = false;
  }
}

async function loadTimelineStats(label: string) {
  try {
    const timestamps = await TagApiClient.fetchTagTimestamps(label);
    timelineStats.value = TagTimelineService.calculateTimelineStats(label, timestamps);
  } catch (err: any) {
    console.warn('获取时序统计失败', err);
  }
}

function onFocusTagChange() {
  updateAssociatedTags();
  loadTimelineStats(selectedGraphTag.value);
}

function updateAssociatedTags() {
  if (!selectedGraphTag.value) return;
  associatedTags.value = TagCooccurrenceService.findAssociatedTags(graphData.value, selectedGraphTag.value, 6);
}

function viewTagNetwork(label: string) {
  selectedGraphTag.value = label;
  currentTab.value = 'graph';
  if (graphData.value.nodes.length === 0) {
    loadGraphData();
  } else {
    updateAssociatedTags();
  }
  loadTimelineStats(label);
}

function combineFilterWithAssociated(tags: string[] | string, tagB?: string) {
  const targetTags = Array.isArray(tags) ? tags : [tags, ...(tagB ? [tagB] : [])];
  currentTab.value = 'filter';
  selectedSmartViewId.value = '';
  activeFilter.value = TagFilterEngine.resetFilterWithTags(targetTags);
  runQuery();
}

function handleSaveAsGroup(tags: string[]) {
  const cleanTags = Array.from(new Set(tags.filter(Boolean)));
  groupModal.value = {
    visible: true,
    isEdit: false,
    groupId: undefined,
    name: cleanTags.join(' + '),
    color: DEFAULT_GROUP_COLOR,
    icon: '',
    tags: cleanTags,
  };
}

function openPluginSettings() {
  settingsModalVisible.value = true;
}

function closePanel() {
  toggleTagManagerDock();
}

let unsubBridge: (() => void) | null = null;

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  unsubBridge = batchTagBridge.on((docs) => {
    // 原地合并而非整体替换，保持 state 对象引用稳定，
    // 避免子组件捕获的 props.state 与内部 composable 的 watch 源失效
    Object.assign(batchModal.value, {
      visible: true,
      targetDocs: [...docs],
      docIdsText: docs.map(d => d.id).join('\n'),
      tagsText: '',
      executing: false,
    });
  });
  refreshAllData();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  if (unsubBridge) unsubBridge();
});
</script>
