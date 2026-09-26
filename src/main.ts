import { Plugin } from 'siyuan';
import { createApp, type App as VueApp } from 'vue';
import App from './App.vue';

let plugin: Plugin | null = null;
let vueApp: VueApp | null = null;
let containerEl: HTMLElement | null = null;

export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps) {
    plugin = pluginProps;
  }
  return plugin!;
}

/**
 * 初始化并挂载标签管家抽屉/面板
 */
export function init(pluginInstance: Plugin) {
  usePlugin(pluginInstance);

  if (document.getElementById('siyuan-tag-manager-dock')) {
    return;
  }

  containerEl = document.createElement('div');
  containerEl.id = 'siyuan-tag-manager-dock';
  containerEl.style.position = 'fixed';
  containerEl.style.top = '40px';
  containerEl.style.right = '10px';
  containerEl.style.bottom = '40px';
  containerEl.style.width = '380px';
  containerEl.style.zIndex = '999';
  containerEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
  containerEl.style.borderRadius = '8px';
  containerEl.style.overflow = 'hidden';
  containerEl.style.display = 'none'; // 默认折叠，通过顶栏触发展示

  vueApp = createApp(App);
  vueApp.mount(containerEl);
  document.body.appendChild(containerEl);
}

/**
 * 切换标签管家工作台的显示/隐藏状态
 */
export function toggleTagManagerDrawer() {
  if (!containerEl) {
    if (plugin) {
      init(plugin);
    }
  }
  if (containerEl) {
    const isHidden = containerEl.style.display === 'none';
    containerEl.style.display = isHidden ? 'flex' : 'none';
  }
}

/**
 * 销毁应用
 */
export function destroy() {
  if (vueApp) {
    vueApp.unmount();
    vueApp = null;
  }
  if (containerEl) {
    containerEl.remove();
    containerEl = null;
  }
}
