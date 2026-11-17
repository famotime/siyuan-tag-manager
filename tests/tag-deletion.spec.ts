import { describe, expect, it, vi } from 'vitest';
import { TagDeletionService } from '../src/services/TagDeletionService';
import type { ITagDeleteConfig } from '../src/types/tag';

describe('TagDeletionService 标签删除与格式化清洗测试', () => {
  describe('formatMarkdownForTagDeletion 文本替换', () => {
    it('strip_hash 模式下正确剥离前后 "#"，保留标签文字', () => {
      const md = '这是一条包含 #待办# 的正文段落。';
      const config: ITagDeleteConfig = { mode: 'strip_hash', replaceWith: '' };
      const res = TagDeletionService.formatMarkdownForTagDeletion(md, '待办', config);
      expect(res).toBe('这是一条包含 待办 的正文段落。');
    });

    it('strip_hash 模式下同一块内多处标签均被剥离', () => {
      const md = '前置 #Vue# 与后置 #Vue# 均应保留文字。';
      const config: ITagDeleteConfig = { mode: 'strip_hash', replaceWith: '' };
      const res = TagDeletionService.formatMarkdownForTagDeletion(md, 'Vue', config);
      expect(res).toBe('前置 Vue 与后置 Vue 均应保留文字。');
    });

    it('精确匹配目标标签，不误伤子层级标签或前缀相同标签', () => {
      const md = '包含根标签 #tech# 以及子标签 #tech/vue# 和相似词 #technology#。';
      const config: ITagDeleteConfig = { mode: 'strip_hash', replaceWith: '' };
      const res = TagDeletionService.formatMarkdownForTagDeletion(md, 'tech', config);
      expect(res).toBe('包含根标签 tech 以及子标签 #tech/vue# 和相似词 #technology#。');
    });

    it('replace_hash 模式下将 "#" 替换为用户指定的自定义字符', () => {
      const md = '重点关注 #紧急# 任务进度。';
      const config: ITagDeleteConfig = { mode: 'replace_hash', replaceWith: '*' };
      const res = TagDeletionService.formatMarkdownForTagDeletion(md, '紧急', config);
      expect(res).toBe('重点关注 *紧急* 任务进度。');
    });

    it('replace_hash 模式下若替换内容为空，行为等同于仅剥离 "#"', () => {
      const md = '重点关注 #紧急# 任务。';
      const config: ITagDeleteConfig = { mode: 'replace_hash', replaceWith: '' };
      const res = TagDeletionService.formatMarkdownForTagDeletion(md, '紧急', config);
      expect(res).toBe('重点关注 紧急 任务。');
    });

    it('remove_all 模式下彻底删除标签标记与文字', () => {
      const md = '任务说明 #临时标记# 请及时归档。';
      const config: ITagDeleteConfig = { mode: 'remove_all', replaceWith: '' };
      const res = TagDeletionService.formatMarkdownForTagDeletion(md, '临时标记', config);
      expect(res).toBe('任务说明 请及时归档。');
    });

    it('边界情况：空文本或空标签直接返回原文', () => {
      const config: ITagDeleteConfig = { mode: 'strip_hash', replaceWith: '' };
      expect(TagDeletionService.formatMarkdownForTagDeletion('', 'test', config)).toBe('');
      expect(TagDeletionService.formatMarkdownForTagDeletion('hello', '', config)).toBe('hello');
    });
  });

  describe('cleanDocTagsAttr 文档级标签属性清洗', () => {
    it('正确移除单个文档标签', () => {
      const tags = 'work,study,life';
      expect(TagDeletionService.cleanDocTagsAttr(tags, 'study')).toBe('work,life');
    });

    it('移除首个或末尾标签', () => {
      expect(TagDeletionService.cleanDocTagsAttr('work,study', 'work')).toBe('study');
      expect(TagDeletionService.cleanDocTagsAttr('work,study', 'study')).toBe('work');
    });

    it('移除后无剩余标签返回空字符串', () => {
      expect(TagDeletionService.cleanDocTagsAttr('work', 'work')).toBe('');
    });

    it('包含多余空格时正常清理规范化', () => {
      expect(TagDeletionService.cleanDocTagsAttr(' work ,  study ', 'work')).toBe('study');
    });
  });

  describe('getDeleteModeDescription 模式描述文案', () => {
    it('正确生成对应的模式文案', () => {
      expect(TagDeletionService.getDeleteModeDescription({ mode: 'strip_hash', replaceWith: '' }))
        .toBe('保留文字并剥离#');
      expect(TagDeletionService.getDeleteModeDescription({ mode: 'remove_all', replaceWith: '' }))
        .toBe('彻底删除#及标签文字');
      expect(TagDeletionService.getDeleteModeDescription({ mode: 'replace_hash', replaceWith: '*' }))
        .toBe('用"*"替代#');
    });
  });

  describe('executeDeleteTag 执行协调与容错', () => {
    it('remove_all 模式下直接调用 client.removeTag', async () => {
      const mockRemoveTag = vi.fn().mockResolvedValue(undefined);
      const mockClient = {
        removeTag: mockRemoveTag,
      } as any;

      const res = await TagDeletionService.executeDeleteTag(
        '废弃标签',
        { mode: 'remove_all', replaceWith: '' },
        mockClient,
      );

      expect(mockRemoveTag).toHaveBeenCalledWith('废弃标签');
      expect(res.success).toBe(true);
    });

    it('strip_hash 模式下分别更新正文段落块与文档属性', async () => {
      const mockSqlQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('s.type LIKE \'%tag%\'')) {
          return Promise.resolve([
            { id: 'b_1', type: 'p', markdown: '这是 #待办# 内容' },
          ]);
        }
        if (sql.includes('type = \'d\'')) {
          return Promise.resolve([
            { id: 'doc_1', ial: 'tags="待办,重要"' },
          ]);
        }
        return Promise.resolve([]);
      });

      const mockUpdateBlock = vi.fn().mockResolvedValue(undefined);
      const mockSetBlockAttrs = vi.fn().mockResolvedValue(undefined);

      const mockClient = {
        sqlQuery: mockSqlQuery,
        updateBlock: mockUpdateBlock,
        setBlockAttrs: mockSetBlockAttrs,
      } as any;

      const res = await TagDeletionService.executeDeleteTag(
        '待办',
        { mode: 'strip_hash', replaceWith: '' },
        mockClient,
      );

      expect(res.success).toBe(true);
      expect(res.affectedBlocks).toBe(2);
      expect(mockUpdateBlock).toHaveBeenCalledWith('b_1', '这是 待办 内容');
      expect(mockSetBlockAttrs).toHaveBeenCalledWith('doc_1', { tags: '重要' });
    });

    it('批量更新时个别块失败不阻断后续块，并汇总记录错误', async () => {
      const mockSqlQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('s.type LIKE \'%tag%\'')) {
          return Promise.resolve([
            { id: 'b_fail', type: 'p', markdown: '异常 #测试#' },
            { id: 'b_ok', type: 'p', markdown: '正常 #测试#' },
          ]);
        }
        return Promise.resolve([]);
      });

      const mockUpdateBlock = vi.fn().mockImplementation((id: string) => {
        if (id === 'b_fail') {
          return Promise.reject(new Error('网络超时'));
        }
        return Promise.resolve();
      });

      const mockClient = {
        sqlQuery: mockSqlQuery,
        updateBlock: mockUpdateBlock,
        setBlockAttrs: vi.fn(),
      } as any;

      const res = await TagDeletionService.executeDeleteTag(
        '测试',
        { mode: 'strip_hash', replaceWith: '' },
        mockClient,
      );

      expect(res.success).toBe(false);
      expect(res.affectedBlocks).toBe(1);
      expect(res.errors.length).toBe(1);
      expect(res.errors[0]).toContain('b_fail');
    });
  });
});
