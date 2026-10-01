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
  <p class="kicker">演者用リンクで開く Viewer を、共有サーバーなしで同梱見本から表示します。スマホで開くと手元用の画面（横帯＋道具列）になります。</p>
  <ul>${sampleRows}
  </ul>
  <p class="note"><strong>送信なし。</strong>「オーナーへ共有」は成功表示だけで、どこにも送られません。自分用メモ・線・図上メモはこの端末のブラウザにだけ残ります（<code>stage-study-*</code> キー）。本物の共有は <a class="plain" href="https://stage-sketch-gamma-share.juggler-arata.workers.dev/stage.html">γ 共有ホスト</a>、本体は <a class="plain" href="https://aratama-ship-it.github.io/stage-sketch-gamma/">γ（GitHub Pages）</a>。</p>
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
