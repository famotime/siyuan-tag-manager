import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TagApiClient } from '../src/services/TagApiClient';

describe('TagApiClient 内核 API 适配客户端单元测试', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('request 基础通信与鉴权头', () => {
    it('当接口返回 code === 0 时正确解析返回 data（支持 block_count 与 doc_count）', async () => {
      let executedSql = '';
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
        executedSql = JSON.parse(init.body).stmt;
        return Promise.resolve({
          json: async () => ({
            code: 0,
            msg: '',
            data: [{ label: 'vue', block_count: 5, doc_count: 3 }],
          }),
        });
      });

      const tags = await TagApiClient.fetchAllTags();
      expect(executedSql).toContain('INNER JOIN blocks b ON s.block_id = b.id');
      expect(executedSql).toContain('count(DISTINCT b.id) as block_count');
      expect(executedSql).toContain('count(DISTINCT b.root_id) as doc_count');
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe('vue');
      expect(tags[0].count).toBe(5);
      expect(tags[0].blockCount).toBe(5);
      expect(tags[0].docCount).toBe(3);
    });

    it('当接口返回非零 code 时抛出带有 msg 的异常', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ code: -1, msg: '权限拒绝或未授权' }),
      } as any);

      await expect(TagApiClient.renameTag('old', 'new')).rejects.toThrow('权限拒绝或未授权');
    });

    it('当 SQL 查询失败时能平滑降级至 /api/tag/getTag 树形接口并拍平', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes('/api/query/sql')) {
          return Promise.reject(new Error('SQL query failure'));
        }
        if (url.includes('/api/tag/getTag')) {
          return Promise.resolve({
            json: async () => ({
              code: 0,
              data: [
                {
                  label: 'parent',
                  name: 'parent',
                  count: 10,
                  children: [
                    { label: 'parent/child', name: 'child', count: 3, children: [] },
                  ],
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const tags = await TagApiClient.fetchAllTags();
      expect(tags).toHaveLength(2);
      expect(tags[0].label).toBe('parent');
      expect(tags[0].depth).toBe(0);
      expect(tags[1].label).toBe('parent/child');
      expect(tags[1].depth).toBe(1);
      expect(callCount).toBe(2);
    });
  });

  describe('executeMergePlan 合并执行与进度报告', () => {
    it('能够依次调用 renameTag，并触发进度回调且统计成功数', async () => {
      const calls: any[] = [];
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
        calls.push(JSON.parse(init.body));
        return Promise.resolve({
          json: async () => ({ code: 0, data: null }),
        });
      });

      const progressSteps: number[] = [];
      const plan = {
        targetLabel: 'React',
        sourceLabels: ['react', 'ReactJS'],
        affectedBlockCount: 10,
        setAsAliasAfterMerge: true,
      };

      const res = await TagApiClient.executeMergePlan(plan, (cur, total, label) => {
        progressSteps.push(cur);
      });

      expect(res.success).toBe(true);
      expect(res.mergedCount).toBe(2);
      expect(res.errors).toHaveLength(0);
      expect(progressSteps).toEqual([1, 2]);
      expect(calls).toEqual([
        { oldLabel: 'react', newLabel: 'React' },
        { oldLabel: 'ReactJS', newLabel: 'React' },
      ]);
    });

    it('单个源标签合并失败时能捕获并记录错误，且继续执行后续标签', async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
        const body = JSON.parse(init.body);
        if (body.oldLabel === 'failingTag') {
          return Promise.resolve({
            json: async () => ({ code: -1, msg: 'Tag locked' }),
          });
        }
        return Promise.resolve({
          json: async () => ({ code: 0, data: null }),
        });
      });

      const plan = {
        targetLabel: 'Target',
        sourceLabels: ['failingTag', 'normalTag'],
        affectedBlockCount: 5,
        setAsAliasAfterMerge: false,
      };

      const res = await TagApiClient.executeMergePlan(plan);
      expect(res.success).toBe(false);
      expect(res.mergedCount).toBe(1);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toContain('failingTag');
    });
  });

  describe('queryMatchedBlocks 与图谱时序数据', () => {
    it('queryMatchedBlocks 能正确构造 SQL 并解析块对象列表', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          code: 0,
          data: [
            {
              id: 'block-1',
              rootId: 'doc-1',
              docTitle: '测试文档',
              content: '含有 #AI# 的内容',
              markdown: '含有 #AI# 的内容',
              type: 'p',
              updated: '20260926080000',
            },
          ],
        }),
      } as any);

      const blocks = await TagApiClient.queryMatchedBlocks({
        includeTags: ['AI'],
        limit: 10,
      });

      expect(blocks).toHaveLength(1);
      expect(blocks[0].id).toBe('block-1');
      expect(blocks[0].docTitle).toBe('测试文档');
    });

    it('queryMatchedBlocks 能正确识别并解析文档级根块 (type = d) 中的 ial tags 属性', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          code: 0,
          data: [
            {
              id: 'doc-block-1',
              rootId: 'doc-block-1',
              docTitle: '2026-05-17 Query Builder 示例',
              content: '2026-05-17 Query Builder 示例',
              markdown: '',
              type: 'd',
              updated: '20260614103132',
              ial: '{: bookmark="✨" id="doc-block-1" tags="AI出海,AIGC" title="2026-05-17 Query Builder 示例" type="doc"}',
            },
          ],
        }),
      } as any);

      const blocks = await TagApiClient.queryMatchedBlocks({
        includeTags: ['AI出海'],
        limit: 10,
      });

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('d');
      expect(blocks[0].content).toContain('#AI出海#');
      expect(blocks[0].content).toContain('#AIGC#');
    });

    it('fetchTagTimestamps 能提取指定标签的所有时间戳并过滤空值', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          code: 0,
          data: [
            { updated: '20260926100000' },
            { updated: '20260925120000' },
            { updated: '' },
          ],
        }),
      } as any);

      const timestamps = await TagApiClient.fetchTagTimestamps('Vue');
      expect(timestamps).toEqual(['20260926100000', '20260925120000']);
    });
  });
});
