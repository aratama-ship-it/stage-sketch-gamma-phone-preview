#!/usr/bin/env node
/* 舞台スケッチγ 共有画面（演者用 Viewer）のスマホUI確認用・静的プレビューを組み立てる。
 *
 *   node build.mjs --source <γ の作業木（origin/main を checkout したもの）>
 *
 * - γ の配信ファイル（study.html / study-frame.html / stage-study-*.js,css / 描画に要る本体 JS）を
 *   そのまま複製し、絶対パス（/study-assets/…・/stage-study-…）を相対パスへ書き換える。
 * - 共有 Worker の API（/study/api/…）は preview-adapter.js が fetch を横取りして同梱見本を返す。
 *   送信（オーナーへ共有）は成功表示だけで、どこにも送らない。
 * - 見本は γ 同梱データから複製する（samples/）。本人の実制作ショーは入れない。
 * - 生成物は本フォルダ直下（GitHub Pages の配信ルート）。手書きのUI差分は overrides/。その他の手書きファイル一覧は README.md を参照。
 */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const sourceDir = argValue('--source') || process.env.GAMMA_SRC;
if (!sourceDir) throw new Error('--source <γの作業木> を指定してください（例: ~/git-repos/gamma-publish-20261001）');
const source = relative => resolve(sourceDir, relative);
const exists = async path => { try { await access(path); return true; } catch { return false; } };
if (!(await exists(source('study.html'))) || !(await exists(source('stage-study-phone.js')))) {
  throw new Error(`γの作業木に見えません: ${sourceDir}`);
}
const read = relative => readFile(source(relative), 'utf8');
const out = relative => resolve(here, relative);
const write = (relative, value) => writeFile(out(relative), value);
const sha256 = value => createHash('sha256').update(value).digest('hex');

// ---- 元の版を記録する -------------------------------------------------------
const now = new Date(), pad = n => String(n).padStart(2, '0');
const buildId = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`; // ローカル時刻 例 20261001-0940
let sourceCommit = 'unknown';
try { sourceCommit = execSync('git rev-parse --short HEAD', { cwd: sourceDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
const stageHtml = await read('stage.html');
const sourceVersion = (stageHtml.match(/stage-app-version">([^<]+)</) || [])[1] || 'unknown';

// ---- そのまま複製する配信ファイル（γ の正本をいじらない） ----------------------
// Pure lighting models/renderers only; no lighting editor, storage or session modules.
const lightingCopies = [
  'gamma-light-model.js', 'stage-fixture-body.js', 'stage-lighting-plan-overlay.js',
  'light-design/rig-engine.js', 'light-design/laser-effects.js',
  'stage-light-render.js', 'gamma-light-cue-overlay.js',
];
const copies = [
  ...lightingCopies,
  'style.css', 'stage-study.css', 'stage-study-phone.css', 'stage-study-navigation.css',
  'stage-study-sticky.js', 'stage-study-private.js', 'stage-study-sync.js', 'stage-study-pen.js',
  'stage-study-navigation.js', 'stage-study-frame.js', 'stage-study-phone.js',
  'stage-venues.js', 'stage-venue-lines.js', 'stage-i18n.js', 'stage-set-model.js', 'stage-machinery.js',
  'gamma-ui.js', 'gamma-ui-i18n.js', 'stage-data-safety.js', 'stage-sketch.js',
];
// Validate all overrides before writing generated assets; typos must fail the build.
const overrideEntries = await exists(out('overrides')) ? await readdir(out('overrides'), { withFileTypes: true }) : [];
for (const entry of overrideEntries) {
  if (!entry.isFile() || !copies.includes(entry.name)) throw new Error(`Unknown override: ${entry.name}`);
}
const overrides = [];
for (const name of copies) {
  await mkdir(dirname(out(name)), { recursive: true });
  await write(name, await read(name));
}
for (const entry of overrideEntries.sort((a, b) => a.name.localeCompare(b.name))) {
  const bytes = await readFile(out(`overrides/${entry.name}`));
  overrides.push({ file: entry.name, sourceSha256: sha256(await readFile(source(entry.name))), sha256: sha256(bytes) });
  await write(entry.name, bytes);
}

// 絶対パス → 相対パス。?v= は build 番号で置き換え、端末のキャッシュを確実に更新する。
const relativize = html => html
  .replaceAll('"/study-assets/', '"./')
  .replaceAll('"/stage-study', '"./stage-study')
  .replace(/(src|href)="\.\/([^"?]+)(?:\?v=[^"]*)?"/g, `$1="./$2?b=${buildId}"`);
const assertRelative = (html, name) => {
  const left = html.match(/(?:src|href)="\/(?:study|stage)[^"]*"/g);
  if (left) throw new Error(`絶対パスが残っています ${name}: ${left.join(', ')}`);
};
const replaceOnce = (text, from, to, label) => {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: 置換対象が ${count} 件（1件の想定）: ${from.slice(0, 60)}`);
  return text.replace(from, to);
};

// ---- Read-only lighting bridge: small, fail-closed patches; never edit γ source. ----
const patches = [];
async function patchAsset(file, changes) {
  let text = await readFile(out(file), 'utf8');
  const before = sha256(text);
  for (const [from, to, label] of changes) text = replaceOnce(text, from, to, `${file}: ${label}`);
  await write(file, text);
  patches.push({ file, sourceSha256: before, sha256: sha256(text), changes: changes.map(([, , label]) => label) });
}
await patchAsset('stage-sketch.js', [[
  '    window.SHOSAI_STAGE_STUDY_RENDERER = Object.freeze({',
  `    window.SHOSAI_STAGE_STUDY_RENDERER = Object.freeze({
      light(mode) {
        if (mode !== "work" && mode !== "show") return;
        const step = LIGHT_LOOK_STEPS.find(item => item.value === (mode === "show" ? "dark" : "off"));
        prefs.lightPool = step.pool;
        prefs.lightBeam = step.beam;
        prefs.workLightOff = step.work;
        applyFeatureFlags();
        render();
      },
      lightInfo() {
        // Same rig, cue model and stage-dimension guard as the actual painter.
        // Unset/off cues still have a rig: show mode correctly leaves it dark.
        return Boolean(lightCueOverlayForLayout(layout("plan")));
      },`,
  'presentation-only light / lightInfo API',
], [
  '    if (showSelection && ((L.plan && target === planCtx) || (!L.plan && target === ctx))) {\n      drawLightCuePools(target, L);',
  '    if ((showSelection || STUDY_READ_ONLY) && ((L.plan && target === planCtx) || (!L.plan && target === ctx))) {\n      drawLightCuePools(target, L);',
  'read-only light pools (selection stays disabled)',
], [
  '    if (showSelection && ((L.plan && target === planCtx) || (!L.plan && target === ctx))) {\n      if (drawLightCueWorkLight(target, L)) {',
  '    if ((showSelection || STUDY_READ_ONLY) && ((L.plan && target === planCtx) || (!L.plan && target === ctx))) {\n      if (drawLightCueWorkLight(target, L)) {',
  'read-only work-light mask, lit pieces and beams',
]]);
await patchAsset('stage-study-frame.js', [
  ["        else if (message.action === 'replay')", "        else if (message.action === 'light') { engine.light(message.mode); }\n        else if (message.action === 'replay')", 'light message'],
  ["        if (message.action === 'load') window.parent.postMessage({ channel: 'stage-study', action: 'loaded' }, location.origin);",
   `        if (message.action === 'load') {
          window.parent.postMessage({ channel: 'stage-study', action: 'light-capability', hasLights: engine.lightInfo() }, location.origin);
          window.parent.postMessage({ channel: 'stage-study', action: 'loaded' }, location.origin);
        }`, 'light capability after load'],
]);


// UI2: presentation-only fit, landscape overlays, and retired pinned-note editing.
await patchAsset("stage-sketch.js", [
  [
    "      lightInfo() {",
    "      stageBounds(view) {\n        const L = layout(view), size = L.size;\n        if (![size.width, size.depth].every(n => Number.isFinite(n) && n > 0)) return null;\n        // Same main-stage bounds as the painter, excluding wings and audience.\n        const points = L.plan\n          ? [[L.stage.x, L.stage.y], [L.stage.x + L.stage.w, L.stage.y + L.stage.h]]\n          : [[L.centerX - L.frontW / 2, L.bottomY], [L.centerX + L.frontW / 2, L.bottomY],\n             [L.centerX + L.shift - L.backW / 2, L.backY], [L.centerX + L.shift + L.backW / 2, L.backY]];\n        const xs = points.map(p => p[0]), ys = points.map(p => p[1]);\n        const x = Math.min(...xs) / W, y = Math.min(...ys) / H;\n        const width = (Math.max(...xs) - Math.min(...xs)) / W;\n        const height = (Math.max(...ys) - Math.min(...ys)) / H;\n        return [x,y,width,height].every(Number.isFinite) && width > 0 && height > 0\n          ? { x, y, width, height, metres: { width: size.width, depth: size.depth, height: size.height }, venue: state.project.venue } : null;\n      },\n      lightInfo() {",
    "main stage bounds without editor or storage access"
  ]
]);
await patchAsset("stage-study-navigation.js", [
  [
    "    const views = {}, pointers = new Map();",
    "    const views = {}, pointers = new Map();\n    const STAGE_FILL = .8, defaultZoom = view => view === 'plan' ? 1.2 : 1;\n    document.body.classList.toggle('viewer-phone', navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 600);",
    "phone detection and zoom defaults"
  ],
  [
    "      bar.append(reset);",
    "      bar.append(reset);\n      const toggle = make('button', 'viewer-controls-toggle'); toggle.type = 'button'; toggle.dataset.viewerControls = view; toggle.setAttribute('aria-expanded', 'false'); bar.prepend(toggle);",
    "overlay control disclosure"
  ],
  [
    "hint, z: 1, x: 0",
    "hint, toggle, base: 1, cx: 0, cy: 0, z: defaultZoom(view), x: 0",
    "relative viewport zoom state"
  ],
  [
    "(v.width * v.z - v.viewport.clientWidth)",
    "(v.width * v.base * v.z - v.viewport.clientWidth)",
    "horizontal pan range"
  ],
  [
    "(v.height * v.z - v.viewport.clientHeight)",
    "(v.height * v.base * v.z - v.viewport.clientHeight)",
    "vertical pan range"
  ],
  [
    "      v.surface.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;",
    "      v.surface.style.transform = `translate(${v.x + v.cx * v.z}px, ${v.y + v.cy * v.z}px) scale(${v.base * v.z})`;",
    "isotropic stage centred zoom"
  ],
  [
    "        Object.assign(v.surface.style,",
    "        const bounds = engine.stageBounds(v.view);\n        v.base = bounds ? Math.min(STAGE_FILL * w / (bounds.width * v.width), STAGE_FILL * h / (bounds.height * v.height)) : 1;\n        v.cx = bounds ? (.5 - bounds.x - bounds.width / 2) * v.width * v.base : 0;\n        v.cy = bounds ? (.5 - bounds.y - bounds.height / 2) * v.height * v.base : 0;\n        v.surface.dataset.fit = bounds ? 'main-stage' : 'full-scene-fallback';\n        Object.assign(v.surface.style,",
    "fit main stage into eighty percent"
  ],
  [
    "      Object.values(views).forEach(update);",
    "      for (const v of Object.values(views)) { v.toggle.textContent = text(v.view === 'front' ? '正面 操作' : '平面 操作', v.view === 'front' ? 'Front controls' : 'Plan controls'); update(v); }",
    "disclosure labels"
  ],
  [
    "      views.front.hint.hidden = !alternate;",
    "      views.front.hint.hidden = !alternate; layout();",
    "reframe changed seat"
  ],
  [
    "      if (event.target.closest?.('.viewer-drawing-bar')) {",
    "      if (event.target.closest?.('.viewer-drawing-bar')) {\n        if (event.type === 'click' && event.target.closest('[data-viewer-controls]')) {\n          const v = views[event.target.closest('[data-viewer-controls]').dataset.viewerControls];\n          const open = v.bar.dataset.open !== 'true'; v.bar.dataset.open = String(open); v.toggle.setAttribute('aria-expanded', String(open));\n        }",
    "disclosure native event path"
  ],
  [
    "v.z = 1; v.x = v.y = 0; update(v);",
    "v.z = defaultZoom(v.view); v.x = v.y = 0; layout();",
    "reset to front100 plan120"
  ],
  [
    "anchorX: (center.x - v.x) / v.z, anchorY: (center.y - v.y) / v.z",
    "anchorX: (center.x - v.x - v.cx * v.z) / v.z, anchorY: (center.y - v.y - v.cy * v.z) / v.z",
    "pinch anchor includes stage centring"
  ],
  [
    "target.x = center.x - gesture.anchorX * target.z; target.y = center.y - gesture.anchorY * target.z;",
    "target.x = center.x - (gesture.anchorX + target.cx) * target.z; target.y = center.y - (gesture.anchorY + target.cy) * target.z;",
    "preserve pinch anchor"
  ],
  [
    "      handleEvent, layout,",
    "      handleEvent, layout,\n      reset() { for (const v of Object.values(views)) { v.z = defaultZoom(v.view); v.x = v.y = 0; } layout(); },",
    "scene zoom reset"
  ],
  [
    "      loaded(lang) { relabel(lang); camera(selectedSeat); layout(); },",
    "      loaded(lang) { relabel(lang); camera(selectedSeat); this.reset(); },",
    "load zoom reset"
  ],
  [
    "(v.viewport.clientWidth / 2 - v.width * v.z / 2 + v.x)",
    "(v.viewport.clientWidth / 2 - v.width * v.base * v.z / 2 + v.x + v.cx * v.z)",
    "capture horizontal crop"
  ],
  [
    "(v.viewport.clientHeight / 2 - v.height * v.z / 2 + v.y)",
    "(v.viewport.clientHeight / 2 - v.height * v.base * v.z / 2 + v.y + v.cy * v.z)",
    "capture vertical crop"
  ],
  [
    "v.width * v.z * ratio, v.height * v.z * ratio",
    "v.width * v.base * v.z * ratio, v.height * v.base * v.z * ratio",
    "capture isotropic scale"
  ]
]);
await patchAsset("stage-study-navigation.css", [
  [
    ".study-frame { --viewer-blue:",
    "\n.viewer-controls-toggle { display: none; }\n@media (orientation: landscape) {\n  .viewer-phone.study-frame[data-view=\"both\"] .study-drawings { grid-template-columns: minmax(0,2fr) minmax(0,1fr); grid-template-rows: 1fr; }\n  .viewer-phone.study-frame .study-drawing { grid-template-rows: minmax(0,1fr); }\n  .viewer-phone .viewer-drawing-bar { position: absolute; right: 4px; top: 4px; z-index: 5; max-width: calc(100% - 8px); padding: 0; gap: 0; background: color-mix(in srgb, var(--viewer-bar) 90%, transparent); }\n  .viewer-phone .viewer-drawing-bar .viewer-controls-toggle { display: block; min-width: 44px; }\n  .viewer-phone .viewer-drawing-bar:not([data-open=\"true\"]) > :not(.viewer-controls-toggle) { display: none; }\n  .viewer-phone .viewer-drawing-bar[data-open=\"true\"] { flex-wrap: wrap; }\n  .viewer-phone .viewer-drawing-bar label { display: none; }\n  .viewer-phone .viewer-drawing-bar select { max-width: 150px; }\n}\n\n.study-frame { --viewer-blue:",
    "landscape controls overlay no layout row"
  ]
]);
await patchAsset("stage-study-frame.js", [
  [
    "      const nativeNoteInput = sticky?.handleEvent(event);",
    "      const nativeNoteInput = false; // Retired pinned-note editor: stored notes are display-only.",
    "block all sticky interaction"
  ],
  [
    "      const message = event.data;",
    "      const message = event.data;\n      if (['sticky-mode', 'sticky-focus', 'sticky-add', 'sticky-select', 'annotation-permission'].includes(message.action)) return;",
    "ignore retired sticky commands"
  ],
  [
    "sticky.configure({ editable: canAnnotate && !message.penEnabled, enabled: Boolean(message.stickyEnabled), lang: message.lang })",
    "sticky.configure({ editable: false, enabled: false, lang: message.lang })",
    "load stickies read only"
  ],
  [
    "sticky.configure({ editable: canAnnotate && !message.enabled, enabled: false })",
    "sticky.configure({ editable: false, enabled: false })",
    "pen cannot enable sticky editing"
  ],
  [
    "        navigation.layout();",
    "        if (message.action === 'scene') navigation.reset();\n        navigation.layout();",
    "scene defaults"
  ]
]);

// ---- 見本（γ 同梱データから複製） -------------------------------------------
const SAMPLES = [
  { key: 'romeo-juliet', file: 'stage-samples/romeo-juliet-second.json', label: 'ロミオとジュリエット（RJセカンド）', labelEn: 'Romeo and Juliet (second draft)', note: '台詞・メモ・照明つきの実寸見本。冊子の iPhone 図はこの系統' },
  { key: 'feature-test', file: 'stage-samples/feature-test-show.json', label: 'テスト: 全機能の試験場', labelEn: 'Feature test show', note: 'セクション分けの 48 シーン。駒・小道具・機構・照明の全種類' },
  { key: 'four-outlines', file: 'public/ai-json/samples/sample-standard.json', label: '四つの輪郭（AI用JSONの標準見本）', labelEn: 'Four Outlines (AI JSON sample)', note: '8 シーンの最小構成。読み込みが軽い' },
];
await mkdir(out('samples'), { recursive: true });
const sceneKeysOf = doc => {
  // study-links.js の studySceneKeys と同じ分け方（場面の見た目が同じなら同じ鍵）。ハッシュの塩は違ってよい。
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  const { scenes, id, title, activeSceneId, versionLabel, parentVersionId, branchReason, createdAt, updatedAt, ...project } = doc.project;
  const shared = { project, venues: doc.venues, setModels: doc.setModels };
  return Object.fromEntries(doc.project.scenes.filter(s => s.kind === 'scene').map(scene => {
    const { title, note, ...drawing } = scene;
    return [scene.id, sha256(JSON.stringify(canonical({ shared, drawing })))];
  }));
};
const sampleIndex = {};
for (const sample of SAMPLES) {
  const doc = JSON.parse(await read(sample.file));
  if (doc.kind !== 'shosai-stage-sketch' || !doc.project?.scenes) throw new Error(`見本の形が違います: ${sample.file}`);
  doc.project.activeSceneId ||= doc.project.scenes.find(s => s.kind === 'scene')?.id || '';
  const payload = {
    updatedAt: '2026-10-01T00:00:00.000Z', revision: 1, document: doc,
    notebookId: sha256(`notebook:${sample.key}`), sceneKeys: sceneKeysOf(doc),
    historyRevisions: [], changes: null, displayName: '',
  };
  const body = JSON.stringify(payload);
  await write(`samples/${sample.key}.json`, body);
  sampleIndex[sample.key] = {
    token: sha256(`token:${sample.key}`).slice(0, 48), label: sample.label, labelEn: sample.labelEn, note: sample.note,
    title: doc.project.title, scenes: doc.project.scenes.filter(s => s.kind === 'scene').length,
    bytes: Buffer.byteLength(body), sourceFile: sample.file,
  };
}
const DEFAULT_SAMPLE = SAMPLES[0].key;

// ---- preview-adapter.js（共有 Worker の API の代わり） ------------------------
const adapter = `/* 共有 Worker の API（/study/api/…）を横取りし、同梱見本を返す。送信は成功表示だけで外へ出さない。 */
(() => {
  'use strict';
  const TOKENS = ${JSON.stringify(Object.fromEntries(Object.entries(sampleIndex).map(([k, v]) => [k, v.token])))};
  const params = new URLSearchParams(location.search);
  const sample = TOKENS[params.get('sample')] ? params.get('sample') : ${JSON.stringify(DEFAULT_SAMPLE)};
  const TOKEN = TOKENS[sample];
  // Viewer は読み込み時に location.hash をトークンとして読むので、ここで同期的に揃える。
  if (location.hash !== '#' + TOKEN) history.replaceState(null, '', location.pathname + location.search + '#' + TOKEN);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
  const originalFetch = window.fetch.bind(window);
  let payloadPromise = null;
  const payload = () => payloadPromise ||= originalFetch('./samples/' + sample + '.json?b=${buildId}', { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error('sample-missing'); return r.json();
  });
  window.__STAGE_SKETCH_PHONE_PREVIEW__ = { build: ${JSON.stringify(buildId)}, source: ${JSON.stringify(`${sourceVersion} ${sourceCommit}`)}, sample, submissions: 0 };
  window.fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = String(options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const viewBase = '/study/api/view/' + TOKEN;
    if (url.pathname === '/study/api/me') return json({ identity: null, methods: { google: false, local: false }, allowAnonymous: true });
    if (url.pathname.endsWith(viewBase) && method === 'GET') { try { return json(await payload()); } catch { return json({ error: 'preview-sample-missing' }, 404); } }
    if (url.pathname.endsWith(viewBase + '/status') && method === 'GET') { const p = await payload(); return json({ revision: p.revision, updatedAt: p.updatedAt }); }
    if (url.pathname.endsWith(viewBase + '/notes') && method === 'POST') { window.__STAGE_SKETCH_PHONE_PREVIEW__.submissions += 1; return json({ ok: true }, 201); }
    if (url.pathname === '/whoami') return json({ user: null });
    if (url.pathname.startsWith('/study/api/') || url.pathname.startsWith('/study/auth/')) return json({ error: 'preview-only' }, 404);
    return originalFetch(input, options);
  };
})();
`;
await write('preview-adapter.js', adapter);

// ---- viewer.html（study.html から） -----------------------------------------
const previewBadge = `UI確認用 build ${buildId}（γ ${sourceVersion} ${sourceCommit}）・同梱見本・送信なし`;
let viewerHtml = relativize(await read('study.html'));
viewerHtml = replaceOnce(viewerHtml, '<title>Stage Sketch Viewer</title>',
  `<title>Stage Sketch Viewer — スマホ共有画面 UI確認用</title>\n<meta name="stage-sketch-preview" content="build ${buildId}; source γ ${sourceVersion} ${sourceCommit}">\n<link rel="icon" href="data:,">`, 'title');
viewerHtml = replaceOnce(viewerHtml, 'href="/study"', 'href="./index.html"', 'library link');
viewerHtml = replaceOnce(viewerHtml, `<script src="./stage-study-viewer.js?b=${buildId}" defer></script>`,
  `<script src="./preview-adapter.js?b=${buildId}" defer></script>\n<script src="./stage-study-viewer.js?b=${buildId}" defer></script>`, 'adapter insert');
viewerHtml = replaceOnce(viewerHtml, '<span data-text="noteAllowed">自分用メモは書き込み可</span>',
  `<span data-text="noteAllowed">自分用メモは書き込み可</span><span data-no-i18n>${previewBadge}</span>`, 'kicker badge');
viewerHtml = replaceOnce(viewerHtml, '<div id="study-name-field">',
  '<p class="study-muted"><strong>UI確認用：</strong>共有ボタンは成功表示まで確認できますが、入力内容はどこにも送信されません。</p><div id="study-name-field">', 'share note');
{
  const before = sha256(viewerHtml);
  viewerHtml = replaceOnce(viewerHtml, '</head>', '<style>#study-sticky, #study-sticky-panel { display: none !important; }</style></head>', 'retired pinned-note UI');
  patches.push({ file: 'viewer.html', sourceSha256: before, sha256: sha256(viewerHtml), changes: ['retired pinned-note UI'] });
}
assertRelative(viewerHtml, 'viewer.html');
await write('viewer.html', viewerHtml);

// ---- study-frame.html ---------------------------------------------------------
let frameHtml = relativize(await read('study-frame.html'));
assertRelative(frameHtml, 'study-frame.html');
await write('study-frame.html', frameHtml);
// Keep the relative order used by stage.html, with the same build cache key.
const scriptTag = name => `<script src="./${name}?b=${buildId}"></script>`;
await patchAsset('study-frame.html', [
  [scriptTag('stage-venues.js'), `${scriptTag('gamma-light-model.js')}\n${scriptTag('stage-venues.js')}`, 'lighting model before stage modules'],
  [scriptTag('stage-machinery.js'), `${scriptTag('stage-machinery.js')}\n${lightingCopies.slice(1).map(scriptTag).join('\n')}`, 'lighting render dependencies in main-app order'],
]);

// ---- stage-study-viewer.js / stage-study-continuity.js（iframe の場所と送信文言） ----
let viewerJs = await read('stage-study-viewer.js');
{
  const before = viewerJs;
  viewerJs = viewerJs.replace(/'\/study-frame\.html(\?v=[^']*)?'/g, `'./study-frame.html?b=${buildId}'`);
  if (viewerJs === before) throw new Error('stage-study-viewer.js: iframe のパスが見つかりません');
  viewerJs = replaceOnce(viewerJs,
    "sent: ['オーナーへ共有しました。自分用メモは残っています。', 'Shared with the owner. Your personal notes are kept.']",
    "sent: ['UI確認用の成功表示です。入力内容は送信されていません。', 'Preview success state only. Nothing was sent.']", 'sent text');
  viewerJs = replaceOnce(viewerJs,
    "private: ['現在表示している舞台図・線・図上メモを画像にして、メモ・表示名と一緒に送ります。他の閲覧者には表示されません。', 'Sends an image of the visible stage views, strokes and pinned notes, together with your note and display name. Other viewers cannot see it.']",
    "private: ['本番では舞台図・線・図上メモ・メモ・表示名をオーナーへ共有します。このUI確認用ページでは送信しません。', 'The live feature shares the stage views, drawings, notes and display name with the owner. This UI preview sends nothing.']", 'private text');
}
await write('stage-study-viewer.js', viewerJs);
await patchAsset("stage-study-viewer.js", [
  [
    "  function syncSticky() {\n    const notes = currentStickies(), selected = notes.find(n => n.id === selectedSticky);\n    $('study-sticky').disabled = !live || pendingNote || historyBlocked;\n    $('study-sticky').setAttribute('aria-pressed', String(stickyEnabled));\n    $('study-sticky-panel').hidden = !live || (!stickyEnabled && !selected);\n    $('study-sticky-editor').hidden = !selected;\n    $('study-sticky-text').disabled = pendingNote || historyBlocked;\n    $('study-sticky-front').disabled = $('study-sticky-plan').disabled = !live || pendingNote || historyBlocked || notes.length >= stickyModel.MAX_NOTES;\n    $('study-sticky-list').disabled = pendingNote || !notes.length;\n    const option = (value, text) => { const el = document.createElement('option'); el.value = value; el.textContent = text; return el; };\n    $('study-sticky-list').replaceChildren(option('', t('stickyChoose')), ...notes.map((n,i) => option(n.id, `${i + 1}. ${t(n.view)} · ${n.text.replace(/\\s+/g,' ').slice(0,40) || t('stickyBlank')}`)));\n    $('study-sticky-list').value = selectedSticky;\n    if (!selected) $('study-sticky-text').value = '';\n    if (selected && $('study-sticky-text').value !== selected.text) $('study-sticky-text').value = selected.text;\n    $('study-sticky-count').textContent = `${selected?.text.length || 0} / 200`;\n    for (const el of document.querySelectorAll('[data-sticky-shape], [data-sticky-color]')) {\n      const key = el.dataset.stickyShape ? 'shape' : 'color', value = el.dataset.stickyShape || el.dataset.stickyColor;\n      el.setAttribute('aria-pressed', String((selected?.[key] || (key === 'shape' ? 'rect' : 'desk')) === value));\n      el.disabled = !selected || pendingNote || historyBlocked;\n    }\n    for (const key of ['width','height']) {\n      const el = $('study-sticky-' + key); el.disabled = !selected || pendingNote || historyBlocked;\n      if (document.activeElement !== el) el.value = selected?.[key] || (key === 'width' ? 188 : '');\n    }\n    $('study-sticky-auto').disabled = !selected || pendingNote || historyBlocked;\n    const transparency = Math.round((1 - (selected?.backgroundOpacity ?? 1)) * 100);\n    $('study-sticky-transparency').disabled = !selected || pendingNote || historyBlocked;\n    $('study-sticky-transparency').value = transparency;\n    $('study-sticky-transparency').setAttribute('aria-valuetext', `${transparency}%`);\n    $('study-sticky-transparency-value').textContent = `${transparency}%`;\n    $('study-sticky-status').textContent = stickyLimit ? t('stickyLimit') : notes.length ? `${notes.length} / ${stickyModel.MAX_NOTES}` : t('stickyEmpty');\n    for (const id of ['study-sticky-position','study-sticky-done','study-sticky-remove','study-sticky-remove-yes']) $(id).disabled = pendingNote || historyBlocked;\n  }\n",
    "  function syncSticky() {\n    $('study-sticky').hidden = true; $('study-sticky-panel').hidden = true;\n    $('study-sticky').inert = true; $('study-sticky-panel').inert = true;\n  }\n",
    "retire sticky UI while retaining inert compatibility nodes"
  ],
  [
    "  $('study-sticky').onclick = () => setSticky(!stickyEnabled);\n  for (const view of ['front','plan']) $('study-sticky-' + view).onclick = () => {\n    if (!live || pendingNote || historyBlocked) return;\n    savePrivate(); setSticky(true); chooseSticky('');\n    if ($('study-view').value !== 'both' && $('study-view').value !== view) { $('study-view').value = view; post({ action: 'view', view }); }\n    post({ action: 'sticky-add', view });\n  };\n  $('study-sticky-list').onchange = event => chooseSticky(event.target.value, true);\n  function styleSticky(key, value) {\n    const note = currentStickies().find(n => n.id === selectedSticky);\n    if (!note || pendingNote || !live || historyBlocked || !stickyModel.validStyle({ ...note, [key]: value }) || !edited()) return;\n    const target = draft.stickies.find(n => n.id === selectedSticky);\n    if (value === undefined) delete target[key]; else target[key] = value;\n    publishStickies(); savePrivate();\n  }\n  document.querySelectorAll('[data-sticky-shape]').forEach(el => { el.onclick = () => styleSticky('shape', el.dataset.stickyShape); });\n  document.querySelectorAll('[data-sticky-color]').forEach(el => {\n    el.style.setProperty('--study-swatch', stickyModel.COLORS[el.dataset.stickyColor]);\n    el.onclick = () => styleSticky('color', el.dataset.stickyColor);\n  });\n  for (const key of ['width','height']) $('study-sticky-' + key).onchange = event => {\n    const value = event.target.value === '' ? undefined : event.target.valueAsNumber;\n    const [min, max] = stickyModel.dimensions[key];\n    styleSticky(key, Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined);\n    event.target.value = currentStickies().find(n => n.id === selectedSticky)?.[key] || (key === 'width' ? 188 : '');\n  };\n  $('study-sticky-auto').onclick = () => styleSticky('height', undefined);\n  $('study-sticky-transparency').oninput = event => styleSticky('backgroundOpacity', (100 - event.target.valueAsNumber) / 100);\n  $('study-sticky-text').oninput = event => {\n    const note = currentStickies().find(n => n.id === selectedSticky);\n    if (!note || pendingNote || !live || !edited()) return;\n    draft.stickies.find(n => n.id === selectedSticky).text = event.target.value.slice(0, stickyModel.MAX_TEXT);\n    publishStickies(); clearTimeout(saveTimer); saveTimer = setTimeout(savePrivate, 300);\n  };\n  $('study-sticky-position').onclick = () => { savePrivate(); post({ action: 'sticky-focus', id: selectedSticky }); };\n  $('study-sticky-done').onclick = () => { savePrivate(); chooseSticky(''); $('study-sticky-list').focus(); };\n  $('study-sticky-remove').onclick = () => { $('study-sticky-confirm').hidden = false; $('study-sticky-remove-no').focus(); };\n  $('study-sticky-remove-no').onclick = () => { $('study-sticky-confirm').hidden = true; $('study-sticky-remove').focus(); };\n  $('study-sticky-remove-yes').onclick = () => {\n    if (!live || pendingNote || !selectedSticky || !edited()) return;\n    draft.stickies = currentStickies().filter(n => n.id !== selectedSticky); selectedSticky = ''; stickyLimit = '';\n    $('study-sticky-confirm').hidden = true; publishStickies(); savePrivate(); $('study-sticky-list').focus();\n  };\n",
    "",
    "remove sticky creation editing saving and list handlers"
  ],
  [
    "    if (['stickies','sticky-selected'].includes(event.data.action) && live && !pendingNote && !historyBlocked\n      && data && event.data.revision === data.revision && event.data.sceneId === scenes[at]?.id) {\n      if (event.data.action === 'stickies') {\n        if (!stickyModel.valid(event.data.stickies)) return;\n        stickyLimit = event.data.limit || '';\n        const change = event.data.change, changedNote = event.data.stickies.find(n => n.id === change?.id);\n        if (!change || !changedNote) { syncSticky(); return; }\n        const existing = currentStickies().find(n => n.id === change.id);\n        if (change.kind === 'add' && (existing || currentStickies().length >= stickyModel.MAX_NOTES)) { publishStickies(); return; }\n        if (['move','text'].includes(change.kind) && !existing) { publishStickies(); return; }\n        if (!['add','move','resize','text'].includes(change.kind) || (change.kind === 'text' && (!Number.isSafeInteger(change.sequence) || change.sequence < 1)) || (change.kind === 'resize' && (!existing || !Number.isFinite(changedNote.width) || !Number.isFinite(changedNote.height))) || !edited()) { loadFrame(); return; }\n        // Merge only the requested personal field. A frame reply cannot replace\n        // newer style/position/text changes made through the other editor.\n        draft.stickies ||= [];\n        if (change.kind === 'add') draft.stickies.push(structuredClone(changedNote));\n        else Object.assign(draft.stickies.find(n => n.id === change.id), change.kind === 'text' ? { text: changedNote.text } : change.kind === 'resize' ? { width: changedNote.width, height: changedNote.height } : { x: changedNote.x, y: changedNote.y });\n        publishStickies(change.kind === 'text' ? { id: change.id, sequence: change.sequence } : undefined); savePrivate();\n      } else chooseSticky(event.data.id, event.data.focus === true);\n    }\n",
    "",
    "remove sticky mutation and persistence messages"
  ],
  [
    "    setPen(false); stickyEnabled = Boolean(value); stickyLimit = '';",
    "    setPen(false); stickyEnabled = false; stickyLimit = '';",
    "prevent sticky mode activation"
  ],
  [
    "  function chooseSticky(id, focus = false) {\n    if (pendingNote || historyBlocked || !live) return;\n    selectedSticky = currentStickies().some(n => n.id === id) ? id : '';\n    $('study-sticky-confirm').hidden = true;\n    post({ action: 'sticky-select', id: selectedSticky }); syncSticky();\n    if (focus && selectedSticky) $('study-sticky-text').focus();\n  }\n",
    "",
    "remove sticky selection and focus"
  ],
  [
    "  function publishStickies(changeAck) {\n    post({ action: 'stickies', sceneId: scenes[at].id, revision: data.revision, stickies: currentStickies(), selectedId: selectedSticky, changeAck });\n    syncSticky();\n  }\n",
    "",
    "remove sticky publish path"
  ]
]);

let continuityJs = await read('stage-study-continuity.js');
{
  const before = continuityJs;
  continuityJs = continuityJs.replace(/'\/study-frame\.html(\?v=[^']*)?'/g, `'./study-frame.html?b=${buildId}'`);
  if (continuityJs === before) throw new Error('stage-study-continuity.js: iframe のパスが見つかりません');
}
await write('stage-study-continuity.js', continuityJs);

// ---- index.html（入口。見本を選ぶだけの小さな紙） -----------------------------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sampleRows = Object.entries(sampleIndex).map(([key, s]) => `
      <li><a class="card" href="./viewer.html?sample=${key}">
        <span class="card-title">${esc(s.label)}</span>
        <span class="card-meta">${s.scenes} シーン · ${(s.bytes / 1024).toFixed(0)} KB · ${esc(s.note)}</span>
      </a></li>`).join('');
const indexHtml = `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<title>舞台スケッチγ 共有画面（スマホ）UI確認用</title>
<link rel="icon" href="data:,">
<style>
  :root { --desk: #191512; --desk-2: #201b16; --ink: #efe7d6; --ink-soft: #93856c; --brass: #9c823f; --rust: #df6433; }
  * { box-sizing: border-box; }
  html { background: var(--desk); color: var(--ink); font: 15px/1.6 "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif; }
  body { margin: 0; padding: max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom)); }
  main { max-width: 640px; margin: 0 auto; }
  .ver { position: fixed; top: 6px; left: 8px; font-size: 11px; color: var(--ink-soft); letter-spacing: .02em; }
  h1 { font-size: 20px; line-height: 1.4; margin: 28px 0 4px; font-weight: 600; }
  .kicker { color: var(--ink-soft); font-size: 13px; margin: 0 0 20px; }
  ul { list-style: none; padding: 0; margin: 0 0 24px; display: grid; gap: 8px; }
  .card { display: block; padding: 12px 14px; background: var(--desk-2); border: 1px solid #3a3027; color: inherit; text-decoration: none; min-height: 44px; }
  .card:focus-visible, .card:hover { outline: 2px solid var(--brass); outline-offset: 0; }
  .card-title { display: block; font-weight: 600; }
  .card-meta { display: block; font-size: 13px; color: var(--ink-soft); }
  .note { font-size: 13px; color: var(--ink-soft); border-top: 1px solid #3a3027; padding-top: 12px; }
  .note strong { color: var(--rust); font-weight: 600; }
  a.plain { color: var(--brass); }
</style></head>
<body>
<div class="ver" aria-label="版">build ${buildId} · γ ${esc(sourceVersion)} ${esc(sourceCommit)}</div>
<main>
  <h1>舞台スケッチγ 共有画面（スマホ）UI確認用</h1>
  <p class="kicker">演者用リンクで開く Viewer を、共有サーバーなしで同梱見本から表示します。スマホの横画面では右側メニューから操作でき、縦画面では上部に情報を表示します。</p>
  <ul>${sampleRows}
  </ul>
  <p class="note"><strong>送信なし。</strong>「オーナーへ共有」は成功表示だけで、どこにも送られません。自分用メモと線はこの端末のブラウザにだけ残ります。既存の図上メモは表示のみです（<code>stage-study-*</code> キー）。本物の共有は <a class="plain" href="https://stage-sketch-gamma-share.juggler-arata.workers.dev/stage.html">γ 共有ホスト</a>、本体は <a class="plain" href="https://aratama-ship-it.github.io/stage-sketch-gamma/">γ（GitHub Pages）</a>。</p>
</main>
</body></html>
`;
await write('index.html', indexHtml);

// ---- manifest.json と古い生成物の掃除 ------------------------------------------
const generated = ['index.html', 'viewer.html', 'study-frame.html', 'preview-adapter.js', 'stage-study-viewer.js', 'stage-study-continuity.js',
  ...copies, ...Object.keys(sampleIndex).map(k => `samples/${k}.json`)].sort();
let previous = null;
try { previous = JSON.parse(await readFile(out('manifest.json'), 'utf8')); } catch {}
for (const name of Object.keys(previous?.files || {})) {
  if (!generated.includes(name) && name !== 'manifest.json') { await rm(out(name), { force: true }); console.log(`removed stale ${name}`); }
}
const manifest = {
  kind: 'stage-sketch-gamma-phone-share-preview', buildId, generatedAt: new Date().toISOString(),
  source: { dir: sourceDir, commit: sourceCommit, version: sourceVersion }, defaultSample: DEFAULT_SAMPLE, samples: sampleIndex,
  externalSubmission: false, overrides, patches,
  files: Object.fromEntries(await Promise.all(generated.map(async name => {
    const bytes = await readFile(out(name)); return [name, { bytes: bytes.length, sha256: sha256(bytes) }];
  }))),
};
await write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`built ${generated.length} files · build ${buildId} · source γ ${sourceVersion} ${sourceCommit}`);
