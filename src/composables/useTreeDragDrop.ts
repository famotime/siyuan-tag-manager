import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import type { ITagItem } from '../types/tag';
import { TagDropService } from '../services/TagDropService';
import { TagTreeService } from '../services/TagTreeService';
import { stripTagHash } from '../utils/tagText';

export interface ITreeDragIndicator {
  nodeLabel: string;
  position: 'before' | 'inside' | 'after';
  mode: 'root' | 'child'; // root: 拖出为独立根标签; child: 归为子标签
}

// 拖拽落位即时确认对话框状态
export interface IReparentConfirmState {
  visible: boolean;
  srcLabel: string;
  targetParentLabel: string | null;
  moves: Array<{ oldLabel: string; newLabel: string }>;
  quoteCount: number;
}

/**
 * 全景树拖拽层级重构状态机
 * 从 TagTreeView.vue 抽离：拖拽指示线三段定位、空白区拖出为根标签、
 * 落位即时确认对话框与暂存执行；树节点与热度词云共用统一 startTagDrag 入口
 */
export function useTreeDragDrop(options: {
  /** 应用暂存重命名后的虚拟标签列表 */
  virtualAllTags: Ref<ITagItem[]>;
  /** 折叠集合（落位执行后需展开目标祖先链） */
  collapsedSet: Ref<Set<string>>;
  /** 执行批量层级重构回调（组件层转发为 emit('batch-reparent') 或注入的异步执行器），可返回 Promise 供确认框等待 */
  onBatchReparent: (moves: Array<{ oldLabel: string; newLabel: string }>) => void | Promise<unknown>;
}) {
  const { virtualAllTags, collapsedSet, onBatchReparent } = options;

  const draggingTagLabel = ref<string | null>(null);
  const dragOverTagLabel = ref<string | null>(null);
  const dragIndicator = ref<ITreeDragIndicator | null>(null);
  const isDraggingOverScrollerBlank = ref(false);

  const reparentConfirmState = ref<IReparentConfirmState>({
    visible: false,
    srcLabel: '',
    targetParentLabel: null,
    moves: [],
    quoteCount: 0,
  });
  const isExecutingReparent = ref(false);

  /**
   * 统一拖拽启动入口（树节点 handleDragStart 与热度词云 handleCloudDragStart 共用，
   * 消除两处逐行重复）
   */
  function startTagDrag(label: string, e: DragEvent) {
    TagDropService.setDraggingTag(label);

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('application/siyuan-tag', label);
      e.dataTransfer.setData('text/plain', `#${label}# `);
    }

    // 异步延迟更新 draggingTagLabel，避免同步修改响应式状态导致 DOM 重新渲染和布局突变（Layout Shift）打断 Chromium 原生拖拽启动
    setTimeout(() => {
      draggingTagLabel.value = label;
    }, 0);
  }

  const isDraggingSubTag = computed(() => {
    const current = draggingTagLabel.value || TagDropService.getDraggingTag();
    return Boolean(current && current.includes('/'));
  });

  const draggingLeafName = computed(() => {
    const current = draggingTagLabel.value || TagDropService.getDraggingTag();
    if (!current) return '';
    return current.split('/').pop() || current;
  });

  function handleDragEnd() {
    draggingTagLabel.value = null;
    dragOverTagLabel.value = null;
    dragIndicator.value = null;
    isDraggingOverScrollerBlank.value = false;
    TagDropService.setDraggingTag(null);
  }

  function handleScrollerDragOver(e: DragEvent) {
    if (!isDraggingSubTag.value) return;
    const target = e.target as HTMLElement | null;
    const isOverNode = Boolean(target?.closest('.tm-tree-node'));
    if (!isOverNode) {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      isDraggingOverScrollerBlank.value = true;
    } else {
      isDraggingOverScrollerBlank.value = false;
    }
  }

  function handleScrollerDragLeave(e: DragEvent) {
    const related = e.relatedTarget as HTMLElement | null;
    const current = e.currentTarget as HTMLElement | null;
    if (!current || !related || !current.contains(related)) {
      isDraggingOverScrollerBlank.value = false;
    }
  }

  function handleScrollerDrop(e: DragEvent) {
    if (!isDraggingSubTag.value) return;
    const target = e.target as HTMLElement | null;
    const isOverNode = Boolean(target?.closest('.tm-tree-node'));
    if (!isOverNode) {
      e.preventDefault();
      e.stopPropagation();
      isDraggingOverScrollerBlank.value = false;
      dragIndicator.value = null;
      handleDropToRoot(e);
    }
  }

  function handleDragOverNode(node: ITagItem, e: DragEvent) {
    const currentDragging = draggingTagLabel.value || TagDropService.getDraggingTag();
    if (!currentDragging || currentDragging === node.label) return;
    // 禁止拖拽到自身或自身的子孙节点
    if (node.label.startsWith(`${currentDragging}/`)) return;

    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    const targetEl = (e.currentTarget as HTMLElement) || (e.target as HTMLElement)?.closest('.tm-tree-node');
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const height = rect.height || 28;
    const offsetY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, offsetY / height));
    const offsetX = e.clientX - rect.left;

    const isSubTag = Boolean(currentDragging.includes('/'));

    // 三段式指示线定位：
    // 1. 上边缘 (ratio < 0.28) 或 靠左拉出 (isSubTag && offsetX < 28) -> 显示上方指示线，拖出为独立根标签
    // 2. 下边缘 (ratio > 0.72) -> 显示下方指示线，拖出为独立根标签
    // 3. 悬停在节点主体 (0.28 <= ratio <= 0.72) -> 目标节点高亮，归为该节点的子标签
    if (ratio < 0.28 || (isSubTag && offsetX < 28)) {
      dragIndicator.value = {
        nodeLabel: node.label,
        position: 'before',
        mode: 'root',
      };
      dragOverTagLabel.value = null;
    } else if (ratio > 0.72) {
      dragIndicator.value = {
        nodeLabel: node.label,
        position: 'after',
        mode: 'root',
      };
      dragOverTagLabel.value = null;
    } else {
      dragIndicator.value = {
        nodeLabel: node.label,
        position: 'inside',
        mode: 'child',
      };
      dragOverTagLabel.value = node.label;
    }
  }

  function handleDragLeaveNode(node: ITagItem, e: DragEvent) {
    // 仅在真正离开节点边界且未进入其子元素时重置
    const related = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement | null;
    if (!currentTarget || !related || !currentTarget.contains(related)) {
      if (dragIndicator.value?.nodeLabel === node.label) {
        dragIndicator.value = null;
      }
      if (dragOverTagLabel.value === node.label) {
        dragOverTagLabel.value = null;
      }
    }
  }

  function resolveDragSource(e: DragEvent): string {
    return (
      draggingTagLabel.value
      || TagDropService.getDraggingTag()
      || e.dataTransfer?.getData('application/siyuan-tag')
      || stripTagHash(e.dataTransfer?.getData('text/plain') || '')
    );
  }

  function openReparentConfirm(src: string, targetParent: string | null) {
    const moves = TagTreeService.calculateReparentMoves(src, targetParent, virtualAllTags.value);
    if (moves.length === 0) return;

    const srcTagItem = virtualAllTags.value.find(t => t.label === src);
    const quoteCount = srcTagItem?.count || 0;

    // 立即呼出直观确认对话框
    reparentConfirmState.value = {
      visible: true,
      srcLabel: src,
      targetParentLabel: targetParent,
      moves,
      quoteCount,
    };
  }

  function handleDropOnNode(targetNode: ITagItem, e: DragEvent) {
    const src = resolveDragSource(e);

    const indicator = dragIndicator.value;
    dragIndicator.value = null;
    dragOverTagLabel.value = null;
    isDraggingOverScrollerBlank.value = false;

    if (!src || src === targetNode.label) return;
    if (targetNode.label.startsWith(`${src}/`)) return;

    e.preventDefault();
    e.stopPropagation();

    // 根据指示线显示状态精准判定：
    // 若处于上下边缘指示线，执行拖出为独立根标签；
    // 若处于节点主体，执行归为该节点的子标签
    const isRootMode = indicator ? indicator.mode === 'root' && indicator.position !== 'inside' : false;
    openReparentConfirm(src, isRootMode ? null : targetNode.label);
  }

  function handleDropToRoot(e: DragEvent) {
    const src = resolveDragSource(e);

    dragIndicator.value = null;
    dragOverTagLabel.value = null;
    isDraggingOverScrollerBlank.value = false;
    if (!src) return;

    e.preventDefault();
    e.stopPropagation();

    openReparentConfirm(src, null);
  }

  /**
   * 确认并执行暂存的层级重构（真实等待异步完成）：
   * isExecutingReparent 在回调 Promise 落定前保持 true，防止重复提交；
   * 确认框在执行完成前不关闭，成功后才展开目标祖先链
   */
  async function handleExecuteReparentDirectly() {
    if (reparentConfirmState.value.moves.length === 0 || isExecutingReparent.value) return;
    isExecutingReparent.value = true;
    try {
      const res = await Promise.resolve(onBatchReparent(reparentConfirmState.value.moves));
      const success = !res || (res as { success?: boolean }).success !== false;
      if (success && reparentConfirmState.value.targetParentLabel) {
        // 确保目标标签及其所有祖先层级均从折叠集合中移除，使其在树中展开立即可见
        const parts = reparentConfirmState.value.targetParentLabel.split('/');
        for (let i = 1; i <= parts.length; i++) {
          const parentPath = parts.slice(0, i).join('/');
          collapsedSet.value.delete(parentPath);
        }
      }
      // 无论成败，执行已结束（失败由执行层提示并刷新），关闭确认框避免基于陈旧状态重试
      reparentConfirmState.value.visible = false;
    } finally {
      isExecutingReparent.value = false;
    }
  }

  return {
    draggingTagLabel,
    dragOverTagLabel,
    dragIndicator,
    isDraggingOverScrollerBlank,
    reparentConfirmState,
    isExecutingReparent,
    isDraggingSubTag,
    draggingLeafName,
    startTagDrag,
    handleDragEnd,
    handleScrollerDragOver,
    handleScrollerDragLeave,
    handleScrollerDrop,
    handleDragOverNode,
    handleDragLeaveNode,
    handleDropOnNode,
    handleDropToRoot,
    handleExecuteReparentDirectly,
  };
}
