import { createApp, reactive, type App as VueApp } from 'vue';
import TagBatchModal from '../components/dialogs/TagBatchModal.vue';
import { TagBatchService } from '../services/TagBatchService';
import { TagApiClient } from '../services/TagApiClient';
import { showMessage } from 'siyuan';
import type { IBatchBridgeDoc } from './batchTagBridge';
import type { ITagItem, ITagGroup } from '../types/tag';
import type { IBatchModalState } from '../types/ui';
import { vTooltip } from './tooltip';

let standaloneApp: VueApp | null = null;
let standaloneContainer: HTMLElement | null = null;
let keydownListener: ((e: KeyboardEvent) => void) | null = null;

export async function openStandaloneBatchModal(
  docs: IBatchBridgeDoc[],
  options?: {
    allTags?: ITagItem[];
    tagGroups?: ITagGroup[];
    onSuccess?: () => void;
  }
): Promise<void> {
  // 确保先关闭并清理旧实例
  closeStandaloneBatchModal();

  if (typeof document === 'undefined') {
    return;
  }

  // 1. 获取全库标签（若未显式传入）
  let allTags = options?.allTags;
  if (!allTags || allTags.length === 0) {
    try {
      allTags = await TagApiClient.fetchAllTags();
    } catch (e) {
      console.warn('[siyuan-tag-manager] fetchAllTags fallback in standalone batch modal:', e);
      allTags = [];
    }
  }

  const tagGroups = options?.tagGroups || [];

  // 2. 构造响应式状态，保证子组件 watch 能够即时捕获
  const state = reactive<IBatchModalState>({
    visible: true,
    targetDocs: [...docs],
    docIdsText: docs.map(d => d.id).join('\n'),
    tagsText: '',
    executing: false,
  });

  // 3. 创建挂载容器
  standaloneContainer = document.createElement('div');
  standaloneContainer.id = 'siyuan-tag-manager-batch-modal-root';
  standaloneContainer.className = 'siyuan-tag-manager-standalone-root';
  document.body.appendChild(standaloneContainer);

  // 4. 监听 Escape 快捷键关闭
  keydownListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeStandaloneBatchModal();
    }
  };
  window.addEventListener('keydown', keydownListener);

  // 5. 创建独立 Vue 实例并挂载
  standaloneApp = createApp(TagBatchModal, {
    state,
    allTags,
    tagGroups,
    onClose: () => {
      closeStandaloneBatchModal();
    },
    onExecute: async (payload: { docIds: string[]; tags: string[] }) => {
      const docIds = payload.docIds.length > 0 ? payload.docIds : docs.map(d => d.id);
      const tags = payload.tags;

      if (docIds.length === 0 || tags.length === 0) {
        showMessage('目标文档与待添加标签均不能为空', 3000, 'error');
        return;
      }

      state.executing = true;
      try {
        const res = await TagBatchService.batchTagDocuments(docIds, tags);
        if (res.success) {
          showMessage(`成功为 ${res.updatedCount} 篇文档更新标签`, 3000, 'info');
          closeStandaloneBatchModal();
          options?.onSuccess?.();
        } else {
          showMessage(`批量打标存在错误: ${res.errors.join('; ')}`, 5000, 'error');
        }
      } catch (err: any) {
        showMessage(`批量打标失败: ${err.message || err}`, 4000, 'error');
      } finally {
        state.executing = false;
      }
    },
  });

  standaloneApp.directive('tooltip', vTooltip);
  standaloneApp.mount(standaloneContainer);
}

export function closeStandaloneBatchModal(): void {
  if (keydownListener && typeof window !== 'undefined') {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }

  if (standaloneApp) {
    try {
      standaloneApp.unmount();
    } catch {
      // 容错处理
    }
    standaloneApp = null;
  }

  if (standaloneContainer) {
    try {
      standaloneContainer.remove();
    } catch {
      // 容错处理
    }
    standaloneContainer = null;
  }
}
