import type { ITagGroup } from '../types/tag';
import { TagGovernanceService } from './TagGovernanceService';
import { TagBatchService } from './TagBatchService';

/**
 * 标签组服务：负责标签套件管理与当前文档/块的一键智能打标
 */
export class TagGroupService {
  /**
   * 生成唯一的分组 ID
   */
  public static generateId(): string {
    return `tg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * 规范化标签项（去除首尾空格、#与多余斜杠）
   */
  public static cleanTag(raw: string): string {
    if (!raw) return '';
    const withoutHash = raw.trim().replace(/^#+|#+$/g, '');
    return TagGovernanceService.normalizeLabel(withoutHash);
  }

  /**
   * 创建新的标签组
   */
  public static createGroup(
    currentGroups: ITagGroup[],
    data: { name: string; tags: string[]; color?: string; icon?: string },
  ): { groups: ITagGroup[]; newGroup: ITagGroup; error?: string } {
    const name = data.name.trim();
    if (!name) {
      return { groups: currentGroups, newGroup: null as any, error: '标签组名称不能为空' };
    }

    const cleanTags = Array.from(
      new Set(data.tags.map(t => this.cleanTag(t)).filter(Boolean)),
    );

    const newGroup: ITagGroup = {
      id: this.generateId(),
      name,
      tags: cleanTags,
      color: data.color || '#4285F4',
      icon: data.icon || '',
      sortOrder: currentGroups.length,
      updatedAt: Date.now(),
    };

    return {
      groups: [...currentGroups, newGroup],
      newGroup,
    };
  }

  /**
   * 更新现有标签组
   */
  public static updateGroup(
    currentGroups: ITagGroup[],
    groupId: string,
    data: Partial<Pick<ITagGroup, 'name' | 'tags' | 'color' | 'icon'>>,
  ): { groups: ITagGroup[]; updatedGroup?: ITagGroup; error?: string } {
    const idx = currentGroups.findIndex(g => g.id === groupId);
    if (idx === -1) {
      return { groups: currentGroups, error: '目标标签组不存在' };
    }

    const target = { ...currentGroups[idx] };
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        return { groups: currentGroups, error: '标签组名称不能为空' };
      }
      target.name = trimmed;
    }

    if (data.tags !== undefined) {
      target.tags = Array.from(
        new Set(data.tags.map(t => this.cleanTag(t)).filter(Boolean)),
      );
    }

    if (data.color !== undefined) target.color = data.color;
    if (data.icon !== undefined) target.icon = data.icon;
    target.updatedAt = Date.now();

    const next = [...currentGroups];
    next[idx] = target;

    return { groups: next, updatedGroup: target };
  }

  /**
   * 删除标签组
   */
  public static deleteGroup(currentGroups: ITagGroup[], groupId: string): ITagGroup[] {
    return currentGroups.filter(g => g.id !== groupId);
  }

  /**
   * 重新排序标签组
   */
  public static reorderGroups(currentGroups: ITagGroup[], orderedIds: string[]): ITagGroup[] {
    const map = new Map(currentGroups.map(g => [g.id, g]));
    const result: ITagGroup[] = [];
    let order = 0;

    for (const id of orderedIds) {
      const g = map.get(id);
      if (g) {
        result.push({ ...g, sortOrder: order++ });
        map.delete(id);
      }
    }

    // 保留未在 orderedIds 中的项
    for (const g of map.values()) {
      result.push({ ...g, sortOrder: order++ });
    }

    return result;
  }

  /**
   * 获取当前思源活跃焦点上下文（当前打开的活动文档或聚焦的内容块）
   */
  public static getActiveContext(): { docId?: string; docTitle?: string; blockId?: string } {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return {};
    }

    let docId: string | undefined;
    let docTitle: string | undefined;
    let blockId: string | undefined;

    // 1. 查找当前激活的 Protyle 标题区域（最准确定位文档）
    const activeWndTitle = document.querySelector('.layout__wnd--active .protyle-title[data-node-id]');
    const anyTitle = activeWndTitle || document.querySelector('.protyle:not(.fn__none) .protyle-title[data-node-id]');

    if (anyTitle) {
      docId = anyTitle.getAttribute('data-node-id') || undefined;
      const titleInput = anyTitle.querySelector('.protyle-title__input');
      docTitle = titleInput?.textContent?.trim() || anyTitle.textContent?.trim() || undefined;
    }

    // 2. 若未从 title 取得，尝试从 wysiwyg 容器属性获取
    if (!docId) {
      const activeWysiwyg = document.querySelector('.layout__wnd--active .protyle-wysiwyg[data-doc-type]') ||
        document.querySelector('.protyle-wysiwyg');
      if (activeWysiwyg) {
        docId = activeWysiwyg.getAttribute('data-doc-id') || activeWysiwyg.getAttribute('data-node-id') || undefined;
      }
    }

    // 3. 检查光标选区是否有焦点落在具体块上
    const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
    if (selection && selection.rangeCount > 0) {
      const node = selection.anchorNode;
      const el = node instanceof Element ? node : node?.parentElement;
      const blockEl = el?.closest('[data-node-id]');
      if (blockEl) {
        if (!docId) {
          const protyle = blockEl.closest('.protyle');
          const titleInProtyle = protyle?.querySelector('.protyle-title[data-node-id]');
          if (titleInProtyle) {
            docId = titleInProtyle.getAttribute('data-node-id') || undefined;
            const titleInput = titleInProtyle.querySelector('.protyle-title__input');
            docTitle = titleInput?.textContent?.trim() || titleInProtyle.textContent?.trim() || undefined;
          } else {
            const wysiwyg = protyle?.querySelector('.protyle-wysiwyg');
            docId = wysiwyg?.getAttribute('data-doc-id') || wysiwyg?.getAttribute('data-node-id') || undefined;
          }
        }

        const id = blockEl.getAttribute('data-node-id');
        // 如果不是整篇文档的根块，则记录为当前块 ID
        if (id && id !== docId) {
          blockId = id;
        }
      }
    }

    return { docId, docTitle, blockId };
  }

  /**
   * 将标签组的标签应用到文档（通过思源原生 IAL tags 属性，去重且不污染正文）
   */
  public static async applyGroupToDoc(
    docId: string,
    tags: string[],
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!docId) {
      return { success: false, error: '文档 ID 不能为空' };
    }
    if (!tags || tags.length === 0) {
      return { success: false, error: '待打标签列表不能为空' };
    }

    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    try {
      const attrsRes = await post('/api/attr/getBlockAttrs', { id: docId });
      const currentTags = attrsRes?.data?.tags || '';
      const newTagsStr = TagBatchService.appendDocTags(currentTags, tags);

      await post('/api/attr/setBlockAttrs', {
        id: docId,
        attrs: { tags: newTagsStr },
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * 将标签组的标签应用到具体块（在块正文末尾追加 #tag#）
   */
  public static async applyGroupToBlock(
    blockId: string,
    tags: string[],
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!blockId) {
      return { success: false, error: '块 ID 不能为空' };
    }
    if (!tags || tags.length === 0) {
      return { success: false, error: '待打标签列表不能为空' };
    }

    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    try {
      const mdRes = await post('/api/block/getBlockKramdown', { id: blockId });
      const currentMd = mdRes?.data?.kramdown || '';
      let updatedMd = currentMd;

      for (const t of tags) {
        updatedMd = TagBatchService.appendMarkdownTag(updatedMd, t);
      }

      await post('/api/block/updateBlock', {
        id: blockId,
        dataType: 'markdown',
        data: updatedMd,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }
}
