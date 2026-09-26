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
});
