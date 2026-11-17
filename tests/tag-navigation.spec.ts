// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagNavigationService } from '../src/services/TagNavigationService';

describe('TagNavigationService 块跳转与屏幕正中居中定位测试', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  });

  it('jumpToBlock 空参数时不触发操作，安全容错', () => {
    expect(() => TagNavigationService.jumpToBlock('', '')).not.toThrow();
  });

  it('openBlockTab 在存在 siyuan.openTab 时，以 targetBlockId 和规范 action 打开页签', () => {
    const mockOpenTab = vi.fn();
    (globalThis as any).window = {
      siyuan: {
        appId: 'test-app',
        openTab: mockOpenTab,
      },
    };

    TagNavigationService.openBlockTab('doc-root-1', 'block-paragraph-1');

    expect(mockOpenTab).toHaveBeenCalledTimes(1);
    expect(mockOpenTab).toHaveBeenCalledWith({
      app: 'test-app',
      doc: {
        id: 'block-paragraph-1',
        action: ['cb-get-focus', 'cb-get-hl', 'cb-get-all', 'cb-get-context'],
      },
    });
  });

  it('openBlockTab 在缺少 openTab 时降级使用 window.open siyuan:// 协议', () => {
    const mockWindowOpen = vi.fn();
    (globalThis as any).window = {
      open: mockWindowOpen,
    };

    TagNavigationService.openBlockTab('doc-root-2', 'block-paragraph-2');

    expect(mockWindowOpen).toHaveBeenCalledWith('siyuan://blocks/block-paragraph-2');
  });

  it('findTargetElement 优先匹配正文 .protyle-wysiwyg 内的节点，并排除侧栏宿主内节点', () => {
    const fakeEl = {
      closest: (sel: string) => (sel.includes('siyuan-tag-manager-host') ? {} : null),
      offsetParent: {},
      clientHeight: 40,
    };

    const realEl = {
      closest: (sel: string) => {
        if (sel.includes('siyuan-tag-manager-host')) return null;
        if (sel.includes('.protyle-wysiwyg')) return {};
        return null;
      },
      offsetParent: {},
      clientHeight: 50,
    };

    (globalThis as any).document = {
      querySelectorAll: (sel: string) => {
        if (sel.includes('test-node-123')) {
          return [fakeEl, realEl];
        }
        return [];
      },
    };

    const found = TagNavigationService.findTargetElement('test-node-123');
    expect(found).toBe(realEl);
  });

  it('scrollElementToCenter 精确计算目标中心与视口中心的偏移并调用 scrollBy 进行居中滚动', () => {
    const scrollBySpy = vi.fn();

    const mockContainer = {
      clientHeight: 600,
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 700,
        height: 600,
      }),
      scrollBy: scrollBySpy,
    };

    const mockTarget = {
      clientHeight: 40,
      closest: (sel: string) => (sel.includes('.protyle-content') ? mockContainer : null),
      parentElement: null,
      getBoundingClientRect: () => ({
        top: 620,
        bottom: 660,
        height: 40,
      }),
    };

    const res = TagNavigationService.scrollElementToCenter(mockTarget as any, 'smooth');
    expect(res).toBe(true);
    expect(scrollBySpy).toHaveBeenCalledTimes(1);

    // 容器中心: 100 + 300 = 400
    // 目标中心: 620 + 20 = 640
    // 差值 diff = 640 - 400 = 240
    expect(scrollBySpy).toHaveBeenCalledWith({
      top: 240,
      behavior: 'smooth',
    });
  });

  it('highlightElement 添加高亮类并在指定时间后自动移除', () => {
    const classListSet = new Set<string>();
    const mockEl = {
      classList: {
        add: (cls: string) => classListSet.add(cls),
        remove: (cls: string) => classListSet.delete(cls),
        contains: (cls: string) => classListSet.has(cls),
      },
    };

    TagNavigationService.highlightElement(mockEl as any, 1000);

    expect(mockEl.classList.contains('protyle-wysiwyg--hl')).toBe(true);
    expect(mockEl.classList.contains('tm-block-jump-highlight')).toBe(true);

    vi.advanceTimersByTime(1050);

    expect(mockEl.classList.contains('protyle-wysiwyg--hl')).toBe(false);
    expect(mockEl.classList.contains('tm-block-jump-highlight')).toBe(false);
  });

  it('连续快速跳转时旧轮询链被作废，不再轮询旧目标', () => {
    // node 环境下补一个最小 document，centerBlockInView 才会进入轮询调度
    const originalDocument = (globalThis as any).document;
    (globalThis as any).document = {};
    const findSpy = vi.spyOn(TagNavigationService, 'findTargetElement').mockReturnValue(null);
    const scrollSpy = vi.spyOn(TagNavigationService, 'scrollElementToCenter').mockReturnValue(true);
    const highlightSpy = vi.spyOn(TagNavigationService, 'highlightElement').mockImplementation(() => {});

    try {
      // 第一次跳转：元素未出现，进入轮询
      TagNavigationService.centerBlockInView('block-a', { maxRetries: 10, interval: 80 });
      vi.advanceTimersByTime(50);

      // 第二次跳转启动，作废旧链
      TagNavigationService.centerBlockInView('block-b', { maxRetries: 10, interval: 80 });
      vi.advanceTimersByTime(600);

      // 旧目标仅被首触查询一次，之后的重试时间点全部作废
      const oldCalls = findSpy.mock.calls.filter(call => call[0] === 'block-a');
      expect(oldCalls.length).toBe(1);
      // 新目标持续轮询
      expect(findSpy.mock.calls.filter(call => call[0] === 'block-b').length).toBeGreaterThan(1);
      expect(scrollSpy).not.toHaveBeenCalled();

      // 元素出现后，仅新链完成定位与高亮
      findSpy.mockReturnValue({ clientHeight: 40, offsetHeight: 40 } as any);
      vi.advanceTimersByTime(200);
      expect(scrollSpy).toHaveBeenCalledTimes(1);
      expect(highlightSpy).toHaveBeenCalledTimes(1);
    } finally {
      findSpy.mockRestore();
      scrollSpy.mockRestore();
      highlightSpy.mockRestore();
      (globalThis as any).document = originalDocument;
    }
  });
});
