import { describe, expect, it, vi } from 'vitest';
import { TagDropService } from '../src/services/TagDropService';
import type { TagApiClient } from '../src/services/TagApiClient';

describe('TagDropService 拖拽打标服务单元测试', () => {
  it('能够成功将标签以【块级末尾追加模式】注入正文段落块', async () => {
    const mockBlock = {
      getAttribute: (name: string) => (name === 'data-node-id' ? '20261002-block-1' : null),
      closest: (selector: string) => {
        if (selector.includes('.protyle-wysiwyg [data-node-id]')) {
          return mockBlock;
        }
        if (selector.includes('.protyle-wysiwyg')) {
          return mockBlock;
        }
        return null;
      },
    } as unknown as HTMLElement;

    const mockClient = {
      getBlockMarkdown: vi.fn().mockResolvedValue('这是一个正在讨论架构的段落。'),
      updateBlock: vi.fn().mockResolvedValue(undefined),
      addTagToDocument: vi.fn().mockResolvedValue(undefined),
    } as unknown as typeof TagApiClient;

    const res = await TagDropService.applyTagToTarget(mockBlock, '架构设计', mockClient);

    expect(res.success).toBe(true);
    expect(res.isDoc).toBe(false);
    expect(res.blockId).toBe('20261002-block-1');
    expect(mockClient.getBlockMarkdown).toHaveBeenCalledWith('20261002-block-1');
    expect(mockClient.updateBlock).toHaveBeenCalledWith(
      '20261002-block-1',
      '这是一个正在讨论架构的段落。 #架构设计#',
    );
  });

  it('若块正文中已存在该标签，不重复重复追加', async () => {
    const mockBlock = {
      getAttribute: (name: string) => (name === 'data-node-id' ? '20261002-block-2' : null),
      closest: (selector: string) => {
        if (selector.includes('.protyle-wysiwyg [data-node-id]')) {
          return mockBlock;
        }
        if (selector.includes('.protyle-wysiwyg')) {
          return mockBlock;
        }
        return null;
      },
    } as unknown as HTMLElement;

    const mockClient = {
      getBlockMarkdown: vi.fn().mockResolvedValue('段落已存在 #架构设计# 标签'),
      updateBlock: vi.fn().mockResolvedValue(undefined),
      addTagToDocument: vi.fn().mockResolvedValue(undefined),
    } as unknown as typeof TagApiClient;

    const res = await TagDropService.applyTagToTarget(mockBlock, '架构设计', mockClient);

    expect(res.success).toBe(true);
    expect(mockClient.updateBlock).not.toHaveBeenCalled();
  });

  it('能够成功将标签添加至文档标题区属性（真实思源 DOM 结构：protyle-title 无 data-node-id，挂载在祖先 .protyle 上）', async () => {
    const mockProtyle = {
      getAttribute: (name: string) => (name === 'data-node-id' ? '20261002-doc-real-1' : null),
    } as unknown as HTMLElement;

    const mockTitle = {
      getAttribute: () => null,
      closest: (selector: string) => {
        if (selector.includes('.protyle-title')) return mockTitle;
        if (selector.includes('.protyle')) return mockProtyle;
        return null;
      },
    } as unknown as HTMLElement;

    // 模拟用户拖拽直接落在大标题输入框 .protyle-title__input 上
    const mockTitleInput = {
      getAttribute: () => null,
      closest: (selector: string) => {
        if (selector.includes('.protyle-wysiwyg')) return null;
        if (selector.includes('.protyle-title')) return mockTitle;
        if (selector.includes('.protyle')) return mockProtyle;
        return null;
      },
    } as unknown as HTMLElement;

    const mockClient = {
      getBlockMarkdown: vi.fn(),
      updateBlock: vi.fn(),
      addTagToDocument: vi.fn().mockResolvedValue(undefined),
    } as unknown as typeof TagApiClient;

    const res = await TagDropService.applyTagToTarget(mockTitleInput, 'AI出海', mockClient);

    expect(res.success).toBe(true);
    expect(res.isDoc).toBe(true);
    expect(res.blockId).toBe('20261002-doc-real-1');
    expect(mockClient.addTagToDocument).toHaveBeenCalledWith('20261002-doc-real-1', 'AI出海');
  });

  it('拖动到思源文档顶部的标签展示区域（.b3-chips__doctag 等）能够成功给文档打标', async () => {
    const mockProtyle = {
      getAttribute: (name: string) => (name === 'data-node-id' ? '20261002-doc-doctag-1' : null),
    } as unknown as HTMLElement;

    const mockChipArea = {
      getAttribute: () => null,
      closest: (selector: string) => {
        if (selector.includes('.protyle-wysiwyg')) return null;
        if (selector.includes('.protyle-title')) return null;
        if (selector.includes('.b3-chips__doctag')) return mockChipArea;
        if (selector.includes('.protyle')) return mockProtyle;
        return null;
      },
    } as unknown as HTMLElement;

    const mockClient = {
      addTagToDocument: vi.fn().mockResolvedValue(undefined),
    } as unknown as typeof TagApiClient;

    const res = await TagDropService.applyTagToTarget(mockChipArea, '重点关注', mockClient);

    expect(res.success).toBe(true);
    expect(res.isDoc).toBe(true);
    expect(res.blockId).toBe('20261002-doc-doctag-1');
    expect(mockClient.addTagToDocument).toHaveBeenCalledWith('20261002-doc-doctag-1', '重点关注');
  });

  it('通过面包屑首项兜底解析当前文档 docId 并成功打标', async () => {
    const mockBreadcrumb = {
      getAttribute: (name: string) => (name === 'data-node-id' ? '20261002-doc-breadcrumb-1' : null),
    };

    const mockProtyle = {
      getAttribute: () => null,
      querySelector: (selector: string) => {
        if (selector.includes('.protyle-breadcrumb')) return mockBreadcrumb;
        return null;
      },
    } as unknown as HTMLElement;

    const mockTitle = {
      getAttribute: () => null,
      closest: (selector: string) => {
        if (selector.includes('.protyle-wysiwyg')) return null;
        if (selector.includes('.protyle-title')) return mockTitle;
        if (selector.includes('.protyle')) return mockProtyle;
        return null;
      },
    } as unknown as HTMLElement;

    const mockClient = {
      addTagToDocument: vi.fn().mockResolvedValue(undefined),
    } as unknown as typeof TagApiClient;

    const res = await TagDropService.applyTagToTarget(mockTitle, '记忆黑科技', mockClient);

    expect(res.success).toBe(true);
    expect(res.isDoc).toBe(true);
    expect(res.blockId).toBe('20261002-doc-breadcrumb-1');
    expect(mockClient.addTagToDocument).toHaveBeenCalledWith('20261002-doc-breadcrumb-1', '记忆黑科技');
  });

  it('对非思源编辑区元素能够正确返回错误', async () => {
    const mockRandom = {
      getAttribute: () => null,
      closest: () => null,
    } as unknown as HTMLElement;

    const res = await TagDropService.applyTagToTarget(mockRandom, '测试');
    expect(res.success).toBe(false);
  });
});
