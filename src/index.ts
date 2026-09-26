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
  destroy,
  init,
  toggleTagManagerDrawer,
} from '@/main';
import '@/index.scss';
import { TagVisualService } from '@/services/TagVisualService';

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

    // 2. 加载本地持久化配置并应用动态样式
    const localData = await this.loadData(STORAGE_NAME).catch(() => null);
    if (localData && Array.isArray(localData.metadataList)) {
      const css = TagVisualService.generateCssRules(localData.metadataList);
      TagVisualService.applyStyles(css);
    }

    // 3. 注册快捷命令 (Alt+Shift+T 快速唤起标签管家工作台)
    this.addCommand({
      langKey: 'openTagManager',
      langText: '打开标签管家工作台',
      hotkey: '⌥⇧T',
      hotkeys: ['⌥⇧T', 'Alt+Shift+T'],
      enabled: () => true,
      execute: (_context: ICommandContext) => {
        toggleTagManagerDrawer();
      },
    });

    // 4. 注册顶栏图标
    this.addTopBar({
      id: 'siyuan-tag-manager-topbar',
      icon: 'iconTagManager',
      title: '标签管家 (Tag Manager)',
      callback: () => {
        toggleTagManagerDrawer();
      },
      contextMenu: (menu) => {
        menu.addItem({
          id: 'tm-open-dashboard',
          icon: 'iconTagManager',
          label: '展开工作台抽屉',
          click: () => {
            toggleTagManagerDrawer();
          },
        });
      },
    });

    // 5. 初始化挂载 Vue UI 容器
    init(this);

    showMessage('🏷️ 标签管家已成功就绪！可点击顶栏图标或按 Alt+Shift+T 唤起', 4000, 'info');
  }

  async onunload() {
    // 清理动态注入样式与 DOM
    TagVisualService.removeStyles();
    destroy();
  }

  async onDataChanged(reason?: TPluginDataChangeReason): Promise<void> {
    console.log(`[${this.name}] onDataChanged:`, reason);
  }
}
