import { describe, expect, it } from 'vitest';
import { TagFilterEngine } from '../src/services/TagFilterEngine';
import type { ISmartTagView } from '../src/types/tag';

describe('TagFilterEngine 布尔筛选与 SQL 组装测试', () => {
  it('正确生成单标签包含查询 SQL', () => {
    const sql = TagFilterEngine.buildQuerySql({
      includeTags: ['YouTube'],
    });

    expect(sql).toContain("b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = 'YouTube')");
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

  describe('resetFilterWithTags 重置并建立新组合筛选测试', () => {
    it('以传入标签建立包含条件，排除条件清空且去除重复与空标签', () => {
      const result = TagFilterEngine.resetFilterWithTags(['Vue', 'React', 'Vue', '  ', 'TypeScript']);
      expect(result.includeTags).toEqual(['Vue', 'React', 'TypeScript']);
      expect(result.excludeTags).toEqual([]);
    });
  });
});

