import { ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagItem, ITagMetadata } from '../types/tag';
import { TagApiClient } from '../services/TagApiClient';
import { TagVisualService } from '../services/TagVisualService';
import { TagDocConverterService } from '../services/TagDocConverterService';
import { usePlugin } from '../main';

// 共享的标签资产与元数据状态
const allTags = ref<ITagItem[]>([]);
const loading = ref(false);
const metadataMap = ref<Map<string, ITagMetadata>>(new Map());

export function useTagData() {
  /**
   * 刷新全库标签数据与本地元数据配置
   */
  async function refreshTags(onLoaded?: (tags: ITagItem[]) => void) {
    loading.value = true;
    try {
      const plugin = usePlugin();
      const localData = await plugin.loadData('tag-manager-config.json').catch(() => null);
      if (localData?.metadataList && Array.isArray(localData.metadataList)) {
        const map = new Map<string, ITagMetadata>();
        localData.metadataList.forEach((m: ITagMetadata) => map.set(m.label, m));
        metadataMap.value = map;
        const css = TagVisualService.generateCssRules(localData.metadataList);
        TagVisualService.applyStyles(css);
      }

      const tags = await TagApiClient.fetchAllTags();
      tags.forEach(t => {
        t.metadata = metadataMap.value.get(t.label);
      });

      allTags.value = tags;
      if (onLoaded) {
        onLoaded(tags);
      }
      return tags;
    } catch (err: any) {
      showMessage(`加载标签失败: ${err.message || err}`, 4000, 'error');
      return [];
    } finally {
      loading.value = false;
    }
  }

  function getTagIcon(label: string): string {
    return metadataMap.value.get(label)?.icon || '';
  }

  function getTagStyle(label: string): Record<string, string> {
    const meta = metadataMap.value.get(label);
    if (!meta) return {};
    const s: Record<string, string> = {};
    if (meta.backgroundColor) s.backgroundColor = meta.backgroundColor;
    if (meta.textColor) s.color = meta.textColor;
    if (meta.backgroundColor || meta.textColor) {
      s.borderRadius = '4px';
      s.padding = '1px 6px';
    }
    return s;
  }

  async function saveTagMetadata(meta: ITagMetadata, savedViews: any[] = []) {
    metadataMap.value.set(meta.label, meta);

    const plugin = usePlugin();
    const metaList = Array.from(metadataMap.value.values());
    await plugin.saveData('tag-manager-config.json', {
      metadataList: metaList,
      savedViews,
    });

    const css = TagVisualService.generateCssRules(metaList);
    TagVisualService.applyStyles(css);
  }

  async function handleRemoveTag(label: string): Promise<boolean> {
    if (!confirm(`确定要彻底删除标签 "${label}" 吗？此操作将移除全库关联引用的标签标记。`)) {
      return false;
    }
    loading.value = true;
    try {
      await TagApiClient.removeTag(label);
      showMessage(`已成功删除标签 "${label}"`, 3000, 'info');
      await refreshTags();
      return true;
    } catch (err: any) {
      showMessage(`删除标签失败: ${err.message || err}`, 4000, 'error');
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function handleConvertToDoc(label: string) {
    loading.value = true;
    try {
      const blocks = await TagApiClient.queryMatchedBlocks({ includeTags: [label], limit: 30 });
      const res = await TagDocConverterService.createDocFromTag(label, blocks);
      if (res.success && res.docId) {
        showMessage(`已成功创建主题聚合文档《${label}》！`, 4000, 'info');
        if ((window as any).siyuan?.openTab) {
          (window as any).siyuan.openTab({
            app: (window as any).siyuan.appId,
            doc: { id: res.docId },
          });
        }
      } else {
        showMessage(`创建聚合文档失败: ${res.error}`, 4000, 'error');
      }
    } catch (err: any) {
      showMessage(`升格文档异常: ${err.message || err}`, 4000, 'error');
    } finally {
      loading.value = false;
    }
  }

  return {
    allTags,
    loading,
    metadataMap,
    refreshTags,
    getTagIcon,
    getTagStyle,
    saveTagMetadata,
    handleRemoveTag,
    handleConvertToDoc,
  };
}
