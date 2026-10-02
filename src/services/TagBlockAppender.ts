import { TagApiClient } from './TagApiClient';

/**
 * 块尾部标签追加打标服务
 * 
 * 核心规范：
 * 1. 严格追加至当前段落块的最末尾；
 * 2. 规范化前置空格间隔，确保标签解析与排版整洁；
 * 3. 兼容 Protyle 实例实时事务与内核 updateBlock 降级。
 */
export class TagBlockAppender {
  /**
   * 将标签规范追加至 Markdown 文本尾部
   */
  public static appendTagToMarkdown(markdown: string, tag: string): string {
    const cleanTag = tag.replace(/^#+|#+$/g, '').trim();
    if (!cleanTag) return markdown;

    const trimmed = markdown.trim();
    if (!trimmed) {
      return `#${cleanTag}#`;
    }

    if (markdown.endsWith(' ')) {
      return `${markdown}#${cleanTag}#`;
    }
    return `${markdown} #${cleanTag}#`;
  }

  /**
   * 将伴生标签追加至指定块末尾
   */
  public static async applyTagToBlockEnd(
    blockId: string,
    tag: string,
    client: typeof TagApiClient = TagApiClient,
    protyle?: any,
  ): Promise<boolean> {
    if (!blockId || !tag) return false;
    const cleanTag = tag.replace(/^#+|#+$/g, '').trim();
    if (!cleanTag) return false;

    // 若当前具有 Protyle 实例且提供 insert 接口，优先使用前端事务以保证 undo/redo 体验
    if (protyle && typeof protyle.insert === 'function') {
      try {
        protyle.insert(` #${cleanTag}# `, false, false);
        return true;
      } catch {
        // 出现异常时平滑降级至 HTTP/SQL 接口
      }
    }

    try {
      const md = await client.getBlockMarkdown(blockId);
      const updatedMd = TagBlockAppender.appendTagToMarkdown(md, cleanTag);
      if (updatedMd !== md) {
        await client.updateBlock(blockId, updatedMd);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
