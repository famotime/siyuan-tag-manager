import { describe, expect, it } from 'vitest';
import { TagBatchService } from '../src/services/TagBatchService';

describe('TagBatchService 批量打标与属性更新测试', () => {
  it('正确解析与规范化文档 IAL tags 属性', () => {
    const raw = 'YouTube, /tech/python/,  AI ';
    const tags = TagBatchService.parseDocTags(raw);
    expect(tags).toEqual(['YouTube', 'tech/python', 'AI']);
  });

  it('追加新标签时自动去重并保留已有标签', () => {
    const current = 'YouTube,AI';
    const updated = TagBatchService.appendDocTags(current, ['AI', 'Prompt', 'Cursor']);
    expect(updated).toBe('YouTube,AI,Prompt,Cursor');
  });

  it('安全移除指定标签', () => {
    const current = 'YouTube,AI,Prompt';
    const remaining = TagBatchService.removeDocTags(current, ['AI', 'NonExist']);
    expect(remaining).toBe('YouTube,Prompt');
  });

  it('向普通 Markdown 块追加标签标记且不重复追加', () => {
    const md = '这是一篇关于AI视频制作的技术笔记。';
    const tagged = TagBatchService.appendMarkdownTag(md, 'YouTube');
    expect(tagged).toBe('这是一篇关于AI视频制作的技术笔记。 #YouTube#');

    // 重复追加同一标签应保持不变
    const reTagged = TagBatchService.appendMarkdownTag(tagged, 'YouTube');
    expect(reTagged).toBe('这是一篇关于AI视频制作的技术笔记。 #YouTube#');
  });

  it('searchDocs 通过 SQL 模糊检索文档并解析现有 tags', async () => {
    const mockRequest = async (url: string, data: any) => {
      if (url === '/api/query/sql') {
        expect(data.stmt).toContain("content LIKE '%AI%'");
        return {
          code: 0,
          data: [
            { id: 'doc_1', content: 'AI应用开发指南', ial: 'tags="AI,Vue"' },
            { id: 'doc_2', content: 'AI模型评测', ial: '' },
          ],
        };
      }
      return { code: 0 };
    };

    const results = await TagBatchService.searchDocs('AI', 10, mockRequest);
    expect(results.length).toBe(2);
    expect(results[0].title).toBe('AI应用开发指南');
    expect(results[0].tags).toEqual(['AI', 'Vue']);
    expect(results[1].tags).toEqual([]);
  });

  it('getNotebookDocs 获取指定笔记本下的文档列表', async () => {
    const mockRequest = async (url: string, data: any) => {
      if (url === '/api/query/sql') {
        expect(data.stmt).toContain("box = 'nb_123'");
        return {
          code: 0,
          data: [
            { id: 'doc_nb1', content: '前端工程架构', ial: 'tags="架构"' },
          ],
        };
      }
      return { code: 0 };
    };

    const docs = await TagBatchService.getNotebookDocs('nb_123', 20, mockRequest);
    expect(docs.length).toBe(1);
    expect(docs[0].id).toBe('doc_nb1');
    expect(docs[0].title).toBe('前端工程架构');
    expect(docs[0].tags).toEqual(['架构']);
  });

  it('fetchNotebooks 正确获取笔记本列表', async () => {
    const mockRequest = async (url: string) => {
      if (url === '/api/notebook/lsNotebooks') {
        return {
          code: 0,
          data: {
            notebooks: [
              { id: 'nb_a', name: '工作笔记', closed: false },
              { id: 'nb_b', name: '个人知识库', closed: false },
            ],
          },
        };
      }
      return { code: 0 };
    };

    const list = await TagBatchService.fetchNotebooks(mockRequest);
    expect(list.length).toBe(2);
    expect(list[0]).toEqual({ id: 'nb_a', name: '工作笔记' });
  });
});

