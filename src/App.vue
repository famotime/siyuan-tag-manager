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
        @toggle-condition="toggleTagCondition"
        @remove-tag="removeFilterTag"
        @toggle-tag="toggleTagFilter"
        @jump-block="jumpToBlock"
      />

      <!-- TAB 3: 认知图谱与生命周期分析 -->
      <TagGraphView
        v-if="currentTab === 'graph'"
        v-model:selected-graph-tag="selectedGraphTag"
        :all-tags="allTags"
        :graph-data="graphData"
        :timeline-stats="timelineStats"
        :associated-tags="associatedTags"
        :top-links="topLinks"
        @focus-tag-change="onFocusTagChange"
        @combine-filter="combineFilterWithAssociated"
      />

      <!-- TAB 4: 标签治理与健康体检 -->
      <TagHygieneView
        v-if="currentTab === 'hygiene'"
        :health-result="healthResult"
        @auto-resolve="onAutoResolveIssue"
        @remove-tag="handleRemoveTag"
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
    />

    <!-- 保存智能视图弹窗 -->
    <TagSaveViewModal
      :state="saveViewModal"
      :include-tags="activeFilter.includeTags"
      :exclude-tags="activeFilter.excludeTags"
      @close="saveViewModal.visible = false"
      @confirm="confirmSaveSmartView"
    />

    <!-- 批量打标弹窗 -->
    <TagBatchModal
      :state="batchModal"
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagHealthIssue, ITagMetadata, ITagGroup } from './types/tag';
import type {
  TabType,
  IRowMenuState,
  IStyleModalState,
  ISaveViewModalState,
  IBatchModalState,
  IMergeModalState,
  ITagGroupModalState,
} from './types/ui';

// 核心服务与工具
import { TagApiClient } from './services/TagApiClient';
import { TagFilterEngine } from './services/TagFilterEngine';
import { TagGovernanceService } from './services/TagGovernanceService';
import { TagBatchService } from './services/TagBatchService';
import { TagGroupService } from './services/TagGroupService';
import { TagCooccurrenceService, type ITagGraphData } from './services/TagCooccurrenceService';
import { TagTimelineService, type ITagTimelineStats } from './services/TagTimelineService';
import { toggleTagManagerDock } from './main';

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

// 1. 数据状态与 Composables 初始化
const {
  allTags,
  loading,
  metadataMap,
  tagGroups,
  refreshTags,
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
  toggleTagFilter,
  toggleTagCondition,
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
  { id: 'graph' as const, name: '认知图谱', iconName: 'git-fork-nodes' },
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
  currentTab.value = 'filter';
  handleQuickFilter(label, append);
}

function openRowMenu(label: string, event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const menuWidth = 180;
  let left = rect.left - menuWidth + 24;
  if (left < 10) left = 10;
  let top = rect.bottom + 4;
  if (top + 200 > window.innerHeight) {
    top = rect.top - 200;
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
    handleRemoveTag(label).then(success => {
      if (success) refreshAllData();
    });
  }
}

function openStyleDialog(label: string) {
  const meta = metadataMap.value.get(label);
  styleModal.value = {
    visible: true,
    label,
    presetId: meta?.groupId || '',
    backgroundColor: meta?.backgroundColor || '',
    textColor: meta?.textColor || '',
    darkBackgroundColor: meta?.darkBackgroundColor || '',
    darkTextColor: meta?.darkTextColor || '',
    icon: meta?.icon || '',
    aliasesText: (meta?.aliases || []).join(', '),
  };
}

async function saveTagStyle() {
  const { label, presetId, backgroundColor, textColor, darkBackgroundColor, darkTextColor, icon, aliasesText } = styleModal.value;
  const aliases = aliasesText.split(',').map(s => s.trim()).filter(Boolean);

  const meta: ITagMetadata = {
    label,
    groupId: presetId || undefined,
    backgroundColor,
    textColor,
    darkBackgroundColor: darkBackgroundColor || undefined,
    darkTextColor: darkTextColor || undefined,
    icon,
    aliases,
    updatedAt: Date.now(),
  };

  await saveTagMetadata(meta, savedViews.value);
  styleModal.value.visible = false;
  showMessage(`已成功更新标签 "#${label}#" 的双主题样式与别名！`, 3000, 'info');
}

function openSaveViewDialog() {
  saveViewModal.value = {
    visible: true,
    title: `${activeFilter.value.includeTags.join('+')} 视图`,
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
    showMessage(`已成功创建标签组「${payload.name}」`, 3000, 'info');
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

async function executeBatchTag() {
  const docIds = batchModal.value.docIdsText.split('\n').map(s => s.trim()).filter(Boolean);
  const tags = batchModal.value.tagsText.split(',').map(s => s.trim()).filter(Boolean);

  if (docIds.length === 0 || tags.length === 0) {
    showMessage('文档 ID 与待添加标签均不能为空', 3000, 'error');
    return;
  }

  batchModal.value.executing = true;
  try {
    const res = await TagBatchService.batchTagDocuments(docIds, tags);
    if (res.success) {
      showMessage(`成功为 ${res.updatedCount} 篇文档更新标签`, 3000, 'info');
      batchModal.value.visible = false;
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

// 5. 认知图谱与生命周期
async function loadGraphData() {
  loading.value = true;
  try {
    const res = await TagApiClient.fetchCooccurrenceGraph();
    graphData.value = res.graph;
    updateAssociatedTags();
  } catch (err: any) {
    showMessage(`加载共现网络失败: ${err.message || err}`, 4000, 'error');
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

function combineFilterWithAssociated(tagA: string, tagB: string) {
  currentTab.value = 'filter';
  selectedSmartViewId.value = '';
  activeFilter.value = TagFilterEngine.resetFilterWithTags([tagA, tagB]);
  runQuery();
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

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  refreshAllData();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
