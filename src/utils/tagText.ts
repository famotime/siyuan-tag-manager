/**
 * 标签文本处理叶子工具（全库唯一规范实现）
 *
 * 历史上 # 剥离、IAL tags 解析、SQL 字面量转义散落在 10+ 处内联正则中，
 * 且 trim 与剥离顺序漂移（先剥后 trim 的实现对 " #a# " 这类带空格输入会剥离失败）。
 * 自本模块起，服务层与 UI 层一律引用此处实现，禁止内联手写等价正则。
 */

/**
 * 剥离首尾全部井号并修剪空白
 * 语义：trim -> 剥离 ^#+ / #+$ -> trim，兼容 " #标签# " 等空白包裹输入
 * 适用于：用户输入清洗、拖拽 payload（`#标签# ` 格式）还原、正文标签文本提取
 */
export function stripTagHash(input: string): string {
  if (!input) return '';
  return input.trim().replace(/^#+|#+$/g, '').trim();
}

/**
 * 从思源块 IAL 标记文本中解析 tags 属性的原始值
 * 返回属性原始串（逗号分隔，未拆分），无 tags 属性或为空时返回 ''
 */
export function parseIalTags(ial: string | null | undefined): string {
  const match = String(ial || '').match(/tags="([^"]+)"/);
  return (match && match[1]) || '';
}

/**
 * SQL 字符串字面量转义（单引号翻倍）
 * 适用于 SQLite 字符串拼接场景；LIKE 通配符转义请使用 TagFilterEngine.escapeLike
 */
export function escapeSqlLiteral(str: string): string {
  if (!str) return '';
  return str.replace(/'/g, '\'\'');
}

/**
 * SQL 值完整转义（反斜杠翻倍 + 单引号翻倍）
 * 适用于 SQL 值等值比较（content = '...' / IN (...)）场景，
 * 语义与历史 TagFilterEngine.escapeSql 保持一致；LIKE 通配符转义请使用 TagFilterEngine.escapeLike
 */
export function escapeSql(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, '\'\'');
}
