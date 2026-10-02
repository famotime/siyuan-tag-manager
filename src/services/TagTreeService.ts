import type { ITagItem } from '../types/tag';

export type TagSortMode = 'name_asc' | 'name_desc' | 'count_asc' | 'count_desc';

/**
 * 标签树形层级构建与检索服务
 */
export class TagTreeService {
  /**
   * 将扁平的标签列表按 "/" 路径构建为多叉树
   */
  public static buildTree(flatTags: ITagItem[], sortMode: TagSortMode = 'count_desc'): ITagItem[] {
    const rootNodes: ITagItem[] = [];

    for (const tag of flatTags) {
      const parts = tag.label.split('/');
      let currentLevel = rootNodes;
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const partName = parts[i];
        currentPath = currentPath ? `${currentPath}/${partName}` : partName;
        const isLeaf = i === parts.length - 1;

        let existing = currentLevel.find(n => n.name === partName);
        if (!existing) {
          existing = {
            name: partName,
            label: currentPath,
            count: isLeaf ? tag.count : 0,
            blockCount: isLeaf ? (tag.blockCount ?? tag.count) : 0,
            docCount: isLeaf ? (tag.docCount ?? 0) : 0,
            depth: i,
            children: [],
            metadata: isLeaf ? tag.metadata : undefined,
          };
          currentLevel.push(existing);
        } else if (isLeaf) {
          existing.count = (existing.count || 0) + tag.count;
          existing.blockCount = (existing.blockCount ?? 0) + (tag.blockCount ?? tag.count);
          existing.docCount = Math.max(existing.docCount ?? 0, tag.docCount ?? 0);
          if (tag.metadata) {
            existing.metadata = { ...existing.metadata, ...tag.metadata };
          }
        }

        if (!existing.children) {
          existing.children = [];
        }
        currentLevel = existing.children;
      }
    }

    // 递归计算父节点的聚合计数，并对各层进行排序
    this.aggregateAndSortTree(rootNodes, sortMode);
    return rootNodes;
  }

  /**
   * 将多叉树按前序遍历拍平为带有准确 depth 的节点列表
   */
  public static flattenTree(nodes: ITagItem[]): ITagItem[] {
    const list: ITagItem[] = [];
    const traverse = (items: ITagItem[]) => {
      for (const item of items) {
        list.push(item);
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      }
    };
    traverse(nodes);
    return list;
  }

  /**
   * 根据暂存的重命名映射表，为标签列表生成前端预览态虚拟标签列表
   */
  public static applyStagedRenames(
    flatTags: ITagItem[],
    stagedRenames: Map<string, string>,
  ): ITagItem[] {
    if (!stagedRenames || stagedRenames.size === 0) {
      return flatTags;
    }
    return flatTags.map(tag => {
      const newLabel = stagedRenames.get(tag.label);
      if (newLabel) {
        const parts = newLabel.split('/');
        return {
          ...tag,
          label: newLabel,
          name: parts[parts.length - 1],
          depth: Math.max(0, parts.length - 1),
        };
      }
      return tag;
    });
  }

  /**
   * 计算拖拽重构层级（Reparenting）所产生的重命名映射列表
   * @param sourceLabel 待移动的源标签全名（如 "tech/python" 或 "frontend"）
   * @param targetParentLabel 目标父标签全名（如 "dev"），为 null 时表示移动至根层级
   * @param allTags 全库标签列表（用于寻找所有需要级联迁移的下属子标签）
   */
  public static calculateReparentMoves(
    sourceLabel: string,
    targetParentLabel: string | null,
    allTags: ITagItem[],
  ): Array<{ oldLabel: string; newLabel: string }> {
    if (!sourceLabel) return [];
    const leafName = sourceLabel.split('/').pop() || sourceLabel;

    let targetBase = '';
    if (targetParentLabel === null) {
      // 移至顶级
      if (!sourceLabel.includes('/')) {
        // 本来就是顶级，无需变动
        return [];
      }
      targetBase = leafName;
    } else {
      // 目标不能是自身或自身的子孙节点
      if (targetParentLabel === sourceLabel || targetParentLabel.startsWith(`${sourceLabel}/`)) {
        return [];
      }
      targetBase = `${targetParentLabel}/${leafName}`;
      if (sourceLabel === targetBase) {
        return [];
      }
    }

    const moves: Array<{ oldLabel: string; newLabel: string }> = [
      { oldLabel: sourceLabel, newLabel: targetBase },
    ];

    // 级联处理所有以 `${sourceLabel}/` 开头的子孙标签
    const prefix = `${sourceLabel}/`;
    const descendantTags = allTags.filter(t => t.label.startsWith(prefix));
    const seen = new Set<string>([sourceLabel]);

    for (const d of descendantTags) {
      if (!seen.has(d.label)) {
        seen.add(d.label);
        const suffix = d.label.slice(sourceLabel.length);
        moves.push({ oldLabel: d.label, newLabel: `${targetBase}${suffix}` });
      }
    }

    return moves;
  }

  /**
   * 递归聚合计数并排序
   */
  private static aggregateAndSortTree(nodes: ITagItem[], sortMode: TagSortMode) {
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        this.aggregateAndSortTree(node.children, sortMode);
        // 如果父节点本身没有单独的引用，或者为了呈现整棵子树热度，聚合子节点计数
        const childrenSum = node.children.reduce((acc, c) => acc + c.count, 0);
        node.count = Math.max(node.count, childrenSum);
        if (node.blockCount !== undefined) {
          const childrenBlocks = node.children.reduce((acc, c) => acc + (c.blockCount ?? c.count), 0);
          node.blockCount = Math.max(node.blockCount, childrenBlocks);
        }
        if (node.docCount !== undefined) {
          const childrenDocs = node.children.reduce((acc, c) => acc + (c.docCount ?? 0), 0);
          node.docCount = Math.max(node.docCount, childrenDocs);
        }
      }
    }
    this.sortNodes(nodes, sortMode);
  }

  /**
   * 针对单层节点执行排序
   */
  public static sortNodes(nodes: ITagItem[], sortMode: TagSortMode) {
    nodes.sort((a, b) => {
      // 优先置顶项排在前列
      const pinA = a.metadata?.isPinned ? 1 : 0;
      const pinB = b.metadata?.isPinned ? 1 : 0;
      if (pinA !== pinB) {
        return pinB - pinA;
      }

      switch (sortMode) {
        case 'count_desc':
          return b.count - a.count;
        case 'count_asc':
          return a.count - b.count;
        case 'name_desc':
          return b.name.localeCompare(a.name, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
      }
    });
  }

  /**
   * 模糊搜索过滤树形节点
   * 若子节点匹配，则保留并展开所有父节点
   */
  public static filterTree(nodes: ITagItem[], keyword: string): ITagItem[] {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return nodes;

    const result: ITagItem[] = [];

    for (const node of nodes) {
      const selfMatch = node.name.toLowerCase().includes(kw)
        || node.label.toLowerCase().includes(kw)
        || (node.metadata?.aliases?.some(a => a.toLowerCase().includes(kw)) ?? false);

      let filteredChildren: ITagItem[] = [];
      if (node.children && node.children.length > 0) {
        filteredChildren = this.filterTree(node.children, keyword);
      }

      if (selfMatch || filteredChildren.length > 0) {
        result.push({
          ...node,
          children: filteredChildren,
        });
      }
    }

    return result;
  }
}
