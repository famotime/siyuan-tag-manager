import { TagGovernanceService } from './TagGovernanceService';
import { TagGroupService } from './TagGroupService';
import type { ITagItem } from '../types/tag';

export interface ITagCreationContext {
  docId?: string;
  docTitle?: string;
  blockId?: string;
}

export interface ITagCreationResult {
  success: boolean;
  label: string;
  targetType: 'block' | 'doc' | 'need_select_doc';
  targetDocTitle?: string;
  error?: string;
}

export type ApiRequestFn = (url: string, data: any) => Promise<any>;

/**
 * 标签快捷创建与上下文应用服务
 * 处理标签命名清洗、合法性校验、当前上下文检测以及向思源文档/块注入新标签
 */
export class TagCreationService {
  /**
   * 清洗用户输入的待创建标签文本
   * 去除首尾空白、首尾的井号 #、多余斜杠等
   */
  public static cleanTag(input: string): string {
    if (!input) return '';
    let val = input.trim();
    // 去除开头和结尾的所有 # 符号
    val = val.replace(/^#+|#+$/g, '').trim();
    // 使用 TagGovernanceService 统一规范化斜杠
    return TagGovernanceService.normalizeLabel(val);
  }

  /**
   * 校验标签命名的有效性
   */
  public static validateTag(raw: string): { valid: boolean; error?: string; cleanLabel: string } {
    const cleanLabel = this.cleanTag(raw);
    if (!cleanLabel) {
      return { valid: false, error: '标签名称不能为空', cleanLabel: '' };
    }

    const validCheck = TagGovernanceService.isValidLabel(cleanLabel);
    if (!validCheck.valid) {
      return { valid: false, error: validCheck.error, cleanLabel };
    }

    return { valid: true, cleanLabel };
  }

  /**
   * 检查标签是否在全库中已存在完全同名的项（忽略首尾 # 与大小写匹配）
   */
  public static isTagExisting(label: string, allTags: ITagItem[]): boolean {
    const clean = this.cleanTag(label).toLowerCase();
    if (!clean || !Array.isArray(allTags)) return false;
    return allTags.some(t => t.label.toLowerCase() === clean);
  }

  /**
   * 执行创建新标签并注入到当前活动上下文（当前聚焦块或当前打开文档）
   */
  public static async createAndApplyTag(
    rawLabel: string,
    context?: ITagCreationContext,
    requestFn?: ApiRequestFn,
  ): Promise<ITagCreationResult> {
    const validation = this.validateTag(rawLabel);
    if (!validation.valid) {
      return {
        success: false,
        label: rawLabel,
        targetType: 'need_select_doc',
        error: validation.error,
      };
    }

    const label = validation.cleanLabel;
    const active = context || TagGroupService.getActiveContext();

    const post = requestFn || (async (url, data) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && (window as any).siyuan?.config?.apiToken) {
        headers.Authorization = `Token ${(window as any).siyuan.config.apiToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      return res.json();
    });

    // 1. 若光标位于具体内容块上：追加到该块末尾
    if (active.blockId) {
      const res = await TagGroupService.applyGroupToBlock(active.blockId, [label], post);
      if (res.success) {
        return {
          success: true,
          label,
          targetType: 'block',
          targetDocTitle: active.docTitle,
        };
      }
      return {
        success: false,
        label,
        targetType: 'block',
        error: res.error || '向当前块插入标签失败',
      };
    }

    // 2. 若检测到当前打开的文档（无聚焦块）：
    //    优先在文档末尾追加一个标签块，同时更新文档 tags 属性，确保思源原生 spans 索引与属性双重生效
    if (active.docId) {
      try {
        // a. 在文档末尾追加包含该标签的段落块
        await post('/api/block/appendBlock', {
          parentID: active.docId,
          dataType: 'markdown',
          data: `#${label}#`,
        });

        // b. 同步为文档打上该 IAL tags 属性
        await TagGroupService.applyGroupToDoc(active.docId, [label], post).catch(() => null);

        return {
          success: true,
          label,
          targetType: 'doc',
          targetDocTitle: active.docTitle,
        };
      } catch (err: any) {
        // 若追加块失败，尝试仅打属性
        const fallbackRes = await TagGroupService.applyGroupToDoc(active.docId, [label], post);
        if (fallbackRes.success) {
          return {
            success: true,
            label,
            targetType: 'doc',
            targetDocTitle: active.docTitle,
          };
        }
        return {
          success: false,
          label,
          targetType: 'doc',
          error: err.message || fallbackRes.error || '为文档添加标签失败',
        };
      }
    }

    // 3. 既无聚焦块也无活动文档：需要用户选择目标文档打标
    return {
      success: false,
      label,
      targetType: 'need_select_doc',
      error: '未检测到当前打开的文档，需选择目标文档完成创建',
    };
  }
}
