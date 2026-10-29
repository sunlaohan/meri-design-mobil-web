# Meri Design Mobile 官网

[meridesign.cn](https://www.meridesign.cn/) 的完整本地版本，2026 年 10 月 28 日迁移。保留原站 Figma Sites 的页面数据、渲染引擎、字体、图片、视频、响应式布局及动效参数，以此保证高精度还原。

页面和资源均由本地提供，日常开发、构建和查看不需要登录或连接 Figma。Figma 组件库、开发文档等外部链接仍指向原站配置的目的地。

## 启动

安装 Node.js 20 或更新版本后，在项目目录运行：

```sh
npm run dev
```

打开 **http://localhost:5173/**。无第三方 npm 依赖，无须执行 `npm install`。`src/` 文件修改后自动重新构建，刷新浏览器即可。指定其他端口：`npm run dev -- --port 5174`。

```sh
npm run check     # 构建并校验全部页面、资源和文件完整性
npm run build     # 生成 dist/
npm run preview   # 查看已有构建产物
```

## 页面

| 中文 | English |
| --- | --- |
| `/` 首页 | `/home-en` |
| `/user-guide` 使用指南 | `/user-guide-en` |
| `/usage-specification` 组件使用规范 | `/usage-specification-en` |
| `/consistency` 移动端一致性 | `/consistency-en` |
| `/update-log` 更新日志 | `/update-log-en` |

## 通过 Codex 维护

直接在这个项目里描述需求即可，例如“修改首页介绍，中英文都更新”“新增一条更新日志”“调整组件规范的手机端目录”。项目中的 `AGENTS.md` 说明了维护入口和视觉一致性要求。

| 内容 | 修改位置 |
| --- | --- |
| 页面文案 | `src/content/<页面>.json` 的 `text` |
| 外部链接 | `src/content/links.json` 的 `url` |
| 布局、组件、断点、动效和新内容 | `src/design/<页面>.json` |
| 额外样式 | `src/styles/custom.css` |
| 额外交互 | `src/behaviors/custom.js` |
| 图片、字体、视频 | `public/` 与 `src/assets-manifest.json` |

这是原站发布数据的本地工程，并非从截图近似重画，也不是 Figma 编辑文件的 React/TSX 源码导出。原始渲染器作为 vendor 保留；设计数据和内容可以在本地修改，构建会自动切换修改页面的渲染方式。详见 [维护说明](docs/MAINTENANCE.md)。

## 后续部署

`dist/` 是完整静态网站，可放到支持静态目录的 Nginx、Netlify、Cloudflare Pages 等服务。保留所有文件，以及每个路由的 `index.html`。Node 本地服务支持视频 Range 请求，部署服务也应支持。默认保留原站禁止搜索收录的设置。

2026 年 10 月 29 日已在 Netlify 团队 `sunshifu` 下创建并部署 `meri-design-mobil`：

- 站点：<https://meri-design-mobil.netlify.app>
- 管理后台：<https://app.netlify.com/projects/meri-design-mobil>
- 本地关联：`.netlify/state.json`；构建配置：`netlify.toml`。
- 部署验证记录：`docs/netlify-deployment.json`。

项目继承团队的私有可见性默认设置；公开访问需在 Netlify 后台点击 **Make public**，或在 **Project configuration > General > Visitor access > Project visibility** 中选择 **Public** 并保存。
