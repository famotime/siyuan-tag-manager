import { describe, expect, it } from 'vitest';
import { TagTreeService } from '../src/services/TagTreeService';
import type { ITagItem } from '../src/types/tag';

describe('TagTreeService 树形构建与检索服务测试', () => {
  it('能够将带斜杠的扁平标签正确转换为层级树，并聚合子树计数', () => {
    const flatTags: ITagItem[] = [
      { name: 'python', label: 'tech/backend/python', count: 10, depth: 0 },
      { name: 'go', label: 'tech/backend/go', count: 5, depth: 0 },
      { name: 'vue', label: 'tech/frontend/vue', count: 8, depth: 0 },
      { name: 'AI', label: 'AI', count: 25, depth: 0 },
    ];

    const tree = TagTreeService.buildTree(flatTags, 'count_desc');

    expect(tree.length).toBe(2); // AI 与 tech
    const techNode = tree.find(n => n.name === 'tech');
    expect(techNode).toBeDefined();
    expect(techNode?.count).toBe(23); // 10 + 5 + 8
    expect(techNode?.children?.length).toBe(2); // backend 与 frontend

    const backendNode = techNode?.children?.find(n => n.name === 'backend');
    expect(backendNode).toBeDefined();
    expect(backendNode?.children?.length).toBe(2); // python 与 go
  });

  it('支持置顶项优先排序', () => {
    const flatTags: ITagItem[] = [
      { name: 'A', label: 'A', count: 100, depth: 0 },
      { name: 'B', label: 'B', count: 1, depth: 0, metadata: { label: 'B', isPinned: true, updatedAt: 0 } },
    ];

    const tree = TagTreeService.buildTree(flatTags, 'count_desc');
    // 置顶项 B 即使 count 只有 1，也必须排在 A 前面
    expect(tree[0].name).toBe('B');
    expect(tree[1].name).toBe('A');
  });

  it('支持模糊关键字搜索并保留路径链路', () => {
    const flatTags: ITagItem[] = [
      { name: 'python', label: 'tech/backend/python', count: 10, depth: 0 },
      { name: 'vue', label: 'tech/frontend/vue', count: 8, depth: 0 },
      { name: 'AI', label: 'AI', count: 25, depth: 0 },
    ];

    const tree = TagTreeService.buildTree(flatTags);
    const filtered = TagTreeService.filterTree(tree, 'python');

    expect(filtered.length).toBe(1); // 仅匹配 tech 路径
    expect(filtered[0].name).toBe('tech');
    expect(filtered[0].children?.[0].name).toBe('backend');
    expect(filtered[0].children?.[0].children?.[0].name).toBe('python');
  });

  it('flattenTree 能够将嵌套树按前序遍历拍平并保留正确 depth', () => {
    const flatTags: ITagItem[] = [
      { name: 'python', label: 'tech/backend/python', count: 10, depth: 0 },
      { name: 'vue', label: 'tech/frontend/vue', count: 8, depth: 0 },
      { name: 'AI', label: 'AI', count: 25, depth: 0 },
    ];
    const tree = TagTreeService.buildTree(flatTags);
    const flattened = TagTreeService.flattenTree(tree);

    // AI (depth 0), tech (depth 0), backend (depth 1), python (depth 2), frontend (depth 1), vue (depth 2)
    expect(flattened.length).toBe(6);
    expect(flattened.find(n => n.label === 'tech')?.depth).toBe(0);
    expect(flattened.find(n => n.label === 'tech/backend')?.depth).toBe(1);
    expect(flattened.find(n => n.label === 'tech/backend/python')?.depth).toBe(2);
  });

  it('calculateReparentMoves 能够正确计算将标签拖入父标签的级联重构路径', () => {
    const allTags: ITagItem[] = [
      { name: 'backend', label: 'backend', count: 5, depth: 0 },
      { name: 'python', label: 'backend/python', count: 10, depth: 1 },
      { name: 'go', label: 'backend/go', count: 3, depth: 1 },
      { name: 'tech', label: 'tech', count: 2, depth: 0 },
    ];

    // 将 backend 拖入 tech 下
    const moves = TagTreeService.calculateReparentMoves('backend', 'tech', allTags);
    expect(moves).toEqual([
      { oldLabel: 'backend', newLabel: 'tech/backend' },
      { oldLabel: 'backend/python', newLabel: 'tech/backend/python' },
      { oldLabel: 'backend/go', newLabel: 'tech/backend/go' },
    ]);
  });

  it('calculateReparentMoves 能够正确计算将子标签拖拽到根节点提升为顶级标签', () => {
    const allTags: ITagItem[] = [
      { name: 'tech', label: 'tech', count: 20, depth: 0 },
      { name: 'frontend', label: 'tech/frontend', count: 10, depth: 1 },
      { name: 'vue', label: 'tech/frontend/vue', count: 8, depth: 2 },
    ];

    // 将 tech/frontend 拖到根节点 (targetParentLabel: null)
    const moves = TagTreeService.calculateReparentMoves('tech/frontend', null, allTags);
    expect(moves).toEqual([
      { oldLabel: 'tech/frontend', newLabel: 'frontend' },
      { oldLabel: 'tech/frontend/vue', newLabel: 'frontend/vue' },
    ]);
  });

  it('calculateReparentMoves 能够防御非法自环拖拽（拖到自身或子孙节点）', () => {
    const allTags: ITagItem[] = [
      { name: 'tech', label: 'tech', count: 10, depth: 0 },
      { name: 'frontend', label: 'tech/frontend', count: 5, depth: 1 },
    ];

    // 尝试将 tech 拖到自身
    expect(TagTreeService.calculateReparentMoves('tech', 'tech', allTags)).toEqual([]);
    // 尝试将 tech 拖到其子孙 tech/frontend
    expect(TagTreeService.calculateReparentMoves('tech', 'tech/frontend', allTags)).toEqual([]);
  });

  it('applyStagedRenames 能够为标签列表即时生成暂存预览状态', () => {
    const flatTags: ITagItem[] = [
      { name: 'vue', label: 'vue', count: 10, depth: 0 },
      { name: 'react', label: 'react', count: 8, depth: 0 },
    ];
    const staged = new Map<string, string>([
      ['vue', 'frontend/vue'],
    ]);

    const preview = TagTreeService.applyStagedRenames(flatTags, staged);
    const vueItem = preview.find(t => t.name === 'vue');
    expect(vueItem?.label).toBe('frontend/vue');
    expect(vueItem?.depth).toBe(1);

    const reactItem = preview.find(t => t.name === 'react');
    expect(reactItem?.label).toBe('react');
    expect(reactItem?.depth).toBe(0);
  });
});
