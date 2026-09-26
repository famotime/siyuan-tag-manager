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
});
