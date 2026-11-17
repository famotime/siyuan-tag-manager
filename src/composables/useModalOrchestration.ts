import { ref } from 'vue';
import type {
  IRowMenuState,
  IStyleModalState,
  ISaveViewModalState,
  IBatchModalState,
  IMergeModalState,
  IRenameModalState,
  ITagGroupModalState,
} from '../types/ui';

/**
 * 外部注册的 Escape 关闭项（如树内局部确认对话框、行内编辑态）
 * 由宿主组件经 registerEscapeCloser 挂入统一关闭链，避免散落的 window 级监听
 */
export interface IEscapeCloserEntry {
  isVisible: () => boolean;
  /** 可选守卫：返回 false 时按 Esc 不关闭也不回退（如弹窗异步执行中） */
  canClose?: () => boolean;
  close: () => void;
}

/**
 * 工作台弹窗编排状态与全局 Escape 关闭链
 * 从 App.vue 抽离：10 个弹窗/菜单状态 + 定位逻辑 + 分层关闭优先级
 *
 * Escape 关闭优先级：
 * confirmDialog → 动态注册项（registerEscapeCloser，如树内确认对话框/行内编辑态）
 * → rowMenu → styleModal → saveViewModal → renameModal → groupModal → reparentModal
 * → batchModal → mergeModal → companion → settings → 回退
 *
 * 带 canClose 守卫的弹窗（executing 中）可见时按 Esc 不关闭也不回退
 */
export function useModalOrchestration(options: {
  /** 全部弹窗均已关闭时 Escape 的回退动作（关闭整个面板） */
  onEscapeFallback: () => void;
}) {
  const companionModalVisible = ref(false);
  const settingsModalVisible = ref(false);

  const rowMenu = ref<IRowMenuState>({
    visible: false,
    label: '',
    top: 0,
    left: 0,
  });

  const styleModal = ref<IStyleModalState>({
    visible: false,
    label: '',
    presetId: '',
    backgroundColor: '',
    textColor: '',
    darkBackgroundColor: '',
    darkTextColor: '',
    icon: '',
    aliasesText: '',
  });

  const saveViewModal = ref<ISaveViewModalState>({
    visible: false,
    title: '',
  });

  const batchModal = ref<IBatchModalState>({
    visible: false,
    docIdsText: '',
    tagsText: '',
    executing: false,
  });

  const mergeModal = ref<IMergeModalState>({
    visible: false,
    sourceLabel: '',
    targetLabel: '',
    setAsAlias: true,
    executing: false,
  });

  const renameModal = ref<IRenameModalState>({
    visible: false,
    oldLabel: '',
    newLabel: '',
    executing: false,
  });

  const groupModal = ref<ITagGroupModalState>({
    visible: false,
    isEdit: false,
    groupId: undefined,
    name: '',
    color: '',
    icon: '',
    tags: [],
  });

  const reparentModal = ref<{ visible: boolean; label: string }>({
    visible: false,
    label: '',
  });

  // 通用自绘确认对话框状态（替代 window.confirm，回调由宿主注册）
  const confirmDialog = ref<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    danger: boolean;
    onConfirm: (() => void) | null;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: '确认',
    danger: false,
    onConfirm: null,
  });

  function openConfirmDialog(options: { title: string; message: string; confirmText?: string; danger?: boolean; onConfirm: () => void }) {
    confirmDialog.value = {
      visible: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || '确认',
      danger: options.danger || false,
      onConfirm: options.onConfirm,
    };
  }

  function closeConfirmDialog() {
    confirmDialog.value.visible = false;
    confirmDialog.value.onConfirm = null;
  }

  function handleConfirmDialog() {
    const callback = confirmDialog.value.onConfirm;
    closeConfirmDialog();
    if (callback) {
      callback();
    }
  }

  // 外部注册的关闭项（树内局部对话框、行内编辑态等），优先级介于 confirmDialog 与固定链之间
  const dynamicClosers: IEscapeCloserEntry[] = [];

  function registerEscapeCloser(entry: IEscapeCloserEntry): () => void {
    dynamicClosers.push(entry);
    return () => {
      const idx = dynamicClosers.indexOf(entry);
      if (idx !== -1) {
        dynamicClosers.splice(idx, 1);
      }
    };
  }

  // Escape 关闭链（顺序即优先级）；动态注册项紧随确认对话框，覆盖各 Tab 内部维护的局部可关闭面
  function getEscapeClosers(): IEscapeCloserEntry[] {
    return [
      { isVisible: () => confirmDialog.value.visible, close: closeConfirmDialog },
      ...dynamicClosers,
      { isVisible: () => rowMenu.value.visible, close: () => { rowMenu.value.visible = false; } },
      { isVisible: () => styleModal.value.visible, close: () => { styleModal.value.visible = false; } },
      { isVisible: () => saveViewModal.value.visible, close: () => { saveViewModal.value.visible = false; } },
      { isVisible: () => renameModal.value.visible, canClose: () => !renameModal.value.executing, close: () => { renameModal.value.visible = false; } },
      { isVisible: () => groupModal.value.visible, close: () => { groupModal.value.visible = false; } },
      { isVisible: () => reparentModal.value.visible, close: () => { reparentModal.value.visible = false; } },
      { isVisible: () => batchModal.value.visible, canClose: () => !batchModal.value.executing, close: () => { batchModal.value.visible = false; } },
      { isVisible: () => mergeModal.value.visible, canClose: () => !mergeModal.value.executing, close: () => { mergeModal.value.visible = false; } },
      { isVisible: () => companionModalVisible.value, close: () => { companionModalVisible.value = false; } },
      { isVisible: () => settingsModalVisible.value, close: () => { settingsModalVisible.value = false; } },
    ];
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      for (const closer of getEscapeClosers()) {
        if (closer.isVisible()) {
          if (closer.canClose && !closer.canClose()) {
            // 异步执行中的弹窗不可关闭：吞掉 Esc，避免继续命中下层弹窗或回退折叠整个面板
            return;
          }
          closer.close();
          return;
        }
      }
      options.onEscapeFallback();
    }
  }

  function openRowMenu(label: string, event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const menuWidth = 180;
    let left = rect.left - menuWidth + 24;
    if (left < 10) left = 10;
    let top = rect.bottom + 4;
    const menuHeight = 130;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    if (top + menuHeight > viewportHeight) {
      top = rect.top - menuHeight;
    }

    rowMenu.value = {
      visible: true,
      label,
      top,
      left,
    };
  }

  function closeRowMenu() {
    if (rowMenu.value.visible) {
      rowMenu.value.visible = false;
    }
  }

  return {
    companionModalVisible,
    settingsModalVisible,
    rowMenu,
    styleModal,
    saveViewModal,
    batchModal,
    mergeModal,
    renameModal,
    groupModal,
    reparentModal,
    confirmDialog,
    openRowMenu,
    closeRowMenu,
    openConfirmDialog,
    closeConfirmDialog,
    handleConfirmDialog,
    registerEscapeCloser,
    handleGlobalKeydown,
  };
}
