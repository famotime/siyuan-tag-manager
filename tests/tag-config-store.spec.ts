import { describe, expect, it } from 'vitest';
import { usePlugin } from '../src/main';
import { TagConfigStore, TAG_MANAGER_CONFIG_STORAGE } from '../src/services/TagConfigStore';

/**
 * 配置统一存储测试
 * 核心回归：修复 saveSmartView 整文件覆盖导致 tagGroups/customTags/
 * companionConfig/tagDeleteConfig 丢失的数据丢失缺陷
 */
const EXISTING_CONFIG = {
  metadataList: [{ label: 'vue', backgroundColor: '#e8f0fe' }],
  savedViews: [{ id: 'view_old', title: '旧视图' }],
  tagGroups: [{ id: 'g1', name: '前端组', tags: ['vue', 'react'] }],
  customTags: ['Frontend/NextJS'],
  customColorPresets: [{ id: 'preset_1', name: '海盐蓝' }],
  companionConfig: { enabled: true, maxCount: 5 },
  tagDeleteConfig: { mode: 'keep_text' },
};

function createMockPlugin(existingData: any) {
  let savedData: any = null;
  const mockPlugin = {
    loadData: async (file: string) => {
      if (file !== TAG_MANAGER_CONFIG_STORAGE) return null;
      return existingData === undefined ? null : JSON.parse(JSON.stringify(existingData));
    },
    saveData: async (file: string, data: any) => {
      if (file !== TAG_MANAGER_CONFIG_STORAGE) return;
      savedData = data;
    },
  } as any;
  usePlugin(mockPlugin);
  return () => savedData;
}

describe('TagConfigStore 配置统一存储', () => {
  let getSavedData: () => any;

  describe('readConfig · 读取配置', () => {
    it('返回既有配置对象', async () => {
      getSavedData = createMockPlugin(EXISTING_CONFIG);
      const config = await TagConfigStore.readConfig();
      expect(config.tagGroups).toEqual(EXISTING_CONFIG.tagGroups);
      expect(config.customTags).toEqual(EXISTING_CONFIG.customTags);
    });

    it('无配置文件时返回空对象', async () => {
      getSavedData = createMockPlugin(null);
      const config = await TagConfigStore.readConfig();
      expect(config).toEqual({});
    });

    it('读取异常时返回空对象不抛出', async () => {
      const brokenPlugin = {
        loadData: async () => {
          throw new Error('storage corrupted');
        },
        saveData: async () => {},
      } as any;
      usePlugin(brokenPlugin);
      const config = await TagConfigStore.readConfig();
      expect(config).toEqual({});
    });
  });

  describe('updateConfig · 读-合并-写语义', () => {
    it('仅更新传入字段，完整保留其余配置（数据丢失缺陷回归）', async () => {
      getSavedData = createMockPlugin(EXISTING_CONFIG);
      await TagConfigStore.updateConfig({
        metadataList: [{ label: 'new-tag' }],
        savedViews: [{ id: 'view_new', title: '新视图' }],
      });

      const saved = getSavedData();
      expect(saved.metadataList).toEqual([{ label: 'new-tag' }]);
      expect(saved.savedViews).toEqual([{ id: 'view_new', title: '新视图' }]);
      // 其余五类配置必须完整保留
      expect(saved.tagGroups).toEqual(EXISTING_CONFIG.tagGroups);
      expect(saved.customTags).toEqual(EXISTING_CONFIG.customTags);
      expect(saved.customColorPresets).toEqual(EXISTING_CONFIG.customColorPresets);
      expect(saved.companionConfig).toEqual(EXISTING_CONFIG.companionConfig);
      expect(saved.tagDeleteConfig).toEqual(EXISTING_CONFIG.tagDeleteConfig);
    });

    it('覆盖同名字段时保留未提及字段', async () => {
      getSavedData = createMockPlugin({ tagGroups: [{ id: 'g1' }], customTags: ['a'] });
      await TagConfigStore.updateConfig({ tagGroups: [{ id: 'g2' }] });
      const saved = getSavedData();
      expect(saved.tagGroups).toEqual([{ id: 'g2' }]);
      expect(saved.customTags).toEqual(['a']);
    });

    it('首次写入（无既有配置文件）成功落盘', async () => {
      getSavedData = createMockPlugin(null);
      await TagConfigStore.updateConfig({ tagGroups: [{ id: 'g1' }] });
      expect(getSavedData()).toEqual({ tagGroups: [{ id: 'g1' }] });
    });
  });

  describe('useTagFilter.saveSmartView 集成回归 · 修复配置覆盖丢失', () => {
    it('保存智能视图后标签分组/自定义标签/伴生配置/删除策略完整保留', async () => {
      getSavedData = createMockPlugin(EXISTING_CONFIG);
      const { useTagFilter } = await import('../src/composables/useTagFilter');
      const { saveSmartView, savedViews } = useTagFilter();

      // 清空模块级共享视图状态，保证断言只含本次保存的视图
      savedViews.value.length = 0;

      const res = await saveSmartView('测试视图', [{ label: 'vue' }]);
      expect(res).toBe(true);

      const saved = getSavedData();
      expect(saved.metadataList).toEqual([{ label: 'vue' }]);
      expect(saved.savedViews.length).toBe(1);
      expect(saved.savedViews[0].title).toBe('测试视图');
      // 修复前此处 tagGroups 等字段会整体丢失
      expect(saved.tagGroups).toEqual(EXISTING_CONFIG.tagGroups);
      expect(saved.customTags).toEqual(EXISTING_CONFIG.customTags);
      expect(saved.companionConfig).toEqual(EXISTING_CONFIG.companionConfig);
      expect(saved.tagDeleteConfig).toEqual(EXISTING_CONFIG.tagDeleteConfig);
    });

    it('空标题拦截不落盘', async () => {
      getSavedData = createMockPlugin(EXISTING_CONFIG);
      const { useTagFilter } = await import('../src/composables/useTagFilter');
      const { saveSmartView } = useTagFilter();
      const res = await saveSmartView('   ');
      expect(res).toBe(false);
      expect(getSavedData()).toBeNull();
    });
  });

  describe('useTagData.persistConfig 全量快照回归', () => {
    it('saveTagDeleteConfig 落盘包含全部七类配置字段', async () => {
      getSavedData = createMockPlugin(null);
      const { useTagData } = await import('../src/composables/useTagData');
      const { saveTagDeleteConfig, tagGroups, customTags, customColorPresets, companionConfig, tagDeleteConfig } = useTagData();

      tagGroups.value = [{ id: 'g1', name: '组', tags: ['x'] }];
      customTags.value = ['custom1'];
      customColorPresets.value = [];
      companionConfig.value = { enabled: false } as any;

      await saveTagDeleteConfig({ mode: 'remove_all' } as any, []);

      const saved = getSavedData();
      expect(Object.keys(saved).sort()).toEqual(
        ['companionConfig', 'customColorPresets', 'customTags', 'metadataList', 'savedViews', 'tagDeleteConfig', 'tagGroups'].sort(),
      );
      expect(saved.tagGroups).toEqual([{ id: 'g1', name: '组', tags: ['x'] }]);
      expect(saved.tagDeleteConfig).toEqual({ mode: 'remove_all' });
      expect(tagDeleteConfig.value.mode).toBe('remove_all');
    });
  });

  describe('updateConfig · 并发写入串行化', () => {
    it('并发 updateConfig 交错执行时不丢失对方字段（丢失更新回归）', async () => {
      // 模拟磁盘延迟：saveData 等待两拍，制造两个并发写入交错的窗口
      let savedData: any = null;
      const mockPlugin = {
        loadData: async (file: string) => {
          if (file !== TAG_MANAGER_CONFIG_STORAGE) return null;
          return savedData ? JSON.parse(JSON.stringify(savedData)) : {};
        },
        saveData: async (_file: string, data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          savedData = data;
        },
      } as any;
      usePlugin(mockPlugin);

      // 无串行化时：A/B 各自读到旧快照，后写者覆盖前写者字段
      await Promise.all([
        TagConfigStore.updateConfig({ fieldA: 'a' }),
        TagConfigStore.updateConfig({ fieldB: 'b' }),
      ]);

      // 通过再次读取校验最终落盘同时包含两个字段
      const final = await TagConfigStore.readConfig();
      expect(final.fieldA).toBe('a');
      expect(final.fieldB).toBe('b');
    });

    it('前序写入失败不阻塞后续写入', async () => {
      let savedData: any = null;
      let failNext = true;
      const mockPlugin = {
        loadData: async () => (savedData ? JSON.parse(JSON.stringify(savedData)) : {}),
        saveData: async (_file: string, data: any) => {
          if (failNext) {
            failNext = false;
            throw new Error('disk error');
          }
          savedData = data;
        },
      } as any;
      usePlugin(mockPlugin);

      const failing = TagConfigStore.updateConfig({ bad: 1 });
      await expect(failing).rejects.toThrow('disk error');

      // 前序失败后，后续写入仍正常执行
      await TagConfigStore.updateConfig({ good: 1 });
      expect(savedData).toEqual({ good: 1 });
    });
  });
});
