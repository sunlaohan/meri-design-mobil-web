(() => {
  'use strict';
  const root = document.documentElement;
  const cover = document.getElementById('meri-page-loader');
  const layer = document.getElementById('meri-media-loaders');
  const artwork = cover.querySelector('svg').outerHTML;
  const message = cover.querySelector('.meri-loading-message');
  const retry = cover.querySelector('button');
  const routes = new Set(__MERI_ROUTES__);
  const normalize = path => path.replace(/\/$/, '') || '/';
  const english = () => (active ? target : normalize(location.pathname)).endsWith('-en');
  const text = (zh, en) => english() ? en : zh;
  let target = normalize(location.pathname);
  let active = true;
  let revision = 0;
  let shownAt = performance.now();
  let showTimer, slowTimer, hideTimer;
  let mediaFrame;
  const media = new Map();
  const failedMedia = new WeakSet();
  const buffering = new WeakSet();
  const dots = '<span class="meri-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const painted = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function busy(value) {
    layer.inert = value;
    const container = document.getElementById('container');
    if (!container) return;
    container.inert = value;
    container.setAttribute('aria-busy', String(value));
  }
  function label(value) {
    message.textContent = value;
    if (!retry.hidden) return;
    message.insertAdjacentHTML('beforeend', dots);
  }
  function show() {
    cover.hidden = false;
    cover.removeAttribute('data-leaving');
    cover.setAttribute('aria-hidden', 'false');
    cover.setAttribute('aria-label', text('正在加载页面', 'Loading page'));
    shownAt = performance.now();
    root.setAttribute('data-meri-covered', '');
    busy(true);
  }
  function armSlowMessage() {
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      if (!active) return;
      retry.hidden = false;
      label(text('加载时间有点长，请稍候', 'Taking a little longer, please wait'));
    }, 15000);
  }
  function begin(path, immediate = false) {
    const next = normalize(new URL(path, location.href).pathname);
    if (!routes.has(next) || next === target) return;
    revision++;
    active = true;
    target = next;
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    retry.hidden = true;
    label(text('正在加载', 'Loading'));
    root.dataset.meriLoading = 'navigation';
    // Cached page switches finish before this delay and never flash a cover.
    if (immediate) show();
    else showTimer = setTimeout(show, 160);
    armSlowMessage();
  }
  function reveal() {
    active = false;
    clearTimeout(showTimer);
    clearTimeout(slowTimer);
    root.dataset.meriLoading = 'ready';
    root.removeAttribute('data-meri-covered');
    busy(false);
    cover.setAttribute('aria-hidden', 'true');
    cover.setAttribute('data-leaving', '');
    hideTimer = setTimeout(() => { cover.hidden = true; }, 210);
    document.dispatchEvent(new CustomEvent('meri:loading-complete'));
    scheduleMedia();
  }
  function imageReady(image) {
    if (image.complete) return image.decode?.().catch(() => {}) || Promise.resolve();
    return new Promise(resolve => {
      const done = () => {
        image.removeEventListener('load', done);
        image.removeEventListener('error', done);
        resolve();
      };
      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
      image.loading = 'eager';
    });
  }
  function inView(element) {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
  }
  async function rendered(container, route) {
    scheduleMedia();
    if (!active || normalize(route) !== target) return;
    const version = ++revision;
    await painted();
    const pictures = [...container.querySelectorAll('img')].filter(inView);
    await Promise.all([
      ...pictures.map(imageReady),
      Promise.race([document.fonts?.ready || Promise.resolve(), delay(1500)]),
    ]);
    // Let the site's own entrance animation settle behind the cover. Nodes at
    // the bottom edge still follow their normal scroll-reveal animation.
    const started = performance.now();
    const primary = [...container.querySelectorAll('h1, h2, img')].filter(element => {
      const box = element.getBoundingClientRect();
      return inView(element) && box.top < innerHeight * .7 && box.width > 60;
    });
    while (version === revision && performance.now() - started < 900 && primary.some(element => {
      for (let node = element; node && node !== container; node = node.parentElement) {
        if (+getComputedStyle(node).opacity < .98) return true;
      }
      return false;
    })) await delay(32);
    const minimum = cover.hidden ? 0 : 320;
    await delay(Math.max(0, minimum - (performance.now() - shownAt)));
    if (version === revision && active && normalize(location.pathname) === target) reveal();
  }
  function fail(route) {
    if (typeof route === 'string' && normalize(new URL(route, location.href).pathname) !== target) return;
    if (!active) return;
    clearTimeout(showTimer);
    clearTimeout(slowTimer);
    show();
    retry.hidden = false;
    label(text('加载遇到一点问题，请重试', 'Unable to load this page. Please retry.'));
  }
  retry.textContent = text('重新加载', 'Try again');
  cover.setAttribute('aria-label', text('正在加载页面', 'Loading page'));
  retry.addEventListener('click', () => location.reload());
  label(text('正在加载', 'Loading'));
  armSlowMessage();

  function removeMedia(element, record) {
    clearTimeout(record.timer);
    if (record.overlay) {
      record.overlay.setAttribute('data-leaving', '');
      const old = record.overlay;
      setTimeout(() => old.remove(), 170);
    }
    media.delete(element);
  }
  function positionMedia(element, record) {
    if (!record.overlay) return;
    const box = element.getBoundingClientRect();
    let top = Math.max(0, box.top), left = Math.max(0, box.left);
    let right = Math.min(innerWidth, box.right), bottom = Math.min(innerHeight, box.bottom);
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      const clip = node.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(style.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
      if (/auto|scroll|hidden|clip/.test(style.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
    }
    const controls = element.tagName === 'VIDEO' && element.controls ? 44 : 0;
    Object.assign(record.overlay.style, {
      left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${Math.max(0, box.height - controls)}px`,
      display: right > left && bottom > top ? 'flex' : 'none',
      clipPath: `inset(${Math.max(0, top - box.top)}px ${Math.max(0, box.right - right)}px ${Math.max(0, box.bottom - controls - bottom)}px ${Math.max(0, left - box.left)}px)`,
    });
    record.overlay.toggleAttribute('data-compact', box.width < 180 || box.height < 130);
  }
  function createMedia(element, record) {
    if (!element.isConnected || !inView(element)) return;
    const overlay = document.createElement('div');
    overlay.className = 'meri-media-loader';
    overlay.setAttribute('aria-hidden', String(!record.error));
    overlay.toggleAttribute('data-error', record.error);
    overlay.innerHTML = artwork;
    const caption = document.createElement('span');
    caption.className = 'meri-loading-message';
    caption.textContent = record.error ? text('内容暂未加载', 'Unable to load') : text('正在加载', 'Loading');
    if (!record.error) caption.insertAdjacentHTML('beforeend', dots);
    overlay.append(caption);
    if (record.error) {
      const button = document.createElement('button');
      button.className = 'meri-loading-retry';
      button.textContent = text('重试', 'Retry');
      button.addEventListener('click', () => {
        failedMedia.delete(element);
        removeMedia(element, record);
        if (element.tagName === 'VIDEO') element.load();
        else {
          const url = new URL(element.currentSrc || element.src, location.href);
          url.searchParams.set('retry', String(Date.now()));
          element.src = url.href;
        }
        scheduleMedia();
      });
      overlay.append(button);
      overlay.setAttribute('role', 'group');
      overlay.setAttribute('aria-label', text('内容加载失败', 'Content failed to load'));
    }
    layer.append(overlay);
    record.overlay = overlay;
    positionMedia(element, record);
  }
  function syncMedia() {
    mediaFrame = undefined;
    const elements = document.querySelectorAll('#container img, #container video, [role="dialog"] img, [role="dialog"] video');
    for (const element of elements) {
      const isVideo = element.tagName === 'VIDEO';
      const error = failedMedia.has(element) || (!isVideo && element.complete && !element.naturalWidth);
      const waiting = isVideo ? buffering.has(element) : !element.complete;
      const box = element.getBoundingClientRect();
      const candidate = (error || waiting) && box.width >= 64 && box.height >= 64 && inView(element);
      let record = media.get(element);
      if (!candidate) { if (record) removeMedia(element, record); continue; }
      if (record && record.error !== error) { removeMedia(element, record); record = undefined; }
      if (!record) {
        record = { error };
        media.set(element, record);
        const current = record;
        record.timer = setTimeout(() => { createMedia(element, current); }, error ? 0 : 180);
      }
      positionMedia(element, record);
    }
    for (const [element, record] of media) if (!element.isConnected) removeMedia(element, record);
  }
  function scheduleMedia() {
    if (!mediaFrame) mediaFrame = requestAnimationFrame(syncMedia);
  }
  const observer = new MutationObserver(scheduleMedia);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
  for (const type of ['load', 'error', 'loadstart', 'waiting', 'stalled', 'loadedmetadata', 'loadeddata', 'canplay', 'playing', 'pause', 'ended']) {
    document.addEventListener(type, event => {
      const element = event.target;
      if (!(element instanceof HTMLImageElement || element instanceof HTMLVideoElement)) return;
      if (type === 'error') failedMedia.add(element);
      else if (type === 'load' || type === 'loadeddata') failedMedia.delete(element);
      if (element instanceof HTMLVideoElement) {
        if (type === 'waiting' || (!element.paused && (type === 'stalled' || type === 'loadstart'))) buffering.add(element);
        if (['canplay', 'playing', 'pause', 'ended', 'error', 'loadeddata'].includes(type)) buffering.delete(element);
      }
      scheduleMedia();
    }, true);
  }
  document.addEventListener('scroll', scheduleMedia, { capture: true, passive: true });
  window.addEventListener('resize', scheduleMedia, { passive: true });
  document.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.download || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && normalize(url.pathname) !== normalize(location.pathname)) begin(url.href);
  }, true);
  window.addEventListener('error', event => {
    if (event.target instanceof HTMLScriptElement || event instanceof ErrorEvent) fail();
  }, true);
  window.addEventListener('unhandledrejection', fail);
  window.addEventListener('pageshow', event => {
    if (event.persisted) { revision++; reveal(); cover.hidden = true; }
  });
  window.MeriLoading = { begin, rendered, fail };
})();
