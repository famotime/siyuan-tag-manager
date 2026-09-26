import { describe, expect, it } from 'vitest';
import { TagGovernanceService } from '../src/services/TagGovernanceService';
import type { ITagItem } from '../src/types/tag';

describe('TagGovernanceService 标签治理引擎单元测试', () => {
  describe('normalizeLabel 标签字符串规范化', () => {
    it('应当去除首尾多余空格', () => {
      expect(TagGovernanceService.normalizeLabel('  Prompt  ')).toBe('Prompt');
    });

    it('应当去除首尾斜杠并规整中间多重连续斜杠', () => {
      expect(TagGovernanceService.normalizeLabel('/tech//python///')).toBe('tech/python');
      expect(TagGovernanceService.normalizeLabel('///a/b/c/')).toBe('a/b/c');
    });

    it('空字符应安全返回空字符串', () => {
      expect(TagGovernanceService.normalizeLabel('')).toBe('');
      expect(TagGovernanceService.normalizeLabel('   ')).toBe('');
    });
  });

  describe('isValidLabel 标签合法性校验', () => {
    it('正常文本标签应当通过验证', () => {
      expect(TagGovernanceService.isValidLabel('YouTube').valid).toBe(true);
      expect(TagGovernanceService.isValidLabel('tech/Python').valid).toBe(true);
      expect(TagGovernanceService.isValidLabel('AI编程').valid).toBe(true);
    });

    it('空或仅含空白的标签应当拒绝', () => {
      expect(TagGovernanceService.isValidLabel('').valid).toBe(false);
      expect(TagGovernanceService.isValidLabel('   ').valid).toBe(false);
    });

    it('包含非法字符（#、空格、引号等）的标签应当拒绝', () => {
      expect(TagGovernanceService.isValidLabel('You Tube').valid).toBe(false);
      expect(TagGovernanceService.isValidLabel('#tag#').valid).toBe(false);
      expect(TagGovernanceService.isValidLabel('tag"test').valid).toBe(false);
    });
  });

  describe('detectCaseConflicts 大小写冲突检测（复现截图痛点）', () => {
    it('能够准确检测出 Prompt/prompt 与 Python/python 的大小写冲突，并推荐高频项为保留项', () => {
      const mockTags: ITagItem[] = [
        { name: 'Prompt', label: 'Prompt', count: 23, depth: 0 },
        { name: 'prompt', label: 'prompt', count: 2, depth: 0 },
        { name: 'Python', label: 'Python', count: 20, depth: 0 },
        { name: 'python', label: 'python', count: 1, depth: 0 },
        { name: 'YouTube', label: 'YouTube', count: 11, depth: 0 },
      ];

      const issues = TagGovernanceService.detectCaseConflicts(mockTags);
      expect(issues.length).toBe(2);

      const promptIssue = issues.find(i => i.primaryLabel === 'Prompt');
      expect(promptIssue).toBeDefined();
      expect(promptIssue?.relatedLabels).toEqual(['prompt']);
      expect(promptIssue?.suggestedAction).toBe('merge');

      const pythonIssue = issues.find(i => i.primaryLabel === 'Python');
      expect(pythonIssue).toBeDefined();
      expect(pythonIssue?.relatedLabels).toEqual(['python']);
    });
  });

  describe('runHealthInspection 全面健康体检', () => {
    it('能够统计大小写冲突、低频标签（Count=1）与孤儿标签（Count=0），并给出健康评分', () => {
      const mockTags: ITagItem[] = [
        { name: 'Prompt', label: 'Prompt', count: 23, depth: 0 },
        { name: 'prompt', label: 'prompt', count: 2, depth: 0 },
        { name: 'Cloudflare', label: 'Cloudflare', count: 1, depth: 0 },
        { name: 'OpenClaw', label: 'OpenClaw', count: 1, depth: 0 },
        { name: 'OrphanTag', label: 'OrphanTag', count: 0, depth: 0 },
        { name: 'YouTube', label: 'YouTube', count: 11, depth: 0 },
      ];

      const result = TagGovernanceService.runHealthInspection(mockTags);
      expect(result.summary.totalTags).toBe(6);
      expect(result.summary.caseConflicts).toBe(1);
      expect(result.summary.lowFrequency).toBe(2);
      expect(result.summary.orphans).toBe(1);
      expect(result.summary.healthyRate).toBeLessThan(100);
    });
  });

  describe('generateMergePlan 合并计划生成', () => {
    it('能够正确计算合并受影响的计数，并安全过滤无效项', () => {
      const mockTags: ITagItem[] = [
        { name: 'Prompt', label: 'Prompt', count: 23, depth: 0 },
        { name: 'prompt', label: 'prompt', count: 2, depth: 0 },
        { name: '提示词', label: '提示词', count: 5, depth: 0 },
      ];

      const { plan, error } = TagGovernanceService.generateMergePlan(
        'Prompt',
        ['prompt', '提示词', 'Prompt'], // 包含自身应被自动过滤
        mockTags,
        true,
      );

      expect(error).toBeUndefined();
      expect(plan).toBeDefined();
      expect(plan?.targetLabel).toBe('Prompt');
      expect(plan?.sourceLabels).toEqual(['prompt', '提示词']);
      expect(plan?.affectedBlockCount).toBe(7); // 2 + 5
      expect(plan?.setAsAliasAfterMerge).toBe(true);
    });

    it('源标签列表为空时应当报错拦截', () => {
      const { plan, error } = TagGovernanceService.generateMergePlan('Prompt', ['Prompt'], []);
      expect(plan).toBeUndefined();
      expect(error).toBeDefined();
    });
  });
});
