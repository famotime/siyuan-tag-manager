import type { ITagHealthIssue, ITagItem, ITagMergePlan } from '../types/tag';

/**
 * 标签治理、规范化与健康检测引擎
 */
export class TagGovernanceService {
  /**
   * 规范化标签字符串
   * 规则：
   * 1. 去除首尾空格
   * 2. 去除首尾斜杠 /
   * 3. 将连续多个斜杠 // 归一为单个斜杠 /
   */
  public static normalizeLabel(label: string): string {
    if (!label) return '';
    let res = label.trim();
    // 替换多个连续斜杠为单个斜杠
    res = res.replace(/\/+/g, '/');
    // 去除开头和结尾的斜杠
    res = res.replace(/^\/+|\/+$/g, '');
    return res;
  }

  /**
   * 验证标签命名合法性
   * 严格遵循思源合法字符规范（不能包含标点、特殊标记等）
   */
  public static isValidLabel(label: string): { valid: boolean; error?: string } {
    const normalized = this.normalizeLabel(label);
    if (!normalized) {
      return { valid: false, error: '标签名称不能为空' };
    }
    // 思源标签不能包含部分特殊标记字符
    const invalidChars = ['#', ' ', '\t', '\n', '"', "'", '`'];
    for (const char of invalidChars) {
      if (normalized.includes(char)) {
        return { valid: false, error: `标签名称不能包含字符 "${char}"` };
      }
    }
    return { valid: true };
  }

  /**
   * 检测库中大小写冲突的标签（如 Prompt 与 prompt）
   * @param tags 标签列表
   * @returns 发现的大小写冲突问题项
   */
  public static detectCaseConflicts(tags: ITagItem[]): ITagHealthIssue[] {
    const issues: ITagHealthIssue[] = [];
    // 映射: 小写全路径 -> 原始标签列表
    const lowerMap = new Map<string, ITagItem[]>();

    for (const tag of tags) {
      const lower = tag.label.toLowerCase();
      const list = lowerMap.get(lower) || [];
      list.push(tag);
      lowerMap.set(lower, list);
    }

    for (const [, tagList] of lowerMap.entries()) {
      if (tagList.length > 1) {
        // 存在多个大小写不同的变体
        // 按引用数从大到小排序，最多的作为建议目标保留标签
        const sorted = [...tagList].sort((a, b) => b.count - a.count);
        const primary = sorted[0];
        const variants = sorted.slice(1).map(t => t.label);

        issues.push({
          type: 'case_conflict',
          primaryLabel: primary.label,
          relatedLabels: variants,
          severity: 'warning',
          message: `发现大小写冲突：${tagList.map(t => `"${t.label}" (${t.count})`).join(', ')}，建议合并到 "${primary.label}"`,
          suggestedAction: 'merge',
        });
      }
    }

    return issues;
  }

  /**
   * 全面健康体检（包含大小写冲突、低频标签、孤儿空标签）
   */
  public static runHealthInspection(tags: ITagItem[]): {
    issues: ITagHealthIssue[];
    summary: {
      totalTags: number;
      caseConflicts: number;
      lowFrequency: number;
      orphans: number;
      healthyRate: number;
    };
  } {
    const issues: ITagHealthIssue[] = [];

    // 1. 大小写冲突
    const caseConflicts = this.detectCaseConflicts(tags);
    issues.push(...caseConflicts);

    let lowFrequencyCount = 0;
    let orphanCount = 0;

    // 2. 扫描低频与孤儿
    for (const tag of tags) {
      if (tag.count <= 0) {
        orphanCount++;
        issues.push({
          type: 'orphan',
          primaryLabel: tag.label,
          severity: 'info',
          message: `标签 "${tag.label}" 引用数为 0，为废弃孤儿标签`,
          suggestedAction: 'clean',
        });
      } else if (tag.count === 1) {
        lowFrequencyCount++;
        issues.push({
          type: 'low_frequency',
          primaryLabel: tag.label,
          severity: 'info',
          message: `标签 "${tag.label}" 仅被引用 1 次，存在碎片化风险`,
          suggestedAction: 'clean',
        });
      }
    }

    const total = tags.length;
    const problemTagsCount = issues.length;
    const healthyRate = total === 0 ? 100 : Math.max(0, Math.round(((total - problemTagsCount) / total) * 100));

    return {
      issues,
      summary: {
        totalTags: total,
        caseConflicts: caseConflicts.length,
        lowFrequency: lowFrequencyCount,
        orphans: orphanCount,
        healthyRate,
      },
    };
  }

  /**
   * 生成标签合并计划
   * @param targetLabel 目标保留的标签名
   * @param sourceLabels 待被吸纳合并的源标签
   * @param allTags 当前所有的标签列表（用于估算计数）
   */
  public static generateMergePlan(
    targetLabel: string,
    sourceLabels: string[],
    allTags: ITagItem[],
    setAsAlias = true,
  ): { plan?: ITagMergePlan; error?: string } {
    const targetValid = this.isValidLabel(targetLabel);
    if (!targetValid.valid) {
      return { error: targetValid.error };
    }

    const cleanTarget = this.normalizeLabel(targetLabel);
    const cleanSources = sourceLabels
      .map(s => this.normalizeLabel(s))
      .filter(s => s && s !== cleanTarget);

    if (cleanSources.length === 0) {
      return { error: '待合并的源标签列表不能为空且不能与目标标签相同' };
    }

    const tagMap = new Map<string, ITagItem>();
    allTags.forEach(t => tagMap.set(t.label, t));

    let totalBlocks = 0;
    for (const src of cleanSources) {
      const item = tagMap.get(src);
      if (item) {
        totalBlocks += item.count;
      }
    }

    const plan: ITagMergePlan = {
      targetLabel: cleanTarget,
      sourceLabels: cleanSources,
      affectedBlockCount: totalBlocks,
      affectedDocCount: 0, // 后续由 SQL 细化
      setAsAliasAfterMerge: setAsAlias,
    };

    return { plan };
  }
}
