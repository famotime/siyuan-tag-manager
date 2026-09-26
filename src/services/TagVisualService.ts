import type { ITagMetadata } from '../types/tag';

/**
 * 标签视觉系统与 CSS 样式注入服务
 */
export class TagVisualService {
  private static readonly STYLE_ELEMENT_ID = 'siyuan-tag-styler';

  /**
   * 根据标签元数据列表生成动态 CSS 规则
   */
  public static generateCssRules(metadataList: ITagMetadata[]): string {
    const rules: string[] = [];

    for (const meta of metadataList) {
      if (!meta.label) continue;
      const cleanLabel = meta.label.trim();
      const styleDeclarations: string[] = [];

      if (meta.backgroundColor) {
        styleDeclarations.push(`background-color: ${meta.backgroundColor} !important;`);
      }
      if (meta.textColor) {
        styleDeclarations.push(`color: ${meta.textColor} !important;`);
      }

      // 如果有任何颜色修饰，统一加轻量美化样式
      if (styleDeclarations.length > 0) {
        styleDeclarations.push('border-radius: 4px;');
        styleDeclarations.push('padding: 1px 6px;');
        styleDeclarations.push('transition: all 0.2s ease;');

        // 支持通过 content 属性或 data-content 属性匹配
        // 思源在编辑器中生成带有 span[data-type~="tag"] 的元素
        const selector = `span[data-type~="tag"][data-content="${cleanLabel}"], `
          + `.protyle-wysiwyg span[data-type~="tag"]:has-text("#${cleanLabel}#"), `
          + `.b3-list-item[data-label="${cleanLabel}"] .b3-list-item__text`;

        rules.push(`${selector} { ${styleDeclarations.join(' ')} }`);
      }

      // 如果配置了自定义 Emoji/图标
      if (meta.icon) {
        const iconSelector = `span[data-type~="tag"][data-content="${cleanLabel}"]::before, `
          + `.protyle-wysiwyg span[data-type~="tag"]:has-text("#${cleanLabel}#")::before`;
        rules.push(`${iconSelector} { content: "${meta.icon} "; font-size: 0.9em; margin-right: 2px; }`);
      }
    }

    return rules.join('\n');
  }

  /**
   * 将生成的 CSS 规则安全注入到思源主界面中
   */
  public static applyStyles(css: string): void {
    if (typeof document === 'undefined') return;

    let styleEl = document.getElementById(this.STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = this.STYLE_ELEMENT_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  /**
   * 移除注入的动态样式
   */
  public static removeStyles(): void {
    if (typeof document === 'undefined') return;
    const styleEl = document.getElementById(this.STYLE_ELEMENT_ID);
    if (styleEl) {
      styleEl.remove();
    }
  }
}
