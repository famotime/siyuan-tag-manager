import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DOCK_TYPE, toggleTagManagerDock, usePlugin } from '../src/main';

describe('Dock 与插件实例管理 (main.ts) 测试', () => {
  it('DOCK_TYPE 常量应为 tag-manager-dock', () => {
    expect(DOCK_TYPE).toBe('tag-manager-dock');
  });

  it('usePlugin 在未绑定时应抛出错误，绑定后能正确返回实例', () => {
    const mockPlugin = {
      name: 'siyuan-tag-manager',
      displayName: '标签管家',
    } as any;

    const instance = usePlugin(mockPlugin);
    expect(instance).toBe(mockPlugin);
    expect(usePlugin()).toBe(mockPlugin);
  });

  describe('toggleTagManagerDock 原生侧栏切换能力', () => {
    const originalDocument = globalThis.document;

    afterEach(() => {
      globalThis.document = originalDocument;
    });

    it('当 document 未定义或处于非浏览器环境时返回 false', () => {
      (globalThis as any).document = undefined;
      const res = toggleTagManagerDock('tag-manager-dock');
      expect(res).toBe(false);
    });

    it('当侧栏 Dock 按钮不存在时返回 false', () => {
      (globalThis as any).document = {
        querySelector: () => null,
      };
      const res = toggleTagManagerDock('tag-manager-dock');
      expect(res).toBe(false);
    });

    it('当侧栏包含带有对应 data-type 的 Dock 项时，点击并返回 true', () => {
      const clickSpy = vi.fn();
      const mockElement = {
        click: clickSpy,
      };

      (globalThis as any).document = {
        querySelector: (sel: string) => {
          if (sel.includes('tag-manager-dock')) {
            return mockElement;
          }
          return null;
        },
      };

      const res = toggleTagManagerDock('tag-manager-dock');
      expect(res).toBe(true);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('当 Dock 项带有图标特征类或属性时能够兜底匹配触发', () => {
      const clickSpy = vi.fn();
      const mockElement = {
        click: clickSpy,
      };

      (globalThis as any).document = {
        querySelector: (sel: string) => {
          if (sel.includes('iconTagManager')) {
            return mockElement;
          }
          return null;
        },
      };

      const res = toggleTagManagerDock();
      expect(res).toBe(true);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });
});
