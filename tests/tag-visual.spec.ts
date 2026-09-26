import { describe, expect, it } from 'vitest';
import { TagVisualService } from '../src/services/TagVisualService';
import type { ITagMetadata } from '../src/types/tag';
import { DUAL_THEME_COLOR_PRESETS } from '../src/styles/palette';

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

    expect(css).toContain('data-tag="YouTube"');
    expect(css).toContain('data-content="YouTube"');
    expect(css).not.toContain(':has-text(');
    expect(css).toContain('background-color: #FFE5E5 !important;');
    expect(css).toContain('color: #FF0000 !important;');
    expect(css).toContain('content: "🎬 "');
  });

  it('能自动生成并注入适配思源暗黑模式的选择器规则，杜绝白炽眩光', () => {
    const mockMeta: ITagMetadata[] = [
      {
        label: 'TechTag',
        backgroundColor: '#EBF3FE',
        textColor: '#1A56DB',
        updatedAt: Date.now(),
      },
    ];

    const css = TagVisualService.generateCssRules(mockMeta);

    // 验证暗黑模式选择器存在且使用合法属性选择器
    expect(css).toContain('[data-theme-mode="dark"]');
    expect(css).toContain('body.theme--dark');
    expect(css).toContain('data-tag="TechTag"');
    expect(css).not.toContain(':has-text(');
    // 验证暗色模式下背景色使用了 rgba 微透，避免纯白炽光斑
    expect(css).toContain('rgba(');
  });

  it('8 组双主题自适应色盘数据完整且亮暗对偶配置齐备', () => {
    expect(DUAL_THEME_COLOR_PRESETS.length).toBe(8);
    for (const preset of DUAL_THEME_COLOR_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.lightBg).toMatch(/^#/);
      expect(preset.lightText).toMatch(/^#/);
      expect(preset.darkBg).toBeTruthy();
      expect(preset.darkText).toMatch(/^#/);
    }
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
