import type { ITagGraphData } from './TagCooccurrenceService';
import type { ITagCompanionCandidate } from '../types/companion';
import { TagApiClient } from './TagApiClient';

/**
 * 伴生标签共现网络内存倒排索引缓存池
 * 
 * 核心目标：
 * 1. 预热构建全库标签无向共现图谱的倒排字典，支持 O(1) 亚毫秒级亚延迟查询；
 * 2. 在索引构建阶段执行最小相似度过滤 (minSimilarity)，消除噪音；
 * 3. 维护脏状态标记，全库打标变动时标记失效并在闲时重建。
 */
export class TagCompanionCache {
  private static invertedIndex = new Map<string, ITagCompanionCandidate[]>();
  private static allNodes: Array<{ label: string; count: number }> = [];
  private static ready = false;
  private static dirty = false;
  private static lastBuiltTime = 0;
  private static isBuilding = false;

  /**
   * 基于共现图谱构建内存倒排索引
   */
  public static buildIndex(graphData: ITagGraphData, minSimilarity = 0.05): void {
    const tempMap = new Map<string, ITagCompanionCandidate[]>();

    const addLink = (source: string, target: string, weight: number, jaccard: number) => {
      if (jaccard < minSimilarity) return;

      const percentage = Math.round(jaccard * 100);
      const candidate: ITagCompanionCandidate = {
        label: target,
        weight,
        jaccard,
        percentage,
      };

      const list = tempMap.get(source) || [];
      list.push(candidate);
      tempMap.set(source, list);
    };

    for (const link of graphData.links) {
      if (!link.source || !link.target) continue;
      // 无向边双向映射
      addLink(link.source, link.target, link.weight, link.jaccard);
      addLink(link.target, link.source, link.weight, link.jaccard);
    }

    // 针对每个主标签的伴随列表进行降序稳定排列 (优先 jaccard 降序，其次 weight 降序)
    for (const list of tempMap.values()) {
      list.sort((a, b) => b.jaccard - a.jaccard || b.weight - a.weight);
    }

    this.allNodes = (graphData.nodes || [])
      .map(n => ({ label: n.label, count: n.count }))
      .sort((a, b) => b.count - a.count);

    this.invertedIndex = tempMap;
    this.ready = true;
    this.dirty = false;
    this.lastBuiltTime = Date.now();
  }

  /**
   * O(1) 查询指定标签关联的最紧密伴生候选列表
   * @param targetLabel 基准标签名
   * @param excludeTags 需排除的标签集合（如当前块已有的标签）
   * @param limit 返回上限数量
   */
  public static queryAssociated(
    targetLabel: string,
    excludeTags: Set<string> = new Set(),
    limit = 4,
  ): ITagCompanionCandidate[] {
    if (!targetLabel) return [];

    const candidates = this.invertedIndex.get(targetLabel);
    if (!candidates || candidates.length === 0) return [];

    const results: ITagCompanionCandidate[] = [];
    const lowerExclude = new Set(Array.from(excludeTags).map(t => t.toLowerCase()));
    lowerExclude.add(targetLabel.toLowerCase());

    for (const item of candidates) {
      if (lowerExclude.has(item.label.toLowerCase())) {
        continue;
      }
      results.push(item);
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  /**
   * 判断指定标签是否存在任何历史共现关联项
   */
  public static hasAssociated(targetLabel: string): boolean {
    if (!targetLabel) return false;
    const candidates = this.invertedIndex.get(targetLabel);
    return Boolean(candidates && candidates.length > 0);
  }

  /**
   * 当目标标签尚无共现数据时，智能兜底查找同层级兄弟标签或全库高频标签
   */
  public static queryFallback(
    targetLabel: string,
    excludeTags: Set<string> = new Set(),
    limit = 4,
  ): ITagCompanionCandidate[] {
    const results: ITagCompanionCandidate[] = [];
    const lowerExclude = new Set(Array.from(excludeTags).map(t => t.toLowerCase()));
    lowerExclude.add(targetLabel.toLowerCase());

    // 1. 若为层级标签，例如 tech/react，优先寻找同前缀兄弟标签 tech/vue
    if (targetLabel.includes('/')) {
      const prefix = targetLabel.substring(0, targetLabel.lastIndexOf('/') + 1);
      for (const node of this.allNodes) {
        if (node.label.startsWith(prefix) && !lowerExclude.has(node.label.toLowerCase())) {
          results.push({
            label: node.label,
            weight: node.count,
            jaccard: 0.5,
            percentage: 50,
          });
          lowerExclude.add(node.label.toLowerCase());
          if (results.length >= limit) return results;
        }
      }
    }

    // 2. 兜底推荐全库高频常用标签
    for (const node of this.allNodes) {
      if (!lowerExclude.has(node.label.toLowerCase())) {
        results.push({
          label: node.label,
          weight: node.count,
          jaccard: 0.3,
          percentage: 30,
        });
        lowerExclude.add(node.label.toLowerCase());
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * 确保索引已预热加载（若未初始化或标记为脏，异步静默重建）
   */
  public static async ensureIndexLoaded(
    client: typeof TagApiClient = TagApiClient,
    minSimilarity = 0.05,
  ): Promise<void> {
    if (this.isBuilding) return;
    if (this.ready && !this.dirty) return;

    this.isBuilding = true;
    try {
      const { graph } = await client.fetchCooccurrenceGraph();
      if (graph) {
        this.buildIndex(graph, minSimilarity);
      }
    } catch {
      // 静默容错，避免阻塞前台编辑器
    } finally {
      this.isBuilding = false;
    }
  }

  /**
   * 标记缓存失效
   */
  public static markDirty(): void {
    this.dirty = true;
  }

  public static isDirty(): boolean {
    return this.dirty;
  }

  public static isReady(): boolean {
    return this.ready;
  }

  public static getLastBuiltTime(): number {
    return this.lastBuiltTime;
  }

  /**
   * 重置内存状态（测试隔离）
   */
  public static reset(): void {
    this.invertedIndex.clear();
    this.ready = false;
    this.dirty = false;
    this.lastBuiltTime = 0;
    this.isBuilding = false;
  }
}
