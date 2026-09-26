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
});
