import antfu from '@antfu/eslint-config'

// 配置基线：与代码库既有的“带分号 + 单引号 + 2 空格”风格保持一致，
// 让 lint 用于发现真实问题而非制造海量风格噪音
export default antfu(
  {
    type: 'lib',
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: true,
    },

    vue: true,
    typescript: true,

    formatters: true,

    ignores: [
      'dist',
      'node_modules',
    ],
  },
  {
    rules: {
      'antfu/top-level-function': 'off',
      'antfu/if-newline': 'off',

      'eqeqeq': 'off',

      'no-console': 'off',
      'no-empty': 'off',

      // 测试标题大量使用中文开头，与“小写开头”约定不兼容
      'test/prefer-lowercase-title': 'off',

      // 导入/成员按字母序重排会破坏既有按功能分组的注释结构，关闭排序类偏好规则
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'perfectionist/sort-exports': 'off',
      'perfectionist/sort-named-exports': 'off',

      // 模板事件名沿用 kebab-case（@quick-filter 等），与 camelCase 约定不兼容
      'vue/custom-event-name-casing': 'off',
      // 属性顺序与单行内容换行属布局偏好，重排现有模板代价大于收益
      'vue/attributes-order': 'off',
      'vue/singleline-html-element-content-newline': 'off',

      'style/brace-style': 'off',
      'style/no-multiple-empty-lines': ['warn', {
        max: 7,
      }],
      'style/operator-linebreak': ['warn', 'before', {
        overrides: {
          '=': 'ignore',
        },
      }],
      'style/padded-blocks': 'off',

      'ts/consistent-type-imports': 'off',
      'ts/explicit-function-return-type': 'off',
      'ts/no-require-imports': 'off',
      'ts/no-use-before-define': 'warn',
      'ts/prefer-literal-enum-member': 'off',
      'ts/strict-boolean-expressions': 'off',

      'unused-imports/no-unused-vars': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      // 参数语义由 TS 类型签名保证，仅选择性标注 @param 的注释不必强制全量对齐
      'jsdoc/check-param-names': 'off',
      'unicorn/prefer-dom-node-text-content': 'off',

      'format/prettier': 'off',

      'regexp/optimal-quantifier-concatenation': 'warn',
      'regexp/no-super-linear-backtracking': 'warn',
      'regexp/no-unused-capturing-group': 'warn',

      'style/comma-dangle': ['error', 'always-multiline'],

      'vue/block-order': ['warn', {
        order: ['template', 'script', 'style'],
      }],
      'vue/block-tag-newline': 'off',

      'vue/eqeqeq': ['warn', 'smart'],

      'vue/first-attribute-linebreak': ['warn', {
        multiline: 'below',
      }],
      'vue/no-mutating-props': ['error', {
        shallowOnly: true,
      }],
      'vue/attribute-hyphenation': 'off',
      'vue/v-on-event-hyphenation': 'off',

      'vue/html-self-closing': 'off',
      'vue/multiline-html-element-content-newline': 'off',

      'vue/valid-template-root': 'off',
    },
  },
)
