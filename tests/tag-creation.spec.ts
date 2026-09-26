import { describe, it, expect, vi } from 'vitest';
import { TagCreationService } from '../src/services/TagCreationService';
import type { ITagItem } from '../src/types/tag';

describe('TagCreationService 标签快捷创建服务测试', () => {
  describe('cleanTag 标签文本清洗', () => {
    it('去除首尾空白字符', () => {
      expect(TagCreationService.cleanTag('  vue3  ')).toBe('vue3');
    });

    it('去除首尾单个或多个 # 符号', () => {
      expect(TagCreationService.cleanTag('#TypeScript#')).toBe('TypeScript');
      expect(TagCreationService.cleanTag('##Vue/Router##')).toBe('Vue/Router');
      expect(TagCreationService.cleanTag('#AI')).toBe('AI');
      expect(TagCreationService.cleanTag('Prompt#')).toBe('Prompt');
    });

    it('规范化多级斜杠层级', () => {
      expect(TagCreationService.cleanTag('/Frontend//React///State/')).toBe('Frontend/React/State');
    });

    it('处理空字符串或仅包含 # 的输入', () => {
      expect(TagCreationService.cleanTag('')).toBe('');
      expect(TagCreationService.cleanTag('   ')).toBe('');
      expect(TagCreationService.cleanTag('###')).toBe('');
    });
  });

  describe('validateTag 标签命名合法性校验', () => {
    it('正确验证合法标签', () => {
      const res = TagCreationService.validateTag('#frontend/vue3#');
      expect(res.valid).toBe(true);
      expect(res.cleanLabel).toBe('frontend/vue3');
      expect(res.error).toBeUndefined();
    });

    it('拦截空标签输入', () => {
      const res = TagCreationService.validateTag('   ');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('不能为空');
    });

    it('拦截包含空格的非法标签', () => {
      const res = TagCreationService.validateTag('vue 3 component');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('不能包含字符 " "');
    });

    it('拦截包含特殊标点符号的非法标签', () => {
      const res = TagCreationService.validateTag('tag"name');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('不能包含字符');
    });
  });

  describe('isTagExisting 全库查重', () => {
    const mockTags: ITagItem[] = [
      { name: 'Vue', label: 'Vue', count: 10, depth: 0 },
      { name: 'React', label: 'Frontend/React', count: 5, depth: 1 },
      { name: 'TypeScript', label: 'TypeScript', count: 8, depth: 0 },
    ];

    it('识别完全匹配的标签（大小写不敏感）', () => {
      expect(TagCreationService.isTagExisting('Vue', mockTags)).toBe(true);
      expect(TagCreationService.isTagExisting('vue', mockTags)).toBe(true);
      expect(TagCreationService.isTagExisting('#Frontend/React#', mockTags)).toBe(true);
    });

    it('未匹配到的新标签返回 false', () => {
      expect(TagCreationService.isTagExisting('Angular', mockTags)).toBe(false);
      expect(TagCreationService.isTagExisting('Frontend/Vue', mockTags)).toBe(false);
    });
  });

  describe('createAndApplyTag 上下文注入执行', () => {
    it('当有焦点块 blockId 时，追加到块正文末尾', async () => {
      const mockRequest = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/block/getBlockKramdown') {
          return { code: 0, data: { kramdown: '这是一段测试笔记内容' } };
        }
        if (url === '/api/block/updateBlock') {
          return { code: 0, data: null };
        }
        return { code: 0, data: {} };
      });

      const res = await TagCreationService.createAndApplyTag(
        '#DeepLearning#',
        { blockId: 'block_101', docId: 'doc_202', docTitle: 'AI研究' },
        mockRequest,
      );

      expect(res.success).toBe(true);
      expect(res.label).toBe('DeepLearning');
      expect(res.targetType).toBe('block');
      expect(mockRequest).toHaveBeenCalledWith('/api/block/getBlockKramdown', { id: 'block_101' });
      expect(mockRequest).toHaveBeenCalledWith('/api/block/updateBlock', {
        id: 'block_101',
        dataType: 'markdown',
        data: '这是一段测试笔记内容 #DeepLearning#',
      });
    });

    it('当无 blockId 但有 docId 时，向文档末尾追加块并打标', async () => {
      const mockRequest = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/block/appendBlock') {
          return { code: 0, data: [{ id: 'new_block_1' }] };
        }
        if (url === '/api/attr/getBlockAttrs') {
          return { code: 0, data: { tags: 'oldTag' } };
        }
        if (url === '/api/attr/setBlockAttrs') {
          return { code: 0, data: null };
        }
        return { code: 0, data: {} };
      });

      const res = await TagCreationService.createAndApplyTag(
        '#Vite#',
        { docId: 'doc_202', docTitle: '前端工程化' },
        mockRequest,
      );

      expect(res.success).toBe(true);
      expect(res.label).toBe('Vite');
      expect(res.targetType).toBe('doc');
      expect(mockRequest).toHaveBeenCalledWith('/api/block/appendBlock', {
        parentID: 'doc_202',
        dataType: 'markdown',
        data: '#Vite#',
      });
      expect(mockRequest).toHaveBeenCalledWith('/api/attr/setBlockAttrs', {
        id: 'doc_202',
        attrs: { tags: 'oldTag,Vite' },
      });
    });

    it('既无 blockId 也无 docId 时，返回 need_select_doc 并提示用户', async () => {
      const res = await TagCreationService.createAndApplyTag('#NewConcept#', {});

      expect(res.success).toBe(false);
      expect(res.targetType).toBe('need_select_doc');
      expect(res.label).toBe('NewConcept');
      expect(res.error).toContain('未检测到当前打开的文档');
    });

    it('非法标签名称直接拦截，不发出网络请求', async () => {
      const mockRequest = vi.fn();
      const res = await TagCreationService.createAndApplyTag('invalid tag with spaces', { docId: 'doc_1' }, mockRequest);

      expect(res.success).toBe(false);
      expect(mockRequest).not.toHaveBeenCalled();
      expect(res.error).toBeDefined();
    });
  });
});
