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
    it('runHealthInspection 准确识别大小写冲突与孤立标签', () => {
      const report = TagGovernanceService.runHealthInspection(mockTags);
      expect(report.summary.healthyRate).toBeLessThan(100);
      expect(report.summary.orphans).toBe(1);

      const caseConflict = report.issues.find(i => i.type === 'case_conflict');
      expect(caseConflict).toBeDefined();
      expect(caseConflict?.relatedLabels).toContain('Vue');
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
  });

  describe('useTagFilter AND/OR 逻辑切换与即时刷新测试', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('toggleTagCondition 将 AND 标签转为 OR 时，所有正向标签统一转为 optionalTags 并触发 runQuery', async () => {
      const { TagApiClient } = await import('../src/services/TagApiClient');
      const { useTagFilter } = await import('../src/composables/useTagFilter');

      const mockBlocks = [
        { id: 'b1', docTitle: 'Doc1', content: '#Vue# #React#', markdown: '', type: 'p', rootId: 'r1', updated: '2026-09-27' },
      ];
      let queriedOptions: any = null;
      vi.spyOn(TagApiClient, 'queryMatchedBlocks').mockImplementation(async (opts) => {
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

      // 验证正向标签已全部统一转为 optionalTags，形成纯粹的 OR 逻辑
      expect(activeFilter.value.includeTags).toEqual([]);
      expect(activeFilter.value.optionalTags).toContain('Vue');
      expect(activeFilter.value.optionalTags).toContain('React');
      expect(activeFilter.value.excludeTags).toEqual([]);

      // 验证触发了 queryMatchedBlocks 刷新，且参数中 optionalTags 包含了两个标签
      expect(queriedOptions).toBeDefined();
      expect(queriedOptions.includeTags).toEqual([]);
      expect(queriedOptions.optionalTags).toEqual(['Vue', 'React']);

      // 验证下方的筛选结果即时更新
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(matchedBlocks.value).toHaveLength(1);
    });

    it('toggleTagCondition 将 OR 标签转为 AND 时，所有正向标签统一转为 includeTags 并触发 runQuery', async () => {
      const { TagApiClient } = await import('../src/services/TagApiClient');
      const { useTagFilter } = await import('../src/composables/useTagFilter');

      let queriedOptions: any = null;
      vi.spyOn(TagApiClient, 'queryMatchedBlocks').mockImplementation(async (opts) => {
        queriedOptions = opts;
        return [] as any;
      });

      const { activeFilter, toggleTagCondition } = useTagFilter();
      activeFilter.value = {
        includeTags: [],
        optionalTags: ['Vue', 'React'],
        excludeTags: [],
      };

      toggleTagCondition('React', 'include');

      expect(activeFilter.value.optionalTags).toEqual([]);
      expect(activeFilter.value.includeTags).toContain('Vue');
      expect(activeFilter.value.includeTags).toContain('React');
      expect(queriedOptions.includeTags).toEqual(['Vue', 'React']);
      expect(queriedOptions.optionalTags).toEqual([]);
    });

    it('switchFilterMode 在顶栏模式切换时能够直接双向转换已有标签并刷新结果', async () => {
      const { TagApiClient } = await import('../src/services/TagApiClient');
      const { useTagFilter } = await import('../src/composables/useTagFilter');

      let queriedOptions: any = null;
      vi.spyOn(TagApiClient, 'queryMatchedBlocks').mockImplementation(async (opts) => {
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

    it('toggleTagFilter 在 optional 模式下添加标签时自动将既有包含标签升级为可选标签', async () => {
      const { TagApiClient } = await import('../src/services/TagApiClient');
      const { useTagFilter } = await import('../src/composables/useTagFilter');

      let queriedOptions: any = null;
      vi.spyOn(TagApiClient, 'queryMatchedBlocks').mockImplementation(async (opts) => {
        queriedOptions = opts;
        return [] as any;
      });

      const { activeFilter, toggleTagFilter } = useTagFilter();
      activeFilter.value = {
        includeTags: ['Vue'],
        optionalTags: [],
        excludeTags: [],
      };

      // 在 optional 模式下点击候选标签 React
      toggleTagFilter('React', 'optional');
      expect(activeFilter.value.includeTags).toEqual([]);
      expect(activeFilter.value.optionalTags).toEqual(['Vue', 'React']);
      expect(queriedOptions.optionalTags).toEqual(['Vue', 'React']);
    });
  });
});
