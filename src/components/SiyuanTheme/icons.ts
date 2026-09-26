/**
 * 标签管家标准显式线框图标库 (24x24 viewBox, stroke-width: 1.75, fill: none)
 * 严格遵从文档《04-ui-ux-design-specification-and-optimization-plan.md》
 */

export interface IconPathData {
  paths: Array<{
    d?: string;
    cx?: number;
    cy?: number;
    r?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rx?: number;
    points?: string;
    type?: 'path' | 'circle' | 'line' | 'rect' | 'polyline' | 'polygon';
  }>;
}

export const LINE_ICONS: Record<string, IconPathData> = {
  // 品牌与标签
  'tag': {
    paths: [
      { type: 'path', d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z' },
      { type: 'line', x1: 7, y1: 7, x2: 7.01, y2: 7 },
    ],
  },
  // 批量打标
  'layers-plus': {
    paths: [
      { type: 'path', d: 'M12 2L2 7l10 5 10-5-10-5z' },
      { type: 'path', d: 'M2 17l10 5 10-5' },
      { type: 'path', d: 'M2 12l10 5 10-5' },
    ],
  },
  // 刷新全库数据
  'refresh-cw': {
    paths: [
      { type: 'polyline', points: '23 4 23 10 17 10' },
      { type: 'polyline', points: '1 20 1 14 7 14' },
      { type: 'path', d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' },
    ],
  },
  // 关闭 / 移除
  'close': {
    paths: [
      { type: 'line', x1: 18, y1: 6, x2: 6, y2: 18 },
      { type: 'line', x1: 6, y1: 6, x2: 18, y2: 18 },
    ],
  },
  // 全景树 Tab
  'folder-tree': {
    paths: [
      { type: 'path', d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' },
      { type: 'line', x1: 12, y1: 11, x2: 12, y2: 17 },
      { type: 'line', x1: 9, y1: 14, x2: 15, y2: 14 },
    ],
  },
  // 多维筛选 Tab
  'filter-funnel': {
    paths: [
      { type: 'polygon', points: '22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' },
    ],
  },
  // 认知图谱 Tab
  'git-fork-nodes': {
    paths: [
      { type: 'circle', cx: 12, cy: 18, r: 3 },
      { type: 'circle', cx: 6, cy: 6, r: 3 },
      { type: 'circle', cx: 18, cy: 6, r: 3 },
      { type: 'path', d: 'M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9' },
      { type: 'path', d: 'M12 12v3' },
    ],
  },
  // 健康治理 Tab
  'shield-check': {
    paths: [
      { type: 'path', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
      { type: 'polyline', points: '9 12 11 14 15 10' },
    ],
  },
  // 搜索 / 即时交叉筛选
  'search': {
    paths: [
      { type: 'circle', cx: 11, cy: 11, r: 8 },
      { type: 'line', x1: 21, y1: 21, x2: 16.65, y2: 16.65 },
    ],
  },
  'search-plus': {
    paths: [
      { type: 'circle', cx: 11, cy: 11, r: 8 },
      { type: 'line', x1: 21, y1: 21, x2: 16.65, y2: 16.65 },
      { type: 'line', x1: 11, y1: 8, x2: 11, y2: 14 },
      { type: 'line', x1: 8, y1: 11, x2: 14, y2: 11 },
    ],
  },
  // 调色板
  'palette': {
    paths: [
      { type: 'path', d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.97-4.48-9-10-9z' },
      { type: 'circle', cx: 6.5, cy: 11.5, r: 1.5 },
      { type: 'circle', cx: 9.5, cy: 7.5, r: 1.5 },
      { type: 'circle', cx: 14.5, cy: 7.5, r: 1.5 },
      { type: 'circle', cx: 17.5, cy: 11.5, r: 1.5 },
    ],
  },
  // 升格实体文档
  'file-up': {
    paths: [
      { type: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
      { type: 'polyline', points: '14 2 14 8 20 8' },
      { type: 'line', x1: 12, y1: 18, x2: 12, y2: 12 },
      { type: 'polyline', points: '9 15 12 12 15 15' },
    ],
  },
  // 文档
  'file-text': {
    paths: [
      { type: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
      { type: 'polyline', points: '14 2 14 8 20 8' },
      { type: 'line', x1: 16, y1: 13, x2: 8, y2: 13 },
      { type: 'line', x1: 16, y1: 17, x2: 8, y2: 17 },
      { type: 'polyline', points: '10 9 9 9 8 9' },
    ],
  },
  // 重构合并
  'git-merge': {
    paths: [
      { type: 'circle', cx: 18, cy: 18, r: 3 },
      { type: 'circle', cx: 6, cy: 6, r: 3 },
      { type: 'path', d: 'M6 9v12' },
      { type: 'path', d: 'M18 15v-4a9 9 0 0 0-9-9' },
    ],
  },
  // 智能视图标记
  'bookmark-star': {
    paths: [
      { type: 'path', d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' },
    ],
  },
  // 保存视图
  'save': {
    paths: [
      { type: 'path', d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' },
      { type: 'polyline', points: '17 21 17 13 7 13 7 21' },
      { type: 'polyline', points: '7 3 7 8 15 8' },
    ],
  },
  // 关联连接
  'link': {
    paths: [
      { type: 'path', d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
      { type: 'path', d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
    ],
  },
  // 趋势与生命周期
  'trending-up': {
    paths: [
      { type: 'polyline', points: '23 6 13.5 15.5 8.5 10.5 1 18' },
      { type: 'polyline', points: '17 6 23 6 23 12' },
    ],
  },
  'trending-down': {
    paths: [
      { type: 'polyline', points: '23 18 13.5 8.5 8.5 13.5 1 6' },
      { type: 'polyline', points: '17 18 23 18 23 12' },
    ],
  },
  'activity': {
    paths: [
      { type: 'polyline', points: '22 12 18 12 15 21 9 3 6 12 2 12' },
    ],
  },
  // 冲突警告与通知
  'alert-triangle': {
    paths: [
      { type: 'path', d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' },
      { type: 'line', x1: 12, y1: 9, x2: 12, y2: 13 },
      { type: 'line', x1: 12, y1: 17, x2: 12.01, y2: 17 },
    ],
  },
  'info': {
    paths: [
      { type: 'circle', cx: 12, cy: 12, r: 10 },
      { type: 'line', x1: 12, y1: 16, x2: 12, y2: 12 },
      { type: 'line', x1: 12, y1: 8, x2: 12.01, y2: 8 },
    ],
  },
  'check-circle': {
    paths: [
      { type: 'path', d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' },
      { type: 'polyline', points: '22 4 12 14.01 9 11.01' },
    ],
  },
  // 更多操作
  'more-horizontal': {
    paths: [
      { type: 'circle', cx: 12, cy: 12, r: 1.5 },
      { type: 'circle', cx: 19, cy: 12, r: 1.5 },
      { type: 'circle', cx: 5, cy: 12, r: 1.5 },
    ],
  },
  // 展开与折叠
  'chevron-right': {
    paths: [
      { type: 'polyline', points: '9 18 15 12 9 6' },
    ],
  },
  'chevron-down': {
    paths: [
      { type: 'polyline', points: '6 9 12 15 18 9' },
    ],
  },
  // 删除与跳转
  'trash': {
    paths: [
      { type: 'polyline', points: '3 6 5 6 21 6' },
      { type: 'path', d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
    ],
  },
  'external-link': {
    paths: [
      { type: 'path', d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' },
      { type: 'polyline', points: '15 3 21 3 21 9' },
      { type: 'line', x1: 10, y1: 14, x2: 21, y2: 3 },
    ],
  },
  // 排序
  'arrow-up-down': {
    paths: [
      { type: 'polyline', points: '7 10 12 15 17 10' },
    ],
  },
  'hash': {
    paths: [
      { type: 'line', x1: 4, y1: 9, x2: 20, y2: 9 },
      { type: 'line', x1: 4, y1: 15, x2: 20, y2: 15 },
      { type: 'line', x1: 10, y1: 3, x2: 8, y2: 21 },
      { type: 'line', x1: 16, y1: 3, x2: 14, y2: 21 },
    ],
  },
  // 选中勾选
  'check': {
    paths: [
      { type: 'polyline', points: '20 6 9 17 4 12' },
    ],
  },
  // 加号 / 新建
  'plus': {
    paths: [
      { type: 'line', x1: 12, y1: 5, x2: 12, y2: 19 },
      { type: 'line', x1: 5, y1: 12, x2: 19, y2: 12 },
    ],
  },
  // 编辑
  'edit': {
    paths: [
      { type: 'path', d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' },
      { type: 'path', d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
    ],
  },
  // 设置
  'settings': {
    paths: [
      { type: 'circle', cx: 12, cy: 12, r: 3 },
      { type: 'path', d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' },
    ],
  },
  // 扫描 / 诊断
  'scan': {
    paths: [
      { type: 'path', d: 'M3 7V5a2 2 0 0 1 2-2h2' },
      { type: 'path', d: 'M17 3h2a2 2 0 0 1 2 2v2' },
      { type: 'path', d: 'M21 17v2a2 2 0 0 1-2 2h-2' },
      { type: 'path', d: 'M7 21H5a2 2 0 0 1-2-2v-2' },
      { type: 'line', x1: 7, y1: 12, x2: 17, y2: 12 },
    ],
  },
  // 回车键图标
  'corner-down-left': {
    paths: [
      { type: 'polyline', points: '9 10 4 15 9 20' },
      { type: 'path', d: 'M20 4v7a4 4 0 0 1-4 4H4' },
    ],
  },
};
