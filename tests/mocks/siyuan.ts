export class Plugin {
  name = 'siyuan-tag-manager';
  displayName = '标签管家';
  i18n: Record<string, any> = {};
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
