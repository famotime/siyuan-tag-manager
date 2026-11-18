import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTagFilter, savedViews } from '../src/composables/useTagFilter';
import { TagFilterEngine } from '../src/services/TagFilterEngine';

/**
 * useTagFilter 筛选查询状态机测试
 * 重点覆盖竞态防护 seq 与 queryLoading 生命周期的边界场景
 */
describe('useTagFilter 查询状态机', () => {
  let querySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const { activeFilter, matchedBlocks } = useTagFilter();
    activeFilter.value = { includeTags: [], excludeTags: [], optionalTags: [] };
    matchedBlocks.value = [];
    savedViews.value = [];
    querySpy = vi.spyOn(TagFilterEngine, 'queryMatchedBlocks');
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  it('空筛选提前返回时复位 queryLoading', async () => {
    const { runQuery, queryLoading } = useTagFilter();

    queryLoading.value = true;
    await runQuery();
    expect(queryLoading.value).toBe(false);
  });

  it('清空筛选打断在途查询后 queryLoading 不卡死，且陈旧结果被丢弃', async () => {
    const { activeFilter, runQuery, queryLoading, matchedBlocks } = useTagFilter();

    // 1. 启动一个挂起中的查询
    let resolvePending!: (blocks: any[]) => void;
    querySpy.mockImplementation(() => new Promise((resolve) => {
      resolvePending = resolve;
    }));

    activeFilter.value = { includeTags: ['vue'], excludeTags: [], optionalTags: [] };
    const pending = runQuery();
    expect(queryLoading.value).toBe(true);

    // 2. 用户在查询飞行中清空筛选 -> 触发空筛选分支
    activeFilter.value = { includeTags: [], excludeTags: [], optionalTags: [] };
    await runQuery();

    // 修复点：空筛选分支必须复位 loading，否则挂起查询的 finally 因 seq 失配永远不复位
    expect(queryLoading.value).toBe(false);

    // 3. 挂起的陈旧查询迟到了：结果应被丢弃，loading 保持 false
    resolvePending([{ id: 'stale-block', rootId: 'r1', docTitle: 'stale', content: 'x', markdown: '', type: 'p', updated: '' }]);
    await pending;
    expect(matchedBlocks.value).toEqual([]);
    expect(queryLoading.value).toBe(false);
    querySpy.mockRestore();
  });

  it('正常查询成功后写入匹配块并复位 loading', async () => {
    const { activeFilter, runQuery, queryLoading, matchedBlocks } = useTagFilter();
    const block = { id: 'b1', rootId: 'r1', docTitle: 'doc', content: '#vue#', markdown: '', type: 'p', updated: '1' };
    querySpy.mockResolvedValue([block]);

    activeFilter.value = { includeTags: ['vue'], excludeTags: [], optionalTags: [] };
    await runQuery();

    expect(queryLoading.value).toBe(false);
    expect(matchedBlocks.value).toEqual([block]);
    expect(querySpy).toHaveBeenCalledWith(
      { includeTags: ['vue'], excludeTags: [], optionalTags: [], limit: 40 },
      expect.any(Function),
    );
  });

  it('后发查询生效时先发查询的结果被丢弃', async () => {
    const { activeFilter, runQuery, queryLoading, matchedBlocks } = useTagFilter();

    const resolvers: Array<(blocks: any[]) => void> = [];
    querySpy.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));

    activeFilter.value = { includeTags: ['vue'], excludeTags: [], optionalTags: [] };
    const first = runQuery();
    activeFilter.value = { includeTags: ['react'], excludeTags: [], optionalTags: [] };
    const second = runQuery();

    resolvers[1]([{ id: 'new', rootId: 'r1', docTitle: 'doc', content: '', markdown: '', type: 'p', updated: '' }]);
    resolvers[0]([{ id: 'old', rootId: 'r0', docTitle: 'doc0', content: '', markdown: '', type: 'p', updated: '' }]);
    await Promise.all([first, second]);

    expect(matchedBlocks.value.map(b => b.id)).toEqual(['new']);
    expect(queryLoading.value).toBe(false);
  });

  it('查询失败时提示错误并复位 loading', async () => {
    const { activeFilter, runQuery, queryLoading, matchedBlocks } = useTagFilter();
    querySpy.mockRejectedValue(new Error('network down'));

    activeFilter.value = { includeTags: ['vue'], excludeTags: [], optionalTags: [] };
    await runQuery();

    expect(queryLoading.value).toBe(false);
    expect(matchedBlocks.value).toEqual([]);
  });
});
