import { ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagMatchedBlock, ISmartTagView, IFilterSelectionState, TagFilterConditionMode } from '../types/tag';
import { TagApiClient } from '../services/TagApiClient';
import { TagFilterEngine } from '../services/TagFilterEngine';
import { usePlugin } from '../main';

// 共享的筛选状态
const activeFilter = ref<IFilterSelectionState>({
  includeTags: [],
  excludeTags: [],
  optionalTags: [],
});

const matchedBlocks = ref<ITagMatchedBlock[]>([]);
const queryLoading = ref(false);
const savedViews = ref<ISmartTagView[]>([]);
const selectedSmartViewId = ref('');

export function useTagFilter() {
  async function runQuery() {
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
      matchedBlocks.value = await TagApiClient.queryMatchedBlocks({
        includeTags: activeFilter.value.includeTags,
        excludeTags: activeFilter.value.excludeTags,
        optionalTags: activeFilter.value.optionalTags,
        limit: 40,
      });
    } catch (err: any) {
      showMessage(`查询块记录失败: ${err.message || err}`, 4000, 'error');
    } finally {
      queryLoading.value = false;
    }
  }

  function handleQuickFilter(label: string, append = false) {
    selectedSmartViewId.value = '';
    if (append) {
      activeFilter.value = TagFilterEngine.toggleFilterSelection(activeFilter.value, label);
    } else {
      activeFilter.value = TagFilterEngine.resolveFilterSelection(activeFilter.value, label, false);
    }
    runQuery();
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
    if (targetMode === 'optional') {
      const allPositive = Array.from(new Set([
        ...activeFilter.value.includeTags,
        ...(activeFilter.value.optionalTags || []),
      ])).filter(Boolean);
      activeFilter.value = {
        includeTags: [],
        optionalTags: allPositive,
        excludeTags: [...activeFilter.value.excludeTags],
      };
    } else {
      const allPositive = Array.from(new Set([
        ...activeFilter.value.includeTags,
        ...(activeFilter.value.optionalTags || []),
      ])).filter(Boolean);
      activeFilter.value = {
        includeTags: allPositive,
        optionalTags: [],
        excludeTags: [...activeFilter.value.excludeTags],
      };
    }
    runQuery();
  }

  function toggleTagFilter(label: string, mode?: TagFilterConditionMode) {
    if (mode === 'optional') {
      if (activeFilter.value.includeTags.length > 0) {
        const merged = Array.from(new Set([
          ...activeFilter.value.includeTags,
          ...(activeFilter.value.optionalTags || []),
        ]));
        activeFilter.value = {
          includeTags: [],
          optionalTags: merged,
          excludeTags: activeFilter.value.excludeTags,
        };
      }
      activeFilter.value = TagFilterEngine.toggleFilterSelection(activeFilter.value, label, 'optional');
    } else if (mode === 'include') {
      if ((activeFilter.value.optionalTags || []).length > 0) {
        const merged = Array.from(new Set([
          ...activeFilter.value.includeTags,
          ...(activeFilter.value.optionalTags || []),
        ]));
        activeFilter.value = {
          includeTags: merged,
          optionalTags: [],
          excludeTags: activeFilter.value.excludeTags,
        };
      }
      activeFilter.value = TagFilterEngine.toggleFilterSelection(activeFilter.value, label, 'include');
    } else {
      activeFilter.value = TagFilterEngine.toggleFilterSelection(activeFilter.value, label, mode);
    }
    runQuery();
  }

  function toggleTagCondition(label: string, targetState: TagFilterConditionMode) {
    if (targetState === 'optional') {
      // 切换至 OR 逻辑：将所有正向标签统一转为 optionalTags，形成真正的多标签 OR 筛选 (WHERE content IN (...))
      const allPositive = Array.from(new Set([
        ...activeFilter.value.includeTags,
        ...(activeFilter.value.optionalTags || []),
        label,
      ])).filter(Boolean);
      activeFilter.value = {
        includeTags: [],
        optionalTags: allPositive,
        excludeTags: activeFilter.value.excludeTags.filter(t => t !== label),
      };
    } else if (targetState === 'include') {
      // 切换至 AND 逻辑：将所有正向标签统一转为 includeTags，形成多标签 AND 筛选
      const allPositive = Array.from(new Set([
        ...activeFilter.value.includeTags,
        ...(activeFilter.value.optionalTags || []),
        label,
      ])).filter(Boolean);
      activeFilter.value = {
        includeTags: allPositive,
        optionalTags: [],
        excludeTags: activeFilter.value.excludeTags.filter(t => t !== label),
      };
    } else if (targetState === 'exclude') {
      activeFilter.value = TagFilterEngine.setTagCondition(activeFilter.value, label, 'exclude');
    }
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

    const plugin = usePlugin();
    await plugin.saveData('tag-manager-config.json', {
      metadataList,
      savedViews: savedViews.value,
    });

    showMessage(`已保存智能视图 "${newView.title}"`, 3000, 'info');
    return true;
  }

  function highlightTags(text: string): string {
    if (!text) return '';
    return text.replace(/#([^#]+)#/g, '<span class="tm-matched-tag">#$1#</span>');
  }

  function jumpToBlock(rootId: string, blockId: string) {
    if ((window as any).siyuan && (window as any).siyuan.openTab) {
      (window as any).siyuan.openTab({
        app: (window as any).siyuan.appId,
        doc: { id: rootId, focusBlockId: blockId },
      });
    } else {
      window.open(`siyuan://blocks/${blockId}`);
    }
  }

  return {
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
    highlightTags,
    jumpToBlock,
  };
}
