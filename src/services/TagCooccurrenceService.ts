import type { ITagItem } from '../types/tag';

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
}
