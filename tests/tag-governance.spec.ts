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

  describe('detectSimilarConflicts 相似冲突检测（覆盖大小写、命名风格与短编辑距离）', () => {
    it('能够准确检测出 Prompt/prompt 与 Python/python 的大小写冲突，并推荐高频项为保留项', () => {
      const mockTags: ITagItem[] = [
        { name: 'Prompt', label: 'Prompt', count: 23, depth: 0 },
        { name: 'prompt', label: 'prompt', count: 2, depth: 0 },
        { name: 'Python', label: 'Python', count: 20, depth: 0 },
        { name: 'python', label: 'python', count: 1, depth: 0 },
        { name: 'YouTube', label: 'YouTube', count: 11, depth: 0 },
      ];

      const issues = TagGovernanceService.detectSimilarConflicts(mockTags);
      expect(issues.length).toBe(2);

      const promptIssue = issues.find(i => i.primaryLabel === 'Prompt');
      expect(promptIssue).toBeDefined();
      expect(promptIssue?.relatedLabels).toEqual(['prompt']);
      expect(promptIssue?.suggestedAction).toBe('merge');

      const pythonIssue = issues.find(i => i.primaryLabel === 'Python');
      expect(pythonIssue).toBeDefined();
      expect(pythonIssue?.relatedLabels).toEqual(['python']);
    });

    it('能够识别命名风格差异（如 tag-manager 与 tag_manager）和短编辑距离拼写笔误（JavaScript 与 JavScript）', () => {
      const mockTags: ITagItem[] = [
        { name: 'tag-manager', label: 'tag-manager', count: 15, depth: 0 },
        { name: 'tag_manager', label: 'tag_manager', count: 3, depth: 0 },
        { name: 'JavaScript', label: 'JavaScript', count: 30, depth: 0 },
        { name: 'JavScript', label: 'JavScript', count: 1, depth: 0 },
        { name: 'AI', label: 'AI', count: 10, depth: 0 },
        { name: 'UI', label: 'UI', count: 8, depth: 0 }, // 短词防误报
      ];

      const issues = TagGovernanceService.detectSimilarConflicts(mockTags);
      expect(issues.length).toBe(2);

      const tagManagerIssue = issues.find(i => i.primaryLabel === 'tag-manager');
      expect(tagManagerIssue?.relatedLabels).toContain('tag_manager');

      const jsIssue = issues.find(i => i.primaryLabel === 'JavaScript');
      expect(jsIssue?.relatedLabels).toContain('JavScript');

      // AI 和 UI 不应误报为冲突
      const aiIssue = issues.find(i => i.primaryLabel === 'AI' || i.relatedLabels?.includes('AI'));
      expect(aiIssue).toBeUndefined();
    });

    it('能够将“测试”和“测-试”及其中文间隔号“测·试”、全角连字符“测－试”识别为相似冲突，并推选规范形式为保留项', () => {
      const mockTags: ITagItem[] = [
        { name: '测试', label: '测试', count: 1, depth: 0 },
        { name: '测-试', label: '测-试', count: 1, depth: 0 },
        { name: '测·试', label: '测·试', count: 1, depth: 0 },
        { name: '测－试', label: '测－试', count: 1, depth: 0 },
      ];

      const issues = TagGovernanceService.detectSimilarConflicts(mockTags);
      expect(issues.length).toBe(1);

      const issue = issues[0];
      // 频次相同时，规范度优先：无标点的“测试”作为 primaryLabel
      expect(issue.primaryLabel).toBe('测试');
      expect(issue.relatedLabels).toContain('测-试');
      expect(issue.relatedLabels).toContain('测·试');
      expect(issue.relatedLabels).toContain('测－试');
      expect(issue.subType).toBe('separator');
    });

    it('严格遵循层级边界：同层级内检测标点变体，跨层级扁平标签互不干扰', () => {
      const mockTags: ITagItem[] = [
        // 同层级冲突组
        { name: '测试', label: '技术/测试', count: 5, depth: 1 },
        { name: '测-试', label: '技术/测-试', count: 1, depth: 1 },
        // 跨层级扁平标签（不应与技术/前端冲突）
        { name: '前端', label: '技术/前端', count: 10, depth: 1 },
        { name: '技术-前端', label: '技术-前端', count: 2, depth: 0 },
        // 不同父路径同名标签（不应发生冲突）
        { name: '测试', label: '管理/测试', count: 3, depth: 1 },
      ];

      const issues = TagGovernanceService.detectSimilarConflicts(mockTags);
      // 仅有 技术/测试 与 技术/测-试 这 1 组冲突
      expect(issues.length).toBe(1);
      expect(issues[0].primaryLabel).toBe('技术/测试');
      expect(issues[0].relatedLabels).toEqual(['技术/测-试']);
    });

    it('防误报机制：数字版本号与中文短词绝不误判为 typo 笔误，长词笔误能正常命中', () => {
      const mockTags: ITagItem[] = [
        // 数字版本号（不应被识别为冲突）
        { name: 'Vue2', label: 'Vue2', count: 10, depth: 0 },
        { name: 'Vue3', label: 'Vue3', count: 15, depth: 0 },
        { name: 'v1', label: 'v1', count: 4, depth: 0 },
        { name: 'v2', label: 'v2', count: 5, depth: 0 },
        { name: '第1版', label: '第1版', count: 2, depth: 0 },
        { name: '第2版', label: '第2版', count: 3, depth: 0 },

        // 中文短词（编辑距离为 1 但词义不同，绝不应误报）
        { name: '测试', label: '测试', count: 8, depth: 0 },
        { name: '考试', label: '考试', count: 6, depth: 0 },
        { name: '开发', label: '开发', count: 12, depth: 0 },
        { name: '开会', label: '开会', count: 4, depth: 0 },

        // 中文长词笔误（长度 >= 4 且编辑距离 1，应能正确命中）
        { name: '敏捷开发流程', label: '敏捷开发流程', count: 10, depth: 0 },
        { name: '敏捷开发历程', label: '敏捷开发历程', count: 1, depth: 0 },
      ];

      const issues = TagGovernanceService.detectSimilarConflicts(mockTags);
      expect(issues.length).toBe(1);

      const typoIssue = issues[0];
      expect(typoIssue.primaryLabel).toBe('敏捷开发流程');
      expect(typoIssue.relatedLabels).toEqual(['敏捷开发历程']);
      expect(typoIssue.subType).toBe('typo');
    });
  });

  describe('detectInvalidNorms 不合规范检测（斜杠/非法字符/超长>15/超深>=3/纯数字）', () => {
    it('能够准确检测出多余斜杠、超长标签、超深层级和纯数字无语义标签', () => {
      const mockTags: ITagItem[] = [
        { name: 'tech', label: '/tech//python/', count: 5, depth: 1 },
        { name: 'invalid#tag', label: 'invalid#tag', count: 2, depth: 0 },
        { name: 'veryLongSentenceTag', label: '这是一个超过十五个字符的超长标签', count: 1, depth: 0 },
        { name: 'deep', label: 'level1/level2/level3/deep', count: 1, depth: 3 },
        { name: '202403', label: '202403', count: 3, depth: 0 },
        { name: 'normal', label: 'normalTag', count: 8, depth: 0 },
      ];

      const issues = TagGovernanceService.detectInvalidNorms(mockTags);
      expect(issues.length).toBe(5);

      const slashIssue = issues.find(i => i.primaryLabel === '/tech//python/');
      expect(slashIssue?.suggestedAction).toBe('normalize');
      expect(slashIssue?.normalizedTarget).toBe('tech/python');

      const charIssue = issues.find(i => i.primaryLabel === 'invalid#tag');
      expect(charIssue?.suggestedAction).toBe('rename');

      const longIssue = issues.find(i => i.primaryLabel === '这是一个超过十五个字符的超长标签');
      expect(longIssue?.suggestedAction).toBe('rename');

      const depthIssue = issues.find(i => i.primaryLabel === 'level1/level2/level3/deep');
      expect(depthIssue?.suggestedAction).toBe('rename');

      const digitIssue = issues.find(i => i.primaryLabel === '202403');
      expect(digitIssue?.suggestedAction).toBe('rename');
      expect(digitIssue?.message).toContain('纯数字');
    });

    it('中文汉字标签（如 待查、已读、技术报告）与 Emoji 标签绝不会被误判为纯数字或无语义', () => {
      const mockTags: ITagItem[] = [
        { name: '待查', label: '待查', count: 10, depth: 0 },
        { name: '已读', label: '已读', count: 5, depth: 0 },
        { name: '标签', label: '标签', count: 12, depth: 0 },
        { name: '技术报告', label: '技术报告', count: 8, depth: 0 },
        { name: '🔍待查', label: '🔍待查', count: 3, depth: 0 },
        { name: '⭐', label: '⭐', count: 4, depth: 0 },
        { name: '---', label: '---', count: 1, depth: 0 }, // 纯标点无语义
      ];

      const issues = TagGovernanceService.detectInvalidNorms(mockTags);
      // 只有 --- 应被识别为标点无语义
      expect(issues.length).toBe(1);
      expect(issues[0].primaryLabel).toBe('---');
      expect(issues[0].message).toContain('仅包含标点符号');

      // 验证待查、已读等绝不属于 issues
      const chineseIssues = issues.filter(i =>
        ['待查', '已读', '标签', '技术报告', '🔍待查', '⭐'].includes(i.primaryLabel)
      );
      expect(chineseIssues.length).toBe(0);
    });
  });

  describe('runHealthInspection 全面健康体检', () => {
    it('能够统计相似冲突、不合规范与低频使用（合并低频与孤儿），并给出健康评分', () => {
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
      expect(result.summary.similarConflicts).toBe(1);
      // 低频使用合并孤儿(count=0)与单次引用(count=1)，总共 1 + 2 = 3
      expect(result.summary.lowFrequency).toBe(3);
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
