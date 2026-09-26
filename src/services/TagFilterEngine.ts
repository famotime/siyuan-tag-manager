import type { ISmartTagView } from '../types/tag';

/**
 * 标签布尔筛选与 SQL 查询组装引擎
 */
export class TagFilterEngine {
  /**
   * 安全转义 SQL 字符串与通配符
   */
  public static escapeSql(str: string): string {
    if (!str) return '';
    // 转义反斜杠和单引号
    return str.replace(/\\/g, '\\\\').replace(/'/g, "''");
  }

  /**
   * 安全转义 LIKE 模式匹配中的特殊字符
   */
  public static escapeLike(str: string): string {
    return this.escapeSql(str).replace(/%/g, '\\%').replace(/_/g, '\\_');
  }

  /**
   * 根据多维布尔条件构建高效率的 SQL 查询语句
   * @param options 筛选配置（必含、排除、可选、笔记本限定、分页）
   */
  public static buildQuerySql(options: {
    includeTags?: string[];
    excludeTags?: string[];
    optionalTags?: string[];
    notebookIds?: string[];
    limit?: number;
    offset?: number;
  }): string {
    const includes = (options.includeTags || []).map(t => t.trim()).filter(Boolean);
    const excludes = (options.excludeTags || []).map(t => t.trim()).filter(Boolean);
    const optionals = (options.optionalTags || []).map(t => t.trim()).filter(Boolean);
    const notebookIds = (options.notebookIds || []).map(t => t.trim()).filter(Boolean);

    const conditions: string[] = [];

    // 1. 必含标签 (AND): 每个标签都必须作为子查询命中
    for (const tag of includes) {
      const safeTag = this.escapeSql(tag);
      conditions.push(`b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = '${safeTag}')`);
    }

    // 2. 排除标签 (NOT): 任意一个命中即排除
    for (const tag of excludes) {
      const safeTag = this.escapeSql(tag);
      conditions.push(`b.id NOT IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = '${safeTag}')`);
    }

    // 3. 可选标签 (OR): 如果指定了可选标签，则至少命中一个
    if (optionals.length > 0) {
      const safeList = optionals.map(t => `'${this.escapeSql(t)}'`).join(', ');
      conditions.push(`b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content IN (${safeList}))`);
    }

    // 4. 限定笔记本
    if (notebookIds.length > 0) {
      const safeBoxList = notebookIds.map(box => `'${this.escapeSql(box)}'`).join(', ');
      conditions.push(`b.box IN (${safeBoxList})`);
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    const limit = options.limit && options.limit > 0 ? options.limit : 50;
    const offset = options.offset && options.offset > 0 ? options.offset : 0;

    return `SELECT b.id, b.content, b.markdown, b.type, b.root_id as rootId, b.updated, b.ial, d.content as docTitle `
      + `FROM blocks b `
      + `LEFT JOIN blocks d ON b.root_id = d.id `
      + `WHERE ${whereClause} `
      + `ORDER BY b.updated DESC `
      + `LIMIT ${limit} OFFSET ${offset};`;
  }

  /**
   * 将智能视图（ISmartTagView）转换为查询参数
   */
  public static viewToQuerySql(view: ISmartTagView, limit = 50, offset = 0): string {
    return this.buildQuerySql({
      includeTags: view.includeTags,
      excludeTags: view.excludeTags,
      optionalTags: view.optionalTags,
      notebookIds: view.notebookIds,
      limit,
      offset,
    });
  }

  /**
   * 计算选中标签后的筛选状态
   * @param currentFilter 当前筛选状态
   * @param label 选中的标签
   * @param append 是否为追加模式（默认 false 为仅以点击标签进行单项筛选；true 为以 AND 形式组合筛选）
   */
  public static resolveFilterSelection(
    currentFilter: { includeTags: string[]; excludeTags: string[] },
    label: string,
    append = false
  ): { includeTags: string[]; excludeTags: string[] } {
    const trimmed = label ? label.trim() : '';
    if (!trimmed) {
      return {
        includeTags: [...currentFilter.includeTags],
        excludeTags: [...currentFilter.excludeTags],
      };
    }

    if (!append) {
      // 默认仅以点击标签进行筛选，重置并清空历史包含与排除条件
      return {
        includeTags: [trimmed],
        excludeTags: [],
      };
    }

    // 追加模式：以 AND 加入多维筛选，若之前在排除列表中则自动移除
    const nextIncludes = currentFilter.includeTags.includes(trimmed)
      ? [...currentFilter.includeTags]
      : [...currentFilter.includeTags, trimmed];
    const nextExcludes = currentFilter.excludeTags.filter(t => t !== trimmed);

    return {
      includeTags: nextIncludes,
      excludeTags: nextExcludes,
    };
  }

  /**
   * 切换标签的组合筛选状态（用于多选场景：未包含则以 AND 追加，已包含则反选移除）
   * @param currentFilter 当前筛选状态
   * @param label 选中的标签
   */
  public static toggleFilterSelection(
    currentFilter: { includeTags: string[]; excludeTags: string[] },
    label: string
  ): { includeTags: string[]; excludeTags: string[] } {
    const trimmed = label ? label.trim() : '';
    if (!trimmed) {
      return {
        includeTags: [...currentFilter.includeTags],
        excludeTags: [...currentFilter.excludeTags],
      };
    }

    if (currentFilter.includeTags.includes(trimmed)) {
      return {
        includeTags: currentFilter.includeTags.filter(t => t !== trimmed),
        excludeTags: currentFilter.excludeTags.filter(t => t !== trimmed),
      };
    }

    return {
      includeTags: [...currentFilter.includeTags, trimmed],
      excludeTags: currentFilter.excludeTags.filter(t => t !== trimmed),
    };
  }

  /**
   * 清空所有筛选标签条件，重置为空筛选状态
   */
  public static clearFilterSelection(): { includeTags: string[]; excludeTags: string[] } {
    return {
      includeTags: [],
      excludeTags: [],
    };
  }

  /**
   * 重置并以指定的标签列表建立新的组合筛选条件（清空原有的所有包含与排除筛选状态）
   * @param tags 新组合筛选的标签列表（如关联组合筛选或共现探查）
   */
  public static resetFilterWithTags(tags: string[]): { includeTags: string[]; excludeTags: string[] } {
    const validTags = tags.map(t => (t || '').trim()).filter(Boolean);
    return {
      includeTags: Array.from(new Set(validTags)),
      excludeTags: [],
    };
  }
}

