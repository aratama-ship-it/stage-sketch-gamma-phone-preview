/* 共有 Worker の API（/study/api/…）を横取りし、同梱見本を返す。送信は成功表示だけで外へ出さない。 */
(() => {
  'use strict';
  const TOKENS = {"romeo-juliet":"cbf4eb20bbe2f8cd8cee54632f3a68479944936393512ecd","feature-test":"8a935ebddbf437f49781d31c830653ec2aa77e639b5b8671","four-outlines":"23492da45dfb8cc811e5788205a3c49f1962374b8c276e4d"};
  const params = new URLSearchParams(location.search);
  const sample = TOKENS[params.get('sample')] ? params.get('sample') : "romeo-juliet";
  const TOKEN = TOKENS[sample];
  // Viewer は読み込み時に location.hash をトークンとして読むので、ここで同期的に揃える。
  if (location.hash !== '#' + TOKEN) history.replaceState(null, '', location.pathname + location.search + '#' + TOKEN);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
  const originalFetch = window.fetch.bind(window);
  let payloadPromise = null;
  const payload = () => payloadPromise ||= originalFetch('./samples/' + sample + '.json?b=20261001-1206', { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error('sample-missing'); return r.json();
  });
  window.__STAGE_SKETCH_PHONE_PREVIEW__ = { build: "20261001-1206", source: "0.2.69 7af5a27", sample, submissions: 0 };
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
