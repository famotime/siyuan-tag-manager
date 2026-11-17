import { describe, it, expect, vi, afterEach } from 'vitest';
import { TagApiClient } from '../src/services/TagApiClient';
import { TagFilterEngine } from '../src/services/TagFilterEngine';
import { TagCooccurrenceService } from '../src/services/TagCooccurrenceService';
import { TagBatchService } from '../src/services/TagBatchService';
import { TagDocConverterService } from '../src/services/TagDocConverterService';
import { DEFAULT_GROUP_COLOR } from '../src/styles/palette';

/**
 * 传输层收敛测试
 * 核心回归：batchTagDocuments / createDocFromTag 默认 fetch 缺失 Authorization 头缺陷
 */
const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as any).window;

function mockFetch(handler: (url: string, init: any) => any) {
  globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: any) => ({
    json: async () => handler(url, init),
  })) as any;
}

function enableSiyuanWindow(apiToken?: string) {
  (globalThis as any).window = {
    siyuan: { config: apiToken ? { apiToken } : {} },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as any).window = originalWindow;
});

describe('TagApiClient 传输层', () => {
  it('postRaw 返回原始响应信封并注入 Authorization 头', async () => {
    enableSiyuanWindow('tok_abc');
    let capturedInit: any = null;
    mockFetch((_url, init) => {
      capturedInit = init;
      return { code: 0, data: { ok: true } };
    });

    const envelope = await TagApiClient.postRaw('/api/query/sql', { stmt: 'SELECT 1' });
    expect(envelope).toEqual({ code: 0, data: { ok: true } });
    expect(capturedInit.headers.Authorization).toBe('Token tok_abc');
    expect(capturedInit.headers['Content-Type']).toBe('application/json');
  });

  it('request 解包 data 并在 code!=0 时抛错', async () => {
    mockFetch(() => ({ code: -1, msg: '权限不足' }));
    await expect(TagApiClient.request('/api/x', {})).rejects.toThrow('权限不足');

    mockFetch(() => ({ code: 0, data: [1, 2, 3] }));
    const data = await TagApiClient.request('/api/x', {});
    expect(data).toEqual([1, 2, 3]);
  });
});

describe('鉴权头缺陷回归 · 默认传输必须携带 Authorization', () => {
  it('TagBatchService.batchTagDocuments 默认 fetch 携带鉴权头', async () => {
    enableSiyuanWindow('tok_batch');
    const authHeaders: string[] = [];
    mockFetch((url: string) => {
      authHeaders.push(url);
      if (url === '/api/attr/getBlockAttrs') {
        return { code: 0, data: { tags: 'existing' } };
      }
      return { code: 0, data: null };
    });

    const res = await TagBatchService.batchTagDocuments(['doc_1'], ['newTag']);
    expect(res.success).toBe(true);
    expect(res.updatedCount).toBe(1);

    const fetchMock = globalThis.fetch as any;
    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.Authorization).toBe('Token tok_batch');
    }
  });

  it('TagBatchService.batchTagDocuments 保留既有标签并追加新标签', async () => {
    enableSiyuanWindow();
    const setAttrsCalls: any[] = [];
    mockFetch((url: string, init: any) => {
      if (url === '/api/attr/setBlockAttrs') {
        setAttrsCalls.push(JSON.parse(init.body));
      }
      return { code: 0, data: { tags: 'a,b' } };
    });

    await TagBatchService.batchTagDocuments(['doc_1'], ['c']);
    expect(setAttrsCalls[0].attrs.tags).toBe('a,b,c');
  });

  it('TagDocConverterService.createDocFromTag 默认 fetch 携带鉴权头', async () => {
    enableSiyuanWindow('tok_doc');
    mockFetch((url: string) => {
      if (url === '/api/notebook/lsNotebooks') {
        return { code: 0, data: { notebooks: [{ id: 'nb1', name: '笔记本', closed: false }] } };
      }
      if (url === '/api/filetree/createDocWithMd') {
        return { code: 0, data: '20240101120000-newdoc' };
      }
      return { code: 0, data: null };
    });

    const res = await TagDocConverterService.createDocFromTag(
      '测试标签',
      [{ id: 'b1', content: '块内容', rootId: 'doc1', docTitle: '文档', markdown: '# 测试标签#\n块内容', type: 'p', updated: '20240101120000', matchedTags: ['测试标签'] }],
    );
    expect(res.success).toBe(true);

    const fetchMock = globalThis.fetch as any;
    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.Authorization).toBe('Token tok_doc');
    }
  });
});

describe('领域服务迁移 · 传输函数注入', () => {
  it('TagFilterEngine.queryMatchedBlocks 构建 SQL 并完成 IAL 文档标签格式化', async () => {
    const calls: Array<{ url: string; data: any }> = [];
    const transport = async (url: string, data: any) => {
      calls.push({ url, data });
      return [
        { id: 'b1', rootId: 'd1', content: '正文内容', markdown: 'md', type: 'p', updated: '20240101' },
        {
          id: 'd1',
          rootId: 'd1',
          content: '文档标题',
          markdown: 'md',
          type: 'd',
          updated: '20240101',
          ial: 'tags="AI,Vue"',
        },
      ];
    };

    const blocks = await TagFilterEngine.queryMatchedBlocks(
      { includeTags: ['AI'], limit: 10 },
      transport,
    );

    expect(calls[0].url).toBe('/api/query/sql');
    expect(calls[0].data.stmt).toContain('AI');
    expect(blocks.length).toBe(2);
    expect(blocks[0].docTitle).toBe('未命名文档');
    // 文档级根块从 IAL 提取 tags 追加展示
    expect(blocks[1].content).toContain('#AI#');
    expect(blocks[1].content).toContain('文档标题');
    expect(blocks[1].matchedTags).toEqual(['AI']);
  });

  it('TagCooccurrenceService.fetchCooccurrenceGraph 注入传输并构建图谱', async () => {
    const transport = async (url: string, data: any) => {
      expect(url).toBe('/api/query/sql');
      expect(data.stmt).toContain('spans');
      return [
        { block_id: 'b1', content: 'AI' },
        { block_id: 'b1', content: 'Vue' },
        { block_id: 'b2', content: 'AI' },
      ];
    };

    const result = await TagCooccurrenceService.fetchCooccurrenceGraph(transport);
    expect(result.spansCount).toBe(3);
    expect(result.graph).toBeDefined();
    expect(result.combinations).toBeDefined();
  });
});

describe('批量打标执行链路统一 executeBatchTagging', () => {
  it('空文档或空标签拦截并返回 false，不触发执行', async () => {
    const batchSpy = vi.spyOn(TagBatchService, 'batchTagDocuments').mockResolvedValue({
      success: true,
      updatedCount: 1,
      errors: [],
    });
    const setExecuting = vi.fn();

    const res1 = await TagBatchService.executeBatchTagging([], ['tag'], setExecuting);
    const res2 = await TagBatchService.executeBatchTagging(['doc1'], [], setExecuting);

    expect(res1).toBe(false);
    expect(res2).toBe(false);
    expect(batchSpy).not.toHaveBeenCalled();
    expect(setExecuting).not.toHaveBeenCalled();

    batchSpy.mockRestore();
  });

  it('执行成功返回 true 且 executing 状态正确切换', async () => {
    const batchSpy = vi.spyOn(TagBatchService, 'batchTagDocuments').mockResolvedValue({
      success: true,
      updatedCount: 3,
      errors: [],
    });
    const setExecuting = vi.fn();

    const res = await TagBatchService.executeBatchTagging(['d1', 'd2', 'd3'], ['tagA'], setExecuting);

    expect(res).toBe(true);
    expect(batchSpy).toHaveBeenCalledWith(['d1', 'd2', 'd3'], ['tagA']);
    expect(setExecuting).toHaveBeenNthCalledWith(1, true);
    expect(setExecuting).toHaveBeenNthCalledWith(2, false);

    batchSpy.mockRestore();
  });

  it('执行存在错误时返回 false', async () => {
    const batchSpy = vi.spyOn(TagBatchService, 'batchTagDocuments').mockResolvedValue({
      success: false,
      updatedCount: 0,
      errors: ['更新文档 d1 失败: boom'],
    });
    const setExecuting = vi.fn();

    const res = await TagBatchService.executeBatchTagging(['d1'], ['tagA'], setExecuting);

    expect(res).toBe(false);
    expect(setExecuting).toHaveBeenNthCalledWith(2, false);

    batchSpy.mockRestore();
  });

  it('执行异常时返回 false 且最终解除执行态', async () => {
    const batchSpy = vi.spyOn(TagBatchService, 'batchTagDocuments').mockRejectedValue(new Error('network down'));
    const setExecuting = vi.fn();

    const res = await TagBatchService.executeBatchTagging(['d1'], ['tagA'], setExecuting);

    expect(res).toBe(false);
    expect(setExecuting).toHaveBeenNthCalledWith(2, false);

    batchSpy.mockRestore();
  });

  it('默认组色常量与应用侧一致', () => {
    expect(DEFAULT_GROUP_COLOR).toBe('#4285F4');
  });
});
