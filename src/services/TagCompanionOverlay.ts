import { createApp, reactive, type App as VueApp } from 'vue';
import type { ICompanionBarState, ITagCompanionCandidate } from '../types/companion';
import TagCompanionBar from '../components/dialogs/TagCompanionBar.vue';
import { TagDomDecorator } from './TagDomDecorator';

/**
 * 伴生推荐浮条视图层（自 TagCompanionService 拆分）
 *
 * 职责边界：Vue 应用挂载/卸载、气泡响应式状态、视窗边界避让定位、
 * 文档头部 chip 增量注入。事件检测与推荐调度仍由 TagCompanionService 负责。
 */
export class TagCompanionOverlay {
  private static app: VueApp | null = null;
  private static container: HTMLElement | null = null;
  private static state: ICompanionBarState = reactive({
    visible: false,
    candidates: [],
    activeIndex: 0,
    position: { top: 0, left: 0 },
    acceptedLabels: [],
  });

  public static getState(): ICompanionBarState {
    return this.state;
  }

  public static isMounted(): boolean {
    return Boolean(this.container);
  }

  public static contains(el: Node | null | undefined): boolean {
    return Boolean(this.container && el && this.container.contains(el));
  }

  /**
   * 挂载浮条 Vue 组件（幂等：重复挂载被忽略）
   */
  public static mount(
    onAccept: (item: ITagCompanionCandidate, idx: number) => void,
    onClose: () => void,
  ): void {
    if (this.container || typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.id = 'siyuan-tag-manager-companion-root';
    document.body.appendChild(this.container);

    this.app = createApp(TagCompanionBar, {
      state: this.state,
      onSelect: onAccept,
      onClose,
    });
    this.app.mount(this.container);
  }

  /**
   * 卸载浮条 Vue 组件并移除容器（幂等：重复卸载安全）
   */
  public static unmount(): void {
    if (this.app) {
      try {
        this.app.unmount();
      } catch {
        // 容错处理
      }
      this.app = null;
    }

    if (this.container) {
      try {
        this.container.remove();
      } catch {
        // 容错处理
      }
      this.container = null;
    }
  }

  /**
   * 展示候选气泡并计算定位（紧随光标/标签正下方，含视窗边界避让）
   */
  public static present(candidates: ITagCompanionCandidate[], rect: DOMRect): void {
    this.state.candidates = candidates;
    this.state.activeIndex = 0;
    this.state.acceptedLabels = [];

    let left = rect.left;
    let top = rect.bottom + 6;

    if (typeof window !== 'undefined') {
      const popoverWidth = 360;
      const popoverHeight = 36;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      if (top + popoverHeight > window.innerHeight - 16) {
        top = Math.max(16, rect.top - popoverHeight - 6);
      }
    }

    this.state.position = { top, left };
    this.state.visible = true;
  }

  /**
   * 隐藏气泡并清空候选状态
   */
  public static hide(): void {
    this.state.visible = false;
    this.state.candidates = [];
    this.state.activeIndex = 0;
  }

  public static markAccepted(label: string): void {
    if (!this.state.acceptedLabels.includes(label)) {
      this.state.acceptedLabels.push(label);
    }
  }

  public static advance(index: number): void {
    this.state.activeIndex = index + 1;
  }

  /**
   * 向文档头部标签展示区增量注入新 Chip DOM 以提供即时视觉反馈
   */
  public static appendDocChipToHeader(anchorEl: HTMLElement, label: string): void {
    if (typeof document === 'undefined') return;

    const protyleEl = anchorEl.closest<HTMLElement>('.protyle') || document.body;
    const doctagContainer = protyleEl.querySelector<HTMLElement>('.b3-chips__doctag');
    if (!doctagContainer) return;

    // 检查是否已有该 chip
    const existing = Array.from(doctagContainer.querySelectorAll('.b3-chip')).find(
      c => (c.getAttribute('data-tag') || c.textContent?.trim()) === label
    );
    if (existing) return;

    const newChip = document.createElement('span');
    newChip.className = 'b3-chip';
    newChip.setAttribute('data-tag', label);
    newChip.setAttribute('data-type', 'open-search');
    newChip.innerHTML = `<span class="b3-chip__text">${label}</span>`;

    const addBtn = doctagContainer.querySelector('.b3-chip--add, .b3-chips__add, button, [data-type="add-tag"]');
    if (addBtn) {
      doctagContainer.insertBefore(newChip, addBtn);
    } else {
      doctagContainer.appendChild(newChip);
    }

    TagDomDecorator.decorateElement(doctagContainer);
  }
}
