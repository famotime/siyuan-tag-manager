import { nextTick, ref } from 'vue';
import { TagTreeService } from '../services/TagTreeService';

/**
 * 全景树浏览位置持久化（scrollTop 与最后点击标签的双通道恢复）
 * 从 TagTreeView.vue 抽离：保存/恢复逻辑，生命周期钩子由组件层注册
 */
export function useScrollPersistence(options: {
  /** 节点点击回调（组件层转发为 emit('tag-click')） */
  onTagClick: (label: string, event: MouseEvent) => void;
  /** 切换到筛选视图回调（组件层转发为 emit('switch-to-filter')） */
  onSwitchToFilter: () => void;
}) {
  const scrollerRef = ref<HTMLElement | null>(null);

  function saveCurrentPosition(label?: string) {
    if (scrollerRef.value) {
      TagTreeService.saveScrollPosition(scrollerRef.value.scrollTop, label);
    } else if (label !== undefined) {
      TagTreeService.saveScrollPosition(-1, label);
    }
  }

  function handleScrollerScroll(e: Event) {
    const target = e.target as HTMLElement;
    if (target) {
      TagTreeService.saveScrollPosition(target.scrollTop);
    }
  }

  function handleNodeTagClick(label: string, event: MouseEvent) {
    saveCurrentPosition(label);
    options.onTagClick(label, event);
  }

  function handleSwitchToFilter() {
    saveCurrentPosition();
    options.onSwitchToFilter();
  }

  function restoreScrollPosition() {
    const { scrollTop, lastClickedTag } = TagTreeService.getSavedScrollPosition();
    if (scrollTop <= 0 && !lastClickedTag) return;

    const performRestore = () => {
      if (!scrollerRef.value) return;
      if (scrollTop > 0) {
        scrollerRef.value.scrollTop = scrollTop;
      } else if (lastClickedTag) {
        const targetEl = scrollerRef.value.querySelector(
          `.tm-tree-node[data-node-tag="${lastClickedTag}"]`,
        ) as HTMLElement | null;
        if (targetEl) {
          targetEl.scrollIntoView({ block: 'nearest' });
        }
      }
    };

    nextTick(() => {
      performRestore();
      // 延迟帧双重校验，确保复杂 DOM 树渲染/布局完成后的绝对像素对齐
      requestAnimationFrame(() => {
        performRestore();
      });
    });
  }

  return {
    scrollerRef,
    handleScrollerScroll,
    handleNodeTagClick,
    handleSwitchToFilter,
    restoreScrollPosition,
    saveCurrentPosition,
  };
}
