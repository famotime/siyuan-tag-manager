import { showMessage } from 'siyuan';
import { TagApiClient } from './TagApiClient';
import { TagBatchService } from './TagBatchService';

/**
 * 标签拖拽打标服务
 * 支持：
 * 1. 拖动到文档正文段落块 -> 给正文段落末尾追加 #标签# 打标
 * 2. 拖动到文档头部标签区域/标签展示区域/标题区 -> 给当前文档添加标签打标
 */
export class TagDropService {
  private static activeHighlightEl: HTMLElement | null = null;
  private static activeHighlightClass: string = 'tm-drop-target-active';
  private static draggingTag: string | null = null;

  public static setDraggingTag(tag: string | null) {
    this.draggingTag = tag;
  }

  public static getDraggingTag(): string | null {
    return this.draggingTag;
  }

  /**
   * 从 DOM 元素出发，多层级解析当前文档的 rootId / docId
   */
  public static resolveDocIdFromElement(targetEl: HTMLElement): string | null {
    if (!targetEl) return null;

    // 1. 检查祖先 .protyle[data-node-id] 容器 (思源在 syncRootAttributes 为 protyle 设置该属性)
    const protyleEl = targetEl.closest?.<HTMLElement>('.protyle');
    if (protyleEl && typeof protyleEl.getAttribute === 'function') {
      const protyleDocId = protyleEl.getAttribute('data-node-id');
      if (protyleDocId) return protyleDocId;

      // 2. 检查面包屑导航的第一项 (面包屑首个 item 的 data-node-id 即为文档根 ID)
      const breadcrumbItem = protyleEl.querySelector?.<HTMLElement>(
        '.protyle-breadcrumb__bar [data-node-id], .protyle-breadcrumb__item[data-node-id]',
      );
      const breadcrumbDocId = breadcrumbItem?.getAttribute('data-node-id');
      if (breadcrumbDocId) return breadcrumbDocId;

      // 3. 检查是否有挂载的 protyle 实例
      if ((protyleEl as any).protyle?.block?.rootID) {
        return (protyleEl as any).protyle.block.rootID;
      }
    }

    // 4. 若元素直接带有 data-node-id
    if (typeof targetEl.getAttribute === 'function') {
      const selfDocId = targetEl.getAttribute('data-node-id');
      if (selfDocId) return selfDocId;
    }

    // 5. 检查所在分栏窗口 (.layout__wnd) 中的当前激活页签
    const wndEl = targetEl.closest?.<HTMLElement>('.layout__wnd');
    if (wndEl) {
      const activeTab = wndEl.querySelector?.<HTMLElement>('.item--focus[data-id], .tab-header--active[data-id]');
      const tabInitData = activeTab?.getAttribute?.('data-initdata');
      if (tabInitData) {
        try {
          const parsed = JSON.parse(tabInitData);
          if (parsed?.rootId || parsed?.blockId) {
            return parsed.rootId || parsed.blockId;
          }
        } catch {
          // ignore
        }
      }
    }

    // 6. 遍历思源全局布局中所有打开的编辑器模型
    try {
      const siyuanGlobal = (window as any).siyuan;
      if (siyuanGlobal?.layout?.centerLayout) {
        const findEditorRootId = (layout: any): string | null => {
          if (!layout || !layout.children) return null;
          for (const child of layout.children) {
            if (child.model?.editor?.element && protyleEl && child.model.editor.element === protyleEl) {
              return child.model.editor.block?.rootID || child.model.rootId || null;
            }
            if (child.panelElement && typeof child.panelElement.contains === 'function' && child.panelElement.contains(targetEl)) {
              return child.model?.editor?.block?.rootID || child.model?.rootId || null;
            }
            const nested = findEditorRootId(child);
            if (nested) return nested;
          }
          return null;
        };
        const found = findEditorRootId(siyuanGlobal.layout.centerLayout);
        if (found) return found;
      }
    } catch {
      // ignore
    }

    // 7. 回退策略：查找当前窗口中激活的 protyle 容器
    const activeProtyle = document?.querySelector?.<HTMLElement>(
      '.layout__wnd--active .protyle[data-node-id], .protyle:not(.fn__none)[data-node-id]',
    );
    const fallbackId = activeProtyle?.getAttribute?.('data-node-id');
    if (fallbackId) return fallbackId;

    return null;
  }

  /**
   * 判断目标是否属于思源文档顶部的标签展示区域、文档标题区域或头部交互区
   */
  public static resolveDocTarget(targetEl: HTMLElement): { el: HTMLElement; docId: string } | null {
    if (!targetEl) return null;

    // 若明确处于正文段落块内部 (.protyle-wysiwyg)，由正文块处理，不作为文档级目标
    const inWysiwyg = Boolean(targetEl.closest?.('.protyle-wysiwyg'));
    if (inWysiwyg) {
      return null;
    }

    // 1. 命中标题区域 (.protyle-title 及其子元素：输入框、图标、属性区)
    const titleContainer = targetEl.closest?.<HTMLElement>('.protyle-title');
    if (titleContainer) {
      const docId = this.resolveDocIdFromElement(titleContainer);
      if (docId) {
        return { el: titleContainer, docId };
      }
    }

    // 2. 命中思源文档头部的标签展示区、添加标签按钮、背景交互区、顶部容器或面包屑
    const headerContainer = targetEl.closest?.<HTMLElement>(
      '.b3-chips__doctag, .b3-chips, .b3-chip, [data-type="tag"], .protyle-background__ia, .protyle-background, .protyle-top, .protyle-breadcrumb, .protyle-attr--av',
    );
    if (headerContainer) {
      const docId = this.resolveDocIdFromElement(headerContainer);
      if (docId) {
        // 高亮元素优先选择内部的标签展示区或标题区，使视觉更聚焦
        const highlightEl =
          headerContainer.querySelector?.<HTMLElement>('.b3-chips__doctag, .protyle-title') ||
          headerContainer;
        return { el: highlightEl, docId };
      }
    }

    // 3. 通用顶部兜底：位于 .protyle 容器内部且不在正文 wysiwyg 之中 (即整个文档头部)
    const protyleContainer = targetEl.closest?.<HTMLElement>('.protyle');
    if (protyleContainer) {
      const docId = this.resolveDocIdFromElement(protyleContainer);
      if (docId) {
        const titleEl = protyleContainer.querySelector?.<HTMLElement>('.protyle-title') || protyleContainer;
        return { el: titleEl, docId };
      }
    }

    return null;
  }

  /**
   * 判断目标是否属于思源正文块（段落、标题、列表项等）
   */
  public static resolveBlockTarget(targetEl: HTMLElement): { el: HTMLElement; blockId: string } | null {
    if (!targetEl) return null;

    // 必须在编辑器正文内容区内部
    const wysiwyg = targetEl.closest<HTMLElement>('.protyle-wysiwyg');
    if (!wysiwyg) return null;

    const blockEl = targetEl.closest<HTMLElement>('.protyle-wysiwyg [data-node-id]');
    if (blockEl) {
      const blockId = blockEl.getAttribute('data-node-id');
      if (blockId) {
        return { el: blockEl, blockId };
      }
    }

    return null;
  }

  /**
   * 执行块级或文档级的打标签逻辑
   */
  public static async applyTagToTarget(
    targetEl: HTMLElement,
    tag: string,
    client: typeof TagApiClient = TagApiClient,
  ): Promise<{ success: boolean; isDoc: boolean; blockId?: string; error?: string }> {
    if (!tag || !targetEl) {
      return { success: false, isDoc: false, error: '标签或目标元素为空' };
    }

    // 优先匹配文档标签区域或标题区域 -> 给文档打标
    const docTarget = this.resolveDocTarget(targetEl);
    if (docTarget) {
      try {
        await client.addTagToDocument(docTarget.docId, tag);
        return { success: true, isDoc: true, blockId: docTarget.docId };
      } catch (err: any) {
        return { success: false, isDoc: true, blockId: docTarget.docId, error: err.message || String(err) };
      }
    }

    // 匹配正文段落块 -> 给正文段落末尾追加打标
    const blockTarget = this.resolveBlockTarget(targetEl);
    if (blockTarget) {
      try {
        const md = await client.getBlockMarkdown(blockTarget.blockId);
        const updatedMd = TagBatchService.appendMarkdownTag(md, tag);
        if (updatedMd !== md) {
          await client.updateBlock(blockTarget.blockId, updatedMd);
        }
        return { success: true, isDoc: false, blockId: blockTarget.blockId };
      } catch (err: any) {
        return { success: false, isDoc: false, blockId: blockTarget.blockId, error: err.message || String(err) };
      }
    }

    return { success: false, isDoc: false, error: '未拖入有效的思源正文块或文档标签区域' };
  }

  /**
   * 初始化全局正文与标签展示区拖放监听器
   * 采用 capture: true 捕获阶段监听，避免被思源大标题输入框自带的 stopPropagation 吞没
   */
  public static initGlobalDropListener(client: typeof TagApiClient = TagApiClient): () => void {
    if (typeof document === 'undefined') return () => {};

    const handleDragOver = (e: DragEvent) => {
      const tag =
        e.dataTransfer?.getData('application/siyuan-tag') ||
        this.draggingTag ||
        e.dataTransfer?.getData('text/plain')?.replace(/^#|#\s*$/g, '').trim();

      if (!tag) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. 检查是否在文档标签展示区或标题区
      const docTarget = this.resolveDocTarget(target);
      if (docTarget) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        this.setHighlight(docTarget.el, 'tm-drop-doc-active');
        return;
      }

      // 2. 检查是否在编辑器正文段落块
      const blockTarget = this.resolveBlockTarget(target);
      if (blockTarget) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        this.setHighlight(blockTarget.el, 'tm-drop-target-active');
        return;
      }

      this.clearHighlight();
    };

    const handleDragLeave = (e: DragEvent) => {
      if (this.activeHighlightEl && (!e.relatedTarget || !this.activeHighlightEl.contains(e.relatedTarget as Node | null))) {
        this.clearHighlight();
      }
    };

    const handleDrop = async (e: DragEvent) => {
      const tag =
        e.dataTransfer?.getData('application/siyuan-tag') ||
        this.draggingTag ||
        e.dataTransfer?.getData('text/plain')?.replace(/^#|#\s*$/g, '').trim();

      const target = e.target as HTMLElement | null;

      if (!tag || !target) {
        this.clearHighlight();
        this.draggingTag = null;
        return;
      }

      // 判断落点是文档头部/标题区还是正文段落
      const docTarget = this.resolveDocTarget(target);
      const blockTarget = this.resolveBlockTarget(target);

      if (!docTarget && !blockTarget) {
        this.clearHighlight();
        return;
      }

      // 阻止思源输入框默认行为及事件冒泡（防止把文字直接插到标题文本框中）
      e.preventDefault();
      e.stopPropagation();

      this.clearHighlight();
      this.draggingTag = null;

      const res = await this.applyTagToTarget(target, tag, client);
      if (res.success) {
        if (res.isDoc) {
          showMessage(`已为当前文档添加标签 #${tag}#`, 3000, 'info');
        } else {
          showMessage(`已在目标段落末尾添加标签 #${tag}#`, 3000, 'info');
        }
      } else if (res.error) {
        showMessage(`打标失败: ${res.error}`, 4000, 'error');
      }
    };

    const handleDragEnd = () => {
      this.clearHighlight();
      this.draggingTag = null;
    };

    const eventOptions: AddEventListenerOptions = { capture: true };

    document.addEventListener('dragover', handleDragOver, eventOptions);
    document.addEventListener('dragleave', handleDragLeave, eventOptions);
    document.addEventListener('drop', handleDrop, eventOptions);
    document.addEventListener('dragend', handleDragEnd, eventOptions);

    return () => {
      this.clearHighlight();
      this.draggingTag = null;
      document.removeEventListener('dragover', handleDragOver, eventOptions);
      document.removeEventListener('dragleave', handleDragLeave, eventOptions);
      document.removeEventListener('drop', handleDrop, eventOptions);
      document.removeEventListener('dragend', handleDragEnd, eventOptions);
    };
  }

  private static setHighlight(el: HTMLElement, className: string) {
    if (this.activeHighlightEl === el && this.activeHighlightClass === className) return;
    this.clearHighlight();
    this.activeHighlightEl = el;
    this.activeHighlightClass = className;
    el.classList.add(className);
  }

  private static clearHighlight() {
    if (this.activeHighlightEl) {
      this.activeHighlightEl.classList.remove(this.activeHighlightClass);
      this.activeHighlightEl.classList.remove('tm-drop-target-active');
      this.activeHighlightEl.classList.remove('tm-drop-doc-active');
      this.activeHighlightEl = null;
    }
  }
}
