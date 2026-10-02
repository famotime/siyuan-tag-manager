import { describe, expect, it, beforeEach } from 'vitest';
import type { ITagGraphData } from '../src/services/TagCooccurrenceService';
import { TagCompanionCache } from '../src/services/TagCompanionCache';
import { TagCompanionRecommender } from '../src/services/TagCompanionRecommender';
import { TagBlockAppender } from '../src/services/TagBlockAppender';
import { TagCompanionService } from '../src/services/TagCompanionService';
import type { ITagCompanionContext } from '../src/types/companion';

describe('伴生标签智能推荐服务与算法测试', () => {
  // 模拟图谱数据
  const mockGraphData: ITagGraphData = {
    nodes: [
      { id: 'React', label: 'React', count: 10 },
      { id: '前端工程化', label: '前端工程化', count: 9 },
      { id: 'TypeScript', label: 'TypeScript', count: 8 },
      { id: '状态管理', label: '状态管理', count: 6 },
      { id: '偶然噪音', label: '偶然噪音', count: 20 },
    ],
    links: [
      { source: 'React', target: '前端工程化', weight: 8, jaccard: 0.7273 },
      { source: 'React', target: 'TypeScript', weight: 7, jaccard: 0.6364 },
      { source: 'React', target: '状态管理', weight: 5, jaccard: 0.4545 },
      // 弱连接 (weight=1, jaccard=1 / (10+20-1) = 0.0345 < 0.15 阈值)
      { source: 'React', target: '偶然噪音', weight: 1, jaccard: 0.0345 },
      { source: 'TypeScript', target: '前端工程化', weight: 6, jaccard: 0.5455 },
    ],
  };

  describe('TagCompanionCache 倒排索引缓存测试', () => {
    beforeEach(() => {
      TagCompanionCache.reset();
    });

    it('能够成功构建倒排索引并过滤低于 minSimilarity 的弱相关噪音', () => {
      TagCompanionCache.buildIndex(mockGraphData, 0.15);

      expect(TagCompanionCache.isReady()).toBe(true);
      expect(TagCompanionCache.isDirty()).toBe(false);

      const candidates = TagCompanionCache.queryAssociated('React', new Set(), 10);
      expect(candidates.length).toBe(3);

      // 应当过滤掉 "偶然噪音" (jaccard=0.0345 < 0.15)
      expect(candidates.some(c => c.label === '偶然噪音')).toBe(false);

      // 排序应当按 jaccard/weight 降序排列
      expect(candidates[0].label).toBe('前端工程化');
      expect(candidates[0].percentage).toBe(73); // 0.7273 -> 73%
      expect(candidates[1].label).toBe('TypeScript');
      expect(candidates[1].percentage).toBe(64);
      expect(candidates[2].label).toBe('状态管理');
      expect(candidates[2].percentage).toBe(45);
    });

    it('无向边对称性：作为 target 的标签也能准确查到反向伴生项', () => {
      TagCompanionCache.buildIndex(mockGraphData, 0.15);

      const tsCandidates = TagCompanionCache.queryAssociated('TypeScript', new Set(), 5);
      const labels = tsCandidates.map(c => c.label);
      expect(labels).toContain('React');
      expect(labels).toContain('前端工程化');
    });

    it('能够严格按照 excludeTags 过滤当前块已有的标签', () => {
      TagCompanionCache.buildIndex(mockGraphData, 0.15);

      // 当前块已经有 "前端工程化"
      const exclude = new Set(['React', '前端工程化']);
      const candidates = TagCompanionCache.queryAssociated('React', exclude, 5);

      expect(candidates.length).toBe(2);
      expect(candidates[0].label).toBe('TypeScript');
      expect(candidates[1].label).toBe('状态管理');
    });

    it('支持脏标记及闲时重建触发标记', () => {
      TagCompanionCache.buildIndex(mockGraphData, 0.15);
      expect(TagCompanionCache.isDirty()).toBe(false);

      TagCompanionCache.markDirty();
      expect(TagCompanionCache.isDirty()).toBe(true);
    });
  });

  describe('TagCompanionRecommender 推荐决策引擎测试', () => {
    beforeEach(() => {
      TagCompanionCache.reset();
      TagCompanionCache.buildIndex(mockGraphData, 0.15);
    });

    it('在给定块上下文且包含已有标签时，精准推荐排除后的伴生项', () => {
      const context: ITagCompanionContext = {
        targetLabel: 'React',
        blockId: 'block-1',
        existingTags: ['React', 'TypeScript'], // 块中已存在 TypeScript
      };

      const result = TagCompanionRecommender.getRecommendations(context, {
        enabled: true,
        triggerMode: 'dual',
        maxCount: 4,
        minSimilarity: 0.15,
        hoverDelayMs: 300,
      });

      // 排除 React 与 TypeScript 后，仅剩下 "前端工程化" 和 "状态管理"
      expect(result.length).toBe(2);
      expect(result[0].label).toBe('前端工程化');
      expect(result[1].label).toBe('状态管理');
    });

    it('当所有候选伴生标签已在块内存在时，返回空数组', () => {
      const context: ITagCompanionContext = {
        targetLabel: 'React',
        blockId: 'block-2',
        existingTags: ['React', '前端工程化', 'TypeScript', '状态管理'],
      };

      const result = TagCompanionRecommender.getRecommendations(context);
      expect(result).toEqual([]);
    });

    it('当推荐功能配置被禁用 (enabled: false) 时返回空数组', () => {
      const context: ITagCompanionContext = {
        targetLabel: 'React',
        blockId: 'block-3',
        existingTags: ['React'],
      };

      const result = TagCompanionRecommender.getRecommendations(context, {
        enabled: false,
        triggerMode: 'dual',
        maxCount: 4,
        minSimilarity: 0.15,
        hoverDelayMs: 300,
      });

      expect(result).toEqual([]);
    });

    it('能正确限制 maxCount 最大返回数量', () => {
      const context: ITagCompanionContext = {
        targetLabel: 'React',
        blockId: 'block-4',
        existingTags: ['React'],
      };

      const result = TagCompanionRecommender.getRecommendations(context, {
        enabled: true,
        triggerMode: 'dual',
        maxCount: 1,
        minSimilarity: 0.15,
        hoverDelayMs: 300,
      });

      expect(result.length).toBe(1);
      expect(result[0].label).toBe('前端工程化');
    });
  });

  describe('TagBlockAppender 块尾规范打标追加算法测试', () => {
    it('当块文本末尾无空格时，自动补前置空格并追加规范标签', () => {
      const originalText = '这是一个正在学习 React 核心概念的段落';
      const updated = TagBlockAppender.appendTagToMarkdown(originalText, '前端工程化');

      expect(updated).toBe('这是一个正在学习 React 核心概念的段落 #前端工程化#');
    });

    it('当块文本末尾已有空格时，不重复产生多余双空格', () => {
      const originalText = '学习笔记正文 ';
      const updated = TagBlockAppender.appendTagToMarkdown(originalText, 'TypeScript');

      expect(updated).toBe('学习笔记正文 #TypeScript#');
    });

    it('连续追加多个标签时，各标签之间具备单一空格良好排版分隔', () => {
      let text = '笔记正文';
      text = TagBlockAppender.appendTagToMarkdown(text, 'React');
      expect(text).toBe('笔记正文 #React#');

      text = TagBlockAppender.appendTagToMarkdown(text, 'TypeScript');
      expect(text).toBe('笔记正文 #React# #TypeScript#');

      text = TagBlockAppender.appendTagToMarkdown(text, '前端工程化');
      expect(text).toBe('笔记正文 #React# #TypeScript# #前端工程化#');
    });

    it('若块文本为空或纯空白时，直接返回单一规范标签格式', () => {
      expect(TagBlockAppender.appendTagToMarkdown('', 'React')).toBe('#React#');
      expect(TagBlockAppender.appendTagToMarkdown('   ', 'React')).toBe('#React#');
    });
  });

  describe('TagCompanionService 全局调度与交互测试', () => {
    it('能够初始化、更新配置与获取配置', () => {
      const dispose = TagCompanionService.init({
        enabled: true,
        triggerMode: 'dual',
        maxCount: 5,
        minSimilarity: 0.2,
      });

      const config = TagCompanionService.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.triggerMode).toBe('dual');
      expect(config.maxCount).toBe(5);
      expect(config.minSimilarity).toBe(0.2);

      TagCompanionService.updateConfig({ maxCount: 3 });
      expect(TagCompanionService.getConfig().maxCount).toBe(3);

      dispose();
    });

    it('能够触发展示并支持递进式采纳推进 activeIndex 指针', async () => {
      TagCompanionService.init();

      const candidates = [
        { label: '前端工程化', weight: 8, jaccard: 0.72, percentage: 72 },
        { label: 'TypeScript', weight: 7, jaccard: 0.63, percentage: 63 },
      ];

      const rect = { left: 100, top: 100, bottom: 120, right: 150 } as DOMRect;
      TagCompanionService.show(candidates, rect, 'mock-block-id');

      // 采纳首项
      await TagCompanionService.acceptCandidate(candidates[0], 0);

      // 再次采纳次项
      await TagCompanionService.acceptCandidate(candidates[1], 1);

      TagCompanionService.hide();
      TagCompanionService.destroy();
    });

    it('能够精准识别单井号未闭合输入态以避让原生联想菜单', () => {
      expect(TagCompanionService.isUnclosedTagText('#ai')).toBe(true);
      expect(TagCompanionService.isUnclosedTagText('正文开始 #ai')).toBe(true);
      expect(TagCompanionService.isUnclosedTagText('正文开始 #ai#')).toBe(false);
      expect(TagCompanionService.isUnclosedTagText('#react#')).toBe(false);
      expect(TagCompanionService.isUnclosedTagText('这是普通文本')).toBe(false);
      expect(TagCompanionService.isUnclosedTagText('')).toBe(false);
    });

    it('能够区分文档级目标与普通块级目标并支持文档属性打标', async () => {
      const { TagApiClient } = await import('../src/services/TagApiClient');
      let addedDocId = '';
      let addedTag = '';
      const originalAdd = TagApiClient.addTagToDocument;
      TagApiClient.addTagToDocument = async (id: string, tag: string) => {
        addedDocId = id;
        addedTag = tag;
      };

      try {
        TagCompanionService.init();

        const candidates = [
          { label: 'Claude', weight: 10, jaccard: 0.8, percentage: 80 },
        ];
        const rect = { left: 100, top: 100, bottom: 120, right: 150 } as DOMRect;

        // 设置为文档级上下文
        TagCompanionService.show(candidates, rect, {
          isDoc: true,
          id: 'doc-root-123',
          targetElement: {
            closest: () => null,
            querySelector: () => null,
          } as any,
        });

        await TagCompanionService.acceptCandidate(candidates[0], 0);

        expect(addedDocId).toBe('doc-root-123');
        expect(addedTag).toBe('Claude');
      } finally {
        TagApiClient.addTagToDocument = originalAdd;
        TagCompanionService.hide();
        TagCompanionService.destroy();
      }
    });
  });
});

