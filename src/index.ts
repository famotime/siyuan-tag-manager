import type {
  ICommandContext,
  TPluginDataChangeReason,
} from 'siyuan';
import {
  Plugin,
  Setting,
  showMessage,
} from 'siyuan';
import PluginInfoString from '@/../plugin.json';
import {
  DOCK_TYPE,
  mountPanel,
  toggleTagManagerDock,
  unmountPanel,
  usePlugin,
} from '@/main';
import '@/index.scss';
import { TagVisualService } from '@/services/TagVisualService';
import { TagDomDecorator } from '@/services/TagDomDecorator';
import { batchTagBridge } from '@/utils/batchTagBridge';
import {
  openStandaloneBatchModal,
  closeStandaloneBatchModal,
} from '@/utils/batchTagModalManager';
import { TagDropService } from '@/services/TagDropService';
import { TagCompanionService } from '@/services/TagCompanionService';
import { TagCompanionCache } from '@/services/TagCompanionCache';
import { TAG_MANAGER_CONFIG_STORAGE } from '@/services/TagConfigStore';
import type { ITagDeleteConfig, TTagDeleteMode } from '@/types/tag';
import { DEFAULT_TAG_DELETE_CONFIG } from '@/types/tag';

// 注册专属标签管家 SVG 图标
const TAG_MANAGER_ICON_SVG = `<symbol id="iconTagManager" viewBox="0 0 1024 1024">
  <path fill="currentColor" d="M938.666667 470.186667l-384-384C531.626667 63.146667 500.906667 51.2 469.333333 51.2H170.666667C104.533333 51.2 51.2 104.533333 51.2 170.666667v298.666666c0 31.573333 11.946667 62.293333 34.986667 85.333334l384 384c46.933333 46.933333 123.733333 46.933333 170.666666 0l297.813334-297.813334c46.933333-46.933333 46.933333-123.733333 0-170.666666zM277.333333 341.333333c-35.413333 0-64-28.586667-64-64s28.586667-64 64-64 64 28.586667 64 64-28.586667 64-64 64z"/>
</symbol>`;

const STORAGE_NAME = TAG_MANAGER_CONFIG_STORAGE;

let PluginInfo = {
  version: '0.9.0',
};
try {
  PluginInfo = PluginInfoString;
} catch {
  // fallback
}

export default class TagManagerPlugin extends Plugin {
  public isReadonly = false;
  public readonly version = PluginInfo.version;
  private disposeDropListener?: () => void;
  private settingDeleteSelect?: HTMLSelectElement;
  private settingDeleteInput?: HTMLInputElement;

  async onload() {
    this.isReadonly = Boolean((window as any).siyuan?.config?.readonly || (window as any).siyuan?.isPublish);

    // 1. 注册专属图标
    this.addIcons(TAG_MANAGER_ICON_SVG);

    // 2. 注入全局 plugin 实例引用
    usePlugin(this);

    // 3. 加载本地持久化配置并应用动态样式
    const localData = await this.loadData(STORAGE_NAME).catch(() => null);
    if (localData && Array.isArray(localData.metadataList)) {
      const css = TagVisualService.generateCssRules(localData.metadataList);
      TagVisualService.applyStyles(css);
    }

    // 4. 注册思源笔记原生 Dock 侧栏 (参考 siyuan-property-manager 标准实现)
    this.addDock({
      config: {
        position: 'RightTop',
        size: { width: 360, height: 0 },
        icon: 'iconTagManager',
        title: (this.i18n.dockTitle as string) ?? '标签管家',
        hotkey: '⌥⇧T',
      },
      data: {},
      type: DOCK_TYPE,
      init() {
        mountPanel(this.element as HTMLElement);
      },
      destroy() {
        unmountPanel(this.element as HTMLElement);
      },
    });

    // 5. 注册快捷命令 (⌥⇧T 快速展开/切换标签管家原生侧栏)
    this.addCommand({
      langKey: 'openTagManager',
      langText: (this.i18n.openTagManager as string) ?? '打开标签管家工作台',
      hotkey: '⌥⇧T',
      enabled: () => true,
      execute: (_context: ICommandContext) => {
        toggleTagManagerDock(DOCK_TYPE);
      },
    });

    // 6. 注册顶栏图标 (点击可快速切换原生侧栏展开/折叠)
    this.addTopBar({
      id: 'siyuan-tag-manager-topbar',
      icon: 'iconTagManager',
      title: (this.i18n.dockTitle as string) ?? '标签管家 (Tag Manager)',
      callback: () => {
        toggleTagManagerDock(DOCK_TYPE);
      },
      contextMenu: (menu) => {
        menu.addItem({
          id: 'tm-open-dock',
          icon: 'iconTagManager',
          label: (this.i18n.toggleDock as string) ?? '展开/折叠侧栏',
          click: () => {
            toggleTagManagerDock(DOCK_TYPE);
          },
        });
        menu.addItem({
          id: 'tm-open-setting',
          icon: 'iconSettings',
          label: (this.i18n.setting as string) ?? '设置',
          click: () => {
            this.openSetting();
          },
        });
      },
    });

    // 7. 启动正文文档标签 DOM 属性装饰器，实时为 span[data-type~="tag"] 注入 data-tag 与 data-content
    TagDomDecorator.startObserving();

    // 8. 监听思源 Protyle 渲染事件，确保切页与新文档即时生效
    this.eventBus.on('loaded-protyle-static', this.handleProtyleLoaded);
    this.eventBus.on('loaded-protyle-dynamic', this.handleProtyleLoaded);
    this.eventBus.on('switch-protyle', this.handleProtyleLoaded);

    // 9. 监听思源原生文档树右键菜单事件，支持选中多篇文档一键批量打标
    this.eventBus.on('open-menu-doctree', this.handleDocTreeMenu);

    // 10. 启动全局正文拖拽打标签监听器（块级末尾追加模式）
    this.disposeDropListener = TagDropService.initGlobalDropListener();

    // 11. 启动输入态基于共现图谱的伴生标签智能推荐调度服务
    TagCompanionService.init(localData?.companionConfig);

    // 12. 注册思源原生标准插件设置页（标签删除偏好）
    this.initNativeSettings(localData?.tagDeleteConfig);
  }

  private handleProtyleLoaded = (e: CustomEvent<any>) => {
    const protyleElem = e?.detail?.protyle?.element;
    TagDomDecorator.decorateElement(protyleElem || document);
  };

  private handleDocTreeMenu = (e: CustomEvent<{ menu: any; elements: HTMLElement[] }>) => {
    const elements = e.detail?.elements || [];
    const docs: Array<{ id: string; title: string }> = [];

    for (const el of elements) {
      const id = el.getAttribute('data-node-id');
      if (id) {
        const titleEl = el.querySelector('.b3-list-item__text');
        const title = titleEl?.textContent?.trim() || el.textContent?.trim() || id;
        docs.push({ id, title });
      }
    }

    if (docs.length > 0 && e.detail?.menu) {
      e.detail.menu.addItem({
        id: 'tm-batch-tag-doctree',
        icon: 'iconTagManager',
        label: `批量打标签 (${docs.length} 篇)`,
        click: () => {
          // 严禁调用 toggleTagManagerDock，避免把已展开的侧栏折叠缩回
          const dispatched = batchTagBridge.trigger(docs);
          if (!dispatched) {
            // 侧栏未挂载或未激活时，通过全局独立模态窗直接唤起，不强行展开侧栏干扰用户
            openStandaloneBatchModal(docs);
          }
        },
      });
    }
  };

  async onunload() {
    if (this.disposeDropListener) {
      this.disposeDropListener();
      this.disposeDropListener = undefined;
    }

    this.eventBus.off('open-menu-doctree', this.handleDocTreeMenu);
    this.eventBus.off('loaded-protyle-static', this.handleProtyleLoaded);
    this.eventBus.off('loaded-protyle-dynamic', this.handleProtyleLoaded);
    this.eventBus.off('switch-protyle', this.handleProtyleLoaded);

    // 清理可能的独立批量打标弹窗
    closeStandaloneBatchModal();

    // 停止伴生标签推荐服务
    TagCompanionService.destroy();

    // 停止正文 DOM 监听并清理装饰属性与样式
    TagDomDecorator.stopObserving();
    TagDomDecorator.clearDecorations();
    TagVisualService.removeStyles();
  }

  async onDataChanged(_reason?: TPluginDataChangeReason): Promise<void> {
    try {
      const localData = await this.loadData(STORAGE_NAME).catch(() => null);
      if (localData && Array.isArray(localData.metadataList)) {
        const css = TagVisualService.generateCssRules(localData.metadataList);
        TagVisualService.applyStyles(css);
      }
      if (localData?.companionConfig) {
        TagCompanionService.updateConfig(localData.companionConfig);
      }
      if (localData?.tagDeleteConfig) {
        if (this.settingDeleteSelect) {
          this.settingDeleteSelect.value = localData.tagDeleteConfig.mode || 'strip_hash';
        }
        if (this.settingDeleteInput) {
          this.settingDeleteInput.value = localData.tagDeleteConfig.replaceWith || '';
          this.settingDeleteInput.disabled = (localData.tagDeleteConfig.mode || 'strip_hash') !== 'replace_hash';
        }
      }
      TagCompanionCache.markDirty();
    } catch {
      // 容错保护，遵循 5 秒拆除预算
    }
  }

  /**
   * 初始化思源系统原生标准插件设置面板
   */
  private initNativeSettings(initialConfig?: ITagDeleteConfig) {
    const currentConfig: ITagDeleteConfig = {
      ...DEFAULT_TAG_DELETE_CONFIG,
      ...(initialConfig || {}),
    };

    const selectEl = document.createElement('select');
    selectEl.className = 'b3-select fn__flex-center fn__size200';
    selectEl.innerHTML = `
      <option value="strip_hash">#（剥离前后“#”，保持标签文字）</option>
      <option value="remove_all">#+标签文字（彻底删除标签及其文字）</option>
      <option value="replace_hash">用...替代#（自定义文本替代前后“#”）</option>
    `;
    selectEl.value = currentConfig.mode;
    this.settingDeleteSelect = selectEl;

    const inputEl = document.createElement('input');
    inputEl.className = 'b3-text-field fn__flex-center fn__size200';
    inputEl.placeholder = '例如 * 或 _（默认为空）';
    inputEl.value = currentConfig.replaceWith || '';
    inputEl.disabled = currentConfig.mode !== 'replace_hash';
    this.settingDeleteInput = inputEl;

    selectEl.addEventListener('change', () => {
      inputEl.disabled = selectEl.value !== 'replace_hash';
      if (selectEl.value === 'replace_hash') {
        inputEl.focus();
      }
    });

    this.setting = new Setting({
      confirmCallback: async () => {
        const selectedMode = selectEl.value as TTagDeleteMode;
        const replaceText = inputEl.value.trim();
        const newDeleteConfig: ITagDeleteConfig = {
          mode: selectedMode,
          replaceWith: replaceText,
        };

        const existing = await this.loadData(STORAGE_NAME).catch(() => ({}));
        await this.saveData(STORAGE_NAME, {
          ...(existing || {}),
          tagDeleteConfig: newDeleteConfig,
        });
        showMessage('标签管家设置已保存', 3000, 'info');
      },
    });

    this.setting.addItem({
      title: '非文档级标签删除模式',
      description: '段落正文内标签删除时的默认处理行为（文档级标签始终从文档属性中移除）',
      actionElement: selectEl,
    });

    this.setting.addItem({
      title: '替换字符/文本',
      description: '当删除模式为【用...替代#】时，用于替换前后“#”的内容（若留空则等同于仅移除“#”）',
      actionElement: inputEl,
    });
  }

  public openSetting() {
    if (this.settingDeleteSelect && this.settingDeleteInput) {
      this.loadData(STORAGE_NAME).then((localData) => {
        const cfg: ITagDeleteConfig = {
          ...DEFAULT_TAG_DELETE_CONFIG,
          ...(localData?.tagDeleteConfig || {}),
        };
        if (this.settingDeleteSelect) {
          this.settingDeleteSelect.value = cfg.mode;
        }
        if (this.settingDeleteInput) {
          this.settingDeleteInput.value = cfg.replaceWith || '';
          this.settingDeleteInput.disabled = cfg.mode !== 'replace_hash';
        }
      }).catch(() => null);
    }
    super.openSetting();
  }
}
