import { describe, expect, it } from 'vitest';
import { TagCooccurrenceService } from '../src/services/TagCooccurrenceService';

describe('TagCooccurrenceService 标签共现网络算法测试', () => {
  it('能够正确将 spans 文本标记聚合为块级标签映射', () => {
    const rawSpans = [
      { block_id: 'b1', content: 'YouTube' },
      { block_id: 'b1', content: 'Prompt' },
      { block_id: 'b2', content: 'YouTube' },
      { block_id: 'b2', content: 'iOS' },
      { block_id: 'b2', content: 'Cursor' },
    ];

    const blockMap = TagCooccurrenceService.groupSpansByBlock(rawSpans);
    expect(blockMap.get('b1')).toEqual(['YouTube', 'Prompt']);
    expect(blockMap.get('b2')).toEqual(['YouTube', 'iOS', 'Cursor']);
  });

  it('能够准确统计共现边权重与 Jaccard 相似度', () => {
    // 模拟数据：
    // b1: YouTube + Prompt
    // b2: YouTube + Prompt + AI
    // b3: YouTube + AI
    const blockMap = new Map<string, string[]>([
      ['b1', ['YouTube', 'Prompt']],
      ['b2', ['YouTube', 'Prompt', 'AI']],
      ['b3', ['YouTube', 'AI']],
    ]);

    const tagCounts = new Map<string, number>([
      ['YouTube', 3],
      ['Prompt', 2],
      ['AI', 2],
    ]);

    const graph = TagCooccurrenceService.buildCooccurrenceGraph(blockMap, tagCounts);

    expect(graph.nodes.length).toBe(3);
    // 边应该有 3 条: YouTube-Prompt, YouTube-AI, Prompt-AI
    expect(graph.links.length).toBe(3);

    const ypLink = graph.links.find(
      l => (l.source === 'Prompt' && l.target === 'YouTube') || (l.source === 'YouTube' && l.target === 'Prompt'),
    );
    expect(ypLink).toBeDefined();
    expect(ypLink?.weight).toBe(2); // 在 b1 和 b2 中共现 2 次

    // Jaccard = 2 / (3 + 2 - 2) = 2/3 ≈ 0.6667
    expect(ypLink?.jaccard).toBeCloseTo(0.6667, 3);
  });

  it('能够为指定标签查找最密切关联的伴随标签', () => {
    const blockMap = new Map<string, string[]>([
      ['b1', ['YouTube', 'Prompt']],
      ['b2', ['YouTube', 'Prompt']],
      ['b3', ['YouTube', 'AI']],
    ]);
    const tagCounts = new Map<string, number>([
      ['YouTube', 3],
      ['Prompt', 2],
      ['AI', 1],
    ]);

    const graph = TagCooccurrenceService.buildCooccurrenceGraph(blockMap, tagCounts);
    const associated = TagCooccurrenceService.findAssociatedTags(graph, 'YouTube');

    expect(associated.length).toBe(2);
    // Prompt 出现了 2 次，AI 出现了 1 次，Prompt 应该排在第 1 位
    expect(associated[0].label).toBe('Prompt');
    expect(associated[0].weight).toBe(2);
    expect(associated[1].label).toBe('AI');
    expect(associated[1].weight).toBe(1);
  });

  it('能够准确挖掘多元标签共现组合（含 2 标、3 标及 N 标，按频次与维度降序排列）', () => {
    // 模拟数据：
    // b1: Vue, Vite, TS, Pinia
    // b2: Vue, Vite, TS
    // b3: Vue, Vite
    // b4: React, Redux (仅 1 次)
    const blockMap = new Map<string, string[]>([
      ['b1', ['Vue', 'Vite', 'TS', 'Pinia']],
      ['b2', ['Vue', 'Vite', 'TS']],
      ['b3', ['Vue', 'Vite']],
      ['b4', ['React', 'Redux']],
    ]);

    // 默认 minCount = 2
    const combos = TagCooccurrenceService.findTagCombinations(blockMap, 2, 5);

    // React, Redux 仅出现 1 次，应被过滤
    expect(combos.some(c => c.tags.includes('React'))).toBe(false);

    // 最高频的应该是 Vue + Vite (出现在 b1, b2, b3 共 3 次)
    expect(combos[0].tags).toEqual(['Vite', 'Vue']);
    expect(combos[0].count).toBe(3);
    const vueVite = combos.find(c => c.tags.length === 2 && c.tags.includes('Vue') && c.tags.includes('Vite'));
    expect(vueVite).toBeDefined();
    expect(vueVite?.count).toBe(3);

    // 3 标组合：Vue + Vite + TS (出现在 b1, b2 共 2 次)
    const triplet = combos.find(c => c.tags.length === 3 && c.tags.includes('Vue') && c.tags.includes('Vite') && c.tags.includes('TS'));
    expect(triplet).toBeDefined();
    expect(triplet?.count).toBe(2);

    // 4 标组合：Vue + Vite + TS + Pinia 仅出现在 b1 (count=1)，由于 minCount=2 应不存在
    const quad = combos.find(c => c.tags.length === 4);
    expect(quad).toBeUndefined();

    // 如果设置 minCount = 1，则 4 标组合与 React+Redux 都应能被检出
    const allCombos = TagCooccurrenceService.findTagCombinations(blockMap, 1, 5);
    const quadWithMin1 = allCombos.find(c => c.tags.length === 4);
    expect(quadWithMin1).toBeDefined();
    expect(quadWithMin1?.count).toBe(1);
    expect(quadWithMin1?.tags).toEqual(['Pinia', 'TS', 'Vite', 'Vue']);
  });
});
