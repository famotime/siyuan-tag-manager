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
  /** 引用计数（关联的块引用总数） */
  count: number;
  /** 关联的去重块数 */
  blockCount?: number;
  /** 关联的去重文档数 */
  docCount?: number;
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
  /** 分组主题色或预设色盘 ID */
  color?: string;
  /** 分组图标（可选） */
  icon?: string;
  /** 明确绑定的标签列表（用于批量套用打标） */
  tags: string[];
  /** 匹配规则（向后兼容） */
  matchRules?: {
    /** 前缀匹配，如 "tech/" */
    prefix?: string[];
    /** 精确标签名匹配 */
    exactLabels?: string[];
  };
  /** 排序序号 */
  sortOrder: number;
  /** 更新时间戳 */
  updatedAt?: number;
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
 * 筛选条件模式：必含 (AND)、可选 (OR)、排除 (NOT)
 */
export type TagFilterConditionMode = 'include' | 'optional' | 'exclude';

/**
 * 多维布尔筛选交互状态接口
 */
export interface IFilterSelectionState {
  /** 包含标签列表（AND 逻辑） */
  includeTags: string[];
  /** 可选标签列表（OR 逻辑） */
  optionalTags: string[];
  /** 排除标签列表（NOT 逻辑） */
  excludeTags: string[];
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
  | 'similar_conflict' // 相似冲突（含大小写变体、分隔符风格、编辑距离）
  | 'invalid_norm'     // 不合规范（含多余斜杠、非法字符、超长标签、超深层级、纯数字）
  | 'low_frequency'    // 低频使用（引用数 <= 1，包含孤儿与单次引用）
  | 'case_conflict'    // 大小写冲突（向后兼容）
  | 'orphan'           // 孤儿空标签（向后兼容）
  | 'redundant_slash'; // 命名格式异常（向后兼容）

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
  suggestedAction: 'merge' | 'clean' | 'rename' | 'normalize';
  /** 细分归类标识 */
  subType?: 'case' | 'separator' | 'typo' | 'slash' | 'invalid_chars' | 'length' | 'depth' | 'digits' | 'zero_ref' | 'single_ref';
  /** 建议规范化后的标签名（针对格式异常等） */
  normalizedTarget?: string;
}

/**
 * 标签健康度体检统计汇总
 */
export interface ITagHealthSummary {
  totalTags: number;
  similarConflicts: number;
  invalidNorms: number;
  lowFrequency: number;
  healthyRate: number;
  /** 兼容历史字段 */
  caseConflicts?: number;
  orphans?: number;
}

/**
 * 标签健康度体检报告完整结构
 */
export interface ITagHealthReport {
  issues: ITagHealthIssue[];
  summary: ITagHealthSummary;
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
