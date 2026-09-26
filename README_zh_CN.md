# Siyuan Plugin Template - Vite & Vue3

[English](./README.md)

> 本例同 [siyuan/plugin-sample](https://github.com/siyuan-note/plugin-sample).

1. 使用 Vite 打包
2. 使用 Vue3 进行开发
3. 提供一个github action 模板，能自动生成package.zip并上传到新版本中
4. 提供自动更新 `plugin.json` 中的 `version` 并发布新版本的脚本。[link](#release-script)

## 兼容性基线

- 思源版本：`3.8.5` 或更高版本
- 插件类型包：`siyuan@1.2.8`
- `plugin.json` 多语言键：RFC 5646（`en-US`、`zh-CN`）
- 本模板同时支持前端插件和后端内核（Kernel）插件。通过 `src/kernel.ts` 构建 `kernel.js`，并在 `plugin.json` 中声明了 `kernels` 与 `publish` 发布支持。

SiYuan 3.8.x 新增了端到端强类型内核 API 契约系统、插件发布服务机制（`loadPublishData`/`savePublishData` 与 `publish` 字段声明）、`openInputDialog` 统一对话框组件、顶栏右键上下文菜单、命令多快捷键与条件控制、数据库日历/列表视图、富文本表格单元格及列表思维导图等。

参考资料：

- [官方内核 API](https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md)
- [官方插件示例](https://github.com/siyuan-note/plugin-sample)
- [Petal / 插件类型定义](https://github.com/siyuan-note/petal)
- [本项目 v3.8.5 迁移指南](./developer_docs/00-version/SiYuan-v3.8.5开发进展与API迁移指南.md)

> [!NOTE]
>
> 在开始之前，你需要先安装 [NodeJS](https://nodejs.org/en/download) 和 [pnpm](https://pnpm.io/installation)。

## 开始

1. 通过 `Use the template` 按钮，以该仓库为模板创建你自己的项目。
> [!WARNING]
>
> 请注意库名和插件名称一致，默认分支必须为 `main`.

> [!WARNING]
>
> 初次尝试，请不要修改任何内容，直接通过下述方式，成功在思源里加载插件模板以后，再进行调整。
>
> 例如删除 README_zh_CN.md 也会导致插件加载不成功。


2. 使用 `git clone` 克隆创建好的仓库。
3. 使用 `pnpm i` 安装项目所需的依赖。

4. 复制 `.env.example` 文件并取名为 `.env`，修改其中的 `VITE_SIYUAN_WORKSPACE_PATH` 为你的思源工作空间。


> [!TIP]
>
> 如果你不喜欢将项目打包至工作空间中，可以使用 `软链接` 的方式。
>
> 直接写入思源空间下，可通过思源的同步功能直接同步至其他设备，而软链接的方式则不会参与同步。
> 
> 本模板不提供软链接的具体内容，相关内容可参考 [plugin-sample-vite-svelte](https://github.com/siyuan-note/plugin-sample-vite-svelte)。
> 


5. 使用 `pnpm dev` 启动项目，看到类似下面的内容表示构建成功

  ```

  > plugin-sample-vite-vue@0.0.1 dev /path/to/your/plugin-sample-vite-vue
  > vite build --watch

  mode=> production
  env=> {
    VITE_SIYUAN_WORKSPACE_PATH: '/path/to/siyuan/workspace',
  }

  Siyuan workspace path is set:
  /path/to/siyuan/workspace

  Plugin will build to:
  # ✅ 插件将会构建至下面的位置
  /path/to/siyuan/workspace/data/plugins/plugin-sample-vite-vue

  isWatch=> true
  distDir=> /path/to/siyuan/workspace/data/plugins/plugin-sample-vite-vue
  vite v6.3.5 building for production...

  watching for file changes...

  build started...
  ✓ 26 modules transformed.
  rendering chunks (1)...LiveReload enabled
  ../../Siyuan-plugin/data/plugins/plugin-sample-vite-vue/index.css    1.08 kB │ gzip:  0.41 kB
  ../../Siyuan-plugin/data/plugins/plugin-sample-vite-vue/index.js   198.60 kB │ gzip: 46.59 kB
  [vite-plugin-static-copy] Copied 7 items.
  built in 502ms.
  ```

   刷新思源，你将会在 `思源 - 设置 - 集市` 中看到名为 `plugin-sample-vite-vue` 的插件。
   
6. 启用插件, 并检查 `App.vue` 文件进行开发。

   这个文件中包含了一些代码示例。


> [!TIP]
>
> 更多的插件代码案例，请查看： [siyuan/plugin-sample/src/index.ts](https://github.com/siyuan-note/plugin-sample/blob/main/src/index.ts)



## 上架集市

### 使用 Github Action

1. 你可以在本地使用插件的版本创建一个名为 `v*` 的 tag。
2. 将创建好的 tag 推送至 Github。模板项目提供了 Action 脚本自动构建新版本。


> [!TIP]
>
> <div id="release-script"></div>这个项目提供了自动创建 `tag` 并发布新版本的脚本，你可以通过运行 `pnpm release` 创建一个修正版本。
>
> 你可以通过使用参数 `--mode=manual|patch|minor|major` 设置版本号的调整模式，或者通过 `pnpm release:manual` 的方式直接以特定参数进行发布。
>
> 完整的命令列表请查看 `package.json` 文件。


样例中自带了 github action，可以自动打包发布，请遵循以下操作：

1. 设置项目 `https://github.com/OWNER/REPO/settings/actions` 页面向下划到 Workflow Permissions，打开配置

![img](./asset/action.png)

2. 需要发布版本的时候，push 一个格式为 `v*` 的 tag，github 就会自动打包发布 release（包括 package.zip）
3. 默认使用保守策略进行 pre-release 发布，如果觉得没有必要，可以更改 release.yml 中的设置：

```yaml
- name: Release
    uses: ncipollo/release-action@v1
    with.
        allowUpdates: true
        artifactErrorsFailBuild: true
        artifacts: 'package.zip'
        token: ${{ secrets.GITHUB_TOKEN }}
        prerelease: true # change this to false
```

### 手动发布

1. 使用 `pnpm build` 构建 `package.zip`
2. 在 GitHub 上创建一个新的发布，使用插件版本号作为 “Tag version”，示例: https://github.com/siyuan-note/plugin-sample/releases
3. 上传 package.zip 作为二进制附件
4. 提交发布

> [!NOTE]
> 
> 如果是第一次发布版本，还需要创建一个 PR 到 [Community Bazaar](https://github.com/siyuan-note/bazaar)  社区集市仓库，修改该库的 plugins.json。该文件是所有社区插件库的索引，格式为：

```json
{
  "repos": [
    "username/reponame"
  ]
}
```

## 国际化

国际化方面主要考虑的是支持多语言，具体需要完成以下工作：

* 插件自身的元信息，比如插件描述和自述文件
  * `plugin.json` 中的 `displayName`、`description` 和 `readme` 字段，以及对应的 `README*.md` 文件
* 插件中使用的文本，比如按钮文字和提示信息
  * `src/i18n/*.json` 语言配置文件
  * 代码中使用 `this.i18n.key` 获取文本

建议插件至少支持英文和简体中文，不支持的语种不需要在 `plugin.json` 中声明。

## 开发者须知

开发者需注意以下规范。

### 1. 读写文件规范

插件或者外部扩展如果有直接读取或者写入 data 下文件的需求，请通过调用内核 API 来实现，**不要自行调用 `fs` 或者其他 electron、nodejs API**，否则可能会导致数据同步时分块丢失，造成云端数据损坏。

相关 API 见 `/api/file/*`（例如 `/api/file/getFile` 等）。

### 2. Daily Note 属性规范

思源在创建日记的时候会自动为文档添加 `custom-dailynote-yyyymmdd` 属性，以方便将日记文档同普通文档区分。详情请见 [Github Issue #9807](https://github.com/siyuan-note/siyuan/issues/9807)。

开发者在开发手动创建 Daily Note 的功能时请注意：

* 如果调用了 `/api/filetree/createDailyNote` 创建日记，那么文档会自动添加这个属性，无需开发者特别处理
* 如果是开发者代码手动创建文档（例如使用 `createDocWithMd` API 创建日记），请手动为文档添加该属性

---

更多有关于插件的信息，请查看： [siyuan/plugin-sample](https://github.com/siyuan-note/plugin-sample).
