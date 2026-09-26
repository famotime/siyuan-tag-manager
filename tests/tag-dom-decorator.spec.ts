import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TagDomDecorator } from '../src/services/TagDomDecorator';

describe('TagDomDecorator 正文标签 DOM 属性装饰器测试', () => {
  describe('extractTagLabel 标签文本清洗与提取', () => {
    it('正确剥离前后 # 号并去除首尾空格', () => {
      expect(TagDomDecorator.extractTagLabel('#YouTube#')).toBe('YouTube');
      expect(TagDomDecorator.extractTagLabel('#Python')).toBe('Python');
      expect(TagDomDecorator.extractTagLabel('React#')).toBe('React');
      expect(TagDomDecorator.extractTagLabel('  #Vue 3#  ')).toBe('Vue 3');
    });

    it('正确支持多层级嵌套斜杠标签', () => {
      expect(TagDomDecorator.extractTagLabel('#tech/frontend/vue#')).toBe('tech/frontend/vue');
      expect(TagDomDecorator.extractTagLabel('#life/finance/stock#')).toBe('life/finance/stock');
    });

    it('正确过滤零宽空格及隐藏格式字符', () => {
      expect(TagDomDecorator.extractTagLabel('\u200B#Prompt#\u200C')).toBe('Prompt');
      expect(TagDomDecorator.extractTagLabel('\uFEFF#Rust#\u200D')).toBe('Rust');
    });

    it('面对空串、纯 # 号或无效输入时返回空字符串', () => {
      expect(TagDomDecorator.extractTagLabel('')).toBe('');
      expect(TagDomDecorator.extractTagLabel('###')).toBe('');
      expect(TagDomDecorator.extractTagLabel('   ')).toBe('');
      expect(TagDomDecorator.extractTagLabel(null)).toBe('');
      expect(TagDomDecorator.extractTagLabel(undefined)).toBe('');
    });
  });

  describe('decorateElement 正文节点打标与装饰逻辑', () => {
    it('应扫描所有 span[data-type~="tag"] 并注入 data-tag 与 data-content 属性', () => {
      const mockSpans = [
        {
          textContent: '#Python#',
          attrs: new Map<string, string>(),
          getAttribute(key: string) { return this.attrs.get(key) || null; },
          setAttribute(key: string, val: string) { this.attrs.set(key, val); },
        },
        {
          textContent: '#tech/vue#',
          attrs: new Map<string, string>(),
          getAttribute(key: string) { return this.attrs.get(key) || null; },
          setAttribute(key: string, val: string) { this.attrs.set(key, val); },
        },
      ];

      const mockRoot = {
        querySelectorAll: vi.fn().mockReturnValue(mockSpans),
      } as any;

      const decoratedCount = TagDomDecorator.decorateElement(mockRoot);

      expect(decoratedCount).toBe(2);
      expect(mockSpans[0].getAttribute('data-tag')).toBe('Python');
      expect(mockSpans[0].getAttribute('data-content')).toBe('Python');
      expect(mockSpans[1].getAttribute('data-tag')).toBe('tech/vue');
      expect(mockSpans[1].getAttribute('data-content')).toBe('tech/vue');
    });

    it('对已打标且文本一致的节点保持幂等，不重复调用 setAttribute', () => {
      const setAttributeSpy = vi.fn();
      const mockSpan = {
        textContent: '#JavaScript#',
        getAttribute(key: string) {
          if (key === 'data-tag' || key === 'data-content') return 'JavaScript';
          return null;
        },
        setAttribute: setAttributeSpy,
      };

      const mockRoot = {
        querySelectorAll: vi.fn().mockReturnValue([mockSpan]),
      } as any;

      const count = TagDomDecorator.decorateElement(mockRoot);
      expect(count).toBe(0);
      expect(setAttributeSpy).not.toHaveBeenCalled();
    });

    it('能清除已添加的 data-tag 和 data-content 装饰属性', () => {
      const removeAttributeSpy = vi.fn();
      const mockSpan = {
        removeAttribute: removeAttributeSpy,
      };

      const mockRoot = {
        querySelectorAll: vi.fn().mockReturnValue([mockSpan]),
      } as any;

      TagDomDecorator.clearDecorations(mockRoot);
      expect(removeAttributeSpy).toHaveBeenCalledWith('data-tag');
      expect(removeAttributeSpy).toHaveBeenCalledWith('data-content');
    });
  });

  describe('startObserving 与 stopObserving 监听器生命周期', () => {
    const originalDocument = globalThis.document;
    const originalMutationObserver = globalThis.MutationObserver;

    afterEach(() => {
      globalThis.document = originalDocument;
      globalThis.MutationObserver = originalMutationObserver;
      TagDomDecorator.stopObserving();
    });

    it('能够创建并注册 MutationObserver 并在 stop 时断开', () => {
      const observeSpy = vi.fn();
      const disconnectSpy = vi.fn();

      class MockObserver {
        observe = observeSpy;
        disconnect = disconnectSpy;
      }

      (globalThis as any).MutationObserver = MockObserver;
      (globalThis as any).document = {
        body: {},
        querySelectorAll: () => [],
      };

      TagDomDecorator.startObserving();
      expect(observeSpy).toHaveBeenCalledTimes(1);

      TagDomDecorator.stopObserving();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });
});
