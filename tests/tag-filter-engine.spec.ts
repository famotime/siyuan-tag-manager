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

  describe('groupMatchedBlocksByDoc 同文档打标段落合并展示测试', () => {
    it('空数组返回空数组', () => {
      expect(TagFilterEngine.groupMatchedBlocksByDoc([])).toEqual([]);
    });

    it('多个打标段落属于同一个文档时，按文档合并为一组并保留一个标题', () => {
      const blocks = [
        {
          id: 'b1',
          rootId: 'doc1',
          docTitle: 'OpenClaw记忆黑科技',
          content: '说话直接，技术讨论给出代码 #算法控制#',
          markdown: '说话直接，技术讨论给出代码 #算法控制#',
          type: 'p',
          updated: '20261002105517',
          matchedTags: ['算法控制'],
        },
        {
          id: 'b2',
          rootId: 'doc1',
          docTitle: 'OpenClaw记忆黑科技',
          content: '想对 Agent 做脑部手术? #算法控制#',
          markdown: '想对 Agent 做脑部手术? #算法控制#',
          type: 'p',
          updated: '20261002105403',
          matchedTags: ['算法控制'],
        },
        {
          id: 'b3',
          rootId: 'doc2',
          docTitle: '哪有什么真正的自由',
          content: '哪有什么真正的自由 · #算法控制#',
          markdown: '哪有什么真正的自由 · #算法控制#',
          type: 'd',
          updated: '20260809144636',
          matchedTags: ['算法控制'],
        },
      ];

      const groups = TagFilterEngine.groupMatchedBlocksByDoc(blocks);

      expect(groups).toHaveLength(2);

      // 第一组：doc1
      expect(groups[0].rootId).toBe('doc1');
      expect(groups[0].docTitle).toBe('OpenClaw记忆黑科技');
      expect(groups[0].blocks).toHaveLength(2);
      expect(groups[0].blocks[0].id).toBe('b1');
      expect(groups[0].blocks[1].id).toBe('b2');
      expect(groups[0].hasDocType).toBe(false);

      // 第二组：doc2
      expect(groups[1].rootId).toBe('doc2');
      expect(groups[1].docTitle).toBe('哪有什么真正的自由');
      expect(groups[1].blocks).toHaveLength(1);
      expect(groups[1].blocks[0].id).toBe('b3');
      expect(groups[1].hasDocType).toBe(true);
    });

    it('保留原始块排序顺序（文档首次出现的先后顺序）', () => {
      const blocks = [
        {
          id: 'b1',
          rootId: 'docA',
          docTitle: '文档A',
          content: '段落1',
          markdown: '段落1',
          type: 'p',
          updated: '20261002100000',
          matchedTags: ['tag1'],
        },
        {
          id: 'b2',
          rootId: 'docB',
          docTitle: '文档B',
          content: '段落2',
          markdown: '段落2',
          type: 'p',
          updated: '20261002090000',
          matchedTags: ['tag1'],
        },
        {
          id: 'b3',
          rootId: 'docA',
          docTitle: '文档A',
          content: '段落3',
          markdown: '段落3',
          type: 'p',
          updated: '20261002080000',
          matchedTags: ['tag1'],
        },
      ];

      const groups = TagFilterEngine.groupMatchedBlocksByDoc(blocks);
      expect(groups).toHaveLength(2);
      expect(groups[0].rootId).toBe('docA');
      expect(groups[0].blocks).toHaveLength(2);
      expect(groups[1].rootId).toBe('docB');
      expect(groups[1].blocks).toHaveLength(1);
    });
  });
});


