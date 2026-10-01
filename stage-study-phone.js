/* Phone shell from Stage Sketch's initPhoneViewerWorkspace. Reuses original inputs and handlers. */
(() => {
  'use strict';
  const phone = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 600;
  if (!phone) return;
  const $ = id => document.getElementById(id), shell = document.querySelector('.study-shell'), orientation = matchMedia('(orientation: portrait)');
  const words = { menu: ['メニュー', 'Menu'], light: ['照明のみ（作業灯なし）', 'Show lighting only (work light off)'], info: ['ショー情報', 'Show information'], settings: ['設定', 'Settings'], sceneInfo: ['場面情報', 'Scene information'], scenes: ['場面一覧', 'Scenes'], tools: ['書き込み', 'Draw'], memo: ['自分用メモ', 'My notes'], memoShort: ['メモ', 'Notes'], close: ['閉じる', 'Close'], view: ['舞台図を切り替える', 'Switch stage view'], both: ['両方', 'Both'], front: ['正面', 'Front'], plan: ['平面', 'Plan'], play: ['転換再生', 'Replay'], stop: ['停止', 'Stop'], share: ['オーナーへ共有', 'Share with owner'] };
  const t = key => words[key][document.documentElement.lang === 'en' ? 1 : 0], make = (tag, className) => Object.assign(document.createElement(tag), { className });
  const paths = { light: 'M12 3v4 M5.6 5.6l2.8 2.8 M18.4 5.6l-2.8 2.8 m-7.4 .9 7.6 0 3.5 10.2h-14.6z', close: 'm3 3 10 10 M13 3 3 13', info: 'M8 7v5 M8 4v.1 M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1', both: 'M1 2h14v5H1Z M1 9h14v5H1Z', front: 'M1 3h14v10H1Z M4 3v10 M12 3v10', plan: 'M2 2h12v12H2Z M2 11h12', scenes: 'M5 3h10 M5 8h10 M5 13h10 M1 3h1 M1 8h1 M1 13h1' };
  const gearMarkup = '<circle cx="8" cy="8" r="4.2" stroke-width="1.3"/><circle cx="8" cy="8" r="1.4" stroke-width="1.3"/><path stroke-width="2.3" d="M8 3.10V1.90M11.94 5.55l1.04-.60M11.94 10.45l1.04.60M8 12.90v1.20M4.06 10.45l-1.04.60M4.06 5.55l-1.04-.60"/>';
  function icon(key) { const existing = $(key)?.querySelector('svg'); if (existing) return existing.cloneNode(true); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); for (const [k, v] of Object.entries({ viewBox: key === 'light' ? '0 0 24 24' : '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v); if (key === 'settings') { svg.innerHTML = gearMarkup; return svg; } const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[key]); svg.append(path); return svg; }
  function button(id, glyph, action) { const el = make('button', ''); el.type = 'button'; el.id = id; if (glyph) el.append(icon(glyph)); el.onclick = action; return el; }
  document.documentElement.classList.add('study-phone'); document.body.classList.add('study-phone');
  const panel = make('section', 'phone-panel'); panel.id = 'phone-panel'; panel.hidden = true; panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', 'phone-panel-title');
  const head = make('header', 'phone-panel-head'), title = make('h2', ''); title.id = 'phone-panel-title'; const close = button('phone-close', 'close', () => show('')); head.append(title, close); const contents = make('div', 'phone-panel-content'); panel.append(head, contents); shell.append(panel);
  const panes = {}; for (const key of ['info', 'settings', 'sceneInfo', 'scenes', 'tools', 'memo', 'menu']) { panes[key] = make('section', ''); panes[key].hidden = true; contents.append(panes[key]); }
  const nav = make('nav', 'phone-scenes'); const previous = button('phone-prev', 'study-prev', () => $('study-prev').click()), current = button('phone-current', null, () => show('scenes')), next = button('phone-next', 'study-next', () => $('study-next').click()); current.className = 'phone-current'; const sceneListButton = button('phone-scene-list', 'scenes', () => show('scenes')), sceneInfo = button('phone-scene-info', 'info', () => { if (sceneInfo.getAttribute('aria-disabled') !== 'true') show('sceneInfo'); }); nav.append(current, sceneListButton, sceneInfo); shell.append(nav);
  const actions = make('nav', 'phone-tools'); shell.append(actions);
  const topActions = make('nav', 'phone-header-actions'), views = make('div', 'phone-views');
  views.setAttribute('role', 'group');
  const viewButtons = Object.fromEntries(['front', 'plan', 'both'].map(key => {
    const b = button('phone-view-' + key, key, () => { $('study-view').value = key; $('study-view').dispatchEvent(new Event('change')); sync(); });
    views.append(b); return [key, b];
  }));
  const lightKey = 'stage-study-phone-light';
  let lightMode = 'work', hasLights = false;
  try { if (localStorage.getItem(lightKey) === 'show') lightMode = 'show'; } catch { /* Display remains usable without storage. */ }
  const lightFrame = () => $('study-frame-host').querySelector('iframe');
  function applyLight() {
    // Same opaque-origin sandbox and targetOrigin as stage-study-viewer.js.
    lightFrame()?.contentWindow?.postMessage({ channel: 'stage-study', action: 'light', mode: hasLights ? lightMode : 'work' }, '*');
  }
  const light = button('phone-light', 'light', () => {
    lightMode = lightMode === 'work' ? 'show' : 'work';
    try { localStorage.setItem(lightKey, lightMode); } catch { /* Keep the current display choice in memory. */ }
    applyLight(); sync();
  });
  light.hidden = true;
  window.addEventListener('message', event => {
    const frame = lightFrame();
    if (!frame || event.source !== frame.contentWindow || event.origin !== 'null' || event.data?.channel !== 'stage-study') return;
    if (event.data.action === 'ready') { hasLights = false; sync(); }
    if (event.data.action === 'light-capability') { hasLights = event.data.hasLights === true; applyLight(); sync(); }
    if (event.data.action === 'loaded') applyLight();
  });
  // A replacement frame must not inherit the old show's capability while loading.
  new MutationObserver(() => { hasLights = false; sync(); }).observe($('study-frame-host'), { childList: true });
  const steps = make('div', 'phone-steps'); steps.append(previous, next); actions.append(steps);
  const play = button('phone-play', 'study-replay', () => { $('study-pen-status').textContent.includes(document.documentElement.lang === 'en' ? 'hidden during replay' : '再生中') ? $('study-stop').click() : $('study-replay').click(); sync(); });
  const tools = button('phone-tools', 'study-pen', () => show('tools')), memo = button('phone-memo', 'study-sticky', () => show('memo'));
  for (const el of [play, tools, memo]) { el.append(make('span', '')); actions.append(el); }
  const settings = button('phone-settings', 'settings', () => show('settings')), info = button('phone-info', 'info', () => show('info')); topActions.append(light, views, info, settings); document.querySelector('.study-header').append(topActions);
  const menu = button('phone-menu', 'scenes', () => show('menu')); menu.append(make('span', '')); actions.prepend(menu);
  const header = document.querySelector('.study-header');
  const brand = document.querySelector('.study-header h1'), defaultBrand = brand.textContent;
  const detail = make('section', 'phone-detail'), sceneNote = $('study-scene-note'); detail.hidden = true; shell.append(detail);
  const backdrop = make('div', 'phone-backdrop'); backdrop.hidden = true; backdrop.setAttribute('aria-hidden', 'true'); shell.append(backdrop);
  const modalKeys = new Set(['info', 'settings', 'scenes', 'sceneInfo']);
  panes.tools.append(document.querySelector('.study-controls')); panes.memo.append(document.querySelector('.study-memo'));
  const share = make('details', 'phone-share'), shareTitle = make('summary', ''); share.append(shareTitle); const shareBlock = document.querySelector('.study-share'); shareBlock.before(share); share.append(shareBlock);
  panes.info.append(document.querySelector('.study-show-info'), $('study-change-summary'));
  panes.settings.append(document.querySelector('.study-kicker'), document.querySelector('.study-header-actions'), $('study-account'));
  panes.sceneInfo.append(sceneNote);
  const sceneList = make('div', 'phone-scene-list'); panes.scenes.append(sceneList); let opened = '', opener = null, listSignature = '';
  function show(key) {
    if (opened === key) key = '';
    if (key && !opened) opener = document.activeElement;
    opened = key; panel.hidden = !key;
    const modal = modalKeys.has(key);
    panel.classList.toggle('phone-modal', modal); backdrop.hidden = !modal;
    panel.setAttribute('role', modal ? 'dialog' : 'region');
    if (modal) panel.setAttribute('aria-modal', 'true'); else panel.removeAttribute('aria-modal');
    for (const child of shell.children) if (child !== panel && child !== backdrop) child.inert = modal;
    for (const [name, pane] of Object.entries(panes)) pane.hidden = name !== key;
    contents.scrollTop = 0; sync();
    if (key) close.focus({ preventScroll: true });
    else { (opener?.getClientRects().length ? opener : menu).focus({ preventScroll: true }); opener = null; }
  }
  const alert = make('p', 'phone-alert'); alert.setAttribute('role', 'status'); alert.hidden = true; shell.append(alert);
  function sync() {
    const ready = !$('study-workspace').hidden && !$('study-note-fields').disabled;
    previous.disabled = $('study-prev').disabled || !ready; next.disabled = $('study-next').disabled || !ready; previous.setAttribute('aria-label', $('study-prev').getAttribute('aria-label')); next.setAttribute('aria-label', $('study-next').getAttribute('aria-label'));
    current.textContent = $('study-scene-heading').textContent || t('scenes'); current.disabled = !ready; current.setAttribute('aria-label', t('scenes') + ' · ' + current.textContent);
    const replay = $('study-pen-status').textContent.includes(document.documentElement.lang === 'en' ? 'hidden during replay' : '再生中'); play.replaceChildren(icon(replay ? 'study-stop' : 'study-replay'), Object.assign(make('span', ''), { textContent: t(replay ? 'stop' : 'play') })); play.disabled = !ready || (!replay && $('study-replay').disabled); play.setAttribute('aria-label', replay ? $('study-stop').title : $('study-replay').title);
    light.hidden = !hasLights; light.disabled = !ready || !hasLights;
    light.setAttribute('aria-pressed', String(lightMode === 'show'));
    light.setAttribute('aria-label', t('light')); light.title = t('light');
    views.setAttribute('aria-label', t('view'));
    for (const [key, b] of Object.entries(viewButtons)) {
      b.disabled = !ready || $('study-view').disabled;
      b.setAttribute('aria-label', t(key)); b.title = t(key);
      b.setAttribute('aria-pressed', String($('study-view').value === key));
    }
    const showTitle = $('study-title').textContent || defaultBrand;
    if (brand.textContent !== showTitle) brand.textContent = showTitle;
    brand.title = showTitle;
    const hasNote = ready && Boolean(sceneNote.textContent.trim());
    sceneListButton.disabled = !ready || $('study-scenes').disabled;
    sceneInfo.setAttribute('aria-disabled', String(!hasNote)); sceneInfo.classList.toggle('has-note', hasNote);
    const inline = hasNote && orientation.matches && ['front', 'plan'].includes($('study-view').value);
    detail.hidden = !inline;
    // Keep a single canonical note node; the inline area keeps its place while the modal is open.
    const noteParent = opened === 'sceneInfo' || !inline ? panes.sceneInfo : detail;
    if (sceneNote.parentNode !== noteParent) noteParent.append(sceneNote);
    if (opened === 'sceneInfo' && !hasNote) { show(''); return; }
    for (const [el, key] of [[menu, 'menu'], [tools, 'tools'], [memo, 'memo'], [settings, 'settings'], [info, 'info'], [current, 'scenes'], [sceneListButton, 'scenes'], [sceneInfo, 'sceneInfo']]) { if (el.querySelector('span')) el.querySelector('span').textContent = t(key === 'memo' ? 'memoShort' : key); if (el !== current) { el.setAttribute('aria-label', t(key)); el.title = t(key); } el.setAttribute('aria-expanded', String(opened === key)); el.setAttribute('aria-controls', 'phone-panel'); }
    tools.disabled = !ready || $('study-pen').disabled; memo.disabled = !ready; tools.setAttribute('aria-pressed', $('study-pen').getAttribute('aria-pressed')); close.setAttribute('aria-label', t('close')); if (opened) title.textContent = t(opened); shareTitle.textContent = t('share');
    const opts = [...$('study-scenes').options], signature = opts.map(o => o.value + o.textContent).join('|'); if (signature !== listSignature) { listSignature = signature; sceneList.replaceChildren(...opts.map(o => { const b = button('', null, () => { $('study-scenes').value = o.value; $('study-scenes').dispatchEvent(new Event('change')); show(''); }); b.textContent = o.textContent; b.dataset.scene = o.value; return b; })); }
    for (const b of sceneList.children) { const selected = b.dataset.scene === $('study-scenes').value; b.setAttribute('aria-current', String(selected)); b.setAttribute('aria-pressed', String(selected)); b.disabled = !ready || $('study-scenes').disabled; }
    const save = $('study-save-status'), danger = save.classList.contains('study-danger'), message = danger ? save.textContent : !opened && $('study-note-status').textContent.includes('送信できません') ? $('study-note-status').textContent : ''; if (alert.textContent !== message) alert.textContent = message; alert.hidden = !message; if ($('study-workspace').hidden && opened) show('');
  }
  function rotate(turned) { if (opened) show(''); if (orientation.matches) { shell.prepend(header); shell.append(nav); } else { panes.menu.append(header, nav); } (orientation.matches ? actions : shell).prepend(steps); steps.inert = modalKeys.has(opened); const current = $('study-view').value; $('study-view').value = turned === true ? (current === 'plan' ? 'plan' : 'front') : (orientation.matches ? 'front' : 'both'); $('study-view').dispatchEvent(new Event('change')); applyLight(); sync(); }
  orientation.addEventListener('change', () => rotate(true)); const viewport = () => shell.style.setProperty('--phone-height', (visualViewport?.height || innerHeight) + 'px'); window.visualViewport?.addEventListener('resize', viewport); window.addEventListener('resize', viewport); viewport();
  let queued = false; const observer = new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); });
  for (const id of ['study-scene-note', 'study-title', 'study-scene-heading', 'study-scenes', 'study-pen-status', 'study-save-status', 'study-note-status']) observer.observe($(id), { childList: true, subtree: true, characterData: true }); for (const id of ['study-prev', 'study-next', 'study-replay', 'study-pen', 'study-view', 'study-workspace', 'study-note-fields']) observer.observe($(id), { attributes: true, attributeFilter: ['disabled', 'hidden', 'aria-pressed'] }); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  $('study-view').addEventListener('change', sync);
  $('study-pen').addEventListener('click', () => { if ($('study-pen').getAttribute('aria-pressed') === 'true') show(''); });

  document.addEventListener('keydown', event => {
    if (!opened) return;
    if (event.key === 'Escape') { event.preventDefault(); show(''); }
    else if (event.key === 'Tab' && modalKeys.has(opened)) {
      const focusable = [...panel.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  document.addEventListener('pointerdown', event => { if (opened && !panel.contains(event.target) && !event.target.closest('.phone-tools,.phone-scenes,.phone-header-actions')) show(''); });
  rotate(); sync();
})();
