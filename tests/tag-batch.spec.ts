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

  describe('子文档递归检索与查询语句构建 (SubDocs)', () => {
    it('buildSubDocsQuery 能为多个父文档生成准确的前缀匹配 SQL 语句', () => {
      const parentRows = [
        { id: 'p1', box: 'box_main', path: '/20260901-doc1.sy' },
        { id: 'p2', box: 'box_work', path: '/folder/20260902-doc2.sy' },
      ];

      const sql = TagBatchService.buildSubDocsQuery(parentRows);
      expect(sql).toContain("type = 'd'");
      expect(sql).toContain("(box = 'box_main' AND path LIKE '/20260901-doc1/%')");
      expect(sql).toContain("(box = 'box_work' AND path LIKE '/folder/20260902-doc2/%')");
    });

    it('buildSubDocsQuery 在没有有效父文档路径时返回空字符串', () => {
      expect(TagBatchService.buildSubDocsQuery([])).toBe('');
      expect(TagBatchService.buildSubDocsQuery([{ id: 'no-box' } as any])).toBe('');
    });

    it('getSubDocs 能成功递归查出指定文档名下的所有子文档，并自动排除父文档本身与重复项', async () => {
      const mockRequest = async (url: string, data: any) => {
        if (url === '/api/query/sql') {
          // 第一步：查父文档
          if (data.stmt.includes("id IN ('root_doc')")) {
            return {
              code: 0,
              data: [
                { id: 'root_doc', box: 'box_1', path: '/20260927-root.sy', content: '根文档' },
              ],
            };
          }
          // 第二步：查子文档
          if (data.stmt.includes("path LIKE '/20260927-root/%'")) {
            return {
              code: 0,
              data: [
                // 模拟内核可能返回包含父文档或重复记录的情况
                { id: 'root_doc', content: '根文档', path: '/20260927-root.sy' },
                { id: 'sub_doc_1', content: '一级子文档A', path: '/20260927-root/20260927-sub1.sy' },
                { id: 'sub_doc_2', content: '二级孙文档B', path: '/20260927-root/20260927-sub1/20260927-sub2.sy' },
                { id: 'sub_doc_1', content: '一级子文档A', path: '/20260927-root/20260927-sub1.sy' }, // 重复项
              ],
            };
          }
        }
        return { code: 0, data: [] };
      };

      const subDocs = await TagBatchService.getSubDocs(['root_doc'], mockRequest);
      expect(subDocs.length).toBe(2);
      expect(subDocs.map(d => d.id)).toEqual(['sub_doc_1', 'sub_doc_2']);
      expect(subDocs.map(d => d.title)).toEqual(['一级子文档A', '二级孙文档B']);
    });

    it('getSubDocs 传入空数组或未查询到父文档时安全返回空数组', async () => {
      const resEmpty = await TagBatchService.getSubDocs([]);
      expect(resEmpty).toEqual([]);

      const mockRequest = async () => ({ code: 0, data: [] });
      const resNotFound = await TagBatchService.getSubDocs(['not_exist_doc'], mockRequest);
      expect(resNotFound).toEqual([]);
    });
  });
});


