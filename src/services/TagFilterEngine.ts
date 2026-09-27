import type { ISmartTagView, IFilterSelectionState, TagFilterConditionMode } from '../types/tag';

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

    const andConditions: string[] = [];
    const notConditions: string[] = [];
    let orCondition = '';

    // 1. 必含标签 (AND): 每个标签都必须作为子查询命中
    for (const tag of includes) {
      const safeTag = this.escapeSql(tag);
      andConditions.push(`b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = '${safeTag}')`);
    }

    // 2. 排除标签 (NOT): 任意一个命中即排除
    for (const tag of excludes) {
      const safeTag = this.escapeSql(tag);
      notConditions.push(`b.id NOT IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = '${safeTag}')`);
    }

    // 3. 可选标签 (OR): 如果指定了可选标签，则命中其中任一即可
    if (optionals.length > 0) {
      const safeList = optionals.map(t => `'${this.escapeSql(t)}'`).join(', ');
      orCondition = `b.id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content IN (${safeList}))`;
    }

    const conditions: string[] = [];

    // 正向条件组合：
    // 若同时存在 AND 必含条件与 OR 可选条件，两组正向条件以 OR 关联，
    // 确保单个标签切换为 OR 时即时生效并扩充结果集，避免 AND 组合导致结果不刷新的问题
    if (andConditions.length > 0 && orCondition) {
      const andPart = andConditions.length === 1 ? andConditions[0] : `(${andConditions.join(' AND ')})`;
      conditions.push(`(${andPart} OR ${orCondition})`);
    } else if (andConditions.length > 0) {
      conditions.push(...andConditions);
    } else if (orCondition) {
      conditions.push(orCondition);
    }

    // 排除条件以 AND 追加
    for (const notCond of notConditions) {
      conditions.push(notCond);
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
   * @param append 是否为追加模式（默认 false 为仅以点击标签进行单项筛选；true 为以组合形式筛选）
   * @param mode 追加模式下采用的逻辑 ('include' | 'optional'，默认为 'include' 即 AND)
   */
  public static resolveFilterSelection(
    currentFilter: { includeTags: string[]; excludeTags: string[]; optionalTags?: string[] },
    label: string,
    append = false,
    mode: 'include' | 'optional' = 'include'
  ): IFilterSelectionState {
    const trimmed = label ? label.trim() : '';
    const currentOptionals = currentFilter.optionalTags || [];

    if (!trimmed) {
      return {
        includeTags: [...currentFilter.includeTags],
        excludeTags: [...currentFilter.excludeTags],
        optionalTags: [...currentOptionals],
      };
    }

    if (!append) {
      // 默认仅以点击标签进行单项筛选，重置并清空历史所有条件
      return {
        includeTags: mode === 'include' ? [trimmed] : [],
        optionalTags: mode === 'optional' ? [trimmed] : [],
        excludeTags: [],
      };
    }

    // 追加模式：加入多维筛选，若之前在其他列表中则自动移除
    const nextIncludes = currentFilter.includeTags.filter(t => t !== trimmed);
    const nextExcludes = currentFilter.excludeTags.filter(t => t !== trimmed);
    const nextOptionals = currentOptionals.filter(t => t !== trimmed);

    if (mode === 'optional') {
      nextOptionals.push(trimmed);
    } else {
      nextIncludes.push(trimmed);
    }

    return {
      includeTags: nextIncludes,
      excludeTags: nextExcludes,
      optionalTags: nextOptionals,
    };
  }

  /**
   * 切换标签的组合筛选状态
   * @param currentFilter 当前筛选状态
   * @param label 选中的标签
   * @param mode 指定的目标模式（'include' | 'optional' | 'exclude'，若未指定则遵循默认反选切换）
   */
  public static toggleFilterSelection(
    currentFilter: { includeTags: string[]; excludeTags: string[]; optionalTags?: string[] },
    label: string,
    mode?: TagFilterConditionMode
  ): IFilterSelectionState {
    const trimmed = label ? label.trim() : '';
    const currentOptionals = currentFilter.optionalTags || [];

    if (!trimmed) {
      return {
        includeTags: [...currentFilter.includeTags],
        excludeTags: [...currentFilter.excludeTags],
        optionalTags: [...currentOptionals],
      };
    }

    const nextIncludes = currentFilter.includeTags.filter(t => t !== trimmed);
    const nextExcludes = currentFilter.excludeTags.filter(t => t !== trimmed);
    const nextOptionals = currentOptionals.filter(t => t !== trimmed);

    if (mode === 'include') {
      if (!currentFilter.includeTags.includes(trimmed)) {
        nextIncludes.push(trimmed);
      }
      return { includeTags: nextIncludes, excludeTags: nextExcludes, optionalTags: nextOptionals };
    }

    if (mode === 'optional') {
      if (!currentOptionals.includes(trimmed)) {
        nextOptionals.push(trimmed);
      }
      return { includeTags: nextIncludes, excludeTags: nextExcludes, optionalTags: nextOptionals };
    }

    if (mode === 'exclude') {
      if (!currentFilter.excludeTags.includes(trimmed)) {
        nextExcludes.push(trimmed);
      }
      return { includeTags: nextIncludes, excludeTags: nextExcludes, optionalTags: nextOptionals };
    }

    // 向后兼容默认逻辑：若已包含则反选移除，若未包含则作为 AND 追加
    if (currentFilter.includeTags.includes(trimmed)) {
      return {
        includeTags: nextIncludes,
        excludeTags: nextExcludes,
        optionalTags: nextOptionals,
      };
    }

    return {
      includeTags: [...nextIncludes, trimmed],
      excludeTags: nextExcludes,
      optionalTags: nextOptionals,
    };
  }

  /**
   * 循环切换指定标签的条件状态：AND (必含) -> OR (可选) -> NOT (排除) -> AND (必含)
   */
  public static cycleFilterCondition(
    currentFilter: { includeTags: string[]; excludeTags: string[]; optionalTags?: string[] },
    label: string
  ): IFilterSelectionState {
    const trimmed = label ? label.trim() : '';
    const currentOptionals = currentFilter.optionalTags || [];

    if (!trimmed) {
      return {
        includeTags: [...currentFilter.includeTags],
        excludeTags: [...currentFilter.excludeTags],
        optionalTags: [...currentOptionals],
      };
    }

    const nextIncludes = currentFilter.includeTags.filter(t => t !== trimmed);
    const nextExcludes = currentFilter.excludeTags.filter(t => t !== trimmed);
    const nextOptionals = currentOptionals.filter(t => t !== trimmed);

    if (currentFilter.includeTags.includes(trimmed)) {
      // AND -> OR
      nextOptionals.push(trimmed);
    } else if (currentOptionals.includes(trimmed)) {
      // OR -> NOT
      nextExcludes.push(trimmed);
    } else if (currentFilter.excludeTags.includes(trimmed)) {
      // NOT -> AND
      nextIncludes.push(trimmed);
    } else {
      // 未命中任何集合时默认作为 AND 加入
      nextIncludes.push(trimmed);
    }

    return {
      includeTags: nextIncludes,
      excludeTags: nextExcludes,
      optionalTags: nextOptionals,
    };
  }

  /**
   * 设置指定标签为特定的布尔状态或直接移除
   */
  public static setTagCondition(
    currentFilter: { includeTags: string[]; excludeTags: string[]; optionalTags?: string[] },
    label: string,
    condition: TagFilterConditionMode | 'remove'
  ): IFilterSelectionState {
    const trimmed = label ? label.trim() : '';
    const currentOptionals = currentFilter.optionalTags || [];

    if (!trimmed) {
      return {
        includeTags: [...currentFilter.includeTags],
        excludeTags: [...currentFilter.excludeTags],
        optionalTags: [...currentOptionals],
      };
    }

    const nextIncludes = currentFilter.includeTags.filter(t => t !== trimmed);
    const nextExcludes = currentFilter.excludeTags.filter(t => t !== trimmed);
    const nextOptionals = currentOptionals.filter(t => t !== trimmed);

    if (condition === 'include') {
      nextIncludes.push(trimmed);
    } else if (condition === 'optional') {
      nextOptionals.push(trimmed);
    } else if (condition === 'exclude') {
      nextExcludes.push(trimmed);
    }

    return {
      includeTags: nextIncludes,
      excludeTags: nextExcludes,
      optionalTags: nextOptionals,
    };
  }

  /**
   * 清空所有筛选标签条件，重置为空筛选状态
   */
  public static clearFilterSelection(): IFilterSelectionState {
    return {
      includeTags: [],
      excludeTags: [],
      optionalTags: [],
    };
  }

  /**
   * 重置并以指定的标签列表建立新的组合筛选条件（清空原有的所有包含与排除筛选状态）
   * @param tags 新组合筛选的标签列表（如关联组合筛选或共现探查）
   * @param mode 新条件的模式（默认 'include' 即 AND）
   */
  public static resetFilterWithTags(
    tags: string[],
    mode: 'include' | 'optional' = 'include'
  ): IFilterSelectionState {
    const validTags = Array.from(new Set(tags.map(t => (t || '').trim()).filter(Boolean)));
    return {
      includeTags: mode === 'include' ? validTags : [],
      excludeTags: [],
      optionalTags: mode === 'optional' ? validTags : [],
    };
  }
}

