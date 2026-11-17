import { createApp, reactive } from 'vue';
import type { App as VueApp } from 'vue';
import TagBatchModal from '../components/dialogs/TagBatchModal.vue';
import { TagBatchService } from '../services/TagBatchService';
import { TagApiClient } from '../services/TagApiClient';
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
  },
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
    onSyncState: (patch: Partial<IBatchModalState>) => {
      Object.assign(state, patch);
    },
    onExecute: async (payload: { docIds: string[]; tags: string[] }) => {
      const docIds = payload.docIds.length > 0 ? payload.docIds : docs.map(d => d.id);

      // 校验、执行与提示统一收敛至 TagBatchService.executeBatchTagging
      const ok = await TagBatchService.executeBatchTagging(docIds, payload.tags, (executing) => {
        state.executing = executing;
      });
      if (ok) {
        closeStandaloneBatchModal();
        options?.onSuccess?.();
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
