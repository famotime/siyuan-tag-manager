/**
 * 伴生标签智能推荐核心数据结构与配置接口
 */

export interface ITagCompanionCandidate {
  /** 伴生标签名 */
  label: string;
  /** 同块共现绝对频次 */
  weight: number;
  /** Jaccard 相似度系数 (0.0 ~ 1.0) */
  jaccard: number;
  /** 格式化百分比 (0 ~ 100) */
  percentage: number;
}

export interface ITagCompanionConfig {
  /** 是否启用伴生标签智能推荐 */
  enabled: boolean;
  /** 触发模式：'input_only' (仅输入闭合 #) | 'dual' (输入闭合 # + 光标移入停留) */
  triggerMode: 'input_only' | 'dual';
  /** 最大推荐条数 (3 ~ 8) */
  maxCount: number;
  /** 最小相似度过滤阈值 (0.10 ~ 0.50) */
  minSimilarity: number;
  /** 光标移入停留触发的防抖时间 (毫秒) */
  hoverDelayMs: number;
}

export const DEFAULT_COMPANION_CONFIG: ITagCompanionConfig = {
  enabled: true,
  triggerMode: 'dual',
  maxCount: 4,
  minSimilarity: 0.05,
  hoverDelayMs: 300,
};

export interface ITagCompanionContext {
  /** 当前触发的核心基准标签 */
  targetLabel: string;
  /** 当前所在的块 ID */
  blockId: string;
  /** 当前所在的块 DOM 元素 */
  blockElement?: HTMLElement;
  /** 当前块内已存在的所有标签 (用于严格去重) */
  existingTags: string[];
  /** 光标选区的屏幕包围盒 (用于悬浮气泡精确定位) */
  caretRect?: DOMRect;
  /** 思源 Protyle 实例引用 (若可用) */
  protyle?: any;
}

export interface ICompanionBarState {
  visible: boolean;
  candidates: ITagCompanionCandidate[];
  activeIndex: number;
  position: { top: number; left: number };
  acceptedLabels: string[];
}

