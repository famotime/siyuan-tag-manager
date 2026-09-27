import { ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagMatchedBlock, ISmartTagView } from '../types/tag';
import { TagApiClient } from '../services/TagApiClient';
import { TagFilterEngine } from '../services/TagFilterEngine';
import { usePlugin } from '../main';

// 共享的筛选状态
const activeFilter = ref<{
  includeTags: string[];
  excludeTags: string[];
}>({
  includeTags: [],
  excludeTags: [],
});

const matchedBlocks = ref<ITagMatchedBlock[]>([]);
const queryLoading = ref(false);
const savedViews = ref<ISmartTagView[]>([]);
const selectedSmartViewId = ref('');

export function useTagFilter() {
  async function runQuery() {
    if (activeFilter.value.includeTags.length === 0 && activeFilter.value.excludeTags.length === 0) {
      matchedBlocks.value = [];
      return;
    }

    queryLoading.value = true;
    try {
      matchedBlocks.value = await TagApiClient.queryMatchedBlocks({
        includeTags: activeFilter.value.includeTags,
        excludeTags: activeFilter.value.excludeTags,
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

  function toggleTagFilter(label: string) {
    const incIndex = activeFilter.value.includeTags.indexOf(label);
    const excIndex = activeFilter.value.excludeTags.indexOf(label);

    if (incIndex > -1) {
      activeFilter.value.includeTags.splice(incIndex, 1);
      activeFilter.value.excludeTags.push(label);
    } else if (excIndex > -1) {
      activeFilter.value.excludeTags.splice(excIndex, 1);
    } else {
      activeFilter.value.includeTags.push(label);
    }
    runQuery();
  }

  function toggleTagCondition(label: string, targetState: 'include' | 'exclude') {
    removeFilterTag(label);
    if (targetState === 'include') {
      activeFilter.value.includeTags.push(label);
    } else {
      activeFilter.value.excludeTags.push(label);
    }
    runQuery();
  }

  function removeFilterTag(label: string) {
    activeFilter.value.includeTags = activeFilter.value.includeTags.filter(t => t !== label);
    activeFilter.value.excludeTags = activeFilter.value.excludeTags.filter(t => t !== label);
    runQuery();
  }

  function clearFilterTags() {
    const cleared = TagFilterEngine.clearFilterSelection();
    activeFilter.value.includeTags = cleared.includeTags;
    activeFilter.value.excludeTags = cleared.excludeTags;
    selectedSmartViewId.value = '';
    runQuery();
  }

  function applySmartView() {
    const v = savedViews.value.find(view => view.id === selectedSmartViewId.value);
    if (!v) return;
    activeFilter.value.includeTags = [...v.includeTags];
    activeFilter.value.excludeTags = [...v.excludeTags];
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
      optionalTags: [],
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
    toggleTagFilter,
    toggleTagCondition,
    removeFilterTag,
    clearFilterTags,
    applySmartView,
    saveSmartView,
    highlightTags,
    jumpToBlock,
  };
}
