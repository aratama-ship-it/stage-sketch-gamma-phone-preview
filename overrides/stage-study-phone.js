/* Phone shell from Stage Sketch's initPhoneViewerWorkspace. Reuses original inputs and handlers. */
(() => {
  'use strict';
  const phone = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 600;
  if (!phone) return;
  const $ = id => document.getElementById(id), shell = document.querySelector('.study-shell'), orientation = matchMedia('(orientation: portrait)');
  const words = { lines: ['稽古', 'Lines'], sceneMode: ['シーン', 'Scene'], linesMode: ['セリフ稽古', 'Line rehearsal'], linePrev: ['前のセリフ', 'Previous line'], lineNext: ['次のセリフ', 'Next line'], upNext: ['次のセリフ', 'Up next'], lineCount: ['セリフ', 'Line'], vertical: ['セリフを縦書きにする（日本語）', 'Vertical lines (Japanese text)'], verticalHint: ['稽古モードのセリフを縦書きで表示します。', 'Shows rehearsal lines in vertical writing.'], noLines: ['この場面にセリフはありません', 'No lines in this scene'], cueMemo: ['合図', 'Cue'], linesHint: ['下の前／次ボタンでセリフのある場面へ進めます。', 'Use the previous / next buttons below to reach a scene with lines.'], menu: ['メニュー', 'Menu'], light: ['照明のみ（作業灯なし）', 'Show lighting only (work light off)'], info: ['ショー情報', 'Show information'], settings: ['設定', 'Settings'], sceneInfo: ['場面情報', 'Scene information'], scenes: ['場面一覧', 'Scenes'], tools: ['書き込み', 'Draw'], memo: ['自分用メモ', 'My notes'], memoShort: ['メモ', 'Notes'], close: ['閉じる', 'Close'], view: ['舞台図を切り替える', 'Switch stage view'], both: ['両方', 'Both'], front: ['正面', 'Front'], plan: ['平面', 'Plan'], play: ['転換再生', 'Replay'], stop: ['停止', 'Stop'], share: ['オーナーへ共有', 'Share with owner'] };
  const t = key => words[key][document.documentElement.lang === 'en' ? 1 : 0], make = (tag, className) => Object.assign(document.createElement(tag), { className });
  const paths = { lines: 'M2 2h12v9H7l-4 3v-3H2Z', lineNext: 'm11 4 4 4-4 4 M1 2h7v7H5l-3 3V9H1Z', light: 'M12 3v4 M5.6 5.6l2.8 2.8 M18.4 5.6l-2.8 2.8 m-7.4 .9 7.6 0 3.5 10.2h-14.6z', close: 'm3 3 10 10 M13 3 3 13', info: 'M8 7v5 M8 4v.1 M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1', both: 'M1 2h14v5H1Z M1 9h14v5H1Z', front: 'M1 3h14v10H1Z M4 3v10 M12 3v10', plan: 'M2 2h12v12H2Z M2 11h12', scenes: 'M5 3h10 M5 8h10 M5 13h10 M1 3h1 M1 8h1 M1 13h1' };
  const gearMarkup = '<circle cx="8" cy="8" r="4.2" stroke-width="1.3"/><circle cx="8" cy="8" r="1.4" stroke-width="1.3"/><path stroke-width="2.3" d="M8 3.10V1.90M11.94 5.55l1.04-.60M11.94 10.45l1.04.60M8 12.90v1.20M4.06 10.45l-1.04.60M4.06 5.55l-1.04-.60"/>';
  function icon(key) { const existing = $(key)?.querySelector('svg'); if (existing) return existing.cloneNode(true); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); for (const [k, v] of Object.entries({ viewBox: key === 'light' ? '0 0 24 24' : '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v); if (key === 'settings') { svg.innerHTML = gearMarkup; return svg; } const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[key]); svg.append(path); return svg; }
  function button(id, glyph, action) { const el = make('button', ''); el.type = 'button'; el.id = id; if (glyph) el.append(icon(glyph)); el.onclick = action; return el; }
  document.documentElement.classList.add('study-phone'); document.body.classList.add('study-phone');
  const panel = make('section', 'phone-panel'); panel.id = 'phone-panel'; panel.hidden = true; panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', 'phone-panel-title');
  const head = make('header', 'phone-panel-head'), title = make('h2', ''); title.id = 'phone-panel-title'; const close = button('phone-close', 'close', () => show('')); head.append(title, close); const contents = make('div', 'phone-panel-content'); panel.append(head, contents); shell.append(panel);
  const panes = {}; for (const key of ['info', 'settings', 'sceneInfo', 'scenes', 'tools', 'memo', 'menu']) { panes[key] = make('section', ''); panes[key].hidden = true; contents.append(panes[key]); }
  const nav = make('nav', 'phone-scenes'); const previous = button('phone-prev', 'study-prev', () => linesOn ? stepLine(-1) : $('study-prev').click()), current = button('phone-current', null, () => show('scenes')), next = button('phone-next', 'study-next', () => linesOn ? stepLine(1) : $('study-next').click()); current.className = 'phone-current'; const sceneListButton = button('phone-scene-list', 'scenes', () => show('scenes')), sceneInfo = button('phone-scene-info', 'info', () => { if (sceneInfo.getAttribute('aria-disabled') !== 'true') show('sceneInfo'); }); nav.append(current, sceneListButton, sceneInfo); shell.append(nav);
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
  let fitFull = false, speakerCast = '', slideDir = 0;
  const applySpeaker = () => lightFrame()?.contentWindow?.postMessage({ channel: 'stage-study', action: 'speaker', castId: speakerCast }, '*');
  const applyFit = () => lightFrame()?.contentWindow?.postMessage({ channel: 'stage-study', action: 'fit', full: fitFull }, '*');
  window.addEventListener('message', event => {
    const frame = lightFrame();
    if (!frame || event.source !== frame.contentWindow || event.origin !== 'null' || event.data?.channel !== 'stage-study') return;
    if (event.data.action === 'ready') { hasLights = false; sync(); }
    if (event.data.action === 'light-capability') { hasLights = event.data.hasLights === true; applyLight(); sync(); }
    if (event.data.action === 'loaded') { applyLight(); applyFit(); applySpeaker(); }
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
  // Read-only data bridge. No access to the viewer closure or mutation of its project.
  const linesKey = 'stage-study-phone-lines:' + location.hash.slice(1);
  let rehearsalLines = [], sceneOrder = new Map(), linesOn = false, lineId = '', pendingLines = null;
  let beforeLinesView = '', renderedLine = '';
  const linesToggle = button('phone-lines', null, () => setLines(!linesOn));
  linesToggle.hidden = true; linesToggle.append(make('span', 'phone-mode-scene'), make('span', 'phone-mode-lines')); nav.append(linesToggle);
  const linesRegion = make('section', 'phone-lines'); linesRegion.id = 'phone-lines-region';
  linesRegion.hidden = true; linesRegion.setAttribute('role', 'region');
  const linesHead = make('div', 'phone-lines-head'), linesMeta = make('span', 'phone-lines-meta');
  linesHead.append(linesMeta);
  const lineLive = make('div', 'phone-line-live'); lineLive.setAttribute('aria-live', 'polite'); lineLive.setAttribute('aria-atomic', 'true');
  const lineSpeaker = make('p', 'phone-line-speaker'), lineText = make('p', 'phone-line-text study-note-text');
  lineLive.append(lineSpeaker, lineText);
  const lineMemo = make('p', 'phone-line-memo study-note-text'), linesEmpty = make('p', 'phone-lines-empty');
  const upcoming = make('section', 'phone-line-next'), upcomingLabel = make('p', 'phone-line-next-label'), upcomingSpeaker = make('p', 'phone-line-next-speaker'), upcomingText = make('p', 'phone-line-next-text study-note-text');
  upcoming.append(upcomingLabel, upcomingSpeaker, upcomingText);
  const linesFlow = make('div', 'phone-lines-flow'); linesFlow.append(lineLive, lineMemo, upcoming);
  linesRegion.append(linesHead, linesFlow, linesEmpty); shell.append(linesRegion);
  const verticalKey = 'stage-study-phone-vertical';
  let verticalOn = false;
  try { verticalOn = localStorage.getItem(verticalKey) === '1'; } catch { /* Display remains usable without storage. */ }
  const verticalLabel = make('label', 'phone-setting'), verticalInput = make('input', ''), verticalText = make('span', 'phone-setting-text'), verticalHint = make('small', 'phone-setting-hint');
  verticalInput.type = 'checkbox'; verticalInput.checked = verticalOn;
  verticalLabel.append(verticalInput, make('span', 'phone-setting-body')); verticalLabel.lastChild.append(verticalText, verticalHint);
  verticalInput.addEventListener('change', () => {
    verticalOn = verticalInput.checked;
    try { localStorage.setItem(verticalKey, verticalOn ? '1' : '0'); } catch { /* Keep the current display choice in memory. */ }
    sync();
  });
  panes.settings.append(verticalLabel);
  const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
  // Safari lacks `word-break: auto-phrase`; approximate phrase breaks with Intl.Segmenter + <wbr> and `keep-all`.
  const phraseWrap = typeof Intl !== 'undefined' && Intl.Segmenter && !(window.CSS && CSS.supports && CSS.supports('word-break', 'auto-phrase'));
  const segmenter = phraseWrap ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
  const caseParticles = new Set(['は', 'が', 'を', 'に', 'へ', 'と', 'の', 'で', 'も']), longParticles = new Set(['から', 'まで', 'より', 'ので', 'のに', 'けど', 'けれど']);
  const isHira = (ch) => /[ぁ-ゟ]/.test(ch || '');
  const phraseParts = (text) => {
    const parts = []; let prev = '', before = '';
    for (const { segment } of segmenter.segment(text)) {
      const startsContent = /[㐀-鿿゠-ヿA-Za-z0-9「『（【]/.test(segment[0]);
      const afterParticle = (caseParticles.has(prev) && !isHira(before.slice(-1))) || longParticles.has(prev);
      const afterHira = isHira(prev.slice(-1)) && !/^[お御ご]$/.test(prev) && !/[っんー]$/.test(prev);
      const afterPunct = /[、。！？」』）】…]$/.test(prev);
      const closes = /^[、。！？」』）】…ー]/.test(segment);
      const nextParticle = caseParticles.has(segment) || longParticles.has(segment);
      if (prev && !closes && ((startsContent && afterHira) || (afterParticle && !nextParticle && (startsContent || !/^の[でに]$/.test(prev))) || afterPunct)) parts.push(null);
      parts.push(segment); before = prev; prev = segment;
    }
    return parts;
  };
  const setPhrased = (el, value) => {
    if (!phraseWrap) return setText(el, value);
    if (el.textContent === value && el.dataset.phrased === '1') return;
    el.classList.add('phrase-wrap'); el.dataset.phrased = '1';
    if (!/[぀-ヿ㐀-鿿]/.test(value)) { el.textContent = value; return; }
    el.replaceChildren(...phraseParts(value).map(part => part === null ? document.createElement('wbr') : document.createTextNode(part)));
  };
  if (phraseWrap) {
    const rephrase = () => { observer.disconnect(); delete sceneNote.dataset.phrased; setPhrased(sceneNote, sceneNote.textContent); observer.observe(sceneNote, { childList: true }); };
    const observer = new MutationObserver(rephrase);
    observer.observe(sceneNote, { childList: true });
  }
  function saveLines() {
    try { localStorage.setItem(linesKey, JSON.stringify({ on: linesOn, lineId })); } catch { /* In-memory use still works. */ }
  }
  function setView(view) {
    if ($('study-view').value === view) return;
    $('study-view').value = view; $('study-view').dispatchEvent(new Event('change'));
  }
  function goLine(index) {
    const line = rehearsalLines[index]; if (!line) return;
    lineId = line.id;
    if ($('study-scenes').value !== line.sceneId) {
      $('study-scenes').value = line.sceneId;
      $('study-scenes').dispatchEvent(new Event('change'));
    }
    saveLines();
  }
  function setLines(on, restoreId = '', restoring = false) {
    if (on && (!rehearsalLines.length || $('study-note-fields').disabled)) return;
    if (on) {
      if (!linesOn) {
        beforeLinesView = $('study-view').value;
        // A tab-local companion preserves the return view across reloads without
        // changing the specified localStorage {on,lineId} record.
        try {
          const savedView = restoring && sessionStorage.getItem(linesKey);
          if (['front', 'plan', 'both'].includes(savedView)) beforeLinesView = savedView;
          sessionStorage.setItem(linesKey, beforeLinesView);
        } catch { /* Fall back to the current view. */ }
      }
      linesOn = true;
      let index = rehearsalLines.findIndex(line => line.id === restoreId);
      if (index < 0) index = rehearsalLines.findIndex(line => line.sceneId === $('study-scenes').value);
      goLine(index < 0 ? 0 : index);
      if ($('study-view').value === 'both') setView('front');
    } else {
      linesOn = false;
      if (beforeLinesView) setView(beforeLinesView);
    }
    if (opened) show('');
    saveLines(); sync();
  }
  function lineStepIndex(direction) {
    const index = rehearsalLines.findIndex(line => line.id === lineId && line.sceneId === $('study-scenes').value);
    if (index >= 0) return index + direction;
    const sceneIndex = sceneOrder.get($('study-scenes').value);
    if (direction > 0) return rehearsalLines.findIndex(line => sceneOrder.get(line.sceneId) > sceneIndex);
    for (let i = rehearsalLines.length - 1; i >= 0; i--) if (sceneOrder.get(rehearsalLines[i].sceneId) < sceneIndex) return i;
    return -1;
  }
  function stepLine(direction) { slideDir = direction; goLine(lineStepIndex(direction)); sync(); slideDir = 0; }
  function syncLines(ready) {
    linesToggle.hidden = !ready || !rehearsalLines.length;
    nav.classList.toggle('has-lines', !linesToggle.hidden);
    linesToggle.disabled = !ready; linesToggle.setAttribute('aria-pressed', String(linesOn));
    linesToggle.setAttribute('aria-label', t('linesMode')); linesToggle.title = t('linesMode');
    setText(linesToggle.querySelector('.phone-mode-scene'), t('sceneMode')); setText(linesToggle.querySelector('.phone-mode-lines'), t('lines'));
    linesRegion.hidden = !ready || !linesOn;
    linesRegion.setAttribute('aria-label', t('linesMode'));
    shell.classList.toggle('phone-lines-on', linesOn && ready);
    if (fitFull !== (linesOn && ready)) { fitFull = linesOn && ready; applyFit(); }
    steps.classList.toggle('phone-lines-steps', linesOn);
    const wantedSpeaker = linesOn && ready ? rehearsalLines.find(item => item.id === lineId && item.sceneId === $('study-scenes').value)?.castId || '' : '';
    if (speakerCast !== wantedSpeaker) { speakerCast = wantedSpeaker; applySpeaker(); }
    for (const [b, direction, original] of [[previous, -1, 'study-prev'], [next, 1, 'study-next']]) {
      const glyph = linesOn ? 'lineNext' : original;
      if (b.dataset.glyph !== glyph) { b.replaceChildren(icon(glyph)); b.dataset.glyph = glyph; }
      b.classList.toggle('phone-line-back', linesOn && direction < 0);
    }
    if (!linesOn || !ready) return;
    let index = rehearsalLines.findIndex(line => line.id === lineId && line.sceneId === $('study-scenes').value);
    if (index < 0) {
      index = rehearsalLines.findIndex(line => line.sceneId === $('study-scenes').value);
      const nextId = rehearsalLines[index]?.id || '';
      if (lineId !== nextId) { lineId = nextId; saveLines(); }
    }
    const line = rehearsalLines[index], following = rehearsalLines[index + 1];
    const vertical = verticalOn && /[぀-ヿ㐀-鿿]/.test(line?.text || ''), wasVertical = linesRegion.classList.contains('is-vertical');
    const sliding = slideDir && vertical === wasVertical && renderedLine && renderedLine !== (lineId || $('study-scenes').value) && !lineLive.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ghost = null, pushed = 0;
    if (sliding) {
      pushed = vertical ? (upcoming.hidden ? lineLive.offsetWidth : Math.max(lineLive.offsetWidth, lineLive.offsetLeft - upcoming.offsetLeft)) : (upcoming.hidden ? lineLive.offsetHeight : Math.max(lineLive.offsetHeight, upcoming.offsetTop - lineLive.offsetTop));
      ghost = lineLive.cloneNode(true); ghost.removeAttribute('aria-live'); ghost.setAttribute('aria-hidden', 'true'); ghost.classList.add('phone-line-ghost');
      Object.assign(ghost.style, { top: `${lineLive.offsetTop}px`, left: `${lineLive.offsetLeft}px`, width: `${lineLive.offsetWidth}px`, height: `${lineLive.offsetHeight}px` });
      linesFlow.append(ghost);
    }
    linesRegion.classList.toggle('is-vertical', vertical);
    const seconds = line?.seconds;
    const time = seconds == null ? '' : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    setText(linesMeta, [line ? `${t('lineCount')} ${index + 1} / ${rehearsalLines.length}` : t('linesMode'), $('study-scene-heading').textContent.split(' · ')[0], time].filter(Boolean).join(' · '));
    lineLive.hidden = !line; upcoming.hidden = !line || !following; lineMemo.hidden = !line?.memo; linesEmpty.hidden = Boolean(line);
    setText(linesEmpty, `${t('noLines')}。${t('linesHint')}`);
    setText(upcomingLabel, t('upNext')); setText(upcomingSpeaker, following?.speaker || ''); upcomingSpeaker.style.borderLeftColor = following?.color || 'var(--study-accent)';
    setPhrased(upcomingText, following?.text || '');
    setText(lineSpeaker, line?.speaker || ''); lineSpeaker.style.borderLeftColor = line?.color || 'var(--study-accent)';
    setPhrased(lineText, line?.text || ''); setPhrased(lineMemo, line?.memo ? `${t('cueMemo')}: ${line.memo.replace(/^(?:合図|Cue)[:：]\s*/, '')}` : '');
    // Only changing lines resets the scroll; status/language updates do not.
    const renderKey = lineId || $('study-scenes').value;
    if (renderedLine !== renderKey) { renderedLine = renderKey; linesRegion.scrollTop = 0; linesFlow.scrollLeft = 0; }
    if (ghost) {
      const timing = { duration: 560, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }, dir = slideDir > 0 ? 1 : -1;
      const axis = vertical ? 'X' : 'Y', sign = vertical ? -1 : 1, away = vertical ? ghost.offsetWidth : ghost.offsetHeight;
      const done = ghost.animate([{ transform: `translate${axis}(0)`, opacity: 1 }, { transform: `translate${axis}(${-sign * dir * away}px)`, opacity: 0 }], timing);
      done.onfinish = done.oncancel = () => ghost.remove();
      for (const el of [lineLive, lineMemo]) if (!el.hidden) el.animate([{ transform: `translate${axis}(${sign * dir * pushed}px)`, opacity: .2 }, { transform: `translate${axis}(0)`, opacity: 1 }], timing);
      if (!upcoming.hidden) upcoming.animate([{ opacity: 0, transform: `translate${axis}(${sign * dir * 28}px)` }, { opacity: .85, transform: `translate${axis}(0)` }], timing);
    }
    previous.setAttribute('aria-label', t('linePrev')); next.setAttribute('aria-label', t('lineNext'));
    previous.disabled = lineStepIndex(-1) < 0;
    const nextIndex = lineStepIndex(1); next.disabled = nextIndex < 0 || nextIndex >= rehearsalLines.length;
  }
  window.addEventListener('stage-study-loaded', event => {
    const { project, scenes } = event.detail;
    sceneOrder = new Map(scenes.map((scene, index) => [scene.id, index]));
    const cues = new Map((project.cues || []).filter(cue => cue.kind === 'timeline' && cue.cueType === 'dialogue').map(cue => [cue.id, cue]));
    const cast = new Map((project.cast || []).map(person => [person.id, person]));
    rehearsalLines = (project.script?.lines || []).filter(line => sceneOrder.has(line.sceneId)).map((line, order) => {
      const cue = cues.get(line.cueId), person = cast.get(line.castId);
      const seconds = Number.isFinite(cue?.offsetSeconds) ? cue.offsetSeconds : Number.isFinite(cue?.atSeconds) ? cue.atSeconds : null;
      const text = String(line.text || ''), memo = String(cue?.memo || '').split('\n');
      if (text.trim() && memo[0].includes(text.trim())) memo.shift();
      return { id: line.id, sceneId: line.sceneId, order, seconds, text, memo: memo.join('\n').trim(), speaker: line.speaker?.trim() || person?.name || '', color: person?.color || '', castId: line.castId || '' };
    }).sort((a, b) => sceneOrder.get(a.sceneId) - sceneOrder.get(b.sceneId) || (a.seconds ?? Infinity) - (b.seconds ?? Infinity) || a.order - b.order);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(linesKey)); } catch { /* Ignore invalid storage. */ }
    pendingLines = rehearsalLines.length && saved?.on === true ? { lineId: saved.lineId } : null;
    if (!rehearsalLines.length) linesOn = false;
    // The event precedes options/frame initialization. sync() waits for viewer readiness.
  });
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
    if (ready && pendingLines) { const saved = pendingLines; pendingLines = null; setLines(true, saved.lineId, true); return; }
    previous.disabled = $('study-prev').disabled || !ready; next.disabled = $('study-next').disabled || !ready; previous.setAttribute('aria-label', $('study-prev').getAttribute('aria-label')); next.setAttribute('aria-label', $('study-next').getAttribute('aria-label'));
    current.textContent = $('study-scene-heading').textContent || t('scenes'); current.disabled = !ready; current.setAttribute('aria-label', t('scenes') + ' · ' + current.textContent);
    const replay = $('study-pen-status').textContent.includes(document.documentElement.lang === 'en' ? 'hidden during replay' : '再生中'); play.replaceChildren(icon(replay ? 'study-stop' : 'study-replay'), Object.assign(make('span', ''), { textContent: t(replay ? 'stop' : 'play') })); play.disabled = !ready || (!replay && $('study-replay').disabled); play.setAttribute('aria-label', replay ? $('study-stop').title : $('study-replay').title);
    light.hidden = !hasLights; light.disabled = !ready || !hasLights;
    light.setAttribute('aria-pressed', String(lightMode === 'show'));
    light.setAttribute('aria-label', t('light')); light.title = t('light');
    views.setAttribute('aria-label', t('view'));
    for (const [key, b] of Object.entries(viewButtons)) {
      b.disabled = !ready || $('study-view').disabled || (linesOn && key === 'both');
      b.setAttribute('aria-label', t(key)); b.title = t(key);
      b.setAttribute('aria-pressed', String($('study-view').value === key));
    }
    const showTitle = $('study-title').textContent || defaultBrand;
    if (brand.textContent !== showTitle) brand.textContent = showTitle;
    brand.title = showTitle;
    const hasNote = ready && Boolean(sceneNote.textContent.trim());
    sceneListButton.disabled = !ready || $('study-scenes').disabled;
    sceneInfo.setAttribute('aria-disabled', String(!hasNote)); sceneInfo.classList.toggle('has-note', hasNote);
    const inline = !linesOn && hasNote && orientation.matches && ['front', 'plan'].includes($('study-view').value);
    detail.hidden = !inline;
    // Keep a single canonical note node; the inline area keeps its place while the modal is open.
    const noteParent = opened === 'sceneInfo' || !inline ? panes.sceneInfo : detail;
    if (sceneNote.parentNode !== noteParent) noteParent.append(sceneNote);
    if (opened === 'sceneInfo' && !hasNote) { show(''); return; }
    for (const [el, key] of [[menu, 'menu'], [tools, 'tools'], [memo, 'memo'], [settings, 'settings'], [info, 'info'], [current, 'scenes'], [sceneListButton, 'scenes'], [sceneInfo, 'sceneInfo']]) { if (el.querySelector('span')) el.querySelector('span').textContent = t(key === 'memo' ? 'memoShort' : key); if (el !== current) { el.setAttribute('aria-label', t(key)); el.title = t(key); } el.setAttribute('aria-expanded', String(opened === key)); el.setAttribute('aria-controls', 'phone-panel'); }
    tools.disabled = !ready || $('study-pen').disabled; memo.disabled = !ready; tools.setAttribute('aria-pressed', $('study-pen').getAttribute('aria-pressed')); close.setAttribute('aria-label', t('close')); if (opened) title.textContent = t(opened); shareTitle.textContent = t('share');
    const opts = [...$('study-scenes').options], signature = opts.map(o => o.value + o.textContent).join('|'); if (signature !== listSignature) { listSignature = signature; sceneList.replaceChildren(...opts.map(o => { const b = button('', null, () => { $('study-scenes').value = o.value; $('study-scenes').dispatchEvent(new Event('change')); show(''); }); b.textContent = o.textContent; b.dataset.scene = o.value; return b; })); }
    for (const b of sceneList.children) { const selected = b.dataset.scene === $('study-scenes').value; b.setAttribute('aria-current', String(selected)); b.setAttribute('aria-pressed', String(selected)); b.disabled = !ready || $('study-scenes').disabled; }
    verticalText.textContent = t('vertical'); verticalHint.textContent = t('verticalHint'); verticalInput.checked = verticalOn;
    syncLines(ready);
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
