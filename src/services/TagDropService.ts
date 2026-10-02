import { showMessage } from 'siyuan';
import { TagApiClient } from './TagApiClient';
import { TagBatchService } from './TagBatchService';

/**
 * 标签拖拽至文档正文区打标服务
 * 严格遵从【块级末尾追加模式】：无论拖入标题或段落，统一在块末尾追加 #标签#，保持块首尾格式整洁
 */
export class TagDropService {
  private static activeHighlightEl: HTMLElement | null = null;
  private static draggingTag: string | null = null;

  public static setDraggingTag(tag: string | null) {
    this.draggingTag = tag;
  }

  public static getDraggingTag(): string | null {
    return this.draggingTag;
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

    const titleEl = targetEl.closest<HTMLElement>('.protyle-title[data-node-id]');
    const blockEl = targetEl.closest<HTMLElement>('.protyle-wysiwyg [data-node-id]');

    if (titleEl) {
      const docId = titleEl.getAttribute('data-node-id');
      if (!docId) return { success: false, isDoc: true, error: '未找到文档 ID' };
      try {
        await client.addTagToDocument(docId, tag);
        return { success: true, isDoc: true, blockId: docId };
      } catch (err: any) {
        return { success: false, isDoc: true, blockId: docId, error: err.message || String(err) };
      }
    }

    if (blockEl) {
      const blockId = blockEl.getAttribute('data-node-id');
      if (!blockId) return { success: false, isDoc: false, error: '未找到块 ID' };
      try {
        const md = await client.getBlockMarkdown(blockId);
        const updatedMd = TagBatchService.appendMarkdownTag(md, tag);
        if (updatedMd !== md) {
          await client.updateBlock(blockId, updatedMd);
        }
        return { success: true, isDoc: false, blockId };
      } catch (err: any) {
        return { success: false, isDoc: false, blockId, error: err.message || String(err) };
      }
    }

    return { success: false, isDoc: false, error: '未拖入有效的思源正文块或文档标题' };
  }

  /**
   * 初始化全局正文拖放监听器
   */
  public static initGlobalDropListener(client: typeof TagApiClient = TagApiClient): () => void {
    if (typeof document === 'undefined') return () => {};

    const handleDragOver = (e: DragEvent) => {
      const tag = e.dataTransfer?.getData('application/siyuan-tag') || this.draggingTag;
      if (!tag) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const dropTarget = target.closest<HTMLElement>('.protyle-title[data-node-id], .protyle-wysiwyg [data-node-id]');
      if (dropTarget) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }

        if (this.activeHighlightEl !== dropTarget) {
          this.clearHighlight();
          this.activeHighlightEl = dropTarget;
          dropTarget.classList.add('tm-drop-target-active');
        }
      } else {
        this.clearHighlight();
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (this.activeHighlightEl && !this.activeHighlightEl.contains(e.relatedTarget as Node | null)) {
        this.clearHighlight();
      }
    };

    const handleDrop = async (e: DragEvent) => {
      const tag = e.dataTransfer?.getData('application/siyuan-tag') || this.draggingTag;
      const target = e.target as HTMLElement | null;
      this.clearHighlight();
      this.draggingTag = null;

      if (!tag || !target) return;

      const dropTarget = target.closest<HTMLElement>('.protyle-title[data-node-id], .protyle-wysiwyg [data-node-id]');
      if (!dropTarget) return;

      e.preventDefault();
      e.stopPropagation();

      const res = await this.applyTagToTarget(dropTarget, tag, client);
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

  private static clearHighlight() {
    if (this.activeHighlightEl) {
      this.activeHighlightEl.classList.remove('tm-drop-target-active');
      this.activeHighlightEl = null;
    }
  }
}
