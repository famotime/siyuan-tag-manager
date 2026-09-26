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
          existing.count = tag.count;
          existing.blockCount = tag.blockCount ?? tag.count;
          existing.docCount = tag.docCount ?? 0;
          if (tag.metadata) {
            existing.metadata = tag.metadata;
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
