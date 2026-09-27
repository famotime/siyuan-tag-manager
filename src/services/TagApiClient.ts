import { TagFilterEngine } from './TagFilterEngine';
import { TagCooccurrenceService } from './TagCooccurrenceService';
import type { ITagItem, ITagMatchedBlock, ITagMergePlan, ITagCombination } from '../types/tag';

export interface IQueryBlockOptions {
  includeTags?: string[];
  excludeTags?: string[];
  optionalTags?: string[];
  notebookIds?: string[];
  limit?: number;
  offset?: number;
}

/**
 * 思源笔记内核 API 交互与适配客户端
 * 统一网络通信、鉴权头注入、错误捕获与降级逻辑
 */
export class TagApiClient {
  /**
   * 基础 POST 请求封装
   */
  private static async request<T = any>(url: string, data: any): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
      headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(json.msg || `Request failed with code ${json.code}`);
    }
    return json.data;
  }

  /**
   * 获取全库所有标签（基于 SQL 高性能聚合，失败时平滑降级至 getTag 接口）
   */
  public static async fetchAllTags(): Promise<ITagItem[]> {
    const sql = `SELECT s.content as label, count(DISTINCT b.id) as block_count, count(DISTINCT b.root_id) as doc_count `
      + `FROM spans s `
      + `INNER JOIN blocks b ON s.block_id = b.id `
      + `WHERE s.type LIKE '%tag%' AND s.content != '' `
      + `GROUP BY s.content `
      + `ORDER BY block_count DESC `
      + `LIMIT 9999;`;

    try {
      const rows: Array<{ label: string; block_count?: number; doc_count?: number; count?: number }> =
        await this.request('/api/query/sql', { stmt: sql });
      return (rows || []).map(r => {
        const label = String(r.label || '');
        const parts = label.split('/');
        const blockCount = Number(r.block_count ?? r.count ?? 0);
        const docCount = Number(r.doc_count ?? blockCount);
        return {
          name: parts[parts.length - 1],
          label,
          count: blockCount,
          blockCount,
          docCount,
          depth: Math.max(0, parts.length - 1),
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
      const count = Number(t.count || 0);
      result.push({
        name: t.name || t.label,
        label: t.label,
        count,
        blockCount: count,
        docCount: count,
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
    if (!oldLabel || !newLabel) {
      throw new Error('旧标签与新标签名称均不能为空');
    }
    await this.request('/api/tag/renameTag', {
      oldLabel,
      newLabel,
    });
  }

  /**
   * 删除标签
   */
  public static async removeTag(label: string): Promise<void> {
    if (!label) {
      throw new Error('待删除的标签名称不能为空');
    }
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
    if (!plan || !plan.targetLabel || !Array.isArray(plan.sourceLabels)) {
      return {
        success: false,
        mergedCount: 0,
        errors: ['无效的合并计划配置'],
      };
    }

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
  public static async queryMatchedBlocks(options: IQueryBlockOptions): Promise<ITagMatchedBlock[]> {
    const sql = TagFilterEngine.buildQuerySql(options);
    const rows: any[] = await this.request('/api/query/sql', { stmt: sql });

    return (rows || []).map(r => {
      let content = r.content || '';
      // 若为文档级根块 (type === 'd')，且正文中未包含 #tag# 文本，从 ial 中提取 tags 属性展示
      if (r.type === 'd' && r.ial) {
        const tagMatch = String(r.ial).match(/tags="([^"]+)"/);
        if (tagMatch && tagMatch[1]) {
          const docTags = tagMatch[1].split(',').map((t: string) => `#${t.trim()}#`).join(' ');
          content = docTags ? `${content ? content + ' · ' : ''}${docTags}` : content;
        }
      }

      return {
        id: r.id,
        rootId: r.rootId,
        docTitle: r.docTitle || '未命名文档',
        content,
        markdown: r.markdown || '',
        type: r.type,
        updated: r.updated || '',
        matchedTags: [...(options.includeTags || []), ...(options.optionalTags || [])],
      };
    });
  }

  /**
   * 获取全库标签共现网络图谱数据
   */
  public static async fetchCooccurrenceGraph(): Promise<{
    graph: any;
    combinations: ITagCombination[];
    spansCount: number;
  }> {
    const sql = `SELECT s.block_id, s.content `
      + `FROM spans s `
      + `INNER JOIN blocks b ON s.block_id = b.id `
      + `WHERE s.type LIKE '%tag%' AND s.content != '' `
      + `ORDER BY s.block_id `
      + `LIMIT 9999;`;

    const rows: Array<{ block_id: string; content: string }> = await this.request('/api/query/sql', { stmt: sql });
    const blockMap = TagCooccurrenceService.groupSpansByBlock(rows || []);

    // 统计各标签总引用数（以块为粒度去重累加，与 block_count 保持一致）
    const tagCounts = new Map<string, number>();
    for (const tags of blockMap.values()) {
      for (const t of new Set(tags)) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }

    const graph = TagCooccurrenceService.buildCooccurrenceGraph(blockMap, tagCounts, 1);
    const combinations = TagCooccurrenceService.findTagCombinations(blockMap, 2, 5);

    return {
      graph,
      combinations,
      spansCount: rows?.length || 0,
    };
  }

  /**
   * 获取指定标签关联块的更新时间戳列表（用于生命周期与时序热力分析）
   */
  public static async fetchTagTimestamps(label: string): Promise<string[]> {
    if (!label) return [];
    const clean = TagFilterEngine.escapeSql(label);
    const sql = `SELECT b.updated `
      + `FROM blocks b `
      + `JOIN spans s ON b.id = s.block_id `
      + `WHERE s.type LIKE '%tag%' AND s.content = '${clean}' `
      + `ORDER BY b.updated DESC `
      + `LIMIT 9999;`;

    const rows: Array<{ updated: string }> = await this.request('/api/query/sql', { stmt: sql });
    return (rows || []).map(r => r.updated).filter(Boolean);
  }
}
