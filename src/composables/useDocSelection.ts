import { computed, onUnmounted, ref, watch } from 'vue';
import { TagBatchService } from '../services/TagBatchService';
import type { IBatchModalState, IBatchDocItem } from '../types/ui';

/**
 * 批量打标弹窗「文档选取」子域（自 TagBatchModal.vue 拆分）
 *
 * 覆盖三种添加模式（搜索 / 笔记本 / 手动 ID）、子文档扫描与排除、
 * 打标目标合并去重，以及执行时的文本兼容字段回传（经 onSyncState 通知宿主，
 * 替代历史实现对 props.state 的直接突变反模式）。
 */
export function useDocSelection(options: {
  /** 弹窗共享状态（响应式对象，来自 props.state） */
  getState: () => IBatchModalState;
  /** 状态回传回调：宿主（App.vue / batchTagModalManager）负责合并入自身状态 */
  onSyncState: (patch: Partial<IBatchModalState>) => void;
}) {
  // 文档添加模式：search | notebook | manual
  const docAddMode = ref<'search' | 'notebook' | 'manual'>('search');

  // 已选文档集合（根文档）
  const selectedDocs = ref<IBatchDocItem[]>([]);

  // 是否包含子文档
  const includeSubDocs = ref(false);
  // 扫描出的子文档列表
  const subDocs = ref<IBatchDocItem[]>([]);
  // 正在扫描子文档状态
  const loadingSubDocs = ref(false);
  // 临时排除的子文档 ID 集合
  const excludedSubDocIds = ref<Set<string>>(new Set());

  // 搜索文档状态
  const docSearchKeyword = ref('');
  const searchingDocs = ref(false);
  const searched = ref(false);
  const searchDocResults = ref<Array<{ id: string; title: string; tags: string[] }>>([]);

  // 笔记本状态
  const notebooks = ref<Array<{ id: string; name: string }>>([]);
  const selectedNotebookId = ref('');
  const loadingNotebookDocs = ref(false);

  // 实际生效的子文档列表（排除被单独移除的）
  const activeSubDocs = computed(() => {
    if (!includeSubDocs.value) return [];
    return subDocs.value.filter(d => !excludedSubDocIds.value.has(d.id));
  });

  // 全部打标目标文档（根文档 + 纳入的有效子文档，去重）
  const allTargetDocs = computed(() => {
    if (!includeSubDocs.value) {
      return selectedDocs.value;
    }
    const rootIds = new Set(selectedDocs.value.map(d => d.id));
    const uniqueSubDocs = activeSubDocs.value.filter(d => !rootIds.has(d.id));
    return [...selectedDocs.value, ...uniqueSubDocs];
  });

  function isSubDoc(id: string): boolean {
    return activeSubDocs.value.some(d => d.id === id);
  }

  // 竞态防护：仅接受最新一次扫描的结果
  let subDocsSeq = 0;
  async function loadSubDocs() {
    const seq = ++subDocsSeq;
    if (!includeSubDocs.value || selectedDocs.value.length === 0) {
      subDocs.value = [];
      return;
    }
    loadingSubDocs.value = true;
    try {
      const parentIds = selectedDocs.value.map(d => d.id);
      const res = await TagBatchService.getSubDocs(parentIds);
      if (seq !== subDocsSeq) return;
      subDocs.value = res.map(r => ({ id: r.id, title: r.title, isSubDoc: true }));
    } catch (err) {
      console.warn('[siyuan-tag-manager] loadSubDocs error:', err);
      if (seq === subDocsSeq) {
        subDocs.value = [];
      }
    } finally {
      if (seq === subDocsSeq) {
        loadingSubDocs.value = false;
      }
    }
  }

  watch(includeSubDocs, (val) => {
    if (val) {
      excludedSubDocIds.value = new Set();
      loadSubDocs();
    } else {
      subDocs.value = [];
      excludedSubDocIds.value = new Set();
    }
  });

  // 当选中文档发生变动且已勾选包含子文档时，自动重新扫描子文档
  watch(
    () => selectedDocs.value.map(d => d.id).sort().join(','),
    () => {
      if (includeSubDocs.value) {
        loadSubDocs();
      }
    }
  );

  // 初始化监听外部传入的 targetDocs 或 docIdsText
  // 每次均经 getState() 动态取最新引用：宿主可能整体替换共享状态对象，一次性捕获会令 watch 源失效
  watch(
    [() => options.getState().visible, () => options.getState().targetDocs],
    ([vis]) => {
      if (vis) {
        const state = options.getState();
        includeSubDocs.value = Boolean(state.includeSubDocs);
        excludedSubDocIds.value = new Set();
        subDocs.value = [];

        if (state.targetDocs && state.targetDocs.length > 0) {
          selectedDocs.value = [...state.targetDocs];
        } else if (state.docIdsText) {
          const ids = state.docIdsText.split('\n').map(s => s.trim()).filter(Boolean);
          selectedDocs.value = ids.map(id => ({ id, title: id }));
        } else {
          selectedDocs.value = [];
        }

        if (includeSubDocs.value) {
          loadSubDocs();
        }
      }
    },
    { immediate: true, deep: true }
  );

  function removeDoc(id: string) {
    if (isSubDoc(id)) {
      const next = new Set(excludedSubDocIds.value);
      next.add(id);
      excludedSubDocIds.value = next;
    } else {
      selectedDocs.value = selectedDocs.value.filter(d => d.id !== id);
    }
  }

  function isDocSelected(id: string): boolean {
    return selectedDocs.value.some(d => d.id === id);
  }

  function toggleDocSelection(doc: { id: string; title: string }) {
    if (isDocSelected(doc.id)) {
      removeDoc(doc.id);
    } else {
      selectedDocs.value.push({ id: doc.id, title: doc.title });
    }
  }

  let searchTimer: any = null;
  function onSearchDocsInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      triggerSearchDocs();
    }, 350);
  }

  onUnmounted(() => {
    clearTimeout(searchTimer);
  });

  // 竞态防护：仅接受最新一次搜索的结果
  let searchSeq = 0;
  async function triggerSearchDocs() {
    const seq = ++searchSeq;
    const kw = docSearchKeyword.value.trim();
    if (!kw) {
      searchDocResults.value = [];
      searched.value = false;
      return;
    }
    searchingDocs.value = true;
    searched.value = true;
    try {
      const results = await TagBatchService.searchDocs(kw, 30);
      if (seq === searchSeq) {
        searchDocResults.value = results;
      }
    } catch (err) {
      console.warn('[siyuan-tag-manager] searchDocs error:', err);
      if (seq === searchSeq) {
        searchDocResults.value = [];
      }
    } finally {
      if (seq === searchSeq) {
        searchingDocs.value = false;
      }
    }
  }

  async function loadNotebooks() {
    if (notebooks.value.length === 0) {
      notebooks.value = await TagBatchService.fetchNotebooks();
    }
  }

  async function loadDocsFromNotebook() {
    if (!selectedNotebookId.value) return;
    loadingNotebookDocs.value = true;
    try {
      const list = await TagBatchService.getNotebookDocs(selectedNotebookId.value, 100);
      const existing = new Set(selectedDocs.value.map(d => d.id));
      for (const item of list) {
        if (!existing.has(item.id)) {
          selectedDocs.value.push({ id: item.id, title: item.title });
          existing.add(item.id);
        }
      }
    } catch (err) {
      console.warn('[siyuan-tag-manager] loadDocsFromNotebook error:', err);
    } finally {
      loadingNotebookDocs.value = false;
    }
  }

  function syncManualDocIds() {
    const lines = options.getState().docIdsText.split('\n').map(s => s.trim()).filter(Boolean);
    const existing = new Set(selectedDocs.value.map(d => d.id));
    for (const id of lines) {
      if (!existing.has(id)) {
        selectedDocs.value.push({ id, title: id });
        existing.add(id);
      }
    }
  }

  /**
   * 执行打标前回传文本兼容字段（docIdsText/tagsText/includeSubDocs），
   * 由宿主合并入共享状态，替代直接突变 props 的反模式
   */
  function commitExecuteContext(docIds: string[], tags: string[]) {
    options.onSyncState({
      docIdsText: docIds.join('\n'),
      tagsText: tags.join(', '),
      includeSubDocs: includeSubDocs.value,
    });
  }

  return {
    docAddMode,
    selectedDocs,
    includeSubDocs,
    subDocs,
    loadingSubDocs,
    excludedSubDocIds,
    docSearchKeyword,
    searchingDocs,
    searched,
    searchDocResults,
    notebooks,
    selectedNotebookId,
    loadingNotebookDocs,
    activeSubDocs,
    allTargetDocs,
    isSubDoc,
    loadSubDocs,
    removeDoc,
    isDocSelected,
    toggleDocSelection,
    onSearchDocsInput,
    triggerSearchDocs,
    loadNotebooks,
    loadDocsFromNotebook,
    syncManualDocIds,
    commitExecuteContext,
  };
}
