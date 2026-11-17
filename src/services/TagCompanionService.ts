import { showMessage } from 'siyuan';
import type {
  ITagCompanionCandidate,
  ITagCompanionConfig,
  ITagCompanionContext,
  ICompanionBarState,
} from '../types/companion';
import { DEFAULT_COMPANION_CONFIG } from '../types/companion';
import { TagCompanionCache } from './TagCompanionCache';
import { TagCompanionRecommender } from './TagCompanionRecommender';
import { TagCompanionOverlay } from './TagCompanionOverlay';
import { TagBlockAppender } from './TagBlockAppender';
import { TagDomDecorator } from './TagDomDecorator';
import { TagApiClient } from './TagApiClient';
import { TagDropService } from './TagDropService';

export type { ICompanionBarState };

export interface ICompanionTargetContext {
  isDoc: boolean;
  id: string; // blockId 或 docId
  targetElement: HTMLElement;
  protyle?: any;
}

/**
 * 伴生标签推荐触发与交互调度服务
 *
 * 职责边界：全局事件检测（键盘输入态、鼠标悬浮、光标停留）、推荐编排与采纳写回。
 * 浮条视图挂载、气泡定位与 chip 注入委托给 TagCompanionOverlay。
 */
export class TagCompanionService {
  private static config: ITagCompanionConfig = { ...DEFAULT_COMPANION_CONFIG };
  private static currentTarget: ICompanionTargetContext | null = null;
  private static hoverTimer: any = null;
  private static isInitialized = false;

  private static cleanupListeners: Array<() => void> = [];

  /**
   * 初始化伴生推荐全局服务
   */
  public static init(customConfig?: Partial<ITagCompanionConfig>): () => void {
    if (this.isInitialized) {
      this.updateConfig(customConfig || {});
      return () => this.destroy();
    }

    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    if (typeof document === 'undefined') {
      return () => {};
    }

    // 1. 预热图谱内存倒排索引
    TagCompanionCache.ensureIndexLoaded(undefined, this.config.minSimilarity).catch(() => {});

    // 2. 挂载全局气泡容器（视图层职责委托 TagCompanionOverlay）
    TagCompanionOverlay.mount(
      (item: ITagCompanionCandidate, idx: number) => {
        this.acceptCandidate(item, idx);
      },
      () => {
        this.hide();
      },
    );

    // 3. 注册事件监听器 (含输入态、鼠标悬浮、光标移入及按键采纳)
    this.bindGlobalListeners();

    this.isInitialized = true;

    return () => {
      this.destroy();
    };
  }

  /**
   * 更新运行时配置
   */
  public static updateConfig(newConfig: Partial<ITagCompanionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (!this.config.enabled) {
      this.hide();
    }
  }

  public static getConfig(): ITagCompanionConfig {
    return { ...this.config };
  }

  public static getState(): ICompanionBarState {
    return TagCompanionOverlay.getState();
  }

  /**
   * 判断思源原生候选联想菜单 (.protyle-hint) 是否处于激活可见状态
   */
  public static isNativeHintActive(): boolean {
    if (typeof document === 'undefined') return false;
    const hintEl = document.querySelector<HTMLElement>('.protyle-hint:not(.fn__none)');
    if (!hintEl) return false;
    const style = window.getComputedStyle(hintEl);
    return style.display !== 'none' && hintEl.clientHeight > 0;
  }

  /**
   * 判断一段文本是否以未闭合的单井号打字中途形态结尾 (例如 "#ai"、" #react")
   */
  public static isUnclosedTagText(text: string): boolean {
    if (!text) return false;
    return /(?:^|\s)#[^\s#]+$/.test(text);
  }

  /**
   * 从目标元素提取所在编辑器 Protyle 实例
   */
  private static extractProtyle(el: HTMLElement): any {
    const protyleEl = el.closest<HTMLElement>('.protyle');
    return (protyleEl as any)?.protyle || null;
  }

  /**
   * 解析目标属于文档级还是段落块级
   * （文档级与块级目标解析统一委托 TagDropService 的共享解析器，消除重复 DOM 遍历逻辑）
   */
  public static resolveTarget(targetEl: HTMLElement): ICompanionTargetContext | null {
    if (!targetEl) return null;

    // 1. 优先检查是否位于文档头部标签区域或标题区
    const docTarget = TagDropService.resolveDocTarget(targetEl);
    if (docTarget) {
      return {
        isDoc: true,
        id: docTarget.docId,
        targetElement: docTarget.el,
        protyle: this.extractProtyle(docTarget.el),
      };
    }

    // 2. 检查是否位于编辑器正文段落块内部
    const blockTarget = TagDropService.resolveBlockTarget(targetEl);
    if (blockTarget) {
      return {
        isDoc: false,
        id: blockTarget.blockId,
        targetElement: blockTarget.el,
        protyle: this.extractProtyle(blockTarget.el),
      };
    }

    return null;
  }

  /**
   * 提取当前上下文已存在的标签列表 (文档级包含所有头部 chips，块级包含块内所有 tag spans)
   */
  public static extractExistingTags(targetCtx: ICompanionTargetContext): string[] {
    if (!targetCtx || !targetCtx.targetElement) return [];

    if (targetCtx.isDoc) {
      const protyleEl = targetCtx.targetElement.closest<HTMLElement>('.protyle') || document.body;
      const docChips = Array.from(
        protyleEl.querySelectorAll<HTMLElement>('.b3-chips__doctag .b3-chip, .b3-chips .b3-chip')
      );
      return docChips
        .map(c => c.getAttribute('data-tag') || TagDomDecorator.extractTagLabel(TagDomDecorator.extractElementText(c)))
        .filter(Boolean);
    }

    const tagElements = Array.from(
      targetCtx.targetElement.querySelectorAll<HTMLElement>('span[data-type~="tag"]')
    );
    return tagElements
      .map(el => el.getAttribute('data-tag') || TagDomDecorator.extractTagLabel(TagDomDecorator.extractElementText(el)))
      .filter(Boolean);
  }

  // ==========================================
  // 全局事件监听（按职责拆分为独立的 handler 构建器）
  // ==========================================

  /**
   * 按键采纳与隐退处理（捕获阶段优先拦截 Tab）
   */
  private static buildAcceptKeyHandler(): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
      if (!TagCompanionService.getState().visible || !this.currentTarget) return;

      if (e.key === 'Tab' && !e.shiftKey) {
        // 递进式采纳当前聚焦项
        e.preventDefault();
        e.stopPropagation();

        const state = this.getState();
        const currentCandidate = state.candidates[state.activeIndex];
        if (currentCandidate) {
          this.acceptCandidate(currentCandidate, state.activeIndex);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        return;
      }

      // 若用户按任意输入键、回车或方向键，立即隐退
      if (
        e.key === 'Enter' ||
        e.key === 'Backspace' ||
        e.key.length === 1 ||
        e.key.startsWith('Arrow')
      ) {
        this.hide();
      }
    };
  }

  /**
   * 键盘抬起监听（英数 # 与全角 ＃ 的闭合 # 瞬发检测）
   */
  private static buildInputCompletionHandler(): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
      if (!this.config.enabled) return;
      if (e.key === 'Escape' || e.key === 'Tab') return;

      // 若原生候选菜单处于打开状态，强行抑制伴生浮条
      if (this.isNativeHintActive()) {
        this.hide();
        return;
      }

      const target = e.target as HTMLElement | null;
      if (!target || !target.closest?.('.protyle-wysiwyg')) return;

      // 无论英数 # 还是全角 ＃，即时检测输入完成
      if (e.key === '#' || e.key === '＃') {
        this.checkInputCompletion(target);
      }
    };
  }

  /**
   * 输入事件监听（捕获富文本异步解析及输入法上屏）
   */
  private static buildRichInputHandler(): (e: Event) => void {
    return (e: Event) => {
      if (!this.config.enabled) return;
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest?.('.protyle-wysiwyg')) return;

      setTimeout(() => {
        if (this.isNativeHintActive()) {
          this.hide();
          return;
        }
        this.checkInputCompletion(target);
      }, 50);
    };
  }

  /**
   * 鼠标悬浮于标签监听（悬浮即时触发，支持正文与文档顶部）
   */
  private static buildTagHoverHandler(): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
      if (!this.config.enabled) return;
      if (this.isNativeHintActive()) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagEl = target.closest<HTMLElement>(
        'span[data-type~="tag"], [data-tag], .b3-chips__doctag .b3-chip, .b3-chips .b3-chip'
      );
      if (!tagEl) return;

      const targetCtx = this.resolveTarget(tagEl);
      if (!targetCtx) return;

      const rawText = TagDomDecorator.extractElementText(tagEl);
      const targetLabel = tagEl.getAttribute('data-tag') || TagDomDecorator.extractTagLabel(rawText);
      if (!targetLabel) return;

      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
      }

      this.hoverTimer = setTimeout(() => {
        if (this.isNativeHintActive()) return;
        const rect = tagEl.getBoundingClientRect();
        this.triggerRecommendation(targetCtx, targetLabel, rect);
      }, 180);
    };
  }

  /**
   * 鼠标移出标签监听（进入浮条或其他标签时保留悬浮计时）
   */
  private static buildTagHoverOutHandler(): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (TagCompanionOverlay.contains(related)) return;
      if (related?.closest?.('span[data-type~="tag"], [data-tag], .b3-chip')) return;

      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }
    };
  }

  /**
   * 光标移动/停留检测（双重模式 300ms 防抖）
   */
  private static buildCursorIdleHandler(): () => void {
    return () => {
      if (!this.config.enabled || this.config.triggerMode !== 'dual') {
        return;
      }

      if (this.isNativeHintActive()) {
        this.hide();
        return;
      }

      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }

      // 静止 300ms 后触发检测
      this.hoverTimer = setTimeout(() => {
        if (this.isNativeHintActive()) return;
        this.checkCursorFocus();
      }, this.config.hoverDelayMs);
    };
  }

  /**
   * 滚动/失焦/外部按下时的即时隐退
   */
  private static buildDismissHandler(): () => void {
    return () => {
      if (this.getState().visible) {
        this.hide();
      }
    };
  }

  /**
   * 注册全局捕获监听
   */
  private static bindGlobalListeners(): void {
    const handleKeyDown = this.buildAcceptKeyHandler();
    const handleKeyUp = this.buildInputCompletionHandler();
    const handleInput = this.buildRichInputHandler();
    const handleMouseOver = this.buildTagHoverHandler();
    const handleMouseOut = this.buildTagHoverOutHandler();
    const handleSelectionChange = this.buildCursorIdleHandler();
    const handleDismiss = this.buildDismissHandler();
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (TagCompanionOverlay.contains(target)) return;
      handleDismiss();
    };

    // 捕获阶段监听以优先拦截 Tab
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('blur', handleDismiss);
    document.addEventListener('mousedown', handleMouseDown);

    this.cleanupListeners.push(() => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('blur', handleDismiss);
      document.removeEventListener('mousedown', handleMouseDown);
    });
  }

  /**
   * 检测刚输入完成标签（严格闭合判定，未闭合打字态时绝对不触发）
   */
  private static checkInputCompletion(targetEl: HTMLElement): void {
    if (this.isNativeHintActive()) {
      this.hide();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const targetCtx = this.resolveTarget(targetEl);
    if (!targetCtx) return;

    let targetLabel = '';

    // 1. 检查光标前的文本
    const node = range.startContainer;
    if (node && node.nodeType === 3) {
      const text = node.textContent || '';
      const textBefore = text.substring(0, range.startOffset).trimEnd();

      // 若正处于单井号未闭合打字态 (例如 "#ai")，严格抑制伴生推荐，避免遮挡原生补全菜单
      if (this.isUnclosedTagText(textBefore)) {
        this.hide();
        return;
      }

      // 仅当输入完闭合井号时 (如 "#ai#") 才提取标签名
      const match = textBefore.match(/#([^\s#]+)#$/);
      if (match && match[1]) {
        targetLabel = match[1];
      }
    }

    // 2. 若文本并非以闭合 # 结尾，检查光标是否刚紧随在已上屏的 span[data-type~="tag"] 之后
    // (例如从思源原生候选菜单按 Enter 选中并插入标签后)
    if (!targetLabel && node) {
      let prevEl: HTMLElement | null = null;
      if (node.nodeType === 3 && node.previousSibling instanceof HTMLElement) {
        prevEl = node.previousSibling;
      } else if (node instanceof HTMLElement) {
        prevEl = node.querySelector('span[data-type~="tag"]') || node.closest('span[data-type~="tag"]');
      }
      if (prevEl && prevEl.matches?.('span[data-type~="tag"]')) {
        targetLabel = prevEl.getAttribute('data-tag') || TagDomDecorator.extractTagLabel(TagDomDecorator.extractElementText(prevEl));
      }
    }

    // 若未发生明确的“标签完成上屏”事件，不进行任何打扰
    if (!targetLabel) return;

    // 计算光标安全坐标
    let rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      const clientRects = range.getClientRects();
      if (clientRects.length > 0) {
        rect = clientRects[0];
      } else {
        rect = targetCtx.targetElement.getBoundingClientRect();
      }
    }

    this.triggerRecommendation(targetCtx, targetLabel, rect);
  }

  /**
   * 检测光标停留于包含标签的块（防抖触发）
   */
  private static checkCursorFocus(): void {
    if (this.isNativeHintActive()) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const parentEl = node instanceof HTMLElement ? node : node.parentElement;
    if (!parentEl) return;

    const targetCtx = this.resolveTarget(parentEl);
    if (!targetCtx) return;

    const tagElements = Array.from(
      targetCtx.targetElement.querySelectorAll<HTMLElement>('span[data-type~="tag"], .b3-chip')
    );
    if (tagElements.length === 0) return;

    const targetEl = tagElements[0];
    const rawText = TagDomDecorator.extractElementText(targetEl);
    const targetLabel = targetEl.getAttribute('data-tag') || TagDomDecorator.extractTagLabel(rawText);
    if (!targetLabel) return;

    let rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      rect = targetEl.getBoundingClientRect();
    }

    this.triggerRecommendation(targetCtx, targetLabel, rect);
  }

  /**
   * 触发并展示推荐气泡
   */
  private static async triggerRecommendation(
    targetCtx: ICompanionTargetContext,
    targetLabel: string,
    caretRect: DOMRect,
  ): Promise<void> {
    if (this.isNativeHintActive()) return;

    // 确保索引缓存已预热
    if (!TagCompanionCache.isReady()) {
      await TagCompanionCache.ensureIndexLoaded(undefined, this.config.minSimilarity);
    }

    // 提取当前目标上下文中已存在的全部标签 (文档级或块级)
    const existingTags = this.extractExistingTags(targetCtx);

    const context: ITagCompanionContext = {
      targetLabel,
      blockId: targetCtx.id,
      blockElement: targetCtx.targetElement,
      existingTags,
      caretRect,
      protyle: targetCtx.protyle,
    };

    const candidates = TagCompanionRecommender.getRecommendations(context, this.config);
    if (candidates.length === 0) {
      this.hide();
      return;
    }

    this.show(candidates, caretRect, targetCtx);
  }

  /**
   * 显示气泡并定位（定位计算委托 TagCompanionOverlay）
   */
  public static show(
    candidates: ITagCompanionCandidate[],
    rect: DOMRect,
    target: string | ICompanionTargetContext,
    protyle?: any,
  ): void {
    if (typeof target === 'string') {
      this.currentTarget = {
        isDoc: false,
        id: target,
        targetElement: typeof document !== 'undefined' ? document.body : (null as any),
        protyle,
      };
    } else {
      this.currentTarget = target;
    }

    TagCompanionOverlay.present(candidates, rect);
  }

  /**
   * 隐藏气泡
   */
  public static hide(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }

    TagCompanionOverlay.hide();
    this.currentTarget = null;
  }

  /**
   * 采纳候选标签并更新状态机 (支持文档级属性添加与正文块末尾追加)
   */
  public static async acceptCandidate(item: ITagCompanionCandidate, index: number): Promise<void> {
    if (!this.currentTarget || !item?.label) return;

    TagCompanionOverlay.markAccepted(item.label);

    if (this.currentTarget.isDoc) {
      // 1. 文档级标签：调用内核 addTagToDocument 增加属性
      try {
        await TagApiClient.addTagToDocument(this.currentTarget.id, item.label);
        showMessage(`已为当前文档添加标签 #${item.label}#`, 3000, 'info');
        TagCompanionOverlay.appendDocChipToHeader(this.currentTarget.targetElement, item.label);
      } catch (err: any) {
        showMessage(`为文档添加标签失败: ${err.message || err}`, 4000, 'error');
      }
    } else {
      // 2. 正文段落块：执行块尾追加打标
      await TagBlockAppender.applyTagToBlockEnd(
        this.currentTarget.id,
        item.label,
        undefined,
        this.currentTarget.protyle,
      );
    }

    // 推进聚焦指针
    TagCompanionOverlay.advance(index);

    // 若全部项已被采纳，平滑隐退
    if (this.getState().activeIndex >= this.getState().candidates.length) {
      setTimeout(() => {
        this.hide();
      }, 350);
    }
  }

  /**
   * 销毁全局服务
   */
  public static destroy(): void {
    this.hide();

    for (const dispose of this.cleanupListeners) {
      dispose();
    }
    this.cleanupListeners = [];

    TagCompanionOverlay.unmount();

    this.isInitialized = false;
  }
}
