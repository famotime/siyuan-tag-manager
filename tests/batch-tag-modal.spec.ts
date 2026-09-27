import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { mockCreateApp, mockAppInstance } = vi.hoisted(() => {
  const mockAppInstance = {
    directive: vi.fn().mockReturnThis(),
    mount: vi.fn(),
    unmount: vi.fn(),
  };
  const mockCreateApp = vi.fn().mockImplementation(() => mockAppInstance);
  return { mockCreateApp, mockAppInstance };
});

vi.mock('vue', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    createApp: mockCreateApp,
  };
});

import { batchTagBridge } from '../src/utils/batchTagBridge';
import { openStandaloneBatchModal, closeStandaloneBatchModal } from '../src/utils/batchTagModalManager';
import { TagApiClient } from '../src/services/TagApiClient';

describe('批量打标桥接与独立全局模态窗测试', () => {
  beforeEach(() => {
    batchTagBridge.clear();
  });

  afterEach(() => {
    batchTagBridge.clear();
    vi.restoreAllMocks();
  });

  describe('batchTagBridge 事件分发桥接', () => {
    it('初始状态下 hasListeners 应为 false，trigger 返回 false', () => {
      expect(batchTagBridge.hasListeners()).toBe(false);
      const res = batchTagBridge.trigger([{ id: 'doc-1', title: '文档1' }]);
      expect(res).toBe(false);
    });

    it('注册监听器后 hasListeners 为 true，trigger 返回 true 并分发数据', () => {
      const listenerSpy = vi.fn();
      const unsub = batchTagBridge.on(listenerSpy);

      expect(batchTagBridge.hasListeners()).toBe(true);

      const docs = [
        { id: '20260927-1', title: '测试文档一' },
        { id: '20260927-2', title: '测试文档二' },
      ];
      const res = batchTagBridge.trigger(docs);

      expect(res).toBe(true);
      expect(listenerSpy).toHaveBeenCalledTimes(1);
      expect(listenerSpy).toHaveBeenCalledWith(docs);

      unsub();
      expect(batchTagBridge.hasListeners()).toBe(false);
      expect(batchTagBridge.trigger(docs)).toBe(false);
    });

    it('支持多个监听器同时接收事件，单个监听器异常不中断其他监听器', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('boom');
      });
      const successListener = vi.fn();

      const unsub1 = batchTagBridge.on(errorListener);
      const unsub2 = batchTagBridge.on(successListener);

      const res = batchTagBridge.trigger([{ id: 'doc-err', title: '异常测试' }]);
      expect(res).toBe(true);
      expect(errorListener).toHaveBeenCalled();
      expect(successListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      unsub1();
      unsub2();
      consoleErrorSpy.mockRestore();
    });

    it('clear 方法应清空所有已注册的监听器', () => {
      batchTagBridge.on(() => {});
      batchTagBridge.on(() => {});
      expect(batchTagBridge.hasListeners()).toBe(true);

      batchTagBridge.clear();
      expect(batchTagBridge.hasListeners()).toBe(false);
    });
  });

  describe('batchTagModalManager 独立全局模态窗管理', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    let mockElements: any[] = [];
    let windowListeners: Record<string, ((e: any) => void)[]> = {};

    beforeEach(() => {
      mockElements = [];
      windowListeners = {};
      mockCreateApp.mockClear();
      mockAppInstance.mount.mockClear();
      mockAppInstance.unmount.mockClear();

      const mockBody = {
        appendChild: (el: any) => {
          mockElements.push(el);
          return el;
        },
      };

      (globalThis as any).document = {
        createElement: (tag: string) => {
          const el: any = {
            tagName: tag.toUpperCase(),
            id: '',
            className: '',
            remove: () => {
              mockElements = mockElements.filter(item => item !== el);
            },
          };
          return el;
        },
        getElementById: (id: string) => {
          return mockElements.find(item => item.id === id) || null;
        },
        querySelectorAll: (sel: string) => {
          if (sel === '#siyuan-tag-manager-batch-modal-root') {
            return mockElements.filter(item => item.id === 'siyuan-tag-manager-batch-modal-root');
          }
          return [];
        },
        body: mockBody,
      };

      (globalThis as any).window = {
        addEventListener: (event: string, fn: any) => {
          if (!windowListeners[event]) windowListeners[event] = [];
          windowListeners[event].push(fn);
        },
        removeEventListener: (event: string, fn: any) => {
          if (windowListeners[event]) {
            windowListeners[event] = windowListeners[event].filter(l => l !== fn);
          }
        },
        dispatchEvent: (event: any) => {
          const list = windowListeners[event.type] || [];
          for (const fn of list) {
            fn(event);
          }
        },
      };

      vi.spyOn(TagApiClient, 'fetchAllTags').mockResolvedValue([]);

      closeStandaloneBatchModal();
    });

    afterEach(() => {
      closeStandaloneBatchModal();
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    });

    it('当处于非浏览器环境时安全退出', async () => {
      (globalThis as any).document = undefined;
      await openStandaloneBatchModal([{ id: 'doc-node', title: 'Node环境' }]);
      expect(mockCreateApp).not.toHaveBeenCalled();
    });

    it('openStandaloneBatchModal 能在 DOM 中创建独立挂载容器并挂载组件', async () => {
      vi.spyOn(TagApiClient, 'fetchAllTags').mockResolvedValue([]);

      const docs = [{ id: 'doc-test-1', title: '待打标文档' }];
      await openStandaloneBatchModal(docs, {
        allTags: [{ label: '测试标签', count: 1 }],
      });

      const container = (globalThis as any).document.getElementById('siyuan-tag-manager-batch-modal-root');
      expect(container).not.toBeNull();
      expect(container?.className).toContain('siyuan-tag-manager-standalone-root');
      expect(mockCreateApp).toHaveBeenCalledTimes(1);
      expect(mockAppInstance.mount).toHaveBeenCalledWith(container);
    });

    it('closeStandaloneBatchModal 能正常卸载并清理 DOM 容器', async () => {
      await openStandaloneBatchModal([{ id: 'doc-test-2', title: '待清理文档' }]);
      expect((globalThis as any).document.getElementById('siyuan-tag-manager-batch-modal-root')).not.toBeNull();

      closeStandaloneBatchModal();
      expect((globalThis as any).document.getElementById('siyuan-tag-manager-batch-modal-root')).toBeNull();
      expect(mockAppInstance.unmount).toHaveBeenCalled();
    });

    it('按 Escape 键能够触发独立模态窗关闭', async () => {
      await openStandaloneBatchModal([{ id: 'doc-esc', title: 'ESC文档' }]);
      expect((globalThis as any).document.getElementById('siyuan-tag-manager-batch-modal-root')).not.toBeNull();

      // 触发 Escape keydown 事件
      (globalThis as any).window.dispatchEvent({ type: 'keydown', key: 'Escape' });

      expect((globalThis as any).document.getElementById('siyuan-tag-manager-batch-modal-root')).toBeNull();
      expect(mockAppInstance.unmount).toHaveBeenCalled();
    });

    it('重复调用 openStandaloneBatchModal 时会自动先清理旧弹窗，保证单例', async () => {
      await openStandaloneBatchModal([{ id: 'doc-first', title: '第一批' }]);
      await openStandaloneBatchModal([{ id: 'doc-second', title: '第二批' }]);

      const allRoots = (globalThis as any).document.querySelectorAll('#siyuan-tag-manager-batch-modal-root');
      expect(allRoots.length).toBe(1);
    });
  });
});
