import type { ITagItem, ITagCombination } from '../types/tag';

export type { ITagCombination };

export interface ITagGraphNode {
  id: string;
  label: string;
  count: number;
  group?: string;
  color?: string;
}

export interface ITagGraphLink {
  source: string;
  target: string;
  weight: number;
  jaccard: number;
}

export interface ITagGraphData {
  nodes: ITagGraphNode[];
  links: ITagGraphLink[];
}

export interface ITagCooccurrencePair {
  tagA: string;
  tagB: string;
  cooccurrenceCount: number;
  jaccardSimilarity: number;
}

/**
 * 标签共现网络与认知图谱算法服务
 */
export class TagCooccurrenceService {
  /**
   * 基于块级标签映射数据构建共现图谱网络
   * @param blockTagsMap Map<blockId, tagLabels[]> 包含各个块命中的所有标签
   * @param tagCounts Map<tagLabel, count> 各标签的全局引用频次
   * @param minWeight 最低共现阈值（过滤弱连接噪音，默认 >= 1）
   */
  public static buildCooccurrenceGraph(
    blockTagsMap: Map<string, string[]>,
    tagCounts: Map<string, number>,
    minWeight = 1,
  ): ITagGraphData {
    // 边统计映射：键为 "tagA|tagB"（字母序排列以确保无向对称性）
    const edgeMap = new Map<string, number>();
    const activeNodes = new Set<string>();

    for (const tags of blockTagsMap.values()) {
      if (tags.length < 2) continue;

      // 块内去重
      const uniqueTags = Array.from(new Set(tags));
      for (let i = 0; i < uniqueTags.length; i++) {
        for (let j = i + 1; j < uniqueTags.length; j++) {
          const tA = uniqueTags[i];
          const tB = uniqueTags[j];
          if (tA === tB) continue;

          const edgeKey = tA < tB ? `${tA}|${tB}` : `${tB}|${tA}`;
          edgeMap.set(edgeKey, (edgeMap.get(edgeKey) || 0) + 1);
        }
      }
    }

    const links: ITagGraphLink[] = [];

    for (const [key, weight] of edgeMap.entries()) {
      if (weight < minWeight) continue;
      const [source, target] = key.split('|');

      const countA = tagCounts.get(source) || weight;
      const countB = tagCounts.get(target) || weight;

      // 计算 Jaccard 相似度系数
      const union = countA + countB - weight;
      const jaccard = union > 0 ? Number((weight / union).toFixed(4)) : 0;

      links.push({
        source,
        target,
        weight,
        jaccard,
      });

      activeNodes.add(source);
      activeNodes.add(target);
    }

    // 构建节点清单
    const nodes: ITagGraphNode[] = Array.from(activeNodes).map(label => {
      const count = tagCounts.get(label) || 1;
      return {
        id: label,
        label,
        count,
      };
    });

    return { nodes, links };
  }

  /**
   * 查询与指定标签关联最密切的伴随标签 (Associated Tags)
   */
  public static findAssociatedTags(
    graphData: ITagGraphData,
    targetLabel: string,
    limit = 5,
  ): Array<{ label: string; weight: number; jaccard: number }> {
    const results: Array<{ label: string; weight: number; jaccard: number }> = [];

    for (const link of graphData.links) {
      if (link.source === targetLabel) {
        results.push({ label: link.target, weight: link.weight, jaccard: link.jaccard });
      } else if (link.target === targetLabel) {
        results.push({ label: link.source, weight: link.weight, jaccard: link.jaccard });
      }
    }

    // 按共现权重及相似度降序排列
    results.sort((a, b) => b.weight - a.weight || b.jaccard - a.jaccard);
    return results.slice(0, limit);
  }

  /**
   * 将 spans 行数据快速分组为 blockTagsMap
   */
  public static groupSpansByBlock(spans: Array<{ block_id: string; content: string }>): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const row of spans) {
      if (!row.block_id || !row.content) continue;
      const list = map.get(row.block_id) || [];
      list.push(row.content);
      map.set(row.block_id, list);
    }
    return map;
  }

  /**
   * 统计全库在同一块中共同出现的多元标签组合（频繁项集挖掘）
   * @param blockTagsMap Map<blockId, tagLabels[]> 包含各个块命中的所有标签
   * @param minCount 最低共现频次阈值（默认 >= 2，过滤单次偶然共现噪声）
   * @param maxCombinationSize 最大统计标签组合规模（默认 5，防止子集组合爆炸）
   */
  public static findTagCombinations(
    blockTagsMap: Map<string, string[]>,
    minCount = 2,
    maxCombinationSize = 5,
  ): ITagCombination[] {
    const comboMap = new Map<string, { tags: string[]; count: number }>();

    for (const tags of blockTagsMap.values()) {
      if (!tags || tags.length < 2) continue;

      // 块内标签清洗去重并按字典序排序（确保组合唯一性）
      const uniqueTags = Array.from(new Set(tags.filter(Boolean))).sort();
      if (uniqueTags.length < 2) continue;

      // 为避免单个块内标签过多（例如批量套用了大量标签）产生组合爆炸，安全截断至前 12 个
      const safeTags = uniqueTags.length > 12 ? uniqueTags.slice(0, 12) : uniqueTags;
      const n = safeTags.length;
      const maxK = Math.min(n, maxCombinationSize);

      // 枚举从 2 到 maxK 规模的所有组合
      for (let k = 2; k <= maxK; k++) {
        TagCooccurrenceService.combineHelper(safeTags, k, 0, [], subset => {
          const key = subset.join('\0');
          const existing = comboMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            comboMap.set(key, { tags: [...subset], count: 1 });
          }
        });
      }
    }

    const results: ITagCombination[] = [];
    for (const item of comboMap.values()) {
      if (item.count >= minCount) {
        results.push(item);
      }
    }

    // 排序逻辑：
    // 1. 优先按共现频次降序
    // 2. 频次相同时，按组合包含的标签数降序（更高维度的聚合排在前面）
    // 3. 标签数仍相同时，按标签字典序稳定排序
    results.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.tags.length !== a.tags.length) return b.tags.length - a.tags.length;
      return a.tags.join(',').localeCompare(b.tags.join(','));
    });

    return results;
  }

  private static combineHelper(
    arr: string[],
    k: number,
    start: number,
    current: string[],
    callback: (subset: string[]) => void,
  ): void {
    if (current.length === k) {
      callback(current);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      TagCooccurrenceService.combineHelper(arr, k, i + 1, current, callback);
      current.pop();
    }
  }
}
