/**
 * 标签管家（Tag Manager）核心数据类型与接口规范
 */

/**
 * 基础标签项数据结构（由 SQL spans 聚合或内核构建）
 */
export interface ITagItem {
  /** 纯标签名称（无斜杠的当前节点名，如 "Python"） */
  name: string;
  /** 完整标签路径（如 "tech/Python" 或 "Prompt"） */
  label: string;
  /** 引用计数（关联的块/文档数量） */
  count: number;
  /** 树深度（0 为根层级） */
  depth: number;
  /** 子标签列表 */
  children?: ITagItem[];
  /** 附加元数据（若存在） */
  metadata?: ITagMetadata;
}

/**
 * 标签持久化扩展元数据接口
 */
export interface ITagMetadata {
  /** 标签唯一标识（完整路径，如 "tech/Python"） */
  label: string;
  /** 自定义别名列表（用于拼音联想与多词归一） */
  aliases?: string[];
  /** 背景高亮颜色（Hex 或 CSS 变量，如 "#E8F0FE"） */
  backgroundColor?: string;
  /** 字体颜色（如 "#1A73E8"） */
  textColor?: string;
  /** 暗黑模式背景高亮颜色（自适应无眩光） */
  darkBackgroundColor?: string;
  /** 暗黑模式字体颜色（高对比度） */
  darkTextColor?: string;
  /** 绑定的预设色盘 ID */
  presetId?: string;
  /** 自定义图标（Emoji 字符或 SVG 图标名） */
  icon?: string;
  /** 所属分组 ID */
  groupId?: string;
  /** 业务定义说明或 Wiki 备注 */
  description?: string;
  /** 是否置顶收藏 */
  isPinned?: boolean;
  /** 置顶排序序号 */
  pinnedOrder?: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/**
 * 标签主题分组接口
 */
export interface ITagGroup {
  /** 分组唯一 ID */
  id: string;
  /** 分组展示名称（如 "状态"、"主题"、"技术栈"） */
  name: string;
  /** 分组主题色 */
  color?: string;
  /** 匹配规则 */
  matchRules: {
    /** 前缀匹配，如 "tech/" */
    prefix?: string[];
    /** 精确标签名匹配 */
    exactLabels?: string[];
  };
  /** 排序序号 */
  sortOrder: number;
}

/**
 * 智能保存视图配置接口
 */
export interface ISmartTagView {
  /** 视图唯一 ID */
  id: string;
  /** 视图标题 */
  title: string;
  /** 包含标签列表（AND 逻辑） */
  includeTags: string[];
  /** 排除标签列表（NOT 逻辑） */
  excludeTags: string[];
  /** 可选标签列表（OR 逻辑） */
  optionalTags: string[];
  /** 限定笔记本 ID 列表 */
  notebookIds?: string[];
  /** 结果呈现方式 */
  displayMode: 'card' | 'compact' | 'table';
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 标签合并与重构计划
 */
export interface ITagMergePlan {
  /** 目标保留标签名（如 "Prompt"） */
  targetLabel: string;
  /** 待合并源标签列表（如 ["prompt", "提示词"]） */
  sourceLabels: string[];
  /** 预估受影响的文档数 */
  affectedDocCount: number;
  /** 预估受影响的块数 */
  affectedBlockCount: number;
  /** 合并后是否自动将源标签记录为别名 */
  setAsAliasAfterMerge: boolean;
}

/**
 * 标签健康度检查问题类型
 */
export type TagHealthIssueType =
  | 'case_conflict'  // 大小写冲突，如 Prompt 与 prompt
  | 'low_frequency'   // 低频标签（Count = 1）
  | 'orphan'          // 孤儿空标签（Count = 0）
  | 'redundant_slash';// 命名格式异常（如以斜杠开头/结尾）

/**
 * 标签健康问题项
 */
export interface ITagHealthIssue {
  /** 问题类型 */
  type: TagHealthIssueType;
  /** 问题主标签 */
  primaryLabel: string;
  /** 冲突/关联的标签列表（如冲突的大小写兄弟） */
  relatedLabels?: string[];
  /** 严重程度: "warning" | "info" */
  severity: 'warning' | 'info';
  /** 问题描述 */
  message: string;
  /** 建议解决动作 */
  suggestedAction: 'merge' | 'clean' | 'rename';
}

/**
 * 标签命中块简要信息（用于抽屉式流式卡片预览）
 */
export interface ITagMatchedBlock {
  id: string;
  rootId: string;
  docTitle: string;
  content: string;
  markdown: string;
  type: string;
  updated: string;
  matchedTags: string[];
}
