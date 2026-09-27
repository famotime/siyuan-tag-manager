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
            :disabled="loading"
            v-tooltip="'刷新全库标签数据'"
            @click="refreshAllData"
          >
            <SyLineIcon name="refresh-cw" :size="14" :spin="loading" />
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
      <!-- TAB 1: 标签全景资产树 -->
      <TagTreeView
        v-if="currentTab === 'tree'"
        :all-tags="allTags"
        :loading="loading"
        :selected-tags="activeFilter.includeTags"
        :tag-groups="tagGroups"
        :get-tag-style="getTagStyle"
        :get-tag-icon="getTagIcon"
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
      />

      <!-- TAB 2: 多维交叉筛选与即时卡片流 -->
      <TagFilterView
        v-if="currentTab === 'filter'"
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
        v-if="currentTab === 'graph'"
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
        v-if="currentTab === 'hygiene'"
        :health-result="healthResult"
        :all-tags="allTags"
        @auto-resolve="onAutoResolveIssue"
        @remove-tag="handleRemoveTag"
        @open-rename="openRenameDialog"
        @auto-normalize="handleAutoNormalizeTag"
        @refresh-tags="refreshAllData"
      />
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
      @close="styleModal.visible = false"
      @save="saveTagStyle"
      @reset="onResetTagStyle"
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagHealthIssue, ITagMetadata, ITagGroup, ITagCombination } from './types/tag';
import type {
  TabType,
  IRowMenuState,
  IStyleModalState,
  ISaveViewModalState,
  IBatchModalState,
  IMergeModalState,
  IRenameModalState,
  ITagGroupModalState,
} from './types/ui';

// 核心服务与工具
import { TagApiClient } from './services/TagApiClient';
import { TagFilterEngine } from './services/TagFilterEngine';
import { TagGovernanceService } from './services/TagGovernanceService';
import { TagBatchService } from './services/TagBatchService';
import { TagGroupService } from './services/TagGroupService';
import { TagCreationService } from './services/TagCreationService';
import { TagCooccurrenceService, type ITagGraphData } from './services/TagCooccurrenceService';
import { TagTimelineService, type ITagTimelineStats } from './services/TagTimelineService';
import { toggleTagManagerDock } from './main';
import { batchTagBridge } from './utils/batchTagBridge';

// 状态 Composables
import { useTagData } from './composables/useTagData';
import { useTagFilter } from './composables/useTagFilter';
import { useTagHygiene } from './composables/useTagHygiene';

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

// 1. 数据状态与 Composables 初始化
const {
  allTags,
  loading,
  metadataMap,
  tagGroups,
  refreshTags,
  addCustomTag,
  getTagIcon,
  getTagStyle,
  saveTagMetadata,
  saveTagGroups,
  handleRemoveTag,
  handleConvertToDoc,
} = useTagData();

const {
  activeFilter,
  matchedBlocks,
  queryLoading,
  savedViews,
  selectedSmartViewId,
  runQuery,
  handleQuickFilter,
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

const { healthResult, updateHealthResult, autoResolveIssue } = useTagHygiene();

// 2. 局部视图与弹窗控制状态
const currentTab = ref<TabType>('tree');

const rowMenu = ref<IRowMenuState>({
  visible: false,
  label: '',
  top: 0,
  left: 0,
});

const styleModal = ref<IStyleModalState>({
  visible: false,
  label: '',
  presetId: '',
  backgroundColor: '',
  textColor: '',
  darkBackgroundColor: '',
  darkTextColor: '',
  icon: '',
  aliasesText: '',
});

const saveViewModal = ref<ISaveViewModalState>({
  visible: false,
  title: '',
});

const batchModal = ref<IBatchModalState>({
  visible: false,
  docIdsText: '',
  tagsText: '',
  executing: false,
});

const mergeModal = ref<IMergeModalState>({
  visible: false,
  sourceLabel: '',
  targetLabel: '',
  setAsAlias: true,
  executing: false,
});

const renameModal = ref<IRenameModalState>({
  visible: false,
  oldLabel: '',
  newLabel: '',
  executing: false,
});

const groupModal = ref<ITagGroupModalState>({
  visible: false,
  isEdit: false,
  groupId: undefined,
  name: '',
  color: '#4285F4',
  icon: '',
  tags: [],
});

// 3. 图谱与时序状态
const graphData = ref<ITagGraphData>({ nodes: [], links: [] });
const tagCombinations = ref<ITagCombination[]>([]);
const selectedGraphTag = ref('');
const associatedTags = ref<Array<{ label: string; weight: number; jaccard: number }>>([]);
const timelineStats = ref<ITagTimelineStats | null>(null);

const tabs = computed(() => [
  { id: 'tree' as const, name: '标签全景', iconName: 'folder-tree' },
  {
    id: 'filter' as const,
    name: '多维筛选',
    iconName: 'filter-funnel',
    badge: activeFilter.value.includeTags.length + activeFilter.value.excludeTags.length,
  },
  { id: 'graph' as const, name: '关联洞察', iconName: 'git-fork-nodes' },
  {
    id: 'hygiene' as const,
    name: '健康治理',
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
  await refreshTags(tags => {
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

function onQuickFilter(label: string, append: boolean) {
  // 不立即跳转多维筛选，而是在后台增加/切换筛选项，跟按住 Ctrl 点击操作保持一致
  handleTagClick(label, { ctrlKey: true } as MouseEvent);
}

function openRowMenu(label: string, event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const menuWidth = 180;
  let left = rect.left - menuWidth + 24;
  if (left < 10) left = 10;
  let top = rect.bottom + 4;
  const menuHeight = 130;
  if (top + menuHeight > window.innerHeight) {
    top = rect.top - menuHeight;
  }

  rowMenu.value = {
    visible: true,
    label,
    top,
    left,
  };
}

function closeRowMenu() {
  if (rowMenu.value.visible) {
    rowMenu.value.visible = false;
  }
}

function handleTreeRemoveTag(label: string) {
  handleRemoveTag(label).then(success => {
    if (success) refreshAllData();
  });
}

function handleRowAction(action: 'style' | 'doc' | 'graph' | 'merge' | 'remove', label: string) {
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

async function confirmSaveSmartView() {
  const ok = await saveSmartView(saveViewModal.value.title, Array.from(metadataMap.value.values()));
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
    color: '#4285F4',
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
    color: group.color || '#4285F4',
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

async function handleDeleteGroup(groupId: string) {
  const g = tagGroups.value.find(item => item.id === groupId);
  if (!confirm(`确定要删除标签组「${g?.name || '此组'}」吗？（不会删除标签本身）`)) {
    return;
  }
  const next = TagGroupService.deleteGroup(tagGroups.value, groupId);
  await saveTagGroups(next, savedViews.value);
  showMessage(`已删除标签组「${g?.name || ''}」`, 3000, 'info');
}

async function handleApplyGroup(group: ITagGroup) {
  if (!group.tags || group.tags.length === 0) {
    showMessage(`标签组「${group.name}」内暂无标签`, 3000, 'info');
    return;
  }

  const active = TagGroupService.getActiveContext();
  if (!active.docId && !active.blockId) {
    showMessage('未检测到当前打开的文档或聚焦块，请先在思源中打开文档或光标置于正文中', 4000, 'error');
    return;
  }

  // 1. 若光标焦点位于非根块的具体内容块上，直接在该块末尾追加 #tag#
  if (active.blockId) {
    const res = await TagGroupService.applyGroupToBlock(active.blockId, group.tags);
    if (res.success) {
      showMessage(`已将标签组「${group.name}」(${group.tags.length}个标签) 追加至当前块`, 3000, 'info');
      await refreshAllData();
      return;
    }
  }

  // 2. 否则默认以思源原生 IAL tags 属性方式注入当前活动文档根块
  if (active.docId) {
    const res = await TagGroupService.applyGroupToDoc(active.docId, group.tags);
    if (res.success) {
      const docName = active.docTitle ? `《${active.docTitle}》` : '当前文档';
      showMessage(`已为 ${docName} 套用标签组「${group.name}」(${group.tags.length} 个标签)`, 3000, 'info');
      await refreshAllData();
    } else {
      showMessage(`套用失败: ${res.error}`, 4000, 'error');
    }
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

async function confirmMerge() {
  const { sourceLabel, targetLabel, setAsAlias } = mergeModal.value;
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

  if (docIds.length === 0 || tags.length === 0) {
    showMessage('目标文档与待添加标签均不能为空', 3000, 'error');
    return;
  }

  batchModal.value.executing = true;
  try {
    const res = await TagBatchService.batchTagDocuments(docIds, tags);
    if (res.success) {
      showMessage(`成功为 ${res.updatedCount} 篇文档更新标签`, 3000, 'info');
      batchModal.value.visible = false;
      batchModal.value.targetDocs = [];
      batchModal.value.docIdsText = '';
      batchModal.value.tagsText = '';
      await refreshAllData();
    } else {
      showMessage(`批量打标存在错误: ${res.errors.join('; ')}`, 5000, 'error');
    }
  } catch (err: any) {
    showMessage(`批量打标失败: ${err.message || err}`, 4000, 'error');
  } finally {
    batchModal.value.executing = false;
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

async function confirmRenameTag(newLabel: string) {
  const oldLabel = renameModal.value.oldLabel;
  if (!oldLabel || !newLabel || oldLabel === newLabel) return;

  renameModal.value.executing = true;
  try {
    await TagApiClient.renameTag(oldLabel, newLabel);
    showMessage(`已成功将标签 "#${oldLabel}#" 重命名为 "#${newLabel}#"`, 3000, 'info');
    renameModal.value.visible = false;
    await refreshAllData();
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
    const res = await TagApiClient.fetchCooccurrenceGraph();
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
    color: '#4285F4',
    icon: '',
    tags: cleanTags,
  };
}

function closePanel() {
  toggleTagManagerDock();
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (rowMenu.value.visible) {
      rowMenu.value.visible = false;
      return;
    }
    if (styleModal.value.visible) {
      styleModal.value.visible = false;
      return;
    }
    if (saveViewModal.value.visible) {
      saveViewModal.value.visible = false;
      return;
    }
    if (batchModal.value.visible) {
      batchModal.value.visible = false;
      return;
    }
    if (mergeModal.value.visible) {
      mergeModal.value.visible = false;
      return;
    }
    closePanel();
  }
}

let unsubBridge: (() => void) | null = null;

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  unsubBridge = batchTagBridge.on((docs) => {
    batchModal.value = {
      visible: true,
      targetDocs: [...docs],
      docIdsText: docs.map(d => d.id).join('\n'),
      tagsText: '',
      executing: false,
    };
  });
  refreshAllData();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  if (unsubBridge) unsubBridge();
});
</script>
