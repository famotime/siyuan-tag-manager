import type { Plugin } from 'siyuan';
import { createApp, type App as VueApp } from 'vue';
import App from './App.vue';

export const DOCK_TYPE = 'tag-manager-dock';

let plugin: Plugin | null = null;

export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps) {
    plugin = pluginProps;
  }
  if (!plugin) {
    throw new Error('[siyuan-tag-manager] plugin not bound yet');
  }
  return plugin;
}

const mounts = new WeakMap<HTMLElement, VueApp>();

/**
 * 把面板挂载到 dock 容器上。multi-mount 安全：同一 host 重复调用会被忽略。
 */
export function mountPanel(host: HTMLElement): void {
  if (mounts.has(host)) {
    return;
  }
  host.classList.add('siyuan-tag-manager-host');
  const app = createApp(App);
  app.provide('plugin', usePlugin());
  app.mount(host);
  mounts.set(host, app);
}

/**
 * 卸载 dock 容器上的面板并清理关联资源
 */
export function unmountPanel(host: HTMLElement): void {
  const app = mounts.get(host);
  if (!app) {
    return;
  }
  app.unmount();
  mounts.delete(host);
  host.classList.remove('siyuan-tag-manager-host');
}

/**
 * 切换思源笔记原生标签管家 Dock 侧栏展开/折叠
 */
export function toggleTagManagerDock(dockType: string = DOCK_TYPE): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  // 1. 尝试在侧栏查找 Dock item 按钮触发原生点击
  const selectors = [
    `span.dock__item[data-type*="${dockType}"]`,
    `span.dock__item[data-type*="iconTagManager"]`,
    `[data-type*="${dockType}"]`,
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      el.click();
      return true;
    }
  }

  return false;
}
