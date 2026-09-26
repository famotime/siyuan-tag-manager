export class Plugin {
  name = 'siyuan-tag-manager';
  displayName = '标签管家';
  i18n: Record<string, any> = {};
  eventBus = {
    on: (_type: string, _callback: any) => {},
    once: (_type: string, _callback: any) => {},
    off: (_type: string, _callback: any) => {},
    emit: (_type: string, _data?: any) => {},
  };
  addIcons() {}
  addDock() {}
  addCommand() {}
  addTopBar() {}
  loadData() { return Promise.resolve(null); }
  saveData() { return Promise.resolve(); }
  removeData() { return Promise.resolve(); }
}

export function showMessage() {}
export function getFrontend() {
  return 'desktop';
}
