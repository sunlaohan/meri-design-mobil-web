# Meri Design Mobile 官网

用户要求保持 https://www.meridesign.cn/ 的视觉和交互一致，后续直接在本地由 Codex 维护。

## 项目结构和修改入口

- `src/content/<slug>.json`：日常文案。每项 `original` 是原始匹配键，**保持不变**，修改 `text`。构建会同步同页组件的对应文案。
- `src/content/links.json`：所有外部链接。保持 `original`，修改 `url`。
- `src/design/<slug>.json`：完整可编辑的设计数据；布局、断点、节点、组件变体、交互、动效均在其中。需要新增内容、调整富文本或布局时，直接修改该文件。
- `src/styles/custom.css`：局部样式调整。可用 `body[data-page="..."]` 限定页面。
- `src/behaviors/custom.js`：附加交互，导航后会调用 `enhancePage`；必须清理监听器和观察器。
- `src/entry.js`：本地渲染、资源解析和导航集成。
- `public/`：本地图片、字体、视频和 vendor 渲染引擎；文件名为原资源的稳定标识。
- `src/pages/`：原站 SSR HTML 基准，通常不用手改。
- `src/import-baseline.json`：导入时的设计数据散列，**不要在日常修改时更新**。构建据此让修改后的场景重新渲染，避免旧 SSR 覆盖修改。

## 开发

Node.js 20+，无 npm 第三方依赖。`npm run dev` 启动在 `http://localhost:5173`。修改 `src/` 会自动重新构建，**浏览器需刷新**。端口冲突可用 `npm run dev -- --port 5174`。

`npm run check` 执行完整构建、页面和资源完整性验证；`npm run build` 输出 `dist/`；`npm run preview` 查看构建产物。不要手改 `dist/`。

## 维护规则

1. 不引入新的 reset 或 UI 框架覆盖现有排版。用户已指定全站字体优先苹方（PingFang SC/TC），缺失时回退系统默认字体；统一入口在 `src/styles/custom.css`。其他响应式和动效保留。
2. 设计数据包含共享组件定义和实例覆盖。更改某段内容时检查相应 `overrides`，以及中文/英文和桌面/手机变体。不随意删除节点 ID、组件绑定或 `characterStyleOverrides`。
3. 修改简单文案用 `src/content/`。新增长度不同的富文本时，同时检查 `characterStyleOverrides` 和 `styleOverrideTable` 的位置与长度。
4. 默认不要修改 `public/_runtimes/`、`public/_components/` 的压缩 vendor 文件。优先用设计数据、样式或附加交互修复。
5. 原站链接/联系方式均按迁移时的内容保留；不要推测并替换外部目的地。
6. 用 CUA 浏览器核对修改页面的桌面和手机表现；需要完全一致时保存同尺寸原站与本地截图。演示视频和动画应考虑时序，不能凭一次静态截图断定完全一致。
7. `scripts/import-original.py` 是一次性的重新导入工具，会覆盖本地设计、内容和导入基准；正常维护**不要运行**。

更多说明见 `README.md` 和 `docs/MAINTENANCE.md`。
