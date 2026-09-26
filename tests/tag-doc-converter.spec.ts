import { describe, expect, it } from 'vitest';
import { TagDocConverterService } from '../src/services/TagDocConverterService';
import type { ITagMatchedBlock } from '../src/types/tag';

describe('TagDocConverterService 标签转实体文档服务测试', () => {
  it('正确生成包含动态 SQL 嵌入块与静态引用列表的 Markdown 内容', () => {
    const mockBlocks: ITagMatchedBlock[] = [
      {
        id: '20260926-b1',
        rootId: '20260926-doc1',
        docTitle: 'YouTube视频解析',
        content: '高效使用 Cursor 的实用技巧 #YouTube#',
        markdown: '高效使用 Cursor 的实用技巧 #YouTube#',
        type: 'p',
        updated: '20260926080000',
        matchedTags: ['YouTube'],
      },
    ];

    const md = TagDocConverterService.generateDocMarkdown('YouTube', mockBlocks);

    // 检查标题与说明
    expect(md).toContain('# 🏷️ 主题聚合：YouTube');
    expect(md).toContain('知识资产聚合说明');
    // 检查动态 SQL 嵌入块
    expect(md).toContain("{{SELECT * FROM blocks WHERE id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = 'YouTube') ORDER BY updated DESC}}");
    // 检查静态历史快照
    expect(md).toContain('《YouTube视频解析》');
    expect(md).toContain('siyuan://blocks/20260926-b1');
  });

  it('没有静态引用时安全输出兜底占位说明', () => {
    const md = TagDocConverterService.generateDocMarkdown('EmptyTag', []);
    expect(md).toContain('（暂无静态引用历史记录）');
  });
});
