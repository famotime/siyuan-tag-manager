import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DOCK_TYPE, toggleTagManagerDock, isTagManagerDockActive, openTagManagerDock, usePlugin } from '../src/main';

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

  describe('isTagManagerDockActive 状态检测能力', () => {
    const originalDocument = globalThis.document;

    afterEach(() => {
      globalThis.document = originalDocument;
    });

    it('在非浏览器环境或未找到按钮时返回 false', () => {
      (globalThis as any).document = undefined;
      expect(isTagManagerDockActive()).toBe(false);

      (globalThis as any).document = { querySelector: () => null };
      expect(isTagManagerDockActive()).toBe(false);
    });

    it('当 Dock 按钮含有 dock__item--active 类时返回 true，否则返回 false', () => {
      const activeEl = {
        classList: {
          contains: (cls: string) => cls === 'dock__item--active',
        },
      };
      (globalThis as any).document = {
        querySelector: () => activeEl,
      };
      expect(isTagManagerDockActive()).toBe(true);

      const inactiveEl = {
        classList: {
          contains: () => false,
        },
      };
      (globalThis as any).document = {
        querySelector: () => inactiveEl,
      };
      expect(isTagManagerDockActive()).toBe(false);
    });
  });

  describe('openTagManagerDock 防缩回安全展开能力', () => {
    const originalDocument = globalThis.document;

    afterEach(() => {
      globalThis.document = originalDocument;
    });

    it('在非浏览器环境或未找到按钮时返回 false', () => {
      (globalThis as any).document = undefined;
      expect(openTagManagerDock()).toBe(false);
    });

    it('当 Dock 已经处于 active 状态时，绝不触发 click 避免缩回，且返回 true', () => {
      const clickSpy = vi.fn();
      const activeEl = {
        click: clickSpy,
        classList: {
          contains: (cls: string) => cls === 'dock__item--active',
        },
      };
      (globalThis as any).document = {
        querySelector: () => activeEl,
      };

      const res = openTagManagerDock();
      expect(res).toBe(true);
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('当 Dock 未激活时，触发 click 展开并返回 true', () => {
      const clickSpy = vi.fn();
      const inactiveEl = {
        click: clickSpy,
        classList: {
          contains: () => false,
        },
      };
      (globalThis as any).document = {
        querySelector: () => inactiveEl,
      };

      const res = openTagManagerDock();
      expect(res).toBe(true);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });
});

