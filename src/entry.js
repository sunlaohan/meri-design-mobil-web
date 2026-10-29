import { SitesRuntime, LocalReactDOMClient } from '/_runtimes/sites-runtime.e19e2ab0117c1ea7fc8baab6cfdfb701ffa09c9a61fb54563c549cb84ba12c12.js';
import { enhancePage } from '/local/custom.js';

const BUNDLE = '57601274-0046-46ba-bd25-2596db6a99b5';
const container = document.getElementById('container');
const assets = await fetch('/local/asset-map.json').then(response => response.json());
let cleanup = () => {};

function updatePage() {
  const route = window.location.pathname.replace(/\/$/, '') || '/';
  document.body.dataset.page = route.slice(1) || 'home';
  document.documentElement.lang = route.endsWith('-en') ? 'en' : 'zh-CN';
  cleanup();
  cleanup = enhancePage({ container, route }) || (() => {});
  document.documentElement.dataset.siteReady = 'true';
  document.dispatchEvent(new CustomEvent('meri:page-ready', { detail: { route } }));
}

const runtime = new SitesRuntime({
  container,
  env: 'published',
  bundleId: BUNDLE,
  loadComponentsOverNetwork: true,
  assetsVersion: 'v11',
  fontsVersion: 'v1',
  videosVersion: 'v1',
  codeComponentsVersion: 'v2',
  withBaseStyles: true,
  // No error reports or telemetry are sent to Figma from the local copy.
  reportingDomain: '',
  isFigmake: false,
  enableMetaTags: true,
  renderOptions: { metronomeEnabled: true, transform3dEnabled: false },
  async getPage(route) {
    const path = route === '/' ? '/_index' : route.replace(/\/$/, '');
    const response = await fetch(`/_json/${BUNDLE}${path}.json`);
    if (!response.ok) throw new Error(`Cannot load local page: ${route} (${response.status})`);
    return { resource: await response.json(), cmsResource: null };
  },
  getAssetURL(asset, { width, height } = {}) {
    const base = `/_assets/v11/${asset}`;
    // Keep the line-art hero at its original resolution. Selecting a smaller
    // responsive candidate changes thin strokes through a second resampling.
    if (asset === 'c5518a516a25e14e7bbb7bb2171afbc8edd3a376.png') return assets[base] || base;
    const query = new URLSearchParams();
    if (width) query.set('w', width);
    if (height) query.set('h', height);
    const requested = query.size ? `${base}?${query}` : base;
    // The original image resizing variants are real local files. Requests at
    // other widths safely use the full-resolution local source image.
    return assets[requested] || assets[base] || base;
  },
  getVideoURL(_source, hash) {
    const url = `/_videos/v1/${hash}`;
    return assets[url] || url;
  },
  onPageRendered: updatePage,
  onReactError(error) { console.error('[Meri Design]', error); },
});

// A modified design scene is freshly rendered. This makes layout, animation,
// rich text and component edits work without maintaining old SSR by hand.
// Unchanged imported pages hydrate their exact original HTML for parity.
if (container.dataset.localRender === 'client') {
  runtime.hydrate = () => {
    container.replaceChildren();
    runtime.root = LocalReactDOMClient.createRoot(container);
    runtime.root.render(runtime.createWebsiteElement());
  };
}

// A back/forward-cache restore reuses the document without rendering the page
// again. Reinstall enhancements after the pagehide cleanup on every restore.
window.addEventListener('pagehide', () => {
  cleanup();
  cleanup = () => {};
  document.documentElement.dataset.siteReady = 'false';
});
window.addEventListener('pageshow', event => {
  if (event.persisted) updatePage();
});
