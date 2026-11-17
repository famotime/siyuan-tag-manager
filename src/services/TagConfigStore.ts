import { usePlugin } from '../main';

/**
 * 插件配置统一存储名（全库唯一常量，禁止各处硬编码）
 */
export const TAG_MANAGER_CONFIG_STORAGE = 'tag-manager-config.json';

/**
 * 插件配置统一存储服务
 *
 * 历史缺陷：useTagFilter.saveSmartView 直接以两字段整文件覆盖配置，
 * 导致标签分组/自定义标签/伴生配置/删除策略等数据丢失。
 * 自本服务起，所有配置写入必须经 updateConfig 的读-合并-写语义完成。
 */
export class TagConfigStore {
  /**
   * 读取当前持久化的完整配置
   * 无文件、内容为空或损坏时返回空对象，不抛出
   */
  public static async readConfig(): Promise<Record<string, any>> {
    try {
      const plugin = usePlugin();
      const data = await plugin.loadData(TAG_MANAGER_CONFIG_STORAGE);
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  /**
   * 读-合并-写：仅覆盖传入字段，保留配置文件中的其余字段
   */
  public static async updateConfig(partial: Record<string, any>): Promise<void> {
    const plugin = usePlugin();
    const current = await this.readConfig();
    await plugin.saveData(TAG_MANAGER_CONFIG_STORAGE, { ...current, ...partial });
  }
}
