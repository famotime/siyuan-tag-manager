import { describe, expect, it, vi, afterEach } from 'vitest';
import type { ITagItem } from '../src/types/tag';
import { TagFilterEngine } from '../src/services/TagFilterEngine';
import { TagGovernanceService } from '../src/services/TagGovernanceService';

describe('UI Composables 与状态管理规范化测试', () => {
  const mockTags: ITagItem[] = [
    { name: 'vue', label: 'vue', count: 12, depth: 0 },
    { name: 'react', label: 'react', count: 8, depth: 0 },
    { name: 'siyuan', label: 'tool/siyuan', count: 15, depth: 1 },
    { name: 'orphan', label: 'orphan', count: 0, depth: 0 },
    { name: 'Vue', label: 'Vue', count: 2, depth: 0 }, // 大小写冲突
  ];

  describe('TagFilterEngine 交互操作测试', () => {
    it('resolveFilterSelection 单选与追加模式行为正确', () => {
      const initial = { includeTags: ['vue'], excludeTags: ['react'] };

      // 单选模式 (append=false): 清空既有筛选，仅以目标标签作为包含项
      const single = TagFilterEngine.resolveFilterSelection(initial, 'tool/siyuan', false);
      expect(single.includeTags).toEqual(['tool/siyuan']);
      expect(single.excludeTags).toEqual([]);

      // 追加模式 (append=true): 若尚未包含则追加，若在排除列表中则移除
      const appended = TagFilterEngine.resolveFilterSelection(single, 'typescript', true);
      expect(appended.includeTags).toEqual(['tool/siyuan', 'typescript']);

      const repeatAppend = TagFilterEngine.resolveFilterSelection(appended, 'typescript', true);
      expect(repeatAppend.includeTags).toEqual(['tool/siyuan', 'typescript']);
    });

    it('toggleFilterSelection 多选切换与反选正确', () => {
      const initial = { includeTags: ['vue'], excludeTags: ['react'] };
      const toggled = TagFilterEngine.toggleFilterSelection(initial, 'react');
      expect(toggled.includeTags).toEqual(['vue', 'react']);
      expect(toggled.excludeTags).toEqual([]);

      const toggledAgain = TagFilterEngine.toggleFilterSelection(toggled, 'vue');
      expect(toggledAgain.includeTags).toEqual(['react']);
    });

    it('resetFilterWithTags 能正确清空并重置为指定多标签', () => {
      const reset = TagFilterEngine.resetFilterWithTags(['tagA', 'tagB']);
      expect(reset.includeTags).toEqual(['tagA', 'tagB']);
      expect(reset.excludeTags).toEqual([]);
    });

    it('clearFilterSelection 返回全空筛选集', () => {
      const cleared = TagFilterEngine.clearFilterSelection();
      expect(cleared.includeTags).toEqual([]);
      expect(cleared.excludeTags).toEqual([]);
    });
  });

  describe('TagGovernanceService 诊断与治理交互', () => {
    it('runHealthInspection 准确识别相似冲突与孤立标签', () => {
      const report = TagGovernanceService.runHealthInspection(mockTags);
      expect(report.summary.healthyRate).toBeLessThan(100);
      expect(report.summary.orphans).toBe(1);

      const conflict = report.issues.find(i => i.type === 'similar_conflict' || i.type === 'case_conflict');
      expect(conflict).toBeDefined();
      expect(conflict?.relatedLabels).toContain('Vue');
    });

    it('generateMergePlan 针对大小写冲突能正确生成合并计划', () => {
      const { plan, error } = TagGovernanceService.generateMergePlan('vue', ['Vue'], mockTags, true);
      expect(error).toBeUndefined();
      expect(plan).toBeDefined();
      expect(plan?.targetLabel).toBe('vue');
      expect(plan?.sourceLabels).toEqual(['Vue']);
    });
  });

  describe('useTagData 侧面板独立标签资产管理测试', () => {
    it('addCustomTag 仅添加到侧面板 allTags 与 customTags，不修改文档', async () => {
      const { usePlugin } = await import('../src/main');
      const { useTagData } = await import('../src/composables/useTagData');

      let savedData: any = null;
      const mockPlugin = {
        loadData: async () => ({ customTags: [] }),
        saveData: async (_file: string, data: any) => {
          savedData = data;
        },
      } as any;
      usePlugin(mockPlugin);

      const { allTags, customTags, addCustomTag } = useTagData();

      // 添加新标签
      const res = await addCustomTag('#Frontend/NextJS#');
      expect(res.success).toBe(true);
      expect(res.label).toBe('Frontend/NextJS');

      // 验证仅在 allTags 和 customTags 中增加
      expect(customTags.value).toContain('Frontend/NextJS');
      const tagItem = allTags.value.find(t => t.label === 'Frontend/NextJS');
      expect(tagItem).toBeDefined();
      expect(tagItem?.count).toBe(0);
      expect(tagItem?.name).toBe('NextJS');

      // 验证本地配置持久化
      expect(savedData?.customTags).toContain('Frontend/NextJS');

      // 重复添加同一个标签会被拦截
      const repeatRes = await addCustomTag('Frontend/NextJS');
      expect(repeatRes.success).toBe(false);
      expect(repeatRes.error).toContain('已存在');
    });

    it('refreshTags 启动时能够从持久化配置回填 savedViews（修复保存视图重启丢失）', async () => {
      const { usePlugin } = await import('../src/main');
      const { TagApiClient } = await import('../src/services/TagApiClient');
      const { useTagData } = await import('../src/composables/useTagData');
      const { savedViews } = await import('../src/composables/useTagFilter');

      vi.spyOn(TagApiClient, 'fetchAllTags').mockResolvedValue([]);
      const persistedView = {
        id: 'view_test_1',
        title: '回归验证视图',
        includeTags: ['vue'],
        excludeTags: [],
        optionalTags: [],
        displayMode: 'card',
        createdAt: 1700000000000,
      };
      const mockPlugin = {
        loadData: async () => ({ savedViews: [persistedView] }),
        saveData: async () => {},
      } as any;
      usePlugin(mockPlugin);

      // 启动前清空共享状态，确保回填确实来自持久化配置
      savedViews.value = [];
      await useTagData().refreshTags();

      expect(savedViews.value).toHaveLength(1);
      expect(savedViews.value[0].id).toBe('view_test_1');
      expect(savedViews.value[0].title).toBe('回归验证视图');
      expect(savedViews.value[0].includeTags).toEqual(['vue']);
    });

    it('persistConfig 无参调用时以共享 savedViews 状态写盘而非空数组覆盖', async () => {
      const { usePlugin } = await import('../src/main');
      const { TagApiClient } = await import('../src/services/TagApiClient');
      const { useTagData } = await import('../src/composables/useTagData');
      const { savedViews } = await import('../src/composables/useTagFilter');

      vi.spyOn(TagApiClient, 'fetchAllTags').mockResolvedValue([]);
      const existingView = {
        id: 'view_keep_1',
        title: '不应被清空的视图',
        includeTags: ['keep'],
        excludeTags: [],
        optionalTags: [],
        displayMode: 'card',
        createdAt: 1700000000000,
      };
      savedViews.value = [existingView as any];

      let savedData: any = null;
      const mockPlugin = {
        loadData: async () => ({}),
        saveData: async (_file: string, data: any) => {
          savedData = data;
        },
      } as any;
      usePlugin(mockPlugin);

      // 模拟历史缺陷触发路径：handleRemoveTag 内部的无参 persistConfig
      // 删除不存在标签时 executeDeleteTag 走 remove_all 之外的查询分支，此处直接用删除流程驱动
      const { TagDeletionService } = await import('../src/services/TagDeletionService');
      vi.spyOn(TagDeletionService, 'executeDeleteTag').mockResolvedValue({
        success: true,
        affectedBlocks: 0,
        errors: [],
      });

      await useTagData().handleRemoveTag('vue');

      expect(savedData?.savedViews).toHaveLength(1);
      expect(savedData?.savedViews[0].id).toBe('view_keep_1');
    });

    it('handleRenameTag 能够正确重命名标签并级联迁移子标签元数据与标签组', async () => {
      const { usePlugin } = await import('../src/main');
      const { TagApiClient } = await import('../src/services/TagApiClient');
      const { useTagData } = await import('../src/composables/useTagData');

      let renamedOld = '';
      let renamedNew = '';
      vi.spyOn(TagApiClient, 'renameTag').mockImplementation(async (oldLabel, newLabel) => {
        renamedOld = oldLabel;
        renamedNew = newLabel;
      });

      let savedData: any = null;
      const mockPlugin = {
        loadData: async () => null,
        saveData: async (_file: string, data: any) => {
          savedData = data;
        },
      } as any;
      usePlugin(mockPlugin);

      const {
        metadataMap,
        customTags,
        tagGroups,
        handleRenameTag,
      } = useTagData();

      // 准备初始元数据、自定义标签、标签组
      metadataMap.value.set('Tech', {
        label: 'Tech',
        backgroundColor: '#112233',
        icon: '💻',
      });
      metadataMap.value.set('Tech/Vue', {
        label: 'Tech/Vue',
        textColor: '#42b883',
      });
      metadataMap.value.set('Other', {
        label: 'Other',
      });

      customTags.value = ['Tech', 'Tech/Vue', 'Other'];
      tagGroups.value = [
        { id: 'g1', name: '技术栈', tags: ['Tech', 'Tech/Vue', 'Other'] },
      ];

      // 执行重命名 Tech -> Technology
      const res = await handleRenameTag('Tech', 'Technology');
      expect(res.success).toBe(true);
      expect(renamedOld).toBe('Tech');
      expect(renamedNew).toBe('Technology');

      // 验证自身与下属子标签元数据键名同步迁移
      expect(metadataMap.value.has('Tech')).toBe(false);
      expect(metadataMap.value.has('Tech/Vue')).toBe(false);
      expect(metadataMap.value.get('Technology')?.backgroundColor).toBe('#112233');
      expect(metadataMap.value.get('Technology')?.icon).toBe('💻');
      expect(metadataMap.value.get('Technology/Vue')?.textColor).toBe('#42b883');
      expect(metadataMap.value.has('Other')).toBe(true);

      // 验证 customTags 同步迁移
      expect(customTags.value).toContain('Technology');
      expect(customTags.value).toContain('Technology/Vue');
      expect(customTags.value).not.toContain('Tech');
      expect(customTags.value).not.toContain('Tech/Vue');

      // 验证 tagGroups 中的引用同步迁移
      expect(tagGroups.value[0].tags).toEqual(['Technology', 'Technology/Vue', 'Other']);

      // 验证保存的配置正确持久化
      expect(savedData).toBeDefined();
    });

    it('migrateTagReferences 合并语义：目标元数据已存在时保留目标样式并合并别名', async () => {
      const { usePlugin } = await import('../src/main');
      const { useTagData } = await import('../src/composables/useTagData');
      usePlugin({ loadData: async () => null, saveData: async () => {} } as any);

      const { metadataMap, migrateTagReferences } = useTagData();
      metadataMap.value.set('ai', {
        label: 'ai',
        backgroundColor: '#111111',
        aliases: ['人工智能'],
        updatedAt: 1,
      });
      metadataMap.value.set('AI', {
        label: 'AI',
        textColor: '#ffffff',
        aliases: ['AI'],
        updatedAt: 2,
      });

      migrateTagReferences('ai', 'AI');

      expect(metadataMap.value.has('ai')).toBe(false);
      const merged = metadataMap.value.get('AI');
      // 目标已有字段优先，源标签独有字段并入
      expect(merged?.backgroundColor).toBe('#111111');
      expect(merged?.textColor).toBe('#ffffff');
      expect(merged?.aliases).toEqual(expect.arrayContaining(['AI', '人工智能']));
    });

    it('migrateTagReferences 迁移后自定义标签与标签组去重且大小写不敏感', async () => {
      const { usePlugin } = await import('../src/main');
      const { useTagData } = await import('../src/composables/useTagData');
      const { savedViews } = await import('../src/composables/useTagFilter');
      usePlugin({ loadData: async () => null, saveData: async () => {} } as any);

      const { customTags, tagGroups, migrateTagReferences } = useTagData();
      customTags.value = ['ai', 'AI', 'other'];
      tagGroups.value = [
        { id: 'g1', name: '智能', tags: ['ai', 'AI', 'other'] },
        { id: 'g2', name: '子级', tags: ['ai/llm', 'other'] },
      ];
      savedViews.value = [
        {
          id: 'v1',
          title: 'AI 视图',
          includeTags: ['ai', 'ai/llm'],
          excludeTags: [],
          optionalTags: [],
          displayMode: 'card',
          createdAt: 1,
        } as any,
      ];

      migrateTagReferences('ai', 'AI');

      // customTags：ai 与 AI 迁移后合并为单一大写项
      expect(customTags.value).toEqual(['AI', 'other']);
      // tagGroups：组内去重，子标签级联迁移
      expect(tagGroups.value[0].tags).toEqual(['AI', 'other']);
      expect(tagGroups.value[1].tags).toEqual(['AI/llm', 'other']);
      // 智能视图同步迁移
      expect(savedViews.value[0].includeTags).toEqual(['AI', 'AI/llm']);
    });

    it('refreshTags 并发时仅最新一次生效，先发后至的旧响应整体丢弃', async () => {
      const { usePlugin } = await import('../src/main');
      const { TagApiClient } = await import('../src/services/TagApiClient');
      const { TagConfigStore } = await import('../src/services/TagConfigStore');
      const { useTagData } = await import('../src/composables/useTagData');

      usePlugin({ loadData: async () => ({}), saveData: async () => {} } as any);

      // 两路可独立放行的挂起响应
      const configResolvers: Array<(v: any) => void> = [];
      const readSpy = vi.spyOn(TagConfigStore, 'readConfig')
        .mockImplementation(() => new Promise((resolve) => { configResolvers.push(resolve); }));
      const fetchResolvers: Array<(v: any[]) => void> = [];
      const fetchSpy = vi.spyOn(TagApiClient, 'fetchAllTags')
        .mockImplementation(() => new Promise((resolve) => { fetchResolvers.push(resolve); }));

      try {
        const { allTags, loading, customTags, refreshTags } = useTagData();
        customTags.value = []; // 清理前序用例残留的共享自定义标签
        const first = refreshTags();
        await Promise.resolve();
        configResolvers[0]({ metadataList: [] });
        await Promise.resolve(); // 先发刷新通过配置检查，进入 fetchAllTags 挂起
        expect(fetchResolvers.length).toBe(1);

        const second = refreshTags();
        await Promise.resolve();
        configResolvers[1]({ metadataList: [] });
        await Promise.resolve();
        expect(fetchResolvers.length).toBe(2);

        // 引用计数忙碌态：两段刷新区间叠加时保持忙碌
        expect(loading.value).toBe(true);

        // 后发刷新先返回 -> 生效
        fetchResolvers[1]([{ name: 'new', label: 'new', count: 2, depth: 0, blockCount: 2, docCount: 1 }]);
        await second;
        expect(loading.value).toBe(true); // 旧刷新仍在飞行，忙碌未解除

        // 先发刷新迟到 -> 数据被丢弃
        fetchResolvers[0]([{ name: 'old', label: 'old', count: 1, depth: 0, blockCount: 1, docCount: 1 }]);
        await first;

        expect(allTags.value.map(t => t.label)).toEqual(['new']);
        expect(loading.value).toBe(false); // 全部结束后忙碌解除
      } finally {
        readSpy.mockRestore();
        fetchSpy.mockRestore();
      }
    });

    it('handleRemoveTag 在删除确认后调用 TagDeletionService 并清理元数据与自定义标签', async () => {
      const { usePlugin } = await import('../src/main');
      const { TagDeletionService } = await import('../src/services/TagDeletionService');
      const { useTagData } = await import('../src/composables/useTagData');

      // mock confirm 模拟用户确认
      (globalThis as any).confirm = vi.fn().mockReturnValue(true);

      let executedLabel = '';
      vi.spyOn(TagDeletionService, 'executeDeleteTag').mockImplementation(async (label) => {
        executedLabel = label;
        return { success: true, affectedBlocks: 1, errors: [] };
      });

      let savedData: any = { customTags: ['DeleteMe', 'KeepMe'] };
      const mockPlugin = {
        loadData: async () => savedData,
        saveData: async (_file: string, data: any) => {
          savedData = data;
        },
      } as any;
      usePlugin(mockPlugin);

      const { TagApiClient } = await import('../src/services/TagApiClient');
      vi.spyOn(TagApiClient, 'fetchAllTags').mockResolvedValue([]);

      const {
        metadataMap,
        customTags,
        handleRemoveTag,
      } = useTagData();

      customTags.value = ['DeleteMe', 'KeepMe'];
      metadataMap.value.set('DeleteMe', {
        label: 'DeleteMe',
        updatedAt: Date.now(),
      });

      const success = await handleRemoveTag('DeleteMe');
      expect(success).toBe(true);
      expect(executedLabel).toBe('DeleteMe');
      expect(customTags.value).not.toContain('DeleteMe');
      expect(customTags.value).toContain('KeepMe');
      expect(metadataMap.value.has('DeleteMe')).toBe(false);
      expect(savedData).toBeDefined();
    });
  });

  describe('useTagFilter AND/OR 逻辑切换与即时刷新测试', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('toggleTagCondition 点击标签仅切换该标签状态，其余标签保持不变，并即时触发 runQuery', async () => {
      const { useTagFilter } = await import('../src/composables/useTagFilter');

      const mockBlocks = [
        { id: 'b1', docTitle: 'Doc1', content: '#Vue# #React#', markdown: '', type: 'p', rootId: 'r1', updated: '2026-09-27' },
      ];
      let queriedOptions: any = null;
      vi.spyOn(TagFilterEngine, 'queryMatchedBlocks').mockImplementation(async (opts) => {
        queriedOptions = opts;
        return mockBlocks as any;
      });

      const { activeFilter, matchedBlocks, toggleTagCondition } = useTagFilter();
      activeFilter.value = {
        includeTags: ['Vue', 'React'],
        optionalTags: [],
        excludeTags: [],
      };

      // 用户点击 React 芯片切换为 optional (OR)
      toggleTagCondition('React', 'optional');

      // 验证仅切换了点击的 React，Vue 依然保持在 includeTags 中
      expect(activeFilter.value.includeTags).toEqual(['Vue']);
      expect(activeFilter.value.optionalTags).toEqual(['React']);
      expect(activeFilter.value.excludeTags).toEqual([]);

      // 验证触发了 queryMatchedBlocks 刷新
      expect(queriedOptions).toBeDefined();
      expect(queriedOptions.includeTags).toEqual(['Vue']);
      expect(queriedOptions.optionalTags).toEqual(['React']);

      // 验证下方的筛选结果即时更新
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(matchedBlocks.value).toHaveLength(1);
    });

    it('toggleTagCondition 将 OR 标签转为 NOT (exclude) 时仅影响该标签', async () => {
      const { useTagFilter } = await import('../src/composables/useTagFilter');

      let queriedOptions: any = null;
      vi.spyOn(TagFilterEngine, 'queryMatchedBlocks').mockImplementation(async (opts) => {
        queriedOptions = opts;
        return [] as any;
      });

      const { activeFilter, toggleTagCondition } = useTagFilter();
      activeFilter.value = {
        includeTags: ['Vue'],
        optionalTags: ['React'],
        excludeTags: [],
      };

      toggleTagCondition('React', 'exclude');

      expect(activeFilter.value.includeTags).toEqual(['Vue']);
      expect(activeFilter.value.optionalTags).toEqual([]);
      expect(activeFilter.value.excludeTags).toEqual(['React']);
      expect(queriedOptions.includeTags).toEqual(['Vue']);
      expect(queriedOptions.excludeTags).toEqual(['React']);
    });

    it('switchFilterMode 在顶栏模式切换时能够直接双向转换已有标签并刷新结果', async () => {
      const { useTagFilter } = await import('../src/composables/useTagFilter');

      let queriedOptions: any = null;
      vi.spyOn(TagFilterEngine, 'queryMatchedBlocks').mockImplementation(async (opts) => {
        queriedOptions = opts;
        return [] as any;
      });

      const { activeFilter, switchFilterMode } = useTagFilter();
      activeFilter.value = {
        includeTags: ['Vue', 'React'],
        optionalTags: [],
        excludeTags: ['Angular'],
      };

      // 点击 [OR 可选]
      switchFilterMode('optional');
      expect(activeFilter.value.includeTags).toEqual([]);
      expect(activeFilter.value.optionalTags).toEqual(['Vue', 'React']);
      expect(activeFilter.value.excludeTags).toEqual(['Angular']);
      expect(queriedOptions.optionalTags).toEqual(['Vue', 'React']);
      expect(queriedOptions.includeTags).toEqual([]);

      // 点击 [AND 必含]
      switchFilterMode('include');
      expect(activeFilter.value.includeTags).toEqual(['Vue', 'React']);
      expect(activeFilter.value.optionalTags).toEqual([]);
      expect(activeFilter.value.excludeTags).toEqual(['Angular']);
      expect(queriedOptions.includeTags).toEqual(['Vue', 'React']);
    });

    it('toggleTagFilter 仅切换指定标签，不影响已有标签条件', async () => {
      const { useTagFilter } = await import('../src/composables/useTagFilter');

      let queriedOptions: any = null;
      vi.spyOn(TagFilterEngine, 'queryMatchedBlocks').mockImplementation(async (opts) => {
        queriedOptions = opts;
        return [] as any;
      });

      const { activeFilter, toggleTagFilter } = useTagFilter();
      activeFilter.value = {
        includeTags: ['Vue'],
        optionalTags: [],
        excludeTags: [],
      };

      // 在 optional 模式下添加标签 React
      toggleTagFilter('React', 'optional');
      expect(activeFilter.value.includeTags).toEqual(['Vue']);
      expect(activeFilter.value.optionalTags).toEqual(['React']);
      expect(queriedOptions.includeTags).toEqual(['Vue']);
      expect(queriedOptions.optionalTags).toEqual(['React']);
    });
  });
});
