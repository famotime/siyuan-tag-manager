import type {
  ICommandContext,
  TPluginDataChangeReason,
} from 'siyuan';
import {
  Plugin,
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

// 注册专属标签管家 SVG 图标
const TAG_MANAGER_ICON_SVG = `<symbol id="iconTagManager" viewBox="0 0 1024 1024">
  <path fill="currentColor" d="M938.666667 470.186667l-384-384C531.626667 63.146667 500.906667 51.2 469.333333 51.2H170.666667C104.533333 51.2 51.2 104.533333 51.2 170.666667v298.666666c0 31.573333 11.946667 62.293333 34.986667 85.333334l384 384c46.933333 46.933333 123.733333 46.933333 170.666666 0l297.813334-297.813334c46.933333-46.933333 46.933333-123.733333 0-170.666666zM277.333333 341.333333c-35.413333 0-64-28.586667-64-64s28.586667-64 64-64 64 28.586667 64 64-28.586667 64-64 64z"/>
</symbol>`;

const STORAGE_NAME = 'tag-manager-config.json';

let PluginInfo = {
  version: '0.1.0',
};
try {
  PluginInfo = PluginInfoString;
} catch {
  // fallback
}

export default class TagManagerPlugin extends Plugin {
  public isReadonly = false;
  public readonly version = PluginInfo.version;

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

    // 5. 注册快捷命令 (Alt+Shift+T 快速展开/切换标签管家原生侧栏)
    this.addCommand({
      langKey: 'openTagManager',
      langText: (this.i18n.openTagManager as string) ?? '打开标签管家工作台',
      hotkey: '⌥⇧T',
      hotkeys: ['⌥⇧T', 'Alt+Shift+T'],
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

    showMessage('标签管家侧栏已就绪！可点击侧栏/顶栏图标或按 Alt+Shift+T 打开', 4000, 'info');
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
          toggleTagManagerDock(DOCK_TYPE);
          batchTagBridge.trigger(docs);
        },
      });
    }
  };

  async onunload() {
    this.eventBus.off('open-menu-doctree', this.handleDocTreeMenu);
    this.eventBus.off('loaded-protyle-static', this.handleProtyleLoaded);
    this.eventBus.off('loaded-protyle-dynamic', this.handleProtyleLoaded);
    this.eventBus.off('switch-protyle', this.handleProtyleLoaded);

    // 停止正文 DOM 监听并清理装饰属性与样式
    TagDomDecorator.stopObserving();
    TagDomDecorator.clearDecorations();
    TagVisualService.removeStyles();
  }

  async onDataChanged(reason?: TPluginDataChangeReason): Promise<void> {
    console.log(`[${this.name}] onDataChanged:`, reason);
  }
}
