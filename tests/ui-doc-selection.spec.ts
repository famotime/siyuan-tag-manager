import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive } from 'vue';
import { useDocSelection } from '../src/composables/useDocSelection';
import { TagBatchService } from '../src/services/TagBatchService';
import type { IBatchModalState } from '../src/types/ui';

/**
 * 批量打标弹窗「文档选取」子域测试（自 TagBatchModal 拆分）
 * 覆盖：初始化回填、选取切换、子文档排除与合并去重、手动 ID 同步、执行上下文回传
 */
function makeState(partial?: Partial<IBatchModalState>): IBatchModalState {
  // 与生产一致使用 reactive：watch 源依赖可见性与目标文档的响应式变化
  return reactive({
    visible: false,
    docIdsText: '',
    tagsText: '',
    executing: false,
    ...partial,
  }) as IBatchModalState;
}

function setup(state: IBatchModalState) {
  const syncPatches: Array<Partial<IBatchModalState>> = [];
  const composable = useDocSelection({
    getState: () => state,
    onSyncState: (patch) => {
      syncPatches.push(patch);
    },
  });
  return { state, syncPatches, ...composable };
}

describe('useDocSelection 文档选取子域', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('visible 开启时从 targetDocs 回填已选文档', async () => {
    const { selectedDocs } = setup(makeState({
      visible: true,
      targetDocs: [{ id: 'doc-1', title: '父项目说明书' }],
    }));
    // watch immediate 同步触发
    await Promise.resolve();
    expect(selectedDocs.value).toEqual([{ id: 'doc-1', title: '父项目说明书' }]);
  });

  it('visible 开启且无 targetDocs 时从 docIdsText 逐行回填', async () => {
    const { selectedDocs } = setup(makeState({
      visible: true,
      docIdsText: 'doc-a\ndoc-b\n\n',
    }));
    await Promise.resolve();
    expect(selectedDocs.value).toEqual([
      { id: 'doc-a', title: 'doc-a' },
      { id: 'doc-b', title: 'doc-b' },
    ]);
  });

  it('visible 开启时清理上次会话残留的搜索状态', async () => {
    const { nextTick } = await import('vue');
    const state = makeState({ visible: false, targetDocs: [{ id: 'doc-1', title: '文档一' }] });
    const composable = setup(state);
    const { docSearchKeyword, searchDocResults, searched } = composable;

    // 模拟上次会话残留
    docSearchKeyword.value = '旧关键词';
    searchDocResults.value = [{ id: 'old', title: '旧结果', tags: [] }];
    searched.value = true;

    // 重新打开弹窗（watch 在调度器 flush 后触发）
    state.visible = true;
    await nextTick();
    await nextTick();

    expect(docSearchKeyword.value).toBe('');
    expect(searchDocResults.value).toEqual([]);
    expect(searched.value).toBe(false);
  });

  it('toggleDocSelection 选取与移除互逆，isDocSelected 状态同步', () => {
    const { selectedDocs, toggleDocSelection, isDocSelected, removeDoc } = setup(makeState());

    toggleDocSelection({ id: 'doc-1', title: '文档一' });
    expect(isDocSelected('doc-1')).toBe(true);
    expect(selectedDocs.value).toHaveLength(1);

    toggleDocSelection({ id: 'doc-1', title: '文档一' });
    expect(isDocSelected('doc-1')).toBe(false);
    expect(selectedDocs.value).toHaveLength(0);

    selectedDocs.value.push({ id: 'doc-2', title: '文档二' });
    removeDoc('doc-2');
    expect(selectedDocs.value).toHaveLength(0);
  });

  it('includeSubDocs 开启后 allTargetDocs 合并根文档与有效子文档并去重', () => {
    const { includeSubDocs, selectedDocs, subDocs, excludedSubDocIds, allTargetDocs } = setup(makeState());

    selectedDocs.value = [{ id: 'root', title: '根文档' }];
    includeSubDocs.value = true;
    subDocs.value = [
      { id: 'sub-1', title: '子文档一', isSubDoc: true },
      { id: 'sub-2', title: '子文档二', isSubDoc: true },
      { id: 'root', title: '与根重复的子文档', isSubDoc: true },
    ];

    // 全部有效：3 个（root + 2 子文档，重复 root 去重）
    expect(allTargetDocs.value.map(d => d.id)).toEqual(['root', 'sub-1', 'sub-2']);

    // 排除 sub-1 后仅剩 root + sub-2
    excludedSubDocIds.value = new Set(['sub-1']);
    expect(allTargetDocs.value.map(d => d.id)).toEqual(['root', 'sub-2']);

    // 关闭包含子文档后回退为仅根文档
    includeSubDocs.value = false;
    expect(allTargetDocs.value.map(d => d.id)).toEqual(['root']);
  });

  it('removeDoc 对子文档加入排除集而非从根列表移除', () => {
    const { includeSubDocs, subDocs, excludedSubDocIds, removeDoc, isSubDoc } = setup(makeState());
    includeSubDocs.value = true;
    subDocs.value = [{ id: 'sub-1', title: '子文档', isSubDoc: true }];

    expect(isSubDoc('sub-1')).toBe(true);
    removeDoc('sub-1');
    expect(excludedSubDocIds.value.has('sub-1')).toBe(true);
    expect(isSubDoc('sub-1')).toBe(false); // 被排除后不再是有效子文档
  });

  it('syncManualDocIds 合并手动输入的文档 ID 且不重复', () => {
    const state = makeState({ visible: true, docIdsText: 'manual-1\nmanual-2\n' });
    const { selectedDocs, syncManualDocIds } = setup(state);

    selectedDocs.value = [{ id: 'manual-2', title: '已存在' }];
    syncManualDocIds();

    expect(selectedDocs.value.map(d => d.id)).toEqual(['manual-2', 'manual-1']);
  });

  it('commitExecuteContext 经 onSyncState 回传文本兼容字段（替代 props 突变）', () => {
    const { includeSubDocs, selectedDocs, commitExecuteContext, syncPatches } = setup(makeState());

    selectedDocs.value = [{ id: 'd1', title: '一' }, { id: 'd2', title: '二' }];
    includeSubDocs.value = true;

    commitExecuteContext(['d1', 'd2'], ['AI', 'Vue']);

    expect(syncPatches).toHaveLength(1);
    expect(syncPatches[0]).toEqual({
      docIdsText: 'd1\nd2',
      tagsText: 'AI, Vue',
      includeSubDocs: true,
    });
  });

  it('triggerSearchDocs 委托 TagBatchService.searchDocs 并承载结果', async () => {
    const searchSpy = vi.spyOn(TagBatchService, 'searchDocs').mockResolvedValue([
      { id: 'r1', title: '搜索结果一', tags: [] },
    ]);
    const { docSearchKeyword, searchDocResults, searched, triggerSearchDocs } = setup(makeState());

    docSearchKeyword.value = '  AI  ';
    await triggerSearchDocs();

    expect(searchSpy).toHaveBeenCalledWith('AI', 30);
    expect(searchDocResults.value).toEqual([{ id: 'r1', title: '搜索结果一', tags: [] }]);
    expect(searched.value).toBe(true);
  });

  it('空关键词清空搜索结果', async () => {
    const { docSearchKeyword, searchDocResults, searched, triggerSearchDocs } = setup(makeState());
    docSearchKeyword.value = '';
    await triggerSearchDocs();
    expect(searchDocResults.value).toEqual([]);
    expect(searched.value).toBe(false);
  });

  it('loadDocsFromNotebook 合并笔记本文档并跳过已选', async () => {
    vi.spyOn(TagBatchService, 'fetchNotebooks').mockResolvedValue([{ id: 'nb1', name: '笔记本' }]);
    vi.spyOn(TagBatchService, 'getNotebookDocs').mockResolvedValue([
      { id: 'nb-doc-1', title: '新文档' },
      { id: 'already', title: '已选文档' },
    ]);

    const { notebooks, selectedNotebookId, selectedDocs, loadNotebooks, loadDocsFromNotebook } = setup(makeState());
    await loadNotebooks();
    expect(notebooks.value).toEqual([{ id: 'nb1', name: '笔记本' }]);

    selectedNotebookId.value = 'nb1';
    selectedDocs.value = [{ id: 'already', title: '已选文档' }];
    await loadDocsFromNotebook();

    expect(selectedDocs.value.map(d => d.id)).toEqual(['already', 'nb-doc-1']);
  });
});
