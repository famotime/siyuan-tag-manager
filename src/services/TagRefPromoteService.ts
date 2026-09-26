import type { ITagItem } from '../types/tag';
import { TagBatchService } from './TagBatchService';
import { TagGovernanceService } from './TagGovernanceService';

export interface IRefMatchedTag {
  tag: string;
  refContent: string;
  reason: 'explicit_anchor' | 'target_doc_title';
}

export interface IRefToTagCandidate {
  docId: string;
  docTitle: string;
  matchedTags: IRefMatchedTag[];
  selected: boolean;
}

export class TagRefPromoteService {
  /**
   * 构建全库标签快速检索索引（支持完整路径与叶子节点宽容匹配）
   */
  public static buildTagIndexes(allTags: ITagItem[]): {
    exactMap: Map<string, string>;
    leafMap: Map<string, string[]>;
  } {
    const exactMap = new Map<string, string>();
    const leafMap = new Map<string, string[]>();

    for (const t of allTags) {
      const clean = TagGovernanceService.normalizeLabel(t.label);
      if (!clean) continue;

      const lower = clean.toLowerCase();
      exactMap.set(lower, clean);

      // 叶子节点名称（例如 tech/Vue 的叶子是 Vue）
      const parts = clean.split('/');
      const leaf = parts[parts.length - 1];
      if (leaf) {
        const leafLower = leaf.toLowerCase();
        const list = leafMap.get(leafLower) || [];
        if (!list.includes(clean)) {
          list.push(clean);
        }
        leafMap.set(leafLower, list);
      }
    }

    return { exactMap, leafMap };
  }

  /**
   * 从原始查询行中提取与现有标签库匹配的候选文档
   */
  public static processQueryRows(
    rows: any[],
    allTags: ITagItem[],
  ): IRefToTagCandidate[] {
    const { exactMap, leafMap } = this.buildTagIndexes(allTags);
    const candidateMap = new Map<string, IRefToTagCandidate>();

    for (const row of rows) {
      const docId = row.doc_id;
      if (!docId) continue;

      const docTitle = row.doc_title || '未命名文档';
      let rawTags = row.doc_ial || '';
      const match = String(rawTags).match(/tags="([^"]+)"/);
      if (match && match[1]) {
        rawTags = match[1];
      }
      const docExistingTags = new Set(
        TagBatchService.parseDocTags(rawTags).map(t => t.toLowerCase()),
      );

      // 提取引用中的候选词
      const terms: Array<{ text: string; reason: 'explicit_anchor' | 'target_doc_title' }> = [];
      if (row.ref_content) {
        terms.push({ text: String(row.ref_content).trim(), reason: 'explicit_anchor' });
      }
      if (row.def_content && row.def_content !== row.ref_content) {
        terms.push({ text: String(row.def_content).trim(), reason: 'target_doc_title' });
      }

      for (const { text, reason } of terms) {
        if (!text) continue;
        const textLower = text.toLowerCase();

        // 1. 精确匹配完整标签路径
        const exactTag = exactMap.get(textLower);
        if (exactTag && !docExistingTags.has(exactTag.toLowerCase())) {
          this.addMatchToCandidateMap(candidateMap, docId, docTitle, {
            tag: exactTag,
            refContent: text,
            reason,
          });
        }

        // 2. 宽容匹配末级叶子节点名称 (如引用了 "Vue", 匹配现有 "frontend/Vue")
        const leafTags = leafMap.get(textLower);
        if (leafTags && leafTags.length > 0) {
          for (const lTag of leafTags) {
            if (!docExistingTags.has(lTag.toLowerCase())) {
              this.addMatchToCandidateMap(candidateMap, docId, docTitle, {
                tag: lTag,
                refContent: text,
                reason,
              });
            }
          }
        }
      }
    }

    return Array.from(candidateMap.values());
  }

  private static addMatchToCandidateMap(
    candidateMap: Map<string, IRefToTagCandidate>,
    docId: string,
    docTitle: string,
    match: IRefMatchedTag,
  ) {
    let candidate = candidateMap.get(docId);
    if (!candidate) {
      candidate = {
        docId,
        docTitle,
        matchedTags: [],
        selected: true,
      };
      candidateMap.set(docId, candidate);
    }

    // 避免重复推荐相同标签给同一文档
    if (!candidate.matchedTags.some(m => m.tag === match.tag)) {
      candidate.matchedTags.push(match);
    }
  }

  /**
   * 全库或指定笔记本扫描同名引用候选
   */
  public static async scanRefsToTags(
    allTags: ITagItem[],
    options?: { notebookId?: string; limit?: number },
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<IRefToTagCandidate[]> {
    if (!allTags || allTags.length === 0) return [];

    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    const limit = options?.limit || 200;
    let whereClause = "WHERE (r.content != '' OR b_def.content != '')";
    if (options?.notebookId) {
      const cleanNb = options.notebookId.replace(/'/g, "''");
      whereClause += ` AND b_doc.box = '${cleanNb}'`;
    }

    const sql = `SELECT `
      + `r.root_id as doc_id, `
      + `b_doc.content as doc_title, `
      + `b_doc.ial as doc_ial, `
      + `r.content as ref_content, `
      + `b_def.content as def_content `
      + `FROM refs r `
      + `JOIN blocks b_doc ON r.root_id = b_doc.id AND b_doc.type = 'd' `
      + `LEFT JOIN blocks b_def ON r.def_block_id = b_def.id `
      + `${whereClause} `
      + `ORDER BY b_doc.updated DESC `
      + `LIMIT ${limit};`;

    try {
      const res = await post('/api/query/sql', { stmt: sql });
      const rows = res?.data || (Array.isArray(res) ? res : []);
      return this.processQueryRows(rows, allTags);
    } catch {
      return [];
    }
  }

  /**
   * 诊断指定单篇文档中的同名引用候选
   */
  public static async diagnoseSingleDocRefs(
    docId: string,
    allTags: ITagItem[],
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<IRefToTagCandidate | null> {
    if (!docId || !allTags || allTags.length === 0) return null;

    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    const cleanId = docId.replace(/'/g, "''");
    const sql = `SELECT `
      + `r.root_id as doc_id, `
      + `b_doc.content as doc_title, `
      + `b_doc.ial as doc_ial, `
      + `r.content as ref_content, `
      + `b_def.content as def_content `
      + `FROM refs r `
      + `JOIN blocks b_doc ON r.root_id = b_doc.id AND b_doc.type = 'd' `
      + `LEFT JOIN blocks b_def ON r.def_block_id = b_def.id `
      + `WHERE r.root_id = '${cleanId}' AND (r.content != '' OR b_def.content != '') `
      + `LIMIT 100;`;

    try {
      const res = await post('/api/query/sql', { stmt: sql });
      const rows = res?.data || (Array.isArray(res) ? res : []);
      const candidates = this.processQueryRows(rows, allTags);
      return candidates.find(c => c.docId === docId) || null;
    } catch {
      return null;
    }
  }

  /**
   * 批量将识别出的引用标签写入对应文档
   */
  public static async promoteCandidates(
    candidates: Array<{ docId: string; tags: string[] }>,
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    let updatedCount = 0;
    const errors: string[] = [];

    for (const item of candidates) {
      if (!item.docId || !item.tags || item.tags.length === 0) continue;
      try {
        const attrsRes = await post('/api/attr/getBlockAttrs', { id: item.docId });
        const currentTags = attrsRes?.data?.tags || '';
        const newTagsStr = TagBatchService.appendDocTags(currentTags, item.tags);

        await post('/api/attr/setBlockAttrs', {
          id: item.docId,
          attrs: { tags: newTagsStr },
        });
        updatedCount++;
      } catch (err: any) {
        errors.push(`为文档 ${item.docId} 打标失败: ${err.message || err}`);
      }
    }

    return {
      success: errors.length === 0,
      updatedCount,
      errors,
    };
  }
}
