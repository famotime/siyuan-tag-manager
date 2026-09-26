import { describe, expect, it } from 'vitest';
import { TagRefPromoteService } from '../src/services/TagRefPromoteService';
import type { ITagItem } from '../src/types/tag';

describe('TagRefPromoteService 引用识别为同名标签测试', () => {
  const existingTags: ITagItem[] = [
    { name: 'Docker', label: 'Docker', count: 10, depth: 0 },
    { name: 'Vue', label: 'frontend/Vue', count: 15, depth: 1 },
    { name: 'React', label: 'frontend/React', count: 8, depth: 1 },
    { name: 'AI', label: 'AI', count: 20, depth: 0 },
  ];

  it('buildTagIndexes 正确构建全路径与叶子节点宽容匹配索引', () => {
    const { exactMap, leafMap } = TagRefPromoteService.buildTagIndexes(existingTags);
    expect(exactMap.get('docker')).toBe('Docker');
    expect(exactMap.get('frontend/vue')).toBe('frontend/Vue');
    expect(leafMap.get('vue')).toEqual(['frontend/Vue']);
  });

  it('processQueryRows 宽容识别同名引用并自动剔除已打标标签', () => {
    const rows = [
      // 文档 1: 引用了 Docker，且文档尚无 tags
      {
        doc_id: 'doc_1',
        doc_title: '容器化实战',
        doc_ial: '',
        ref_content: 'Docker',
        def_content: 'Docker 安装指南',
      },
      // 文档 2: 引用了 Vue (叶子节点)，但文档本身已有 Vue 标签，不应重复推荐
      {
        doc_id: 'doc_2',
        doc_title: '前端框架对比',
        doc_ial: 'tags="frontend/Vue"',
        ref_content: 'Vue',
        def_content: '',
      },
      // 文档 3: 引用了 React，且通过被引用目标文档标题 def_content 命中
      {
        doc_id: 'doc_3',
        doc_title: 'React 项目复盘',
        doc_ial: '',
        ref_content: '',
        def_content: 'React',
      },
      // 文档 4: 引用锚文本为无语义的“点此查看”，但被引用块显式命名为 Docker
      {
        doc_id: 'doc_4',
        doc_title: '微服务运维日志',
        doc_ial: '',
        ref_content: '点此查看',
        def_content: '某段非同名代码',
        def_name: 'Docker',
      },
      // 文档 5: 引用锚文本为“核心框架”，被引用文档设置了别名 Vue
      {
        doc_id: 'doc_5',
        doc_title: 'Web 技术选型',
        doc_ial: '',
        ref_content: '核心框架',
        def_content: '某文档',
        def_doc_alias: 'mvvm, Vue, 渐进式',
      },
    ];

    const candidates = TagRefPromoteService.processQueryRows(rows, existingTags);
    expect(candidates.length).toBe(4);

    const doc1 = candidates.find(c => c.docId === 'doc_1');
    expect(doc1).toBeDefined();
    expect(doc1?.matchedTags[0].tag).toBe('Docker');

    // doc_2 已经被过滤掉
    const doc2 = candidates.find(c => c.docId === 'doc_2');
    expect(doc2).toBeUndefined();

    const doc3 = candidates.find(c => c.docId === 'doc_3');
    expect(doc3).toBeDefined();
    expect(doc3?.matchedTags[0].tag).toBe('frontend/React');
    expect(doc3?.matchedTags[0].reason).toBe('target_doc_title');

    // 验证目标块命名命中
    const doc4 = candidates.find(c => c.docId === 'doc_4');
    expect(doc4).toBeDefined();
    expect(doc4?.matchedTags[0].tag).toBe('Docker');
    expect(doc4?.matchedTags[0].reason).toBe('target_name');

    // 验证目标文档别名命中
    const doc5 = candidates.find(c => c.docId === 'doc_5');
    expect(doc5).toBeDefined();
    expect(doc5?.matchedTags[0].tag).toBe('frontend/Vue');
    expect(doc5?.matchedTags[0].reason).toBe('target_alias');
  });

  it('scanRefsToTags 正确构造 SQL 并返回匹配候选', async () => {
    const mockRequest = async (url: string, data: any) => {
      if (url === '/api/query/sql') {
        expect(data.stmt).toContain('FROM refs r');
        expect(data.stmt).toContain("b_doc.box = 'nb_1'");
        return {
          code: 0,
          data: [
            {
              doc_id: 'doc_10',
              doc_title: 'AI 绘画指引',
              doc_ial: '',
              ref_content: 'AI',
              def_content: '',
            },
          ],
        };
      }
      return { code: 0 };
    };

    const res = await TagRefPromoteService.scanRefsToTags(
      existingTags,
      { notebookId: 'nb_1' },
      mockRequest,
    );

    expect(res.length).toBe(1);
    expect(res[0].docId).toBe('doc_10');
    expect(res[0].matchedTags[0].tag).toBe('AI');
  });

  it('promoteCandidates 批量将识别出的标签写入文档根块 IAL tags', async () => {
    const calls: Array<{ url: string; data: any }> = [];
    const mockRequest = async (url: string, data: any) => {
      calls.push({ url, data });
      if (url === '/api/attr/getBlockAttrs') {
        return { code: 0, data: { tags: 'Notes' } };
      }
      if (url === '/api/attr/setBlockAttrs') {
        return { code: 0, data: null };
      }
      return { code: 0 };
    };

    const candidates = [
      { docId: 'doc_10', tags: ['Docker', 'AI'] },
    ];

    const result = await TagRefPromoteService.promoteCandidates(candidates, mockRequest);
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(calls.length).toBe(2);
    expect(calls[1].data.attrs.tags).toBe('Notes,Docker,AI');
  });
});
