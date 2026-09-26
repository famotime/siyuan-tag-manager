import { describe, expect, it } from 'vitest';
import { TagVisualService } from '../src/services/TagVisualService';
import type { ITagMetadata } from '../src/types/tag';

describe('TagVisualService 标签视觉与动态样式注入测试', () => {
  it('能够根据标签元数据正确生成背景色和字体色规则', () => {
    const mockMeta: ITagMetadata[] = [
      {
        label: 'YouTube',
        backgroundColor: '#FFE5E5',
        textColor: '#FF0000',
        icon: '🎬',
        updatedAt: Date.now(),
      },
    ];

    const css = TagVisualService.generateCssRules(mockMeta);

    expect(css).toContain('data-content="YouTube"');
    expect(css).toContain('background-color: #FFE5E5 !important;');
    expect(css).toContain('color: #FF0000 !important;');
    expect(css).toContain('content: "🎬 "');
  });

  it('空标签或无样式配置项不应产生多余规则', () => {
    const mockMeta: ITagMetadata[] = [
      {
        label: 'EmptyTag',
        updatedAt: Date.now(),
      },
    ];

    const css = TagVisualService.generateCssRules(mockMeta);
    expect(css.trim()).toBe('');
  });
});
