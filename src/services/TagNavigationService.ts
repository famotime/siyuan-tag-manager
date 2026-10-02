import type { Plugin } from 'siyuan';

export interface IBlockCenterOptions {
  /** 最大轮询尝试次数，默认 15 次 */
  maxRetries?: number;
  /** 每次尝试的时间间隔(ms)，默认 80ms */
  interval?: number;
  /** 滚动行为，默认 'smooth' */
  behavior?: ScrollBehavior;
  /** 高亮持续时间(ms)，默认 2000ms */
  highlightDuration?: number;
}

/**
 * 标签导航与精确定位服务
 * 负责打标块点击跳转时打开对应文档页签，并将打标位置精准展示在文档显示区域的屏幕正中（而非窗口底部）
 */
export class TagNavigationService {
  /**
   * 跳转至指定块，并将该块在文档显示区域内垂直居中展示
   * @param rootId 文档根块 ID
   * @param blockId 目标块 ID
   * @param plugin 思源插件实例（可选）
   */
  public static jumpToBlock(rootId: string, blockId: string, plugin?: Plugin): void {
    const targetBlockId = blockId || rootId;
    if (!targetBlockId) return;

    // 1. 调用思源 openTab 或协议打开目标块所属文档
    this.openBlockTab(rootId, targetBlockId, plugin);

    // 2. 调度执行文档显示区域垂直正中居中滚动校准与高亮
    this.centerBlockInView(targetBlockId);
  }

  /**
   * 调用思源 openTab 或 URL Scheme 打开目标块所在的文档页签
   */
  public static openBlockTab(rootId: string, blockId: string, plugin?: Plugin): void {
    const targetId = blockId || rootId;
    const siyuanGlobal = typeof window !== 'undefined' ? (window as any).siyuan : null;
    const app = (plugin as any)?.app || siyuanGlobal?.ws?.app;

    if (siyuanGlobal?.openTab) {
      try {
        siyuanGlobal.openTab({
          app: app || siyuanGlobal.appId,
          doc: {
            id: targetId,
            action: ['cb-get-focus', 'cb-get-hl', 'cb-get-all', 'cb-get-context'],
          },
        });
        return;
      } catch (err) {
        console.warn('[TagManager] openTab error, fallback to URL scheme:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.open(`siyuan://blocks/${targetId}`);
    }
  }

  /**
   * 将指定块在文档显示区域（Protyle 内容视口）垂直居中显示
   */
  public static centerBlockInView(blockId: string, options: IBlockCenterOptions = {}): void {
    if (typeof document === 'undefined') return;

    const maxRetries = options.maxRetries ?? 15;
    const interval = options.interval ?? 80;
    const behavior = options.behavior ?? 'smooth';
    const highlightDuration = options.highlightDuration ?? 2000;

    let retries = 0;

    const attempt = () => {
      retries++;
      const targetEl = this.findTargetElement(blockId);

      if (targetEl && (targetEl.clientHeight > 0 || targetEl.offsetHeight > 0)) {
        this.scrollElementToCenter(targetEl, behavior);
        this.highlightElement(targetEl, highlightDuration);

        // 在 250ms 后进行二次校验复调，消除异步渲染或大文档排版回流可能产生的细微偏移
        if (retries <= 3) {
          setTimeout(() => {
            const el = this.findTargetElement(blockId);
            if (el) {
              this.scrollElementToCenter(el, 'auto');
            }
          }, 250);
        }
        return;
      }

      if (retries < maxRetries) {
        setTimeout(attempt, interval);
      }
    };

    // 稍作微小延迟首触，等待页签切换或 Protyle 挂载初始化
    setTimeout(attempt, 50);
  }

  /**
   * 精确寻找文档正文中的目标节点（排除侧栏、弹窗与临时预览）
   */
  public static findTargetElement(blockId: string): HTMLElement | null {
    if (typeof document === 'undefined') return null;

    const elements = Array.from(document.querySelectorAll(`[data-node-id="${blockId}"]`)) as HTMLElement[];
    if (elements.length === 0) return null;

    // 优先匹配主工作区正文编辑区域内的块，排除标签管家侧栏宿主与隐藏节点
    const primary = elements.find(el => {
      const inWysiwyg = Boolean(el.closest('.protyle-wysiwyg'));
      const inHost = Boolean(el.closest('.siyuan-tag-manager-host'));
      const isHidden = el.offsetParent === null && el.clientHeight === 0 && el.offsetHeight === 0;
      return inWysiwyg && !inHost && !isHidden;
    });

    if (primary) return primary;

    // 兜底匹配任意非标签管家宿主内的节点
    return elements.find(el => !el.closest('.siyuan-tag-manager-host')) || elements[0] || null;
  }

  /**
   * 执行将元素在容器视口内垂直正中居中的滚动计算与操作
   * 计算目标块中心点与容器视口中心点的偏差，精确 scrollBy(diff)
   */
  public static scrollElementToCenter(targetEl: HTMLElement, behavior: ScrollBehavior = 'smooth'): boolean {
    // 查找最近的可滚动 Protyle 内容容器
    const scrollContainer = this.findScrollContainer(targetEl);

    if (scrollContainer && scrollContainer.clientHeight > 0) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      // 目标块垂直中心与容器可视区域垂直中心的差值
      const targetCenter = targetRect.top + targetRect.height / 2;
      const containerCenter = containerRect.top + containerRect.height / 2;
      const diff = targetCenter - containerCenter;

      if (Math.abs(diff) > 2) {
        if (typeof scrollContainer.scrollBy === 'function') {
          scrollContainer.scrollBy({
            top: diff,
            behavior,
          });
        } else {
          scrollContainer.scrollTop += diff;
        }
      }
      return true;
    }

    // 降级使用 scrollIntoView
    try {
      if (typeof targetEl.scrollIntoView === 'function') {
        targetEl.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior,
        });
        return true;
      }
    } catch {
      // 容错保护
    }

    return false;
  }

  /**
   * 查找目标元素所属的 Protyle 内容滚动容器
   */
  public static findScrollContainer(targetEl: HTMLElement): HTMLElement | null {
    const directProtyle = targetEl.closest('.protyle-content') as HTMLElement | null;
    if (directProtyle) return directProtyle;

    let parent = targetEl.parentElement;
    while (parent && parent !== document.body) {
      const overflowY = (typeof window !== 'undefined' && window.getComputedStyle
        ? window.getComputedStyle(parent).overflowY
        : parent.style?.overflowY) || '';
      if ((overflowY === 'auto' || overflowY === 'scroll') && parent.clientHeight > 0) {
        return parent;
      }
      parent = parent.parentElement;
    }

    return null;
  }

  /**
   * 触发思源原生高亮光晕动效
   */
  public static highlightElement(targetEl: HTMLElement, duration = 2000): void {
    targetEl.classList.add('protyle-wysiwyg--hl');
    targetEl.classList.add('tm-block-jump-highlight');

    setTimeout(() => {
      targetEl.classList.remove('protyle-wysiwyg--hl');
      targetEl.classList.remove('tm-block-jump-highlight');
    }, duration);
  }
}
