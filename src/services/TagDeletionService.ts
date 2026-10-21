import { TagApiClient } from './TagApiClient';
import { TagFilterEngine } from './TagFilterEngine';
import type { ITagDeleteConfig, ITagDeleteResult } from '../types/tag';
import { DEFAULT_TAG_DELETE_CONFIG } from '../types/tag';

/**
 * 标签删除与格式化清洗领域服务
 * 
 * 核心特性：
 * 1. 严格支持段落内标签剥离“#”保持文字、用指定字符替代“#”及彻底删除三种模式；
 * 2. 区分正文块（非文档级）与文档根块（文档级标签属性）；
 * 3. 容错处理：批量更新时异常块跳过并汇总记录，保障全库数据安全。
 */
export class TagDeletionService {
  /**
   * 转义正则表达式特殊字符
   */
  public static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 获取删除模式的可读提示描述
   */
  public static getDeleteModeDescription(config: ITagDeleteConfig): string {
    const mode = config?.mode || DEFAULT_TAG_DELETE_CONFIG.mode;
    if (mode === 'remove_all') {
      return '彻底删除#及标签文字';
    }
    if (mode === 'replace_hash') {
      const rep = config.replaceWith || '';
      return rep ? `用"${rep}"替代#` : '保留文字并剥离#';
    }
    return '保留文字并剥离#';
  }

  /**
   * 将 Markdown 文本中指定的精确标签按删除策略进行格式化转换
   * 
   * @param markdown 原始块 Markdown 文本
   * @param label 待删除的纯标签名称（无前后 #）
   * @param config 删除偏好配置
   */
  public static formatMarkdownForTagDeletion(
    markdown: string,
    label: string,
    config: ITagDeleteConfig,
  ): string {
    if (!markdown || !label) {
      return markdown;
    }

    const cleanLabel = label.replace(/^#+|#+$/g, '').trim();
    if (!cleanLabel) {
      return markdown;
    }

    // 精准匹配思源行内标签格式：#label#，避免误伤包含子路径的标签或普通文本
    const regex = new RegExp(`#${TagDeletionService.escapeRegex(cleanLabel)}#`, 'g');
    const mode = config?.mode || DEFAULT_TAG_DELETE_CONFIG.mode;

    if (mode === 'remove_all') {
      // 彻底删除模式：清除 #tag#，并适当压缩可能留下的多余连续空格
      return markdown.replace(regex, '').replace(/ {2,}/g, ' ');
    }

    if (mode === 'replace_hash') {
      const rep = config?.replaceWith !== undefined ? config.replaceWith : '';
      return markdown.replace(regex, `${rep}${cleanLabel}${rep}`);
    }

    // 默认 strip_hash 模式：剥离前后“#”，保留正文文字
    return markdown.replace(regex, cleanLabel);
  }

  /**
   * 清洗文档根块 IAL 中的 tags 属性字符串，移除指定标签
   * 
   * @param existingTagsAttr 逗号分隔的现有标签字符串，如 "tech,vue,note"
   * @param label 待移除的标签
   */
  public static cleanDocTagsAttr(existingTagsAttr: string, label: string): string {
    if (!existingTagsAttr || !label) {
      return '';
    }
    const cleanLabel = label.replace(/^#+|#+$/g, '').trim();
    const tags = existingTagsAttr
      .split(',')
      .map(t => t.trim())
      .filter(t => Boolean(t) && t !== cleanLabel);

    return tags.join(',');
  }

  /**
   * 执行标签删除操作，协调非文档级正文块与文档级属性更新
   * 
   * @param label 待删除的标签名称
   * @param config 标签删除策略配置
   * @param client API 通信客户端（支持测试注入）
   */
  public static async executeDeleteTag(
    label: string,
    config: ITagDeleteConfig,
    client: typeof TagApiClient = TagApiClient,
  ): Promise<ITagDeleteResult> {
    if (!label) {
      return { success: false, affectedBlocks: 0, errors: ['待删除的标签名不能为空'] };
    }

    const cleanLabel = label.replace(/^#+|#+$/g, '').trim();
    const mode = config?.mode || DEFAULT_TAG_DELETE_CONFIG.mode;

    // 若配置为彻底删除模式，直接委托给内核原生 removeTag 接口
    if (mode === 'remove_all') {
      try {
        await client.removeTag(cleanLabel);
        return { success: true, affectedBlocks: 1, errors: [] };
      } catch (err: any) {
        return { success: false, affectedBlocks: 0, errors: [`调用内核删除失败: ${err.message || err}`] };
      }
    }

    // 针对 strip_hash 与 replace_hash 模式：分别处理正文块与文档级标签
    const errors: string[] = [];
    let affectedBlocks = 0;
    const escapedLabel = TagFilterEngine.escapeSql(cleanLabel);

    try {
      // 1. 查询全库引用该标签的非文档级正文块 (type != 'd')
      const blockQuerySql = `SELECT b.id, b.type, b.markdown `
        + `FROM spans s `
        + `INNER JOIN blocks b ON s.block_id = b.id `
        + `WHERE s.type LIKE '%tag%' AND s.content = '${escapedLabel}' AND b.type != 'd' `
        + `GROUP BY b.id;`;

      const blockRows: Array<{ id: string; type: string; markdown: string }> =
        await client.sqlQuery<{ id: string; type: string; markdown: string }>(blockQuerySql).catch(() => []);

      // 逐个更新非文档级正文块
      for (const row of blockRows) {
        try {
          let currentMd = row.markdown;
          if (!currentMd) {
            currentMd = await client.getBlockMarkdown(row.id);
          }
          const updatedMd = TagDeletionService.formatMarkdownForTagDeletion(currentMd, cleanLabel, config);
          if (updatedMd !== currentMd) {
            await client.updateBlock(row.id, updatedMd);
            affectedBlocks++;
          }
        } catch (blockErr: any) {
          errors.push(`更新正文块 [${row.id}] 失败: ${blockErr.message || blockErr}`);
        }
      }

      // 2. 查询包含该标签属性的文档根块 (type == 'd')
      const docQuerySql = `SELECT id, ial FROM blocks `
        + `WHERE type = 'd' AND ial LIKE '%tags=%${escapedLabel}%';`;

      const docRows: Array<{ id: string; ial: string }> =
        await client.sqlQuery<{ id: string; ial: string }>(docQuerySql).catch(() => []);

      for (const doc of docRows) {
        try {
          const match = (doc.ial || '').match(/tags="([^"]+)"/);
          if (match && match[1]) {
            const rawTags = match[1];
            const tagsList = rawTags.split(',').map(t => t.trim());
            if (tagsList.includes(cleanLabel)) {
              const cleanedTags = TagDeletionService.cleanDocTagsAttr(rawTags, cleanLabel);
              await client.setBlockAttrs(doc.id, { tags: cleanedTags });
              affectedBlocks++;
            }
          }
        } catch (docErr: any) {
          errors.push(`更新文档属性 [${doc.id}] 失败: ${docErr.message || docErr}`);
        }
      }

      return {
        success: errors.length === 0,
        affectedBlocks,
        errors,
      };
    } catch (err: any) {
      return {
        success: false,
        affectedBlocks,
        errors: [...errors, `删除标签全局任务异常: ${err.message || err}`],
      };
    }
  }
}
