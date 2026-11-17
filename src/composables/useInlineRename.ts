import { nextTick, ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagItem } from '../types/tag';
import { TagGovernanceService } from '../services/TagGovernanceService';

/**
 * 全景树行内就地重命名状态与方法
 * 从 TagTreeView.vue 抽离：编辑态、校验分支与级联子标签重命名确认对话框
 */
export function useInlineRename(options: {
  /** 全库标签列表（getter 形式以保持响应性） */
  allTags: () => ITagItem[];
  /** 提交重命名回调（组件层转发为 emit('rename-tag')） */
  onRenameTag: (oldLabel: string, newLabel: string) => void;
}) {
  const editingLabel = ref<string | null>(null);
  const inlineRenameValue = ref('');
  const inlineInputRef = ref<HTMLInputElement | null>(null);
  const isSubmittingRename = ref(false);

  // 级联重命名子标签模态对话框状态
  const cascadeRenameConfirmState = ref<{
    visible: boolean;
    oldLabel: string;
    newLabel: string;
    childCount: number;
  }>({
    visible: false,
    oldLabel: '',
    newLabel: '',
    childCount: 0,
  });

  function startInlineRename(node: ITagItem) {
    editingLabel.value = node.label;
    inlineRenameValue.value = node.name;
    nextTick(() => {
      inlineInputRef.value?.focus();
      inlineInputRef.value?.select();
    });
  }

  function cancelInlineRename() {
    editingLabel.value = null;
    inlineRenameValue.value = '';
    isSubmittingRename.value = false;
  }

  async function submitInlineRename(node: ITagItem) {
    if (isSubmittingRename.value) return;
    const newName = inlineRenameValue.value.trim();
    if (!newName) {
      showMessage('标签名称不能为空', 3000, 'error');
      return;
    }
    if (newName === node.name) {
      cancelInlineRename();
      return;
    }
    if (newName.includes('/')) {
      showMessage('节点名称不能包含层级斜杠 "/"，如需调整层级请使用拖拽或层级配置', 3000, 'error');
      return;
    }

    const check = TagGovernanceService.isValidLabel(newName);
    if (!check.valid) {
      showMessage(check.error || '标签名称格式不合法', 3000, 'error');
      return;
    }

    const lastSlashIndex = node.label.lastIndexOf('/');
    const newFullLabel = lastSlashIndex >= 0
      ? `${node.label.slice(0, lastSlashIndex)}/${newName}`
      : newName;

    if (options.allTags().some(t => t.label.toLowerCase() === newFullLabel.toLowerCase())) {
      showMessage(`标签 "#${newFullLabel}#" 已存在于标签库中`, 3000, 'error');
      return;
    }

    const subTagPrefix = `${node.label}/`;
    const childTags = options.allTags().filter(t => t.label.startsWith(subTagPrefix));
    if (childTags.length > 0) {
      // 唤起自定义 DOM 模态对话框，彻底杜绝 Electron 原生 confirm 引起的鼠标光标指针丢失问题
      cascadeRenameConfirmState.value = {
        visible: true,
        oldLabel: node.label,
        newLabel: newFullLabel,
        childCount: childTags.length,
      };
      return;
    }

    isSubmittingRename.value = true;
    try {
      options.onRenameTag(node.label, newFullLabel);
      cancelInlineRename();
    } finally {
      isSubmittingRename.value = false;
    }
  }

  function confirmCascadeRename() {
    const { oldLabel, newLabel } = cascadeRenameConfirmState.value;
    cascadeRenameConfirmState.value.visible = false;
    if (oldLabel && newLabel) {
      options.onRenameTag(oldLabel, newLabel);
      cancelInlineRename();
    }
  }

  function handleInlineRenameBlur(node: ITagItem) {
    if (isSubmittingRename.value || cascadeRenameConfirmState.value.visible) return;
    if (inlineRenameValue.value.trim() === node.name || !inlineRenameValue.value.trim()) {
      cancelInlineRename();
    }
  }

  return {
    editingLabel,
    inlineRenameValue,
    inlineInputRef,
    isSubmittingRename,
    cascadeRenameConfirmState,
    startInlineRename,
    cancelInlineRename,
    submitInlineRename,
    confirmCascadeRename,
    handleInlineRenameBlur,
  };
}
