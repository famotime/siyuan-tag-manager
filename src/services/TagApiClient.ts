import { showMessage } from 'siyuan';
import { escapeSql } from '../utils/tagText';
import type { ITagItem, ITagMergePlan } from '../types/tag';

/** 思源 SQL 单次查询的常规行数上限，达到即提示结果可能不完整 */
const SQL_ROW_LIMIT = 9999;

/**
 * 思源笔记内核 API 交互与适配客户端
 * 统一网络通信、鉴权头注入、错误捕获与降级逻辑
 */
export class TagApiClient {
  /**
   * 基础 POST 传输（返回原始响应信封 {code, msg, data}，不做错误规范化）
   * 各领域服务的默认传输实现；注入 requestFn 的测试路径遵循同一信封契约
   */
  public static async postRaw(url: string, data: any): Promise<any> {
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

    return res.json();
  }

  /**
   * 规范化 POST 请求：code != 0 时抛出错误，成功时返回解包后的 data
   */
  public static async request<T = any>(url: string, data: any): Promise<T> {
    const json = await this.postRaw(url, data);
    if (json.code !== 0) {
      throw new Error(json.msg || `Request failed with code ${json.code}`);
    }
    return json.data;
  }

  /**
   * 执行 SQL 查询接口
   */
  public static async sqlQuery<T = any>(sql: string): Promise<T[]> {
    return this.request<T[]>('/api/query/sql', { stmt: sql });
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
      if (rows && rows.length >= SQL_ROW_LIMIT) {
        showMessage('全库标签数已达单次查询上限，全景统计可能不完整', 5000, 'info');
      }
      return (rows || []).map((r) => {
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
   * 获取指定标签关联块的更新时间戳列表（用于生命周期与时序热力分析）
   */
  public static async fetchTagTimestamps(label: string): Promise<string[]> {
    if (!label) return [];
    const clean = escapeSql(label);
    const sql = `SELECT b.updated `
      + `FROM blocks b `
      + `JOIN spans s ON b.id = s.block_id `
      + `WHERE s.type LIKE '%tag%' AND s.content = '${clean}' `
      + `ORDER BY b.updated DESC `
      + `LIMIT 9999;`;

    const rows: Array<{ updated: string }> = await this.request('/api/query/sql', { stmt: sql });
    if (rows && rows.length >= SQL_ROW_LIMIT) {
      showMessage('该标签的引用数已达单次查询上限，时序统计可能不完整', 5000, 'info');
    }
    return (rows || []).map(r => r.updated).filter(Boolean);
  }

  /**
   * 获取指定块的 Markdown 文本内容
   */
  public static async getBlockMarkdown(blockId: string): Promise<string> {
    if (!blockId) return '';
    const clean = escapeSql(blockId);
    const sql = `SELECT markdown FROM blocks WHERE id = '${clean}' LIMIT 1;`;
    const rows: any[] = await this.request('/api/query/sql', { stmt: sql });
    return rows?.[0]?.markdown || '';
  }

  /**
   * 更新指定块的内容
   */
  public static async updateBlock(blockId: string, markdown: string): Promise<void> {
    if (!blockId) {
      throw new Error('目标块 ID 不能为空');
    }
    await this.request('/api/block/updateBlock', {
      id: blockId,
      dataType: 'markdown',
      data: markdown,
    });
  }

  /**
   * 为文档根块追加标签属性
   */
  public static async addTagToDocument(docId: string, tag: string): Promise<void> {
    if (!docId || !tag) return;
    const attrsRes = await this.request('/api/attr/getBlockAttrs', { id: docId });
    const currentTags = attrsRes?.tags || '';
    const tagsArr = currentTags ? currentTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    if (!tagsArr.includes(tag)) {
      tagsArr.push(tag);
    }
    await this.request('/api/attr/setBlockAttrs', {
      id: docId,
      attrs: {
        tags: tagsArr.join(','),
      },
    });
  }

  /**
   * 设置块自定义属性
   */
  public static async setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    if (!blockId) return;
    await this.request('/api/attr/setBlockAttrs', {
      id: blockId,
      attrs,
    });
  }
}
