/**
 * Local interaction enhancements. Called after the page and every internal
 * navigation render. Return a cleanup function for listeners/observers.
 * Keep page-specific behavior here instead of editing the vendor engine.
 */
export function enhancePage({ container, route }) {
  const isDocumentation = /^\/(user-guide|usage-specification|consistency|update-log)(-en)?$/.test(route);
  const buttonLabels = new Map();

  let entries = [];
  let menu;
  let scrollRoot;
  let current;
  let clicked;
  let frame;
  let settleTimer;
  const restoreAttributes = [];
  const normalize = text => text.trim().replace(/\s+/g, ' ').toLowerCase();
  // Update-log dates sit inside a header row alongside the version label.
  const headingOf = section => section.firstElementChild?.matches('.textContents')
    ? section.firstElementChild : section.firstElementChild?.querySelector('.textContents');


  function labelImageButtons() {
    for (const button of container.querySelectorAll('button')) {
      if (button.textContent.trim() || (button.hasAttribute('aria-label') && !buttonLabels.has(button))) continue;
      const picture = button.querySelector('img[alt], [role="img"][aria-label], svg[aria-label]');
      if (!picture) continue;
      const originalLabel = picture.getAttribute('alt') || picture.getAttribute('aria-label');
      let label = originalLabel;
      if (originalLabel === '打开导航') label = route.endsWith('-en') ? 'Open navigation' : '打开导航';
      else if (originalLabel === '关闭导航') label = route.endsWith('-en') ? 'Close navigation' : '关闭导航';
      else if (!originalLabel || originalLabel === 'img') label = route.endsWith('-en') ? 'Open image preview' : '查看大图';
      if (!buttonLabels.has(button)) buttonLabels.set(button, button.getAttribute('aria-label'));
      button.setAttribute('aria-label', label);
    }
  }

  function rememberAttribute(element, name, value) {
    const original = element.getAttribute(name);
    restoreAttributes.push(() => {
      if (original === null) element.removeAttribute(name);
      else element.setAttribute(name, original);
    });
    element.setAttribute(name, value);
  }

  function select(entry) {
    if (!entry) return;
    if (current !== entry) {
      current = entry;
      for (const item of entries) {
        if (item === entry) item.button.setAttribute('aria-current', 'location');
        else item.button.removeAttribute('aria-current');
      }
    }

    // Only scroll the directory itself; scrollIntoView also moves the article.
    const bounds = menu.getBoundingClientRect();
    const buttonBounds = entry.button.getBoundingClientRect();
    if (buttonBounds.top < bounds.top) menu.scrollTop += buttonBounds.top - bounds.top;
    else if (buttonBounds.bottom > bounds.bottom) menu.scrollTop += buttonBounds.bottom - bounds.bottom;
  }

  function sync() {
    frame = undefined;
    if (!scrollRoot || clicked) return;
    const top = scrollRoot.getBoundingClientRect().top;
    const readingLine = top + Math.min(80, scrollRoot.clientHeight * 0.2) + 2;
    let active = entries[0];
    for (const entry of entries) {
      if (entry.section.getBoundingClientRect().top <= readingLine) active = entry;
    }
    if (scrollRoot.scrollTop > 0 &&
        scrollRoot.scrollHeight - scrollRoot.clientHeight - scrollRoot.scrollTop <= 2) {
      active = entries.at(-1);
    }
    select(active);
  }

  function scheduleSync() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function resizeMenu() {
    if (menu) {
      menu.style.setProperty('--side-nav-height', `${Math.max(52, innerHeight - menu.getBoundingClientRect().top - 24)}px`);
    }
    scheduleSync();
  }

  const resizeObserver = new ResizeObserver(resizeMenu);

  function reset() {
    resizeObserver.disconnect();
    cancelAnimationFrame(frame);
    frame = undefined;
    clearTimeout(settleTimer);
    clicked = current = undefined;
    if (menu) {
      menu.style.removeProperty('--side-nav-height');
    }
    for (const restore of restoreAttributes.splice(0)) restore();
    entries = [];
    menu = scrollRoot = undefined;
  }

  function connect() {
    if (!isDocumentation) return;
    // These shared imported classes identify the directory buttons and the
    // article's direct section list across all eight documentation routes.
    const navigation = container.querySelector('nav[aria-label="本页目录"], nav[aria-label="On this page"]');
    const buttons = [...(navigation || container).querySelectorAll(navigation ? 'button' : 'button.css-iyqo1d')];
    const firstSection = container.querySelector('main section');
    const article = firstSection?.parentElement || container.querySelector('.css-q0vn01');
    const sections = article ? [...article.children].filter(section => headingOf(section)) : [];
    if (buttons.length === entries.length && buttons.every((button, i) =>
      button === entries[i].button && sections.includes(entries[i].section))) return;
    reset();
    if (!buttons.length || !sections.length) return;

    // Resolve headings by label first. Imported labels may use shortened
    // wording; use section order only when both lists have the same length.
    const pairs = buttons.map((button, index) => {
      const title = normalize(button.textContent);
      const heading = title === '禁用提示' ? '禁用点击提示' : title;
      const section = sections.find(item => normalize(headingOf(item).textContent) === heading)
        || (sections.length === buttons.length ? sections[index] : undefined);
      return { button, section };
    });
    if (pairs.some(entry => !entry.section)) return;

    let root = article.parentElement;
    while (root && !/^(auto|scroll)$/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    if (!root) return;
    entries = pairs;
    scrollRoot = root;
    menu = buttons[0].parentElement;
    rememberAttribute(menu, 'data-meri-side-nav', '');
    rememberAttribute(menu, 'role', 'navigation');
    rememberAttribute(menu, 'aria-label', route.endsWith('-en') ? 'On this page' : '本页目录');
    entries.forEach((entry, index) => {
      rememberAttribute(entry.button, 'data-meri-side-nav-item', '');
      rememberAttribute(entry.button, 'aria-current', 'false');
      if (!entry.section.id) rememberAttribute(entry.section, 'id', `meri-section-${index + 1}`);
      rememberAttribute(entry.button, 'aria-controls', entry.section.id);
    });
    resizeMenu();
    resizeObserver.observe(scrollRoot);
    resizeObserver.observe(article);
  }

  function releaseClick() {
    clearTimeout(settleTimer);
    clicked = undefined;
  }

  function onClick(event) {
    const entry = entries.find(item => item.button.contains(event.target));
    if (!entry) return;
    event.preventDefault();
    event.stopPropagation();
    releaseClick();
    clicked = entry;
    select(entry);
    const top = scrollRoot.scrollTop + entry.section.getBoundingClientRect().top
      - scrollRoot.getBoundingClientRect().top;
    scrollRoot.scrollTo({
      top,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
    // Preserve the clicked item while the smooth scroll crosses
    // intervening sections. A click on an already visible target may not scroll.
    settleTimer = setTimeout(releaseClick, 500);
  }

  function onScroll(event) {
    if (event.target !== scrollRoot) return;
    if (clicked) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(releaseClick, 160);
    } else scheduleSync();
  }

  function onScrollInput(event) {
    if (event.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    releaseClick();
  }

  const mutationObserver = new MutationObserver(() => {
    labelImageButtons();
    connect();
  });
  mutationObserver.observe(container, { childList: true, subtree: true });
  container.addEventListener('click', onClick, true);
  container.addEventListener('scroll', onScroll, true);
  container.addEventListener('wheel', onScrollInput, { passive: true });
  container.addEventListener('touchstart', onScrollInput, { passive: true });
  container.addEventListener('keydown', onScrollInput);
  window.addEventListener('resize', resizeMenu);
  labelImageButtons();
  connect();

  return () => {
    mutationObserver.disconnect();
    cancelAnimationFrame(frame);
    reset();
    for (const [button, original] of buttonLabels) {
      if (original === null) button.removeAttribute('aria-label');
      else button.setAttribute('aria-label', original);
    }
    buttonLabels.clear();
    container.removeEventListener('click', onClick, true);
    container.removeEventListener('scroll', onScroll, true);
    container.removeEventListener('wheel', onScrollInput);
    container.removeEventListener('touchstart', onScrollInput);
    container.removeEventListener('keydown', onScrollInput);
    window.removeEventListener('resize', resizeMenu);
  };
}
