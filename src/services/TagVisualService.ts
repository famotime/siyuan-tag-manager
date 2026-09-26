import type { ITagMetadata } from '../types/tag';
import { DUAL_THEME_COLOR_PRESETS } from '../styles/palette';

/**
 * 标签视觉系统与 CSS 样式注入服务
 * 严格遵循双主题自适应规范，防止暗黑模式眩光与对比度崩溃
 */
export class TagVisualService {
  private static readonly STYLE_ELEMENT_ID = 'siyuan-tag-styler';

  /**
   * 将 Hex 颜色转化为 RGB
   */
  public static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      return { r, g, b };
    }
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return { r, g, b };
    }
    return null;
  }

  /**
   * 自动推导暗黑模式下的低眩光背景与高对比文字
   */
  public static deriveDarkModeStyles(lightBgHex: string, lightTextHex: string): { darkBg: string; darkText: string } {
    const rgbBg = this.hexToRgb(lightBgHex);
    let darkBg = 'rgba(255, 255, 255, 0.12)';
    if (rgbBg) {
      // 暗黑模式下使用 22% 透明度，与深色底色自然融合，杜绝白炽眩光
      darkBg = `rgba(${rgbBg.r}, ${rgbBg.g}, ${rgbBg.b}, 0.22)`;
    }

    const rgbText = this.hexToRgb(lightTextHex);
    let darkText = '#e2e8f0';
    if (rgbText) {
      // 提升文字明度至柔和亮色，确保在深黑底上达到 WCAG AA 4.5:1+ 对比度
      const r = Math.min(255, Math.round(rgbText.r * 0.4 + 180));
      const g = Math.min(255, Math.round(rgbText.g * 0.4 + 180));
      const b = Math.min(255, Math.round(rgbText.b * 0.4 + 180));
      darkText = `rgb(${r}, ${g}, ${b})`;
    }

    return { darkBg, darkText };
  }

  /**
   * 根据标签元数据列表生成动态 CSS 规则（同时支持亮色与暗色模式自适应）
   */
  public static generateCssRules(metadataList: ITagMetadata[]): string {
    const rules: string[] = [];

    for (const meta of metadataList) {
      if (!meta.label) continue;
      const cleanLabel = meta.label.trim();
      const styleDeclarations: string[] = [];

      // 亮色/基础样式规则
      if (meta.backgroundColor) {
        styleDeclarations.push(`background-color: ${meta.backgroundColor} !important;`);
      }
      if (meta.textColor) {
        styleDeclarations.push(`color: ${meta.textColor} !important;`);
      }

      // 如果有任何颜色修饰，统一加轻量美化样式
      if (styleDeclarations.length > 0) {
        // 彻底清除思源正文原生标签的下划线边框，统一胶囊样式
        styleDeclarations.push('border-bottom: none !important;');
        styleDeclarations.push('text-decoration: none !important;');
        styleDeclarations.push('border-radius: 4px;');
        styleDeclarations.push('padding: 1px 6px;');
        styleDeclarations.push('transition: all 0.2s ease;');

        // 支持通过 data-tag / data-content 属性匹配正文标签、文档头部标签 doctag、侧面板标签树与常用组胶囊
        const escapedLabel = cleanLabel.replace(/["\\]/g, '\\$&');
        const selector = `.protyle-wysiwyg span[data-type~="tag"][data-tag="${escapedLabel}"], `
          + `span[data-type~="tag"][data-tag="${escapedLabel}"], `
          + `span[data-type~="tag"][data-content="${escapedLabel}"], `
          + `.b3-chips__doctag .b3-chip[data-tag="${escapedLabel}"], `
          + `.b3-chips__doctag .b3-chip[data-content="${escapedLabel}"], `
          + `.b3-chips .b3-chip[data-type="open-search"][data-tag="${escapedLabel}"], `
          + `.tm-node-name[data-tag="${escapedLabel}"], `
          + `.tm-group-tag-pill[data-tag="${escapedLabel}"], `
          + `.b3-list-item[data-label="${escapedLabel}"] .b3-list-item__text`;

        rules.push(`${selector} { ${styleDeclarations.join(' ')} }`);

        // 暗黑主题自适应规则注入
        const preset = meta.groupId ? DUAL_THEME_COLOR_PRESETS.find(p => p.id === meta.groupId) : undefined;
        let darkBg = meta.darkBackgroundColor;
        let darkText = meta.darkTextColor;

        if (!darkBg && preset) {
          darkBg = preset.darkBg;
          darkText = preset.darkText;
        } else if (!darkBg && meta.backgroundColor && meta.textColor) {
          const derived = this.deriveDarkModeStyles(meta.backgroundColor, meta.textColor);
          darkBg = derived.darkBg;
          darkText = derived.darkText;
        }

        if (darkBg || darkText) {
          const darkDeclarations: string[] = [];
          if (darkBg) darkDeclarations.push(`background-color: ${darkBg} !important;`);
          if (darkText) darkDeclarations.push(`color: ${darkText} !important;`);
          // 暗黑模式下同样严格保障下划线消除
          darkDeclarations.push('border-bottom: none !important;');
          darkDeclarations.push('text-decoration: none !important;');

          if (darkDeclarations.length > 0) {
            const darkSelector = `[data-theme-mode="dark"] .protyle-wysiwyg span[data-type~="tag"][data-tag="${escapedLabel}"], `
              + `[data-theme-mode="dark"] span[data-type~="tag"][data-tag="${escapedLabel}"], `
              + `body.theme--dark .protyle-wysiwyg span[data-type~="tag"][data-tag="${escapedLabel}"], `
              + `body.theme--dark span[data-type~="tag"][data-tag="${escapedLabel}"], `
              + `[data-theme-mode="dark"] span[data-type~="tag"][data-content="${escapedLabel}"], `
              + `body.theme--dark span[data-type~="tag"][data-content="${escapedLabel}"], `
              + `[data-theme-mode="dark"] .b3-chips__doctag .b3-chip[data-tag="${escapedLabel}"], `
              + `body.theme--dark .b3-chips__doctag .b3-chip[data-tag="${escapedLabel}"], `
              + `[data-theme-mode="dark"] .b3-chips .b3-chip[data-type="open-search"][data-tag="${escapedLabel}"], `
              + `body.theme--dark .b3-chips .b3-chip[data-type="open-search"][data-tag="${escapedLabel}"], `
              + `[data-theme-mode="dark"] .tm-node-name[data-tag="${escapedLabel}"], `
              + `body.theme--dark .tm-node-name[data-tag="${escapedLabel}"], `
              + `[data-theme-mode="dark"] .tm-group-tag-pill[data-tag="${escapedLabel}"], `
              + `body.theme--dark .tm-group-tag-pill[data-tag="${escapedLabel}"], `
              + `[data-theme-mode="dark"] .b3-list-item[data-label="${escapedLabel}"] .b3-list-item__text, `
              + `body.theme--dark .b3-list-item[data-label="${escapedLabel}"] .b3-list-item__text`;
            rules.push(`${darkSelector} { ${darkDeclarations.join(' ')} }`);
          }
        }

        // 文档标签关闭图标协同优化
        const closeBtnSelector = `.b3-chips__doctag .b3-chip[data-tag="${escapedLabel}"] svg.b3-chip__close, `
          + `.b3-chips .b3-chip[data-type="open-search"][data-tag="${escapedLabel}"] svg.b3-chip__close`;
        rules.push(`${closeBtnSelector} { color: inherit !important; opacity: 0.75; }`);
      }

      // 如果配置了自定义 Emoji/图标
      if (meta.icon) {
        const escapedLabel = cleanLabel.replace(/["\\]/g, '\\$&');
        const iconSelector = `.protyle-wysiwyg span[data-type~="tag"][data-tag="${escapedLabel}"]::before, `
          + `span[data-type~="tag"][data-tag="${escapedLabel}"]::before, `
          + `span[data-type~="tag"][data-content="${escapedLabel}"]::before, `
          + `.b3-chips__doctag .b3-chip[data-tag="${escapedLabel}"]::before, `
          + `.b3-chips__doctag .b3-chip[data-content="${escapedLabel}"]::before, `
          + `.b3-chips .b3-chip[data-type="open-search"][data-tag="${escapedLabel}"]::before, `
          + `.tm-group-tag-pill[data-tag="${escapedLabel}"]::before`;
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
