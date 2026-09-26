import { TagGovernanceService } from './TagGovernanceService';

/**
 * 批量打标与属性更新服务
 */
export class TagBatchService {
  /**
   * 解析文档 IAL tags 属性（逗号分隔）
   */
  public static parseDocTags(tagsAttr?: string): string[] {
    if (!tagsAttr) return [];
    return tagsAttr
      .split(',')
      .map(t => TagGovernanceService.normalizeLabel(t))
      .filter(Boolean);
  }

  /**
   * 将新标签追加到现有文档标签列表中（去重且规范化）
   */
  public static appendDocTags(currentTagsAttr: string | undefined, newTags: string[]): string {
    const existing = this.parseDocTags(currentTagsAttr);
    const existingSet = new Set(existing);

    for (const tag of newTags) {
      const clean = TagGovernanceService.normalizeLabel(tag);
      if (clean && !existingSet.has(clean)) {
        existing.push(clean);
        existingSet.add(clean);
      }
    }

    return existing.join(',');
  }

  /**
   * 从现有文档标签中移除指定标签
   */
  public static removeDocTags(currentTagsAttr: string | undefined, tagsToRemove: string[]): string {
    const existing = this.parseDocTags(currentTagsAttr);
    const removeSet = new Set(tagsToRemove.map(t => TagGovernanceService.normalizeLabel(t)));

    const remaining = existing.filter(t => !removeSet.has(t));
    return remaining.join(',');
  }

  /**
   * 向一段 Markdown 文本后部追加标签
   */
  public static appendMarkdownTag(markdown: string, tag: string): string {
    const cleanTag = TagGovernanceService.normalizeLabel(tag);
    if (!cleanTag) return markdown;

    const tagStr = `#${cleanTag}#`;
    // 若已包含该标签标记，则不重复追加
    if (markdown.includes(tagStr)) {
      return markdown;
    }

    const trimmed = markdown.trimEnd();
    return `${trimmed} ${tagStr}`;
  }

  /**
   * 批量为多个文档打标（调用思源 /api/attr/setBlockAttrs）
   */
  public static async batchTagDocuments(
    docIds: string[],
    tagsToAdd: string[],
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const post = requestFn || (async (url, data) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    });

    let updatedCount = 0;
    const errors: string[] = [];

    for (const id of docIds) {
      try {
        // 1. 获取当前文档的属性
        const attrsRes = await post('/api/attr/getBlockAttrs', { id });
        const currentTags = attrsRes?.data?.tags || '';
        const newTagsStr = this.appendDocTags(currentTags, tagsToAdd);

        // 2. 更新属性
        await post('/api/attr/setBlockAttrs', {
          id,
          attrs: {
            tags: newTagsStr,
          },
        });
        updatedCount++;
      } catch (err: any) {
        errors.push(`更新文档 ${id} 失败: ${err.message || err}`);
      }
    }

    return {
      success: errors.length === 0,
      updatedCount,
      errors,
    };
  }

  /**
   * 模糊搜索文档候选列表
   */
  public static async searchDocs(
    keyword: string,
    limit = 20,
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<Array<{ id: string; title: string; tags: string[] }>> {
    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    const clean = keyword.replace(/'/g, "''").trim();
    if (!clean) return [];

    const sql = `SELECT id, content, ial FROM blocks WHERE type = 'd' AND content LIKE '%${clean}%' ORDER BY updated DESC LIMIT ${limit};`;
    try {
      const res = await post('/api/query/sql', { stmt: sql });
      const rows = res?.data || (Array.isArray(res) ? res : []);
      return (rows || []).map((r: any) => {
        let tags: string[] = [];
        if (r.ial) {
          const match = String(r.ial).match(/tags="([^"]+)"/);
          if (match && match[1]) {
            tags = this.parseDocTags(match[1]);
          }
        }
        return {
          id: r.id,
          title: r.content || '未命名文档',
          tags,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * 获取指定笔记本下的文档列表
   */
  public static async getNotebookDocs(
    notebookId: string,
    limit = 50,
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<Array<{ id: string; title: string; tags: string[] }>> {
    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    const clean = notebookId.replace(/'/g, "''").trim();
    if (!clean) return [];

    const sql = `SELECT id, content, ial FROM blocks WHERE type = 'd' AND box = '${clean}' ORDER BY updated DESC LIMIT ${limit};`;
    try {
      const res = await post('/api/query/sql', { stmt: sql });
      const rows = res?.data || (Array.isArray(res) ? res : []);
      return (rows || []).map((r: any) => {
        let tags: string[] = [];
        if (r.ial) {
          const match = String(r.ial).match(/tags="([^"]+)"/);
          if (match && match[1]) {
            tags = this.parseDocTags(match[1]);
          }
        }
        return {
          id: r.id,
          title: r.content || '未命名文档',
          tags,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * 获取全量笔记本列表
   */
  public static async fetchNotebooks(
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<Array<{ id: string; name: string }>> {
    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    try {
      const res = await post('/api/notebook/lsNotebooks', {});
      const list = res?.data?.notebooks || [];
      return list.map((nb: any) => ({
        id: nb.id,
        name: nb.name,
      }));
    } catch {
      return [];
    }
  }
}
