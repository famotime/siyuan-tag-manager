import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

/**
 * UI 组件 SSR 渲染测试共享工具
 * 消除各 spec 逐用例重复的 createSSRApp + tooltip 指令桩 + renderToString 样板
 */

/**
 * 创建挂载了 v-tooltip 空指令桩的 SSR 测试应用
 * （工作台组件大量使用 v-tooltip；测试环境以空指令桩替代思源宿主注册）
 */
export function createTestApp(component: any, props?: Record<string, any>) {
  const app = createSSRApp(component, props);
  app.directive('tooltip', {});
  return app;
}

/**
 * 渲染组件为 HTML 字符串（断言 CSS 类名与中文文案回归的主要手段）
 */
export async function renderComponent(component: any, props?: Record<string, any>): Promise<string> {
  return renderToString(createTestApp(component, props));
}
