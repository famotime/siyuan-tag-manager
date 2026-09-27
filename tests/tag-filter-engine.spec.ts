import { describe, expect, it } from 'vitest';
import { TagFilterEngine } from '../src/services/TagFilterEngine';
import type { ISmartTagView } from '../src/types/tag';

describe('TagFilterEngine 布尔筛选与 SQL 组装测试', () => {
  it('正确生成单标签包含查询 SQL', () => {
    const sql = TagFilterEngine.buildQuerySql({
      includeTags: ['YouTube'],
    });

    expect(sql).toContain("b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = 'YouTube')");
    expect(sql).toContain('b.ial');
    expect(sql).not.toContain("b.type NOT IN ('d')");
    expect(sql).toContain('LIMIT 50 OFFSET 0');
  });

  it('正确生成多标签 AND、NOT 和 OR 复合查询 SQL', () => {
    const sql = TagFilterEngine.buildQuerySql({
      includeTags: ['YouTube', 'Prompt'],
      excludeTags: ['旧方案'],
      optionalTags: ['iOS', 'Cursor'],
      limit: 20,
      offset: 10,
    });

    // 必含 AND 检查
    expect(sql).toContain("content = 'YouTube'");
    expect(sql).toContain("content = 'Prompt'");
    // 排除 NOT 检查
    expect(sql).toContain("b.id NOT IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = '旧方案')");
    // 可选 OR 检查
    expect(sql).toContain("content IN ('iOS', 'Cursor')");
    // 分页检查
    expect(sql).toContain('LIMIT 20 OFFSET 10');
  });

  it('安全转义包含单引号与反斜杠的异常标签，防注入', () => {
    const sql = TagFilterEngine.buildQuerySql({
      includeTags: ["tag'with'quote", 'tag\\slash'],
    });

    expect(sql).toContain("content = 'tag''with''quote'");
    expect(sql).toContain("content = 'tag\\\\slash'");
  });

  it('支持将智能视图对象转换为查询 SQL', () => {
    const mockView: ISmartTagView = {
      id: 'view_1',
      title: '常用AI视频',
      includeTags: ['YouTube', 'AIGC'],
      excludeTags: [],
      optionalTags: [],
      displayMode: 'card',
      createdAt: Date.now(),
    };

    const sql = TagFilterEngine.viewToQuerySql(mockView);
    expect(sql).toContain("content = 'YouTube'");
    expect(sql).toContain("content = 'AIGC'");
  });

  describe('resolveFilterSelection 标签点击筛选状态解析', () => {
    it('默认模式（append=false）仅以点击标签进行筛选，清空历史包含与排除条件', () => {
      const initial = {
        includeTags: ['Vue', 'React'],
        excludeTags: ['Angular'],
      };

      const result = TagFilterEngine.resolveFilterSelection(initial, 'TypeScript', false);
      expect(result.includeTags).toEqual(['TypeScript']);
      expect(result.excludeTags).toEqual([]);
    });

    it('追加模式（append=true）以 AND 加入多维筛选', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: [],
      };

      const result = TagFilterEngine.resolveFilterSelection(initial, 'TypeScript', true);
      expect(result.includeTags).toEqual(['Vue', 'TypeScript']);
      expect(result.excludeTags).toEqual([]);
    });

    it('追加模式下重复添加相同标签不会产生冗余', () => {
      const initial = {
        includeTags: ['Vue', 'TypeScript'],
        excludeTags: [],
      };

      const result = TagFilterEngine.resolveFilterSelection(initial, 'TypeScript', true);
      expect(result.includeTags).toEqual(['Vue', 'TypeScript']);
    });

    it('追加模式下若选中的标签处于排除列表中，自动从排除列表移除并加入包含列表', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: ['TypeScript', 'JavaScript'],
      };

      const result = TagFilterEngine.resolveFilterSelection(initial, 'TypeScript', true);
      expect(result.includeTags).toEqual(['Vue', 'TypeScript']);
      expect(result.excludeTags).toEqual(['JavaScript']);
    });

    it('当传入空标签时保持原状态不变', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: ['Legacy'],
      };

      const result = TagFilterEngine.resolveFilterSelection(initial, '   ', false);
      expect(result.includeTags).toEqual(['Vue']);
      expect(result.excludeTags).toEqual(['Legacy']);
    });
  });

  describe('clearFilterSelection 清空筛选状态测试', () => {
    it('返回空的包含与排除标签集合', () => {
      const result = TagFilterEngine.clearFilterSelection();
      expect(result.includeTags).toEqual([]);
      expect(result.excludeTags).toEqual([]);
    });
  });

  describe('toggleFilterSelection 多选切换与反选状态解析测试', () => {
    it('若目标标签未被包含，则以 AND 追加至 includeTags', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: [],
      };

      const result = TagFilterEngine.toggleFilterSelection(initial, 'TypeScript');
      expect(result.includeTags).toEqual(['Vue', 'TypeScript']);
      expect(result.excludeTags).toEqual([]);
    });

    it('若目标标签已被包含，则从 includeTags 中移除实现反选', () => {
      const initial = {
        includeTags: ['Vue', 'TypeScript'],
        excludeTags: [],
      };

      const result = TagFilterEngine.toggleFilterSelection(initial, 'TypeScript');
      expect(result.includeTags).toEqual(['Vue']);
      expect(result.excludeTags).toEqual([]);
    });

    it('若目标标签处于 excludeTags 中，切换时应从 excludeTags 移除并加入 includeTags', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: ['TypeScript', 'Angular'],
      };

      const result = TagFilterEngine.toggleFilterSelection(initial, 'TypeScript');
      expect(result.includeTags).toEqual(['Vue', 'TypeScript']);
      expect(result.excludeTags).toEqual(['Angular']);
    });

    it('传入空标签时保持原状态不变', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: ['Legacy'],
      };

      const result = TagFilterEngine.toggleFilterSelection(initial, '   ');
      expect(result.includeTags).toEqual(['Vue']);
      expect(result.excludeTags).toEqual(['Legacy']);
    });

    it('支持指定 mode="optional" 将标签加入可选列表 (OR)，并自动从包含和排除中剔除', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: ['React'],
        optionalTags: ['Angular'],
      };

      const result = TagFilterEngine.toggleFilterSelection(initial, 'React', 'optional');
      expect(result.optionalTags).toEqual(['Angular', 'React']);
      expect(result.excludeTags).toEqual([]);
      expect(result.includeTags).toEqual(['Vue']);

      // 再次点击相同标签则实现反选移除
      const toggledOff = TagFilterEngine.toggleFilterSelection(result, 'React', 'optional');
      expect(toggledOff.optionalTags).toEqual(['Angular']);
    });
  });

  describe('cycleFilterCondition 循环切换筛选状态测试 (AND -> OR -> NOT -> AND)', () => {
    it('对 AND 标签循环切换变为 OR 标签', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: [],
        optionalTags: [],
      };

      const res = TagFilterEngine.cycleFilterCondition(initial, 'Vue');
      expect(res.includeTags).toEqual([]);
      expect(res.optionalTags).toEqual(['Vue']);
      expect(res.excludeTags).toEqual([]);
    });

    it('对 OR 标签循环切换变为 NOT 标签', () => {
      const initial = {
        includeTags: [],
        excludeTags: [],
        optionalTags: ['Vue'],
      };

      const res = TagFilterEngine.cycleFilterCondition(initial, 'Vue');
      expect(res.includeTags).toEqual([]);
      expect(res.optionalTags).toEqual([]);
      expect(res.excludeTags).toEqual(['Vue']);
    });

    it('对 NOT 标签循环切换变为 AND 标签', () => {
      const initial = {
        includeTags: [],
        excludeTags: ['Vue'],
        optionalTags: [],
      };

      const res = TagFilterEngine.cycleFilterCondition(initial, 'Vue');
      expect(res.includeTags).toEqual(['Vue']);
      expect(res.optionalTags).toEqual([]);
      expect(res.excludeTags).toEqual([]);
    });

    it('对未在任何列表中的新标签循环切换默认加入 AND', () => {
      const initial = {
        includeTags: [],
        excludeTags: [],
        optionalTags: [],
      };

      const res = TagFilterEngine.cycleFilterCondition(initial, 'Vue');
      expect(res.includeTags).toEqual(['Vue']);
    });
  });

  describe('setTagCondition 显式设置与移除状态测试', () => {
    it('正确将标签设置为 optional (OR)，并清理其他状态', () => {
      const initial = {
        includeTags: ['Vue'],
        excludeTags: [],
        optionalTags: [],
      };

      const res = TagFilterEngine.setTagCondition(initial, 'Vue', 'optional');
      expect(res.includeTags).toEqual([]);
      expect(res.optionalTags).toEqual(['Vue']);
      expect(res.excludeTags).toEqual([]);
    });

    it('使用 remove 状态时从所有列表中彻底移除标签', () => {
      const initial = {
        includeTags: [],
        excludeTags: [],
        optionalTags: ['Vue'],
      };

      const res = TagFilterEngine.setTagCondition(initial, 'Vue', 'remove');
      expect(res.optionalTags).toEqual([]);
      expect(res.includeTags).toEqual([]);
      expect(res.excludeTags).toEqual([]);
    });
  });

  describe('buildQuerySql OR 独立与混合查询生成测试', () => {
    it('支持仅包含 OR 可选标签的独立查询 SQL', () => {
      const sql = TagFilterEngine.buildQuerySql({
        optionalTags: ['Vue', 'React'],
      });

      expect(sql).toContain("b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content IN ('Vue', 'React'))");
      expect(sql).not.toContain('b.id NOT IN');
      expect(sql).toContain('LIMIT 50 OFFSET 0');
    });

    it('当同时包含 includeTags (AND) 与 optionalTags (OR) 时，两组正向条件以 OR 关联', () => {
      const sql = TagFilterEngine.buildQuerySql({
        includeTags: ['Vue'],
        optionalTags: ['React'],
        excludeTags: ['Angular'],
      });

      expect(sql).toContain("(b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = 'Vue') OR b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content IN ('React')))");
      expect(sql).toContain("b.id NOT IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = 'Angular')");
    });

    it('resetFilterWithTags 支持 mode="optional" 生成 OR 组合', () => {
      const res = TagFilterEngine.resetFilterWithTags(['Vue', 'React'], 'optional');
      expect(res.includeTags).toEqual([]);
      expect(res.optionalTags).toEqual(['Vue', 'React']);
      expect(res.excludeTags).toEqual([]);
    });
  });
});

