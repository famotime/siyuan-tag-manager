import { describe, expect, it } from 'vitest';
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
});
