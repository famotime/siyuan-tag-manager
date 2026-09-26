import { TagFilterEngine } from './TagFilterEngine';
import type { ITagItem, ITagMatchedBlock, ITagMergePlan } from '../types/tag';

/**
 * 思源笔记内核 API 交互与适配客户端
 */
export class TagApiClient {
  /**
   * 基础 POST 请求封装
   */
  private static async request<T = any>(url: string, data: any): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(json.msg || `Request failed with code ${json.code}`);
    }
    return json.data;
  }

  /**
   * 获取全库所有标签（基于 SQL 高性能聚合）
   */
  public static async fetchAllTags(): Promise<ITagItem[]> {
    const sql = `SELECT content as label, count(1) as count `
      + `FROM spans `
      + `WHERE type LIKE '%tag%' AND content != '' `
      + `GROUP BY content `
      + `ORDER BY count DESC;`;

    try {
      const rows: Array<{ label: string; count: number }> = await this.request('/api/query/sql', { stmt: sql });
      return (rows || []).map(r => {
        const parts = r.label.split('/');
        return {
          name: parts[parts.length - 1],
          label: r.label,
          count: Number(r.count),
          depth: parts.length - 1,
        };
      });
    } catch {
      // 降级使用 /api/tag/getTag
      const res = await this.request<any[]>('/api/tag/getTag', { sort: 8 });
      return this.flattenKernelTags(res || []);
    }
  }

  /**
   * 将思源内核返回的树形标签拍平
   */
  private static flattenKernelTags(tags: any[], depth = 0): ITagItem[] {
    const result: ITagItem[] = [];
    for (const t of tags) {
      result.push({
        name: t.name || t.label,
        label: t.label,
        count: t.count || 0,
        depth,
      });
      if (t.children && t.children.length > 0) {
        result.push(...this.flattenKernelTags(t.children, depth + 1));
      }
    }
    return result;
  }

  /**
   * 重命名标签
   */
  public static async renameTag(oldLabel: string, newLabel: string): Promise<void> {
    await this.request('/api/tag/renameTag', {
      oldLabel,
      newLabel,
    });
  }

  /**
   * 删除标签
   */
  public static async removeTag(label: string): Promise<void> {
    await this.request('/api/tag/removeTag', {
      label,
    });
  }

  /**
   * 执行标签合并操作
   * 将 plan 中的源标签依次重命名为目标标签，内核自动完成去重与合并
   */
  public static async executeMergePlan(
    plan: ITagMergePlan,
    onProgress?: (current: number, total: number, currentLabel: string) => void,
  ): Promise<{ success: boolean; mergedCount: number; errors: string[] }> {
    const total = plan.sourceLabels.length;
    let mergedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < total; i++) {
      const src = plan.sourceLabels[i];
      if (onProgress) {
        onProgress(i + 1, total, src);
      }
      try {
        await this.renameTag(src, plan.targetLabel);
        mergedCount++;
      } catch (err: any) {
        errors.push(`合并 "${src}" 到 "${plan.targetLabel}" 失败: ${err.message || err}`);
      }
    }

    return {
      success: errors.length === 0,
      mergedCount,
      errors,
    };
  }

  /**
   * 执行多维布尔筛选查询，获取命中的块列表
   */
  public static async queryMatchedBlocks(options: {
    includeTags?: string[];
    excludeTags?: string[];
    optionalTags?: string[];
    notebookIds?: string[];
    limit?: number;
    offset?: number;
  }): Promise<ITagMatchedBlock[]> {
    const sql = TagFilterEngine.buildQuerySql(options);
    const rows: any[] = await this.request('/api/query/sql', { stmt: sql });

    return (rows || []).map(r => ({
      id: r.id,
      rootId: r.rootId,
      docTitle: r.docTitle || '未命名文档',
      content: r.content || '',
      markdown: r.markdown || '',
      type: r.type,
      updated: r.updated || '',
      matchedTags: options.includeTags || [],
    }));
  }
}
