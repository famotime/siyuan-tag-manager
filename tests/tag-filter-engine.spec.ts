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
});
