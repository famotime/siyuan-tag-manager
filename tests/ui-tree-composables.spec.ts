import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import type { ITagItem } from '../src/types/tag';
import { useInlineRename } from '../src/composables/useInlineRename';
import { useHeatVisualization } from '../src/composables/useHeatVisualization';
import { useTreeDragDrop } from '../src/composables/useTreeDragDrop';
import { useScrollPersistence } from '../src/composables/useScrollPersistence';

const mockTags: ITagItem[] = [
  { name: 'vue', label: 'vue', count: 100, depth: 0, docCount: 10, blockCount: 100 },
  { name: 'react', label: 'react', count: 50, depth: 0, docCount: 5, blockCount: 50 },
  { name: 'AI', label: 'ai/llm', count: 20, depth: 1, docCount: 2, blockCount: 20 },
  { name: 'orphan', label: 'orphan', count: 0, depth: 0, docCount: 0, blockCount: 0 },
];

describe('useInlineRename 行内就地重命名', () => {
  function setup(allTags: ITagItem[] = mockTags) {
    const onRenameTag = vi.fn();
    const composable = useInlineRename({
      allTags: () => allTags,
      onRenameTag,
    });
    return { onRenameTag, ...composable };
  }

  it('startInlineRename 进入编辑态并聚焦输入框', async () => {
    const { editingLabel, inlineRenameValue, _inlineInputRef, startInlineRename } = setup();
    startInlineRename(mockTags[0]);
    expect(editingLabel.value).toBe('vue');
    expect(inlineRenameValue.value).toBe('vue');
    // nextTick 后聚焦（无 DOM 时静默容错）
    await Promise.resolve();
  });

  it('submitInlineRename 空名称与同名拦截', async () => {
    const { editingLabel, inlineRenameValue, submitInlineRename, onRenameTag } = setup();
    editingLabel.value = 'vue';
    inlineRenameValue.value = '   ';
    await submitInlineRename(mockTags[0]);
    expect(onRenameTag).not.toHaveBeenCalled();

    inlineRenameValue.value = 'vue';
    await submitInlineRename(mockTags[0]);
    expect(editingLabel.value).toBeNull();
    expect(onRenameTag).not.toHaveBeenCalled();
  });

  it('submitInlineRename 拒绝包含层级斜杠的名称', async () => {
    const { inlineRenameValue, submitInlineRename, onRenameTag } = setup();
    inlineRenameValue.value = 'a/b';
    await submitInlineRename(mockTags[0]);
    expect(onRenameTag).not.toHaveBeenCalled();
  });

  it('submitInlineRename 拒绝重名标签（大小写不敏感）', async () => {
    const { inlineRenameValue, submitInlineRename, onRenameTag } = setup();
    // 顶层标签重命名为既存的 react（大小写不同）
    inlineRenameValue.value = 'React';
    await submitInlineRename(mockTags[0]);
    expect(onRenameTag).not.toHaveBeenCalled();
  });

  it('无子标签时直接提交重命名并回调', async () => {
    const { inlineRenameValue, submitInlineRename, onRenameTag, editingLabel } = setup();
    inlineRenameValue.value = 'VueJS';
    await submitInlineRename(mockTags[0]);
    expect(onRenameTag).toHaveBeenCalledWith('vue', 'VueJS');
    expect(editingLabel.value).toBeNull();
  });

  it('存在子标签时唤起级联确认对话框，确认后提交', async () => {
    const tags: ITagItem[] = [
      { name: 'AI', label: 'ai/llm', count: 1, depth: 1 },
      { name: 'llm', label: 'ai/llm/gpt', count: 1, depth: 2 },
    ];
    const { inlineRenameValue, submitInlineRename, cascadeRenameConfirmState, confirmCascadeRename, onRenameTag } = setup(tags);
    inlineRenameValue.value = 'ML';
    await submitInlineRename(tags[0]);
    expect(cascadeRenameConfirmState.value.visible).toBe(true);
    expect(cascadeRenameConfirmState.value.childCount).toBe(1);
    expect(onRenameTag).not.toHaveBeenCalled();

    confirmCascadeRename();
    expect(onRenameTag).toHaveBeenCalledWith('ai/llm', 'ai/ML');
    expect(cascadeRenameConfirmState.value.visible).toBe(false);
  });

  it('handleInlineRenameBlur 提交中或级联确认中不取消编辑', () => {
    const { inlineRenameValue, handleInlineRenameBlur, editingLabel, cascadeRenameConfirmState, cancelInlineRename } = setup();
    editingLabel.value = 'vue';
    inlineRenameValue.value = 'pending-value';
    cascadeRenameConfirmState.value.visible = true;
    handleInlineRenameBlur(mockTags[0]);
    expect(editingLabel.value).toBe('vue');
    cascadeRenameConfirmState.value.visible = false;
    cancelInlineRename();
    expect(editingLabel.value).toBeNull();
  });
});

describe('useHeatVisualization 热度双模可视化', () => {
  function setup(tags: ITagItem[] = mockTags, expanded = true) {
    const virtualAllTags = ref<ITagItem[]>(tags);
    const heatExpanded = ref(expanded);
    const composable = useHeatVisualization({ virtualAllTags, heatExpanded });
    return { virtualAllTags, heatExpanded, ...composable };
  }

  it('cloudTags 按范围过滤：top20/top50/all', () => {
    const { cloudTags, heatScope } = setup();
    expect(cloudTags.value.length).toBe(4);
    heatScope.value = 'top20';
    expect(cloudTags.value.length).toBe(3); // 仅 count>0 的 3 个
    expect(cloudTags.value[0].label).toBe('vue'); // 引用数降序
    heatScope.value = 'all';
    expect(cloudTags.value.length).toBe(4);
  });

  it('computeCloudFontSize 零引用取最小字号，等值取中值', () => {
    const { computeCloudFontSize } = setup();
    expect(computeCloudFontSize(0)).toBe(11);
    const equal = setup([{ name: 'a', label: 'a', count: 5, depth: 0 }]);
    expect(equal.computeCloudFontSize(5)).toBe(14);
  });

  it('getHeatTierClass 按比例分级', () => {
    const { getHeatTierClass } = setup();
    expect(getHeatTierClass(0)).toBe('tier-zero');
    // vue=100(max), react=50, ai/llm=20, min effective=20
    expect(getHeatTierClass(100)).toBe('tier-extreme');
    expect(getHeatTierClass(0)).toBe('tier-zero');
  });

  it('formatPercent 计算占比', () => {
    const { formatPercent } = setup();
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(100)).toBe('59%'); // 100/170 ≈ 58.8%
    expect(formatPercent(5)).toBe('2.9%'); // 小数保留一位
  });

  it('getRankBarWidth 零引用为 0，最大引用为 100', () => {
    const { getRankBarWidth } = setup();
    expect(getRankBarWidth(0)).toBe(0);
    expect(getRankBarWidth(100)).toBe(100);
    expect(getRankBarWidth(50)).toBe(50);
  });

  it('heatBadgeCount 全量范围或折叠时为全库标签数，限定范围时为过滤数', () => {
    const { heatBadgeCount, heatExpanded, heatScope } = setup(mockTags, false);
    expect(heatBadgeCount.value).toBe(4);
    heatExpanded.value = true;
    expect(heatBadgeCount.value).toBe(4); // 默认 all 范围
    heatScope.value = 'top20';
    expect(heatBadgeCount.value).toBe(3); // 限定范围
  });
});

describe('useTreeDragDrop 拖拽层级重构', () => {
  function setup(tags: ITagItem[] = mockTags) {
    const onBatchReparent = vi.fn();
    const virtualAllTags = ref<ITagItem[]>(tags);
    const collapsedSet = ref<Set<string>>(new Set());
    const composable = useTreeDragDrop({
      virtualAllTags,
      collapsedSet,
      onBatchReparent,
    });
    return { onBatchReparent, virtualAllTags, collapsedSet, ...composable };
  }

  function makeDragEvent(data: Record<string, string> = {}): DragEvent {
    return {
      dataTransfer: {
        effectAllowed: '',
        dropEffect: '',
        setData: vi.fn(),
        getData: (type: string) => data[type] || '',
      },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 0,
      clientY: 0,
      target: null,
      currentTarget: null,
    } as unknown as DragEvent;
  }

  it('startTagDrag 设置全局拖拽标签并写入 dataTransfer', () => {
    const { startTagDrag, _draggingTagLabel } = setup();
    const e = makeDragEvent();
    startTagDrag('vue', e);
    expect(e.dataTransfer?.setData).toHaveBeenCalledWith('application/siyuan-tag', 'vue');
    expect(e.dataTransfer?.setData).toHaveBeenCalledWith('text/plain', '#vue# ');
  });

  it('handleDragEnd 清空全部拖拽状态', () => {
    const { startTagDrag, handleDragEnd, draggingTagLabel, dragIndicator, dragOverTagLabel } = setup();
    startTagDrag('vue', makeDragEvent());
    handleDragEnd();
    expect(draggingTagLabel.value).toBeNull();
    expect(dragIndicator.value).toBeNull();
    expect(dragOverTagLabel.value).toBeNull();
  });

  it('handleDropToRoot 生成拖出为根标签的重构确认状态', () => {
    const tags: ITagItem[] = [
      { name: 'gpt', label: 'ai/llm/gpt', count: 5, depth: 2 },
    ];
    const { handleDropToRoot, reparentConfirmState } = setup(tags);
    const e = makeDragEvent({ 'application/siyuan-tag': 'ai/llm/gpt' });
    handleDropToRoot(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(reparentConfirmState.value.visible).toBe(true);
    expect(reparentConfirmState.value.srcLabel).toBe('ai/llm/gpt');
    expect(reparentConfirmState.value.targetParentLabel).toBeNull();
    expect(reparentConfirmState.value.moves.length).toBeGreaterThan(0);
  });

  it('handleDropOnNode 归为目标节点子标签', () => {
    const tags: ITagItem[] = [
      { name: 'vue', label: 'vue', count: 5, depth: 0 },
      { name: 'gpt', label: 'ai/llm/gpt', count: 5, depth: 2 },
    ];
    const { handleDropOnNode, reparentConfirmState, dragIndicator } = setup(tags);
    const e = makeDragEvent({ 'application/siyuan-tag': 'ai/llm/gpt' });
    handleDropOnNode(tags[0], e);
    expect(reparentConfirmState.value.visible).toBe(true);
    expect(reparentConfirmState.value.targetParentLabel).toBe('vue');
    expect(dragIndicator.value).toBeNull();
  });

  it('handleDropOnNode 忽略自身与子孙节点', () => {
    const tags: ITagItem[] = [{ name: 'gpt', label: 'ai/llm/gpt', count: 5, depth: 2 }];
    const { handleDropOnNode, reparentConfirmState } = setup(tags);
    const e = makeDragEvent({ 'application/siyuan-tag': 'ai/llm/gpt' });
    handleDropOnNode(tags[0], e);
    expect(reparentConfirmState.value.visible).toBe(false);
  });

  it('handleExecuteReparentDirectly 提交暂存变动并展开目标祖先链', () => {
    const { reparentConfirmState, handleExecuteReparentDirectly, onBatchReparent, collapsedSet } = setup();
    collapsedSet.value = new Set(['ai', 'ai/llm']);
    reparentConfirmState.value = {
      visible: true,
      srcLabel: 'x',
      targetParentLabel: 'ai/llm/gpt',
      moves: [{ oldLabel: 'a', newLabel: 'ai/llm/gpt/a' }],
      quoteCount: 1,
    };
    handleExecuteReparentDirectly();
    expect(onBatchReparent).toHaveBeenCalledWith([{ oldLabel: 'a', newLabel: 'ai/llm/gpt/a' }]);
    expect(collapsedSet.value.has('ai')).toBe(false);
    expect(collapsedSet.value.has('ai/llm')).toBe(false);
    expect(reparentConfirmState.value.visible).toBe(false);
  });
});

describe('useScrollPersistence 全景浏览位置保持', () => {
  it('handleScrollerScroll 与 handleNodeTagClick 委托 TagTreeService 持久化并回调', async () => {
    const { TagTreeService } = await import('../src/services/TagTreeService');
    const saveSpy = vi.spyOn(TagTreeService, 'saveScrollPosition').mockImplementation(() => {});
    const getSpy = vi.spyOn(TagTreeService, 'getSavedScrollPosition').mockReturnValue({
      scrollTop: 120,
      lastClickedTag: 'vue',
    } as any);

    const onTagClick = vi.fn();
    const onSwitchToFilter = vi.fn();
    const { scrollerRef, handleScrollerScroll, handleNodeTagClick, handleSwitchToFilter } = useScrollPersistence({
      onTagClick,
      onSwitchToFilter,
    });

    const scroller = { scrollTop: 88 } as HTMLElement;
    scrollerRef.value = scroller;
    handleScrollerScroll({ target: scroller } as unknown as Event);
    expect(saveSpy).toHaveBeenCalledWith(88);

    handleNodeTagClick('vue', {} as MouseEvent);
    expect(saveSpy).toHaveBeenCalledWith(88, 'vue');
    expect(onTagClick).toHaveBeenCalledWith('vue', {});

    handleSwitchToFilter();
    expect(onSwitchToFilter).toHaveBeenCalled();

    // 无 scroller 时的兜底
    scrollerRef.value = null;
    handleNodeTagClick('react', {} as MouseEvent);
    expect(saveSpy).toHaveBeenCalledWith(-1, 'react');

    saveSpy.mockRestore();
    getSpy.mockRestore();
  });
});
