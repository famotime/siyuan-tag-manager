import { ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagMatchedBlock, ISmartTagView, IFilterSelectionState, TagFilterConditionMode } from '../types/tag';
import { TagApiClient } from '../services/TagApiClient';
import { TagFilterEngine } from '../services/TagFilterEngine';
import { TagNavigationService } from '../services/TagNavigationService';
import { TagConfigStore } from '../services/TagConfigStore';
import { usePlugin } from '../main';

// 共享的筛选状态
const activeFilter = ref<IFilterSelectionState>({
  includeTags: [],
  excludeTags: [],
  optionalTags: [],
});

const matchedBlocks = ref<ITagMatchedBlock[]>([]);
const queryLoading = ref(false);
// 模块级共享状态：由 useTagData.refreshTags 从持久化配置回填（导出以避免跨 composable 循环依赖）
export const savedViews = ref<ISmartTagView[]>([]);
const selectedSmartViewId = ref('');

export function useTagFilter() {
  // 竞态防护：仅接受最新一次查询的结果，先发后至的旧响应直接丢弃
  let querySeq = 0;

  async function runQuery() {
    const seq = ++querySeq;
    if (
      activeFilter.value.includeTags.length === 0 &&
      activeFilter.value.excludeTags.length === 0 &&
      activeFilter.value.optionalTags.length === 0
    ) {
      matchedBlocks.value = [];
      return;
    }

    queryLoading.value = true;
    try {
      const blocks = await TagFilterEngine.queryMatchedBlocks(
        {
          includeTags: activeFilter.value.includeTags,
          excludeTags: activeFilter.value.excludeTags,
          optionalTags: activeFilter.value.optionalTags,
          limit: 40,
        },
        (url: string, data: any) => TagApiClient.request(url, data),
      );
      if (seq !== querySeq) return;
      matchedBlocks.value = blocks;
    } catch (err: any) {
      if (seq === querySeq) {
        showMessage(`查询块记录失败: ${err.message || err}`, 4000, 'error');
      }
    } finally {
      if (seq === querySeq) {
        queryLoading.value = false;
      }
    }
  }

  function handleTagClick(label: string, event?: MouseEvent) {
    const isMultiSelect = Boolean(event && (event.ctrlKey || event.metaKey || event.shiftKey));
    selectedSmartViewId.value = '';
    if (isMultiSelect) {
      activeFilter.value = TagFilterEngine.toggleFilterSelection(activeFilter.value, label);
    } else {
      activeFilter.value = TagFilterEngine.resolveFilterSelection(activeFilter.value, label, false);
    }
    runQuery();
  }

  function switchFilterMode(targetMode: 'include' | 'optional') {
    // 两分支的正向标签合并去重计算完全一致，提取到分支外
    const allPositive = Array.from(new Set([
      ...activeFilter.value.includeTags,
      ...(activeFilter.value.optionalTags || []),
    ])).filter(Boolean);

    if (targetMode === 'optional') {
      activeFilter.value = {
        includeTags: [],
        optionalTags: allPositive,
        excludeTags: [...activeFilter.value.excludeTags],
      };
    } else {
      activeFilter.value = {
        includeTags: allPositive,
        optionalTags: [],
        excludeTags: [...activeFilter.value.excludeTags],
      };
    }
    runQuery();
  }

  function toggleTagFilter(label: string, mode?: TagFilterConditionMode) {
    activeFilter.value = TagFilterEngine.toggleFilterSelection(activeFilter.value, label, mode);
    runQuery();
  }

  function toggleTagCondition(label: string, targetState: TagFilterConditionMode) {
    // 仅切换当前点击的标签状态，保持其他标签的筛选条件不变
    activeFilter.value = TagFilterEngine.setTagCondition(activeFilter.value, label, targetState);
    runQuery();
  }

  function cycleTagCondition(label: string) {
    activeFilter.value = TagFilterEngine.cycleFilterCondition(activeFilter.value, label);
    runQuery();
  }

  function removeFilterTag(label: string) {
    activeFilter.value = TagFilterEngine.setTagCondition(activeFilter.value, label, 'remove');
    runQuery();
  }

  function clearFilterTags() {
    activeFilter.value = TagFilterEngine.clearFilterSelection();
    selectedSmartViewId.value = '';
    runQuery();
  }

  function applySmartView() {
    const v = savedViews.value.find(view => view.id === selectedSmartViewId.value);
    if (!v) return;
    activeFilter.value.includeTags = [...(v.includeTags || [])];
    activeFilter.value.excludeTags = [...(v.excludeTags || [])];
    activeFilter.value.optionalTags = [...(v.optionalTags || [])];
    runQuery();
  }

  async function saveSmartView(title: string, metadataList: any[] = []) {
    if (!title.trim()) {
      showMessage('视图标题不能为空', 3000, 'error');
      return false;
    }

    const newView: ISmartTagView = {
      id: `view_${Date.now()}`,
      title: title.trim(),
      includeTags: [...activeFilter.value.includeTags],
      excludeTags: [...activeFilter.value.excludeTags],
      optionalTags: [...activeFilter.value.optionalTags],
      displayMode: 'card',
      createdAt: Date.now(),
    };

    savedViews.value.push(newView);
    selectedSmartViewId.value = newView.id;

    // 读-合并-写持久化，避免整文件覆盖丢失标签分组等其他配置
    await TagConfigStore.updateConfig({
      metadataList,
      savedViews: savedViews.value,
    });

    showMessage(`已保存智能视图 "${newView.title}"`, 3000, 'info');
    return true;
  }

  function jumpToBlock(rootId: string, blockId: string) {
    let plugin: any = null;
    try {
      plugin = usePlugin();
    } catch {
      // 容错处理独立测试或插件未初始化环境
    }
    TagNavigationService.jumpToBlock(rootId, blockId, plugin);
  }

  return {
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
  };
}
