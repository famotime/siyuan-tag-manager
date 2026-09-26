import { describe, expect, it } from 'vitest';
import { LINE_ICONS } from '../src/components/SiyuanTheme/icons';
import { vTooltip } from '../src/utils/tooltip';

describe('UI/UX 线性图标与即时 Tooltip 体系测试', () => {
  it('标准显式线框图标库包含核心 20+ 个业务图标定义', () => {
    const requiredIcons = [
      'tag',
      'layers-plus',
      'refresh-cw',
      'close',
      'folder-tree',
      'filter-funnel',
      'git-fork-nodes',
      'shield-check',
      'search',
      'search-plus',
      'palette',
      'file-up',
      'git-merge',
      'bookmark-star',
      'save',
      'link',
      'trending-up',
      'trending-down',
      'activity',
      'alert-triangle',
      'info',
      'check-circle',
      'more-horizontal',
      'chevron-right',
      'chevron-down',
      'trash',
      'external-link',
    ];

    for (const name of requiredIcons) {
      expect(LINE_ICONS[name], `图标 ${name} 必须存在`).toBeDefined();
      expect(LINE_ICONS[name].paths.length).toBeGreaterThan(0);
    }
  });

  it('vTooltip 指令结构符合 Vue 3 自定义指令规范', () => {
    expect(vTooltip.mounted).toBeTypeOf('function');
    expect(vTooltip.updated).toBeTypeOf('function');
    expect(vTooltip.unmounted).toBeTypeOf('function');
  });
});
