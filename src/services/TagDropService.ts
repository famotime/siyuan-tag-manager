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
   * 判断目标是否属于思源文档顶部的标签展示区域或文档标题区域
   */
  public static resolveDocTarget(targetEl: HTMLElement): { el: HTMLElement; docId: string } | null {
    if (!targetEl) return null;

    // 1. 直接命中或位于文档标题区
    const titleEl = targetEl.closest?.<HTMLElement>('.protyle-title[data-node-id]');
    if (titleEl && typeof titleEl.getAttribute === 'function') {
      const docId = titleEl.getAttribute('data-node-id');
      if (docId) return { el: titleEl, docId };
    }

    // 2. 命中思源文档头部的标签展示区、添加标签按钮或背景交互区
    const docTagArea = targetEl.closest?.<HTMLElement>(
      '.b3-chips__doctag, .b3-chips, .b3-chip, [data-type="tag"], .protyle-background__ia, .protyle-background, .protyle-attr--av',
    );
    if (docTagArea) {
      // 在同一个 protyle 编辑器容器中寻找对应的文档标题节点
      const protyleContainer = targetEl.closest?.<HTMLElement>('.protyle, .protyle-content');
      const containerTitle = protyleContainer?.querySelector?.<HTMLElement>('.protyle-title[data-node-id]');
      const docId = containerTitle?.getAttribute?.('data-node-id');
      if (docId) {
        return { el: docTagArea, docId };
      }

      // 回退：查找当前窗口中激活的 protyle 标题
      const fallbackTitle = document?.querySelector?.<HTMLElement>(
        '.layout__wnd--active .protyle-title[data-node-id], .protyle:not(.fn__none) .protyle-title[data-node-id]',
      );
      const fallbackDocId = fallbackTitle?.getAttribute?.('data-node-id');
      if (fallbackDocId) {
        return { el: docTagArea, docId: fallbackDocId };
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
   */
  public static initGlobalDropListener(client: typeof TagApiClient = TagApiClient): () => void {
    if (typeof document === 'undefined') return () => {};

    const handleDragOver = (e: DragEvent) => {
      const tag = e.dataTransfer?.getData('application/siyuan-tag') || this.draggingTag;
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
      if (this.activeHighlightEl && !this.activeHighlightEl.contains(e.relatedTarget as Node | null)) {
        this.clearHighlight();
      }
    };

    const handleDrop = async (e: DragEvent) => {
      const tag =
        e.dataTransfer?.getData('application/siyuan-tag') ||
        e.dataTransfer?.getData('text/plain')?.replace(/^#|#\s*$/g, '').trim() ||
        this.draggingTag;
      const target = e.target as HTMLElement | null;
      this.clearHighlight();
      this.draggingTag = null;

      if (!tag || !target) return;

      // 判断落点是文档标签区还是正文段落
      const isDocTarget = Boolean(this.resolveDocTarget(target));
      const isBlockTarget = Boolean(this.resolveBlockTarget(target));

      if (!isDocTarget && !isBlockTarget) return;

      e.preventDefault();
      e.stopPropagation();

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

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      this.clearHighlight();
      this.draggingTag = null;
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragend', handleDragEnd);
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
