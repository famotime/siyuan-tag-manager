/**
 * 8 组精调双主题自适应标签色盘 (Dual-Theme Palette with WCAG AA+)
 * 严格遵从文档《04-ui-ux-design-specification-and-optimization-plan.md》第 4.2 节
 */

export interface IColorPreset {
  id: string;
  name: string;
  // 亮色模式配方
  lightBg: string;
  lightText: string;
  lightBorder: string;
  // 暗色模式配方 (避免白炽眩光，确保对比度达到 WCAG AA 4.5:1+)
  darkBg: string;
  darkText: string;
  darkBorder: string;
}

export const DUAL_THEME_COLOR_PRESETS: IColorPreset[] = [
  {
    id: 'tech-blue',
    name: '经典蓝',
    lightBg: '#EBF3FE',
    lightText: '#1A56DB',
    lightBorder: 'rgba(26, 86, 219, 0.15)',
    darkBg: 'rgba(26, 86, 219, 0.22)',
    darkText: '#8EB0FD',
    darkBorder: 'rgba(142, 176, 253, 0.25)',
  },
  {
    id: 'emerald',
    name: '护眼翡绿',
    lightBg: '#E8F7F0',
    lightText: '#0E6E45',
    lightBorder: 'rgba(14, 110, 69, 0.15)',
    darkBg: 'rgba(16, 185, 129, 0.20)',
    darkText: '#6EE7B7',
    darkBorder: 'rgba(110, 231, 183, 0.25)',
  },
  {
    id: 'amber-gold',
    name: '琥珀金橙',
    lightBg: '#FEF3E6',
    lightText: '#B45309',
    lightBorder: 'rgba(180, 83, 9, 0.15)',
    darkBg: 'rgba(245, 158, 11, 0.20)',
    darkText: '#FCD34D',
    darkBorder: 'rgba(252, 211, 77, 0.25)',
  },
  {
    id: 'coral-rose',
    name: '绯红珊瑚',
    lightBg: '#FEEBEB',
    lightText: '#C5221F',
    lightBorder: 'rgba(197, 34, 31, 0.15)',
    darkBg: 'rgba(239, 68, 68, 0.22)',
    darkText: '#FCA5A5',
    darkBorder: 'rgba(252, 165, 165, 0.25)',
  },
  {
    id: 'violet',
    name: '优雅紫罗兰',
    lightBg: '#F3ECFE',
    lightText: '#6929C4',
    lightBorder: 'rgba(105, 41, 196, 0.15)',
    darkBg: 'rgba(139, 92, 246, 0.22)',
    darkText: '#C4B5FD',
    darkBorder: 'rgba(196, 181, 253, 0.25)',
  },
  {
    id: 'cyan-aqua',
    name: '青碧浅湖',
    lightBg: '#E3F8FA',
    lightText: '#006E7F',
    lightBorder: 'rgba(0, 110, 127, 0.15)',
    darkBg: 'rgba(6, 182, 212, 0.20)',
    darkText: '#67E8F9',
    darkBorder: 'rgba(103, 232, 249, 0.25)',
  },
  {
    id: 'rose-berry',
    name: '暖粉玛瑙',
    lightBg: '#FDF0F5',
    lightText: '#9F1853',
    lightBorder: 'rgba(159, 24, 83, 0.15)',
    darkBg: 'rgba(244, 63, 94, 0.20)',
    darkText: '#FDA4AF',
    darkBorder: 'rgba(253, 164, 175, 0.25)',
  },
  {
    id: 'slate-grey',
    name: '雅致中性灰',
    lightBg: '#F1F3F5',
    lightText: '#495057',
    lightBorder: 'rgba(73, 80, 87, 0.15)',
    darkBg: 'rgba(148, 163, 184, 0.20)',
    darkText: '#CBD5E1',
    darkBorder: 'rgba(203, 213, 225, 0.25)',
  },
];
