import { TagGovernanceService } from './TagGovernanceService';
import { TagApiClient } from './TagApiClient';
import type { ITagMatchedBlock } from '../types/tag';

/**
 * 标签转实体文档（Tag to Doc）生成与转换服务
 */
export class TagDocConverterService {
  /**
   * 生成标签聚合文档的 Markdown 文本
   * @param label 标签名称
   * @param blocks 当前已关联的块记录
   */
  public static generateDocMarkdown(label: string, blocks: ITagMatchedBlock[] = []): string {
    const cleanLabel = TagGovernanceService.normalizeLabel(label);
    const now = new Date().toLocaleString('zh-CN', { hour12: false });

    const lines: string[] = [
      `# 🏷️ 主题聚合：${cleanLabel}`,
      ``,
      `> 💡 **知识资产聚合说明**：本聚合文档由 **“标签管家”** 插件于 \`${now}\` 自动生成。它将碎片化散落在各处的 \`#${cleanLabel}#\` 标签沉淀升格为实体主题知识库。`,
      ``,
      `## 🔄 实时动态聚合视图`,
      ``,
      `{{SELECT * FROM blocks WHERE id IN (SELECT block_id FROM spans WHERE type LIKE '%tag%' AND content = '${cleanLabel}') ORDER BY updated DESC}}`,
      ``,
      `## 📑 历史快照存盘（共 ${blocks.length} 处引用）`,
      ``,
    ];

    if (blocks.length === 0) {
      lines.push(`_（暂无静态引用历史记录）_`);
    } else {
      for (const b of blocks) {
        const title = b.docTitle ? `《${b.docTitle}》` : '未命名文档';
        const snippet = b.content ? b.content.replace(/\n+/g, ' ').slice(0, 100) : '块内容';
        lines.push(`* **[${title}](siyuan://blocks/${b.id})**：${snippet}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * 自动调用思源 API 创建文档
   * @param requestFn 可注入传输函数，契约为“code!=0 抛错、成功返回解包后的 data”
   */
  public static async createDocFromTag(
    label: string,
    blocks: ITagMatchedBlock[],
    requestFn?: (url: string, data: any) => Promise<any>,
  ): Promise<{ success: boolean; docId?: string; error?: string }> {
    // 默认传输统一走 TagApiClient.request（含鉴权头、code 校验与解包）
    const post = requestFn || ((url: string, data: any) => TagApiClient.request(url, data));

    try {
      // 1. 获取笔记本列表，选用第一个打开的笔记本
      const nbRes = await post('/api/notebook/lsNotebooks', {});
      const notebooks = nbRes?.notebooks || [];
      const activeNotebook = notebooks.find((n: any) => !n.closed) || notebooks[0];

      if (!activeNotebook) {
        return { success: false, error: '未找到可用的活动笔记本' };
      }

      const cleanLabel = TagGovernanceService.normalizeLabel(label);
      const docPath = `/${cleanLabel}`;
      const md = this.generateDocMarkdown(cleanLabel, blocks);

      // 2. 调用 /api/filetree/createDocWithMd 创建文档（code!=0 时由传输层抛错进入 catch）
      const docId = await post('/api/filetree/createDocWithMd', {
        notebook: activeNotebook.id,
        path: docPath,
        markdown: md,
      });

      if (docId) {
        return { success: true, docId };
      }
      return { success: false, error: '创建文档失败' };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }
}
