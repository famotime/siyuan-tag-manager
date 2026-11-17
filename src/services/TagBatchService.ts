import { TagGovernanceService } from './TagGovernanceService';
import { TagApiClient } from './TagApiClient';
import { showMessage } from 'siyuan';
import { parseIalTags, escapeSqlLiteral } from '../utils/tagText';

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
   * @param requestFn 可注入传输函数，契约为“code!=0 抛错、成功返回解包后的 data”（与 TagApiClient.request 一致）
   */
  public static async batchTagDocuments(
    docIds: string[],
    tagsToAdd: string[],
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    // 默认传输统一走 TagApiClient.request（含鉴权头、code 校验与解包，失败不再被误计为成功）
    const post = requestFn || ((url: string, data: any) => TagApiClient.request(url, data));

    let updatedCount = 0;
    const errors: string[] = [];

    for (const id of docIds) {
      try {
        // 1. 获取当前文档的属性
        const attrsRes = await post('/api/attr/getBlockAttrs', { id });
        const currentTags = attrsRes?.tags || '';
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
   * 批量打标统一执行链路（校验 + 服务调用 + 用户提示）
   * 由侧栏内嵌弹窗（App.vue）与独立弹窗（batchTagModalManager）共用，
   * 消除两处逐字重复的校验、调用与文案逻辑
   *
   * @returns 是否执行成功（供宿主决定关闭弹窗与刷新数据）
   */
  public static async executeBatchTagging(
    docIds: string[],
    tags: string[],
    setExecuting: (executing: boolean) => void,
  ): Promise<boolean> {
    if (docIds.length === 0 || tags.length === 0) {
      showMessage('目标文档与待添加标签均不能为空', 3000, 'error');
      return false;
    }

    setExecuting(true);
    try {
      const res = await this.batchTagDocuments(docIds, tags);
      if (res.success) {
        showMessage(`成功为 ${res.updatedCount} 篇文档更新标签`, 3000, 'info');
        return true;
      }
      showMessage(`批量打标存在错误: ${res.errors.join('; ')}`, 5000, 'error');
      return false;
    } catch (err: any) {
      showMessage(`批量打标失败: ${err.message || err}`, 4000, 'error');
      return false;
    } finally {
      setExecuting(false);
    }
  }

  /**
   * 模糊搜索文档候选列表
   * @param requestFn 可注入传输函数，契约为“code!=0 抛错、成功返回解包后的 data”
   */
  public static async searchDocs(
    keyword: string,
    limit = 20,
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<Array<{ id: string; title: string; tags: string[] }>> {
    const post = requestFn || ((url: string, data: any) => TagApiClient.request(url, data));

    const clean = escapeSqlLiteral(keyword).trim();
    if (!clean) return [];

    const sql = `SELECT id, content, ial FROM blocks WHERE type = 'd' AND content LIKE '%${clean}%' ORDER BY updated DESC LIMIT ${limit};`;
    try {
      const rows = await post('/api/query/sql', { stmt: sql });
      return (rows || []).map((r: any) => {
        let tags: string[] = [];
        const tagsAttr = parseIalTags(r.ial);
        if (tagsAttr) {
          tags = this.parseDocTags(tagsAttr);
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
   * @param requestFn 可注入传输函数，契约为“code!=0 抛错、成功返回解包后的 data”
   */
  public static async getNotebookDocs(
    notebookId: string,
    limit = 50,
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<Array<{ id: string; title: string; tags: string[] }>> {
    const post = requestFn || ((url: string, data: any) => TagApiClient.request(url, data));

    const clean = escapeSqlLiteral(notebookId).trim();
    if (!clean) return [];

    const sql = `SELECT id, content, ial FROM blocks WHERE type = 'd' AND box = '${clean}' ORDER BY updated DESC LIMIT ${limit};`;
    try {
      const rows = await post('/api/query/sql', { stmt: sql });
      return (rows || []).map((r: any) => {
        let tags: string[] = [];
        const tagsAttr = parseIalTags(r.ial);
        if (tagsAttr) {
          tags = this.parseDocTags(tagsAttr);
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
   * @param requestFn 可注入传输函数，契约为“code!=0 抛错、成功返回解包后的 data”
   */
  public static async fetchNotebooks(
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<Array<{ id: string; name: string }>> {
    const post = requestFn || ((url: string, data: any) => TagApiClient.request(url, data));

    try {
      const res = await post('/api/notebook/lsNotebooks', {});
      const list = res?.notebooks || [];
      return list.map((nb: any) => ({
        id: nb.id,
        name: nb.name,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 构造获取后代子文档的 SQL 语句
   */
  public static buildSubDocsQuery(parentRows: Array<{ id?: string; box?: string; path?: string }>): string {
    const conditions: string[] = [];
    for (const row of parentRows) {
      if (!row || !row.box || !row.path) continue;
      const prefix = `${row.path.replace(/\.sy$/i, '')}/`;
      const cleanBox = escapeSqlLiteral(String(row.box));
      const cleanPrefix = escapeSqlLiteral(prefix);
      conditions.push(`(box = '${cleanBox}' AND path LIKE '${cleanPrefix}%')`);
    }

    if (conditions.length === 0) return '';
    return `SELECT id, content, path FROM blocks WHERE type = 'd' AND (${conditions.join(' OR ')}) ORDER BY path ASC LIMIT 9999;`;
  }

  /**
   * 递归检索指定文档名下的所有层级子文档
   * @param requestFn 可注入传输函数，契约为“code!=0 抛错、成功返回解包后的 data”
   */
  public static async getSubDocs(
    parentDocIds: string[],
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<Array<{ id: string; title: string }>> {
    const post = requestFn || (async (url: string, data: any) => {
      if (typeof window === 'undefined' && !url.startsWith('http')) {
        return [];
      }
      return TagApiClient.request(url, data);
    });

    const validIds = Array.from(new Set(parentDocIds.map(id => id?.trim()).filter(Boolean)));
    if (validIds.length === 0) return [];

    try {
      // 1. 查询父文档的物理路径与所属笔记本
      const inClause = validIds.map(id => `'${escapeSqlLiteral(id)}'`).join(', ');
      const parentSql = `SELECT id, box, path, content FROM blocks WHERE type = 'd' AND id IN (${inClause});`;
      const parentRows = await post('/api/query/sql', { stmt: parentSql });
      if (!parentRows || parentRows.length === 0) return [];

      // 2. 构造后代子文档 SQL 检索语句
      const subSql = this.buildSubDocsQuery(parentRows);
      if (!subSql) return [];

      // 3. 执行子文档检索
      const subRows = await post('/api/query/sql', { stmt: subSql });

      // 4. 排除已选中的父文档自身，并去重
      const parentIdSet = new Set(validIds);
      const seenIds = new Set<string>();
      const result: Array<{ id: string; title: string }> = [];

      for (const r of subRows) {
        if (!r.id || parentIdSet.has(r.id) || seenIds.has(r.id)) continue;
        seenIds.add(r.id);
        result.push({
          id: r.id,
          title: r.content || '未命名文档',
        });
      }

      return result;
    } catch (e) {
      console.warn('[siyuan-tag-manager] getSubDocs failed:', e);
      return [];
    }
  }
}

