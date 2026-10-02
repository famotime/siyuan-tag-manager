import type { ITagCompanionCandidate, ITagCompanionConfig, ITagCompanionContext } from '../types/companion';
import { DEFAULT_COMPANION_CONFIG } from '../types/companion';
import { TagCompanionCache } from './TagCompanionCache';

/**
 * 伴生标签推荐决策引擎
 * 
 * 核心职责：
 * 1. 结合当前编辑块上下文与已有打标标签，执行聚焦基准提取；
 * 2. 严格排除当前块内已存在的全部标签；
 * 3. 遵从用户配置项 (启用状态、最大数量、相似度阈值) 输出推荐结果。
 */
export class TagCompanionRecommender {
  public static getRecommendations(
    context: ITagCompanionContext,
    config: ITagCompanionConfig = DEFAULT_COMPANION_CONFIG,
  ): ITagCompanionCandidate[] {
    if (!config.enabled) {
      return [];
    }

    const target = context.targetLabel?.trim();
    if (!target) {
      return [];
    }

    const excludeSet = new Set<string>();
    if (Array.isArray(context.existingTags)) {
      for (const t of context.existingTags) {
        if (t) excludeSet.add(t);
      }
    }
    // 自身始终加入排除集合
    excludeSet.add(target);

    const limit = config.maxCount > 0 ? config.maxCount : DEFAULT_COMPANION_CONFIG.maxCount;

    let candidates = TagCompanionCache.queryAssociated(target, excludeSet, limit);
    // 仅当该标签在全库中完全无任何历史共现关联记录时，才启用智能层级/高频兜底
    if (candidates.length === 0 && !TagCompanionCache.hasAssociated(target)) {
      candidates = TagCompanionCache.queryFallback(target, excludeSet, limit);
    }

    return candidates;
  }
}
