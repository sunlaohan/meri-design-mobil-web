import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { build, root } from './build.mjs';

const { routes, assets } = await build();
const output = path.join(root, 'dist');
const bundle = '57601274-0046-46ba-bd25-2596db6a99b5';
const resourcePaths = new Set(assets.map(item => item.url));
let textNodes = 0, interactions = 0, behaviors = 0, videos = 0;

for (const asset of assets) {
  const built = await readFile(path.join(output, asset.file));
  const bytes = asset.file.startsWith('/_runtimes/') ? built.subarray(0, asset.bytes) : built;
  assert.equal(bytes.length, asset.bytes, `Resource size changed: ${asset.file}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256,
    `Resource integrity failed: ${asset.file}`);
}

for (const { route, slug, rootId } of routes) {
  const scene = JSON.parse(await readFile(path.join(output, '_json', bundle, `${route.slice(1) || '_index'}.json`)));
  assert.ok(scene.nodeById[rootId], `Missing page root: ${route}`);
  const html = await readFile(path.join(output, route.slice(1), 'index.html'), 'utf8');
  assert.ok(html.includes('src="/local/entry.js"'), `Missing local entry: ${route}`);
  assert.ok(!html.includes('reportingDomain: "https://www.figma.com"'), `Remote reporting: ${route}`);
  assert.ok(!html.includes('new SitesRuntime('), `Old inline runtime: ${route}`);
  for (const value of Object.values(scene.assets)) {
    const prefix = value.type === 'VIDEO_ASSET' ? '/_videos/v1/' : '/_assets/v11/';
    if (value.url) assert.ok(resourcePaths.has(prefix + value.url), `Missing scene asset: ${slug}, ${value.url}`);
    if (value.type === 'VIDEO_ASSET') videos++;
  }
  for (const font of Object.values(scene.fonts)) {
    const urls = font.subsets
      ? font.subsets.subsetMappings.map(item => font.subsets.baseUrl + item.file)
      : [font.url.startsWith('/') ? font.url : '/_user_fonts/v1/' + font.url];
    for (const url of urls) assert.ok(resourcePaths.has(url), `Missing font ${slug}: ${url}`);
  }
  for (const node of Object.values(scene.nodeById)) {
    if (node.type === 'TEXT') textNodes++;
    interactions += node.interactions?.length || 0;
    behaviors += Object.keys(node.behaviors || {}).length;
  }
  for (const url of html.matchAll(/(?:src|href)="(\/[^"#?]+)(?:[^\"]*)"/g)) {
    const resource = url[1];
    if (resource === '/' || routes.some(item => item.route === resource)) continue;
    await stat(path.join(output, resource));
  }
}

const runtime = await readFile(path.join(output, '_runtimes/sites-runtime.e19e2ab0117c1ea7fc8baab6cfdfb701ffa09c9a61fb54563c549cb84ba12c12.js'), 'utf8');
const original = await readFile(path.join(root, 'public/_runtimes/sites-runtime.e19e2ab0117c1ea7fc8baab6cfdfb701ffa09c9a61fb54563c549cb84ba12c12.js'), 'utf8');
assert.ok(runtime.startsWith(original), 'The vendor rendering engine has been modified');
assert.ok(runtime.endsWith('export { pO as LocalReactDOMClient };\n'), 'Missing local rendering bridge');
console.log(`Verified ${routes.length} routes, ${assets.length} resource hashes, ${textNodes} text nodes, ${interactions} interactions, ${behaviors} behaviors and ${videos} video references.`);
