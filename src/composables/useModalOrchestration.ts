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
 * 工作台弹窗编排状态与全局 Escape 关闭链
 * 从 App.vue 抽离：10 个弹窗/菜单状态 + 定位逻辑 + 分层关闭优先级
 *
 * Escape 关闭优先级：
 * rowMenu → styleModal → saveViewModal → renameModal → groupModal → reparentModal
 * → batchModal → mergeModal → companion → settings → 回退
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

  // Escape 关闭链（顺序即优先级）
  const escapeClosers = [
    { isVisible: () => rowMenu.value.visible, close: () => { rowMenu.value.visible = false; } },
    { isVisible: () => styleModal.value.visible, close: () => { styleModal.value.visible = false; } },
    { isVisible: () => saveViewModal.value.visible, close: () => { saveViewModal.value.visible = false; } },
    { isVisible: () => renameModal.value.visible, close: () => { renameModal.value.visible = false; } },
    { isVisible: () => groupModal.value.visible, close: () => { groupModal.value.visible = false; } },
    { isVisible: () => reparentModal.value.visible, close: () => { reparentModal.value.visible = false; } },
    { isVisible: () => batchModal.value.visible, close: () => { batchModal.value.visible = false; } },
    { isVisible: () => mergeModal.value.visible, close: () => { mergeModal.value.visible = false; } },
    { isVisible: () => companionModalVisible.value, close: () => { companionModalVisible.value = false; } },
    { isVisible: () => settingsModalVisible.value, close: () => { settingsModalVisible.value = false; } },
  ];

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      for (const closer of escapeClosers) {
        if (closer.isVisible()) {
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
    openRowMenu,
    closeRowMenu,
    handleGlobalKeydown,
  };
}
