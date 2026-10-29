# 维护说明

## 为什么保留原始渲染数据

原站由 Figma Sites 发布。浏览器中的布局依赖设计节点、组件变体、变量、响应式约束、动画时序和代码行为。迁移这些实际数据比手工根据截图估算更能保持效果一致。

工程保留可读的 JSON 设计文件，把原始压缩渲染引擎放在 `public/_runtimes/`，日常内容、样式和增强交互有独立入口。构建完全离线，运行也无需向原站请求页面、字体、图片或视频。

## 文案编辑

打开 `src/content/home.json`，搜索原文，保持 `id`、`name` 和 `original`，修改 `text`：

```json
{
  "id": "原始节点 ID",
  "name": "原始节点名称",
  "original": "原始文案",
  "text": "修改后的文案"
}
```

同页同一原文的组件和实例覆盖会同步修改。英文页独立维护。简单内容变更不必碰庞大的设计文件。

对于富文本，`characterStyleOverrides` 按字符记录样式。调整段落结构或增加带样式文本时，直接修改 `src/design/` 对应节点和样式索引。修改过的页面会全新渲染，避免原始 HTML 水合时回退到旧内容。

## 布局与交互

在 `src/design/<页面>.json` 搜索可见文案，从 `id` 回到包含该文本的父节点。`children` 是子节点 ID，`mainComponentId` 指向组件定义，`overrides` 是实例覆盖。

常见属性：`paddingTop` / `paddingLeft`、`itemSpacing`、`layoutMode`、`size`、`constraintValues`、`behaviors`、`interactions`。动效中的 `transitionDuration`、`easingFunction` 和 `state.transform` 均保留原值。

局部的视觉覆盖可写到 `src/styles/custom.css`：

```css
body[data-page="user-guide"] .某个已有类名 {
  /* 仅影响使用指南 */
}
```

附加交互在 `src/behaviors/custom.js` 的 `enhancePage` 中实现。返回 cleanup 函数；内部路由跳转后会卸载旧行为，再安装新行为。

## 加载动画

`src/loading/` 保存手绘 SVG、关键样式、加载画面和状态控制器。构建会将它们及站点样式内联到每个页面，避免外部样式表阻塞首帧；动画不依赖额外的网络请求，能在主脚本下载前直接显示。

首屏由 `src/entry.js` 的渲染回调通知加载器，等待可见图片、字体和主要入场动效就绪后淡出。页面切换显示同一加载画面，快速切换会跳过延迟出现的遮罩。图片慢加载和视频缓冲使用对应区域的小版动画，保留布局及视频控制条。长时间等待与网络失败提供重试，支持中英文及系统减少动态效果设置。验证记录见 `docs/loading-checks.json`。

## 图片、字体和视频

`src/assets-manifest.json` 记录资源的原始 URL、本地文件、大小和 SHA-256。图片包含原站的响应式尺寸版本。原站按现代浏览器 Accept 请求提供 AVIF，本地保存对应的实际版本，避免 PNG 和线上压缩图片的轻微色差。

`src/entry.js` 将所有图片和视频解析为本地文件。未命中某个尺寸的请求会回退到已保存的完整图片。更换素材时既可保留相应文件名覆盖，也可新增资源并更新清单和设计引用；清单的文件大小和 SHA-256 需要同步。

视频保存为 `.mp4`，本地服务器支持 `Range` 和 `HEAD`，可以加载、播放和拖动进度。

## 构建与检查

`npm run check` 校验全部路由、设计根节点、图片/字体/视频引用、资源完整性、本地入口和 vendor 引擎。它不启动浏览器；界面和动态交互需用浏览器补充核对。

原始基准在 `src/import-baseline.json`。不要为消除“修改”状态而更新它。页面数据或文案、链接变化后，构建会设置 `data-local-render="client"`，使用同一渲染器重新渲染该页。原始页面继续使用原 HTML 水合。

构建会根据渲染器、本地脚本、样式、资源映射和页面数据生成内容版本号，并将它加入 HTML 入口、模块依赖及数据请求的 `?v=` 参数。正式域名曾经托管于 Figma，访问者可能仍缓存了相同路径的旧渲染器；版本参数用于隔离这些旧文件，也避免后续更新混用不同版本。请保留此机制，使用 `npm run build` 生成完整产物后统一部署。旧缓存兼容性验证见 `docs/cache-compatibility.json`。

`scripts/import-original.py` 会重新下载并覆盖原始数据和内容配置，仅用于有意重新迁移。执行前应先通过 Git 保留本地维护变更。

## 来源与边界

网站素材和发布页面来自用户提供的官网；vendor 保留原始附带的第三方许可声明。没有原始 Figma 编辑文件，所以工程不包含 Figma 团队里的未发布设计稿，也不包含外链开发组件网站的源码。
