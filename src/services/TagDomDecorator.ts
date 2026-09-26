/**
 * 正文文档标签 DOM 属性装饰器服务
 * 
 * 核心职责：
 * 1. 监听思源 Protyle 编辑器内部 DOM 变动与渲染事件；
 * 2. 扫描 span[data-type~="tag"] 节点，提取真实标签名并打上只读属性 data-tag 与 data-content；
 * 3. 驱动原生标准 CSS 属性选择器精确渲染正文标签的高亮背景、字体色与 Emoji 伪元素前缀。
 */
export class TagDomDecorator {
  private static observer: MutationObserver | null = null;
  private static isObserving = false;
  private static pendingMutations = false;

  /**
   * 剥离并清洗标签文本，提取干净的标签标识（支持多级标签如 #tech/vue# -> tech/vue）
   */
  public static extractTagLabel(rawText: string | null | undefined): string {
    if (!rawText) return '';
    // 过滤零宽字符（\u200B-\u200F）、格式控制字符（\u202A-\u202E）、单词连接符（\u2060-\u206F，思源Protyle行内标签默认前缀U+2060）及BOM字符（\uFEFF）
    const cleaned = rawText.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '').trim();
    // 剥离首尾所有的 '#' 字符并修剪
    return cleaned.replace(/^#+|#+$/g, '').trim();
  }

  /**
   * 从元素中提取文本内容（优先提取纯文本子节点，排除关闭按钮等 SVG 子节点干扰）
   */
  public static extractElementText(el: Element): string {
    if (el.childNodes && el.childNodes.length > 0) {
      let text = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        // 3 为 Node.TEXT_NODE
        if (node.nodeType === 3) {
          text += node.textContent || '';
        }
      }
      if (text.trim()) {
        return text;
      }
    }
    return el.textContent || '';
  }

  /**
   * 为指定根节点下的所有正文行内标签与文档头部标签注入 data-tag 与 data-content 属性
   * 严格保障操作幂等，相同标签不重复 setAttribute 避免重绘触发循环
   * @param root 待扫描的根元素或 Document
   * @returns 成功打标/修改的节点数量
   */
  public static decorateElement(root: Element | Document = document): number {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;

    let count = 0;
    // 同时扫描：正文行内标签 span[data-type~="tag"] 以及文档头部标签 .b3-chips__doctag .b3-chip
    const targetElements = root.querySelectorAll('span[data-type~="tag"], .b3-chips__doctag .b3-chip, .b3-chips .b3-chip[data-type="open-search"]');
    for (let i = 0; i < targetElements.length; i++) {
      const el = targetElements[i] as HTMLElement;
      const rawText = this.extractElementText(el);
      const label = this.extractTagLabel(rawText);
      if (!label) continue;

      let modified = false;
      if (el.getAttribute('data-tag') !== label) {
        el.setAttribute('data-tag', label);
        modified = true;
      }
      if (el.getAttribute('data-content') !== label) {
        el.setAttribute('data-content', label);
        modified = true;
      }

      if (modified) {
        count++;
      }
    }

    return count;
  }

  /**
   * 移除所有已打标的 data-tag 与 data-content 属性（插件卸载或禁用时调用）
   */
  public static clearDecorations(root: Element | Document = document): void {
    if (!root || typeof root.querySelectorAll !== 'function') return;

    const targetElements = root.querySelectorAll('span[data-type~="tag"], .b3-chips__doctag .b3-chip, .b3-chips .b3-chip[data-type="open-search"]');
    for (let i = 0; i < targetElements.length; i++) {
      const el = targetElements[i] as HTMLElement;
      if (el.removeAttribute) {
        el.removeAttribute('data-tag');
        el.removeAttribute('data-content');
      }
    }
  }

  /**
   * 启动基于 MutationObserver 的正文 DOM 监听引擎
   * 配合 RAF / 异步微任务进行节流防抖，单次全库扫描在微秒级
   */
  public static startObserving(target?: Node): void {
    if (typeof MutationObserver === 'undefined') return;
    if (typeof document === 'undefined') return;
    if (this.isObserving) return;

    const targetNode = target || document.body;
    if (!targetNode) return;

    // 启动即刻执行一次全景扫描
    this.decorateElement(document);

    this.observer = new MutationObserver(() => {
      if (this.pendingMutations) return;
      this.pendingMutations = true;

      const nextTick = typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (cb: () => void) => setTimeout(cb, 16);

      nextTick(() => {
        this.pendingMutations = false;
        this.decorateElement(document);
      });
    });

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    this.isObserving = true;
  }

  /**
   * 停止正文 DOM 监听并断开 Observer
   */
  public static stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isObserving = false;
    this.pendingMutations = false;
  }
}
