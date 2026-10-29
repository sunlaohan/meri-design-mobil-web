import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const bundle = '57601274-0046-46ba-bd25-2596db6a99b5';
const runtimePath = '_runtimes/sites-runtime.e19e2ab0117c1ea7fc8baab6cfdfb701ffa09c9a61fb54563c549cb84ba12c12.js';
const json = async name => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const digest = data => createHash('sha256').update(data).digest('hex');

async function write(relative, value) {
  const target = path.join(output, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, value);
}

function transformScene(value, text, links) {
  if (Array.isArray(value)) return value.map(item => transformScene(item, text, links));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      key === 'characters' && text.has(item) ? text.get(item) : transformScene(item, text, links)]));
  }
  return typeof value === 'string' && links.has(value) ? links.get(value) : value;
}

export async function build({ clean = true } = {}) {
  const [routes, assets, baseline, linkEntries] = await Promise.all([
    json('src/routes.json'), json('src/assets-manifest.json'), json('src/import-baseline.json'), json('src/content/links.json'),
  ]);
  if (clean) await rm(output, { force: true, recursive: true });
  await mkdir(output, { recursive: true });
  // Only publish indexed resources; original PNG copies retained for reference
  // need not inflate every development build or future static deployment.
  for (let offset = 0; offset < assets.length; offset += 16) {
    await Promise.all(assets.slice(offset, offset + 16).map(async asset => {
      const relative = asset.file.replace(/^\//, '');
      await mkdir(path.dirname(path.join(output, relative)), { recursive: true });
      await cp(path.join(root, 'public', relative), path.join(output, relative));
    }));
  }
  const assetMap = Object.fromEntries(assets.map(asset => [asset.url, asset.file]));
  const links = new Map(linkEntries.filter(item => item.original !== item.url).map(item => [item.original, item.url]));
  const changedPages = [];

  for (const { route, slug } of routes) {
    const sceneSource = await readFile(path.join(root, 'src/design', `${slug}.json`), 'utf8');
    const entries = await json(`src/content/${slug}.json`);
    const text = new Map(entries.filter(item => item.original !== item.text).map(item => [item.original, item.text]));
    const changed = digest(sceneSource) !== baseline.scenes[slug] || text.size > 0 || links.size > 0;
    const scene = transformScene(JSON.parse(sceneSource), text, links);
    await write(`_json/${bundle}/${route.slice(1) || '_index'}.json`, JSON.stringify(scene));

    let html = await readFile(path.join(root, 'src/pages', `${slug}.html`), 'utf8');
    html = html.replace(/<script type="module">[\s\S]*?<\/script>/g,
      '<script type="module" src="/local/entry.js"></script>');
    html = html.replace('<html lang="en">', `<html lang="${slug.endsWith('-en') ? 'en' : 'zh-CN'}">`);
    html = html.replace('<head>', '<head>\n    <link rel="icon" href="/_assets/v11/ed9af64e3509a41e2633c90fe5f34154a9253e27.png">\n    <link rel="stylesheet" href="/local/custom.css">');
    html = html.replace('<body', `<body data-page="${slug}"`);
    if (changed) {
      changedPages.push(slug);
      html = html.replace('id="container"', 'id="container" data-local-render="client"');
    }
    // Replace complete URLs, longest first, so a base file does not swallow its
    // responsive variant. Runtime rendering uses the same mapping above.
    for (const [url, file] of Object.entries(assetMap).sort((a, b) => b[0].length - a[0].length)) {
      if (url !== file) html = html.split(url).join(file);
    }
    for (const [before, after] of links) html = html.split(before).join(after);
    await write(route === '/' ? 'index.html' : `${route.slice(1)}/index.html`, html);
  }

  // Export only a bridge to the already bundled React client. The vendor
  // rendering implementation and all of its animation code stay unchanged.
  let runtime = await readFile(path.join(root, 'public', runtimePath), 'utf8');
  runtime += '\nexport { pO as LocalReactDOMClient };\n';
  await write(runtimePath, runtime);
  await write('local/entry.js', await readFile(path.join(root, 'src/entry.js')));
  await write('local/custom.js', await readFile(path.join(root, 'src/behaviors/custom.js')));
  await write('local/custom.css', await readFile(path.join(root, 'src/styles/custom.css')));
  await write('local/asset-map.json', JSON.stringify(assetMap));
  await write('404.html', '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>页面不存在 · Meri Design</title><style>body{font:16px system-ui;padding:80px;color:#424c59}a{color:#246fe5}</style><h1>页面不存在</h1><a href="/">返回 Meri Design 首页</a></html>');
  await write('robots.txt', 'User-agent: *\nDisallow: /\n');
  console.log(`Built ${routes.length} pages and ${assets.length} local resources.${changedPages.length ? ` Fresh rendering: ${changedPages.join(', ')}.` : ''}`);
  return { routes, assets, changedPages };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
