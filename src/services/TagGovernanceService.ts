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
   * 计算字符串 Levenshtein 编辑距离
   */
  public static calcLevenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let curr = new Array(b.length + 1);

    for (let i = 0; i < a.length; i++) {
      curr[0] = i + 1;
      for (let j = 0; j < b.length; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        curr[j + 1] = Math.min(
          curr[j] + 1,       // 插入
          prev[j + 1] + 1,   // 删除
          prev[j] + cost,    // 替换
        );
      }
      const temp = prev;
      prev = curr;
      curr = temp;
    }
    return prev[b.length];
  }

  /**
   * 判断两个标签是否相似（覆盖大小写、命名风格与分隔符、短编辑距离笔误）
   */
  public static checkSimilarity(labelA: string, labelB: string): { similar: boolean; reason?: 'case' | 'separator' | 'typo' } {
    if (labelA === labelB) return { similar: false };

    const lowerA = labelA.toLowerCase();
    const lowerB = labelB.toLowerCase();

    // 1. 大小写冲突 (如 Prompt 与 prompt)
    if (lowerA === lowerB) {
      return { similar: true, reason: 'case' };
    }

    // 2. 命名风格与分隔符差异 (如 tag-manager, tag_manager, tagManager)
    const normA = lowerA.replace(/[-_.\s/]/g, '');
    const normB = lowerB.replace(/[-_.\s/]/g, '');
    if (normA === normB && normA.length >= 3) {
      return { similar: true, reason: 'separator' };
    }

    // 3. 短编辑距离 (形似词/拼写笔误)
    const lenA = lowerA.length;
    const lenB = lowerB.length;
    const minLen = Math.min(lenA, lenB);
    const maxLen = Math.max(lenA, lenB);

    // 长度差异大于 2，或短词 (<= 3 字符)，跳过编辑距离以避免 AI/UI 等误报
    if (maxLen - minLen > 2 || minLen <= 3) {
      return { similar: false };
    }

    const dist = this.calcLevenshtein(lowerA, lowerB);
    const similarity = 1 - dist / maxLen;

    // 编辑距离为 1，或者长词 (>= 8) 编辑距离为 2，且相似度达到 75%
    if ((dist === 1 || (maxLen >= 8 && dist === 2)) && similarity >= 0.75) {
      return { similar: true, reason: 'typo' };
    }

    return { similar: false };
  }

  /**
   * 检测库中相似冲突的标签（覆盖大小写变体、分隔符风格差异与短编辑距离笔误）
   * @param tags 标签列表
   * @returns 发现的相似冲突问题项
   */
  public static detectSimilarConflicts(tags: ITagItem[]): ITagHealthIssue[] {
    const issues: ITagHealthIssue[] = [];
    const n = tags.length;
    if (n <= 1) return issues;

    // 并查集快速聚类
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i: number): number {
      if (parent[i] === i) return i;
      parent[i] = find(parent[i]);
      return parent[i];
    }
    function union(i: number, j: number) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sim = this.checkSimilarity(tags[i].label, tags[j].label);
        if (sim.similar) {
          union(i, j);
        }
      }
    }

    // 按连通分量聚集标签
    const clusters = new Map<number, ITagItem[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      const list = clusters.get(root) || [];
      list.push(tags[i]);
      clusters.set(root, list);
    }

    for (const [, tagList] of clusters.entries()) {
      if (tagList.length > 1) {
        // 按引用数从大到小排序，最多的作为建议目标保留主标签
        const sorted = [...tagList].sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.label.localeCompare(b.label);
        });
        const primary = sorted[0];
        const variants = sorted.slice(1).map(t => t.label);

        issues.push({
          type: 'similar_conflict',
          primaryLabel: primary.label,
          relatedLabels: variants,
          severity: 'warning',
          message: `发现相似冲突：${tagList.map(t => `"${t.label}" (${t.count})`).join(', ')}，建议合并到 "${primary.label}"`,
          suggestedAction: 'merge',
        });
      }
    }

    return issues;
  }

  /**
   * 兼容历史命名：检测大小写与相似冲突
   */
  public static detectCaseConflicts(tags: ITagItem[]): ITagHealthIssue[] {
    return this.detectSimilarConflicts(tags);
  }

  /**
   * 检测库中不合规范的标签（多余斜杠、非法字符、超长 > 15 字符、超深 >= 3 层、纯数字无语义）
   */
  public static detectInvalidNorms(tags: ITagItem[]): ITagHealthIssue[] {
    const issues: ITagHealthIssue[] = [];

    for (const tag of tags) {
      const raw = tag.label;
      const normalized = this.normalizeLabel(raw);

      // 1. 命名格式异常（包含多余首尾斜杠或连续斜杠）
      if (normalized !== raw) {
        issues.push({
          type: 'invalid_norm',
          primaryLabel: raw,
          severity: 'warning',
          message: `标签 "${raw}" 包含多余的首尾斜杠或连续斜杠，建议规整为 "${normalized}"`,
          suggestedAction: 'normalize',
          subType: 'slash',
          normalizedTarget: normalized,
        });
        continue;
      }

      // 2. 包含思源非法字符
      const validRes = this.isValidLabel(raw);
      if (!validRes.valid) {
        issues.push({
          type: 'invalid_norm',
          primaryLabel: raw,
          severity: 'warning',
          message: `标签 "${raw}" 包含非法字符（${validRes.error || '空格/特殊符号'}），无法被正常索引`,
          suggestedAction: 'rename',
          subType: 'invalid_chars',
        });
        continue;
      }

      // 3. 超长异常标签（严格标准：> 15 字符）
      if (raw.length > 15) {
        issues.push({
          type: 'invalid_norm',
          primaryLabel: raw,
          severity: 'warning',
          message: `标签 "${raw}" 长度达到 ${raw.length} 字符（超过 15 字符），疑似误输入整句`,
          suggestedAction: 'rename',
          subType: 'length',
        });
        continue;
      }

      // 4. 超深层级标签（严格标准：嵌套深度 >= 3 层）
      const depth = raw.split('/').filter(Boolean).length;
      if (depth >= 3) {
        issues.push({
          type: 'invalid_norm',
          primaryLabel: raw,
          severity: 'warning',
          message: `标签 "${raw}" 嵌套深度达到 ${depth} 层（>= 3 层），层级过深建议扁平化`,
          suggestedAction: 'rename',
          subType: 'depth',
        });
        continue;
      }

      // 5. 纯数字或纯标点无语义符号
      const leafName = tag.name || raw.split('/').pop() || raw;
      const isPureDigits = /^\d+$/.test(leafName);
      // \p{L} 包含汉字、拉丁字母等全语言文字字符；\p{Extended_Pictographic} 包含 Emoji 表情标记
      const hasMeaningfulText = /[\p{L}\p{Extended_Pictographic}]/u.test(leafName);
      const isPurePunctuation = !hasMeaningfulText && !isPureDigits && /^[\p{P}\p{S}\s]+$/u.test(leafName);

      if (isPureDigits || isPurePunctuation) {
        issues.push({
          type: 'invalid_norm',
          primaryLabel: raw,
          severity: 'warning',
          message: isPureDigits
            ? `标签 "${raw}" 为纯数字，缺乏明确知识语义`
            : `标签 "${raw}" 仅包含标点符号，缺乏明确知识语义`,
          suggestedAction: 'rename',
          subType: 'digits',
        });
        continue;
      }
    }

    return issues;
  }

  /**
   * 检测库中低频使用的标签（合并原低频 Count=1 与孤儿 Count=0）
   */
  public static detectLowFrequency(tags: ITagItem[]): ITagHealthIssue[] {
    const issues: ITagHealthIssue[] = [];

    for (const tag of tags) {
      if (tag.count <= 0) {
        issues.push({
          type: 'low_frequency',
          primaryLabel: tag.label,
          severity: 'info',
          message: `标签 "${tag.label}" 引用数为 0（孤儿标签），为废弃无用标签`,
          suggestedAction: 'clean',
          subType: 'zero_ref',
        });
      } else if (tag.count === 1) {
        issues.push({
          type: 'low_frequency',
          primaryLabel: tag.label,
          severity: 'info',
          message: `标签 "${tag.label}" 仅被引用 1 次，存在碎片化风险`,
          suggestedAction: 'clean',
          subType: 'single_ref',
        });
      }
    }

    return issues;
  }

  /**
   * 全面健康体检（三大治理核心：相似冲突、不合规范、低频使用）
   */
  public static runHealthInspection(tags: ITagItem[]): {
    issues: ITagHealthIssue[];
    summary: {
      totalTags: number;
      similarConflicts: number;
      invalidNorms: number;
      lowFrequency: number;
      healthyRate: number;
      caseConflicts: number;
      orphans: number;
    };
  } {
    const similarIssues = this.detectSimilarConflicts(tags);
    const invalidNormIssues = this.detectInvalidNorms(tags);
    const lowFreqIssues = this.detectLowFrequency(tags);

    const issues: ITagHealthIssue[] = [
      ...similarIssues,
      ...invalidNormIssues,
      ...lowFreqIssues,
    ];

    const total = tags.length;
    const problemTagSet = new Set<string>();
    similarIssues.forEach(i => {
      problemTagSet.add(i.primaryLabel);
      i.relatedLabels?.forEach(l => problemTagSet.add(l));
    });
    invalidNormIssues.forEach(i => problemTagSet.add(i.primaryLabel));
    lowFreqIssues.forEach(i => problemTagSet.add(i.primaryLabel));

    const problemTagsCount = problemTagSet.size;
    const healthyRate = total === 0 ? 100 : Math.max(0, Math.round(((total - problemTagsCount) / total) * 100));

    const orphanCount = lowFreqIssues.filter(i => i.subType === 'zero_ref').length;

    return {
      issues,
      summary: {
        totalTags: total,
        similarConflicts: similarIssues.length,
        invalidNorms: invalidNormIssues.length,
        lowFrequency: lowFreqIssues.length,
        healthyRate,
        caseConflicts: similarIssues.length,
        orphans: orphanCount,
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
