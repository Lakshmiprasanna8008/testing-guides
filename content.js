(() => {
  'use strict';
  if (window.top !== window.self || document.getElementById('cpi-guider-host')) return;

  const BASES = ['/api/v1', '/itspaces/odata/api/v1', '/odata/api/v1'];
  let apiBase = null;

  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const q = v => String(v).replace(/'/g, "''");
  const pill = v => `<span class="pill ${esc(v)}">${esc(v)}</span>`;
  const fmtDate = v => { const m = /\/Date\((\d+)/.exec(v || ''); return m ? new Date(+m[1]).toLocaleString() : (v || ''); };

  async function detectBase() {
    if (apiBase) return apiBase;
    for (const b of BASES) {
      try {
        const r = await fetch(location.origin + b + '/MessageProcessingLogs?$top=1&$format=json',
          { credentials: 'include', headers: { Accept: 'application/json' } });
        if (!r.ok) continue;
        JSON.parse(await r.text());          // a login page returns 200 HTML, so insist on real JSON
        apiBase = b;
        return b;
      } catch (e) { /* try next */ }
    }
    throw new Error('Could not find the OData API on this host (tried ' + BASES.join(', ') +
      ').\nMake sure you are logged in and your user has monitoring/read roles.');
  }

  async function api(path, as = 'json') {
    const base = await detectBase();
    const res = await fetch(location.origin + base + path, {
      credentials: 'include',
      headers: { Accept: as === 'json' ? 'application/json' : '*/*' }
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(res.status + ' ' + res.statusText + '\n' + t.slice(0, 600));
    }
    if (as === 'blob') return res.blob();
    if (as === 'text') return res.text();
    const j = await res.json();
    return j.d && j.d.results ? j.d.results : (j.d ?? j);
  }

  function pretty(t) {
    const s = (t || '').trim();
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch (e) { /* not json */ }
    if (s.startsWith('<')) {
      let ind = 0;
      return s.replace(/>\s*</g, '>\n<').split('\n').map(l => {
        if (/^<\//.test(l)) ind = Math.max(ind - 1, 0);
        const out = '  '.repeat(ind) + l;
        if (/^<[^!?\/][^>]*[^\/]>$/.test(l) && !/<\/[^>]+>$/.test(l)) ind++;
        return out;
      }).join('\n');
    }
    return t;
  }

  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    root.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  const EXT_BY_TYPE = { 'application/xml': '.xml', 'text/xml': '.xml', 'application/json': '.json', 'text/csv': '.csv',
    'application/pdf': '.pdf', 'application/zip': '.zip', 'text/html': '.html', 'text/plain': '.txt' };
  const withExt = (name, ct) => /\.[A-Za-z0-9]{1,5}$/.test(name || '') ? name :
    (name || 'attachment') + (EXT_BY_TYPE[String(ct || '').split(';')[0].trim().toLowerCase()] || '.txt');

  function currentFlowId() {
    const m = /integrationflows\/([^\/?#]+)/i.exec(decodeURIComponent(location.href));
    return m ? m[1] : '';
  }

  // ---------- UI ----------
  const CSS = `
    :host { all: initial;
      --bg:#fbfaf7; --surface:#ffffff; --ink:#1b2430; --muted:#6b7280; --line:#e7e3da; --tint:#f4f1ea;
      --navy:#14213a; --navy2:#1f3a5f; --gold:#b08d57; --btn:#1f3a5f; --btn-ink:#ffffff;
      --shadow:0 18px 50px rgba(20,33,58,.28), 0 2px 8px rgba(20,33,58,.12);
    }
    @media (prefers-color-scheme: dark) { :host {
      --bg:#12171f; --surface:#1a212b; --ink:#ebe8e2; --muted:#98a1ae; --line:#2a3340; --tint:#202937;
      --navy:#0d1522; --navy2:#16233a; --gold:#d3b27a; --btn:#d3b27a; --btn-ink:#12171f;
      --shadow:0 18px 50px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.35);
    } }
    * { box-sizing: border-box; font-family: "Segoe UI", -apple-system, "SF Pro Text", Roboto, sans-serif; }
    [hidden] { display: none !important; }

    #fab { position: fixed; right: 22px; bottom: 22px; z-index: 2147483000; display: flex; align-items: center; gap: 8px;
           background: linear-gradient(135deg, var(--navy), var(--navy2)); color: #f3ead7; border: 1px solid var(--gold);
           border-radius: 999px; padding: 10px 18px 10px 14px; font-size: 12.5px; font-weight: 600; letter-spacing: .08em;
           cursor: pointer; box-shadow: var(--shadow); transition: transform .15s ease; user-select: none; }
    #fab:hover { transform: translateY(-2px); }
    #fab svg { color: var(--gold); }

    #panel { position: fixed; right: 22px; bottom: 80px; width: 540px; max-width: 96vw; height: 76vh; z-index: 2147483000;
             background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
             display: flex; flex-direction: column; box-shadow: var(--shadow); font-size: 12.5px;
             animation: rise .22s ease; }
    @keyframes rise { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }

    #bar { display: flex; align-items: center; gap: 12px; padding: 14px 16px;
           background: linear-gradient(135deg, var(--navy), var(--navy2)); color: #f3ead7; border-bottom: 2px solid var(--gold); }
    #bar .mark { color: var(--gold); display: flex; }
    #bar .ttl { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    #bar b { font-family: Georgia, "Times New Roman", serif; font-size: 16px; font-weight: 600; letter-spacing: .06em; }
    #flowlbl { font-size: 11px; opacity: .72; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button.x { background: transparent; border: 0; color: #f3ead7; font-size: 20px; line-height: 1; cursor: pointer; opacity: .7; padding: 2px 6px; }
    button.x:hover { opacity: 1; }

    #tabs { display: flex; gap: 4px; padding: 0 12px; background: var(--surface); border-bottom: 1px solid var(--line); }
    #tabs button { border: 0; background: transparent; color: var(--muted); padding: 11px 14px; cursor: pointer; font-size: 12px;
                   font-weight: 600; letter-spacing: .05em; text-transform: uppercase; border-bottom: 2px solid transparent; margin-bottom: -1px; }
    #tabs button:hover { color: var(--ink); }
    #tabs button.on { color: var(--ink); border-bottom-color: var(--gold); }

    #body { flex: 1; overflow: auto; padding: 14px; }
    #body::-webkit-scrollbar, #out::-webkit-scrollbar { width: 8px; height: 8px; }
    #body::-webkit-scrollbar-thumb, #out::-webkit-scrollbar-thumb { background: var(--line); border-radius: 8px; }

    #outwrap { border-top: 1px solid var(--line); background: var(--surface); padding: 10px 12px 12px; max-height: 40%; display: flex; flex-direction: column; }
    #outhead { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
    #outtitle { flex: 1; font-family: Georgia, serif; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #out { margin: 0; flex: 1; overflow: auto; background: #0f141c; color: #d9d4c7; padding: 10px 12px; border-radius: 10px;
           border: 1px solid var(--line); font: 11px/1.55 "Cascadia Mono", Consolas, Menlo, monospace; white-space: pre-wrap; word-break: break-all; }

    button.b { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 5px 11px;
               cursor: pointer; font-size: 11.5px; font-weight: 500; transition: all .12s ease; }
    button.b:hover { border-color: var(--gold); background: var(--tint); }
    button.b.p { background: var(--btn); color: var(--btn-ink); border-color: var(--btn); font-weight: 600; letter-spacing: .02em; }
    button.b.p:hover { filter: brightness(1.12); }

    input, select { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px;
                    padding: 6px 9px; font-size: 12px; outline: none; transition: border-color .12s ease, box-shadow .12s ease; }
    input:focus, select:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(176,141,87,.18); }
    input::placeholder { color: var(--muted); }
    .row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }

    table { font-size: 12.5px; color: var(--ink); border-collapse: collapse; width: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
    th { text-align: left; padding: 8px 10px; font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
         color: var(--muted); background: var(--tint); border-bottom: 1px solid var(--line); }
    td { color: var(--ink); text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
    tr:last-child td { border-bottom: 0; }
    tr.click { cursor: pointer; } tr.click:hover td { background: var(--tint); }

    .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 700; letter-spacing: .05em;
            background: var(--tint); color: var(--muted); }
    .pill.FAILED, .pill.ERROR { background: rgba(185,28,28,.12); color: #b91c1c; }
    .pill.COMPLETED, .pill.STARTED { background: rgba(21,128,61,.13); color: #15803d; }
    .pill.RETRY, .pill.ESCALATED { background: rgba(194,120,3,.14); color: #b45309; }
    .pill.PROCESSING, .pill.STARTING { background: rgba(37,99,235,.13); color: #2563eb; }
    @media (prefers-color-scheme: dark) {
      .pill.FAILED, .pill.ERROR { color: #f28b8b; } .pill.COMPLETED, .pill.STARTED { color: #6fd29a; }
      .pill.RETRY, .pill.ESCALATED { color: #f0b865; } .pill.PROCESSING, .pill.STARTING { color: #8db4ff; }
    }

    .muted { color: var(--muted); }
    .card { border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin: 14px 0; background: var(--surface); }
    .card > b { font-family: Georgia, serif; font-size: 13.5px; }
    .card .meta { color: var(--muted); font-size: 11.5px; line-height: 1.7; margin-top: 4px; }
    .err { color: #b91c1c; white-space: pre-wrap; background: rgba(185,28,28,.07); border-radius: 8px; padding: 10px; }
    .sub { font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--gold); margin: 12px 0 6px; }
  `;

  const host = document.createElement('div');
  host.id = 'cpi-guider-host';
  const root = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  root.innerHTML = `
    <style>${CSS}</style>
    <div id="fab"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none"/></svg><span>CPI GUIDER</span></div>
    <div id="panel" hidden>
      <div id="bar"><span class="mark"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none"/></svg></span><div class="ttl"><b>CPI Guider</b><span id="flowlbl"></span></div><button class="x" id="close">&times;</button></div>
      <div id="tabs">
        <button data-t="msg" class="on">Messages</button>
        <button data-t="dep">Deployed</button>
        <button data-t="tools">Tools</button>
      </div>
      <div id="body">
        <section id="t-msg">
          <div class="row">
            <input id="flow" placeholder="iFlow ID" size="24">
            <select id="status"><option value="">All</option><option>FAILED</option><option>COMPLETED</option>
              <option>RETRY</option><option>PROCESSING</option><option>ESCALATED</option></select>
            <select id="range"><option value="1">1 h</option><option value="24" selected>24 h</option>
              <option value="168">7 d</option></select>
            <button class="b p" id="search">Search</button>
          </div>
          <div id="list" class="muted">Press Search.</div>
          <div id="detail"></div>
        </section>
        <section id="t-dep" hidden>
          <div class="row"><input id="depfilter" placeholder="Filter by name" size="24">
            <button class="b p" id="deploadbtn">Load</button></div>
          <div id="deplist" class="muted">Press Load.</div>
        </section>
        <section id="t-tools" hidden>
          <div class="card">
            <b>Download iFlow (design time)</b>
            <div class="row" style="margin-top:6px">
              <input id="dlid" placeholder="iFlow ID" size="26">
              <input id="dlver" value="active" size="8">
              <button class="b p" id="dlbtn">Download ZIP</button>
            </div>
          </div>
          <div class="card">
            <b>API Explorer</b> <span class="muted">(GET, relative to the detected API base, e.g. /api/v1)</span>
            <div class="row" style="margin-top:6px">
              <input id="apipath" size="52" value="/MessageProcessingLogs?$top=5&$format=json">
              <button class="b p" id="apirun">Run</button>
            </div>
          </div>
        </section>
      </div>
      <div id="outwrap" hidden>
        <div id="outhead"><span id="outtitle"></span>
          <button class="b" id="copyout">Copy</button><button class="b" id="saveout">Save</button>
          <button class="b" id="hideout">Hide</button></div>
        <pre id="out"></pre>
      </div>
    </div>`;

  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];

  let lastOut = { text: '', name: 'output.txt' };
  function showOut(title, text, name) {
    lastOut = { text, name: name || 'output.txt' };
    $('#outtitle').textContent = title;
    $('#out').textContent = text;
    $('#outwrap').hidden = false;
  }
  const fail = (title, e) => showOut(title + ' - failed', String(e.message || e));

  // ---------- panel behaviour ----------
  function refreshFlow() {
    const id = currentFlowId();
    $('#flowlbl').textContent = id ? 'iFlow: ' + id : 'No iFlow detected in URL';
    if (id) { $('#flow').value = id; $('#dlid').value = id; }
  }
  $('#fab').onclick = () => { $('#panel').hidden = !$('#panel').hidden; refreshFlow(); };
  $('#close').onclick = () => { $('#panel').hidden = true; };
  $('#hideout').onclick = () => { $('#outwrap').hidden = true; };
  $('#copyout').onclick = () => navigator.clipboard.writeText(lastOut.text);
  $('#saveout').onclick = () => saveBlob(new Blob([lastOut.text], { type: 'text/plain' }), lastOut.name);
  $$('#tabs button').forEach(b => b.onclick = () => {
    $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    ['msg', 'dep', 'tools'].forEach(t => { $('#t-' + t).hidden = (t !== b.dataset.t); });
  });
  let lastUrl = location.href;
  setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; refreshFlow(); } }, 1000);

  // ---------- Messages tab ----------
  $('#search').onclick = async () => {
    const flow = $('#flow').value.trim(), status = $('#status').value, hrs = +$('#range').value;
    const since = new Date(Date.now() - hrs * 3600e3).toISOString().slice(0, 19);
    const f = [`LogStart gt datetime'${since}'`];
    if (flow) f.push(`IntegrationFlowName eq '${q(flow)}'`);
    if (status) f.push(`Status eq '${status}'`);
    $('#list').textContent = 'Loading...';
    $('#detail').innerHTML = '';
    try {
      const rows = await api('/MessageProcessingLogs?$format=json&$top=50&$orderby=' +
        encodeURIComponent('LogStart desc') + '&$filter=' + encodeURIComponent(f.join(' and ')));
      if (!rows.length) { $('#list').textContent = 'No messages found.'; return; }
      $('#list').innerHTML = '<table><tr><th>Start</th><th>Status</th><th>iFlow</th></tr>' +
        rows.map(r => `<tr class="click" data-g="${esc(r.MessageGuid)}"><td>${esc(fmtDate(r.LogStart))}</td>
          <td>${pill(r.Status)}</td><td>${esc(r.IntegrationFlowName)}</td></tr>`).join('') + '</table>';
      $$('#list tr.click').forEach(tr => tr.onclick = () => loadDetail(tr.dataset.g));
    } catch (e) { $('#list').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
  };

  async function loadDetail(guid) {
    const d = $('#detail');
    d.innerHTML = '<div class="card muted">Loading...</div>';
    try {
      const m = await api(`/MessageProcessingLogs('${q(guid)}')?$format=json`);
      d.innerHTML = `<div class="card">
        <div><b>${esc(m.IntegrationFlowName)}</b> ${pill(m.Status)}</div>
        <div class="meta">GUID: ${esc(m.MessageGuid)}<br>
        Start: ${esc(fmtDate(m.LogStart))} &nbsp; End: ${esc(fmtDate(m.LogEnd))}<br>
        Correlation: ${esc(m.CorrelationId)} &nbsp; AppMsgId: ${esc(m.ApplicationMessageId)}<br>
        Sender: ${esc(m.Sender)} &nbsp; Receiver: ${esc(m.Receiver)}</div>
        <div class="row" style="margin:12px 0 4px">
          <button class="b" id="d-copy">Copy GUID</button>
          <button class="b" id="d-err">Error</button>
          <button class="b" id="d-att">Attachments</button>
          <button class="b" id="d-hdr">Custom headers</button>
          <button class="b p" id="d-trace">Trace steps</button>
        </div>
        <div id="dres"></div></div>`;
      $('#d-copy').onclick = () => navigator.clipboard.writeText(guid);
      $('#d-err').onclick = async () => {
        try { showOut('Error information', pretty(await api(`/MessageProcessingLogs('${q(guid)}')/ErrorInformation/$value`, 'text')), guid + '-error.txt'); }
        catch (e) { fail('Error information', e); }
      };
      $('#d-hdr').onclick = async () => {
        try {
          const r = await api(`/MessageProcessingLogs('${q(guid)}')/CustomHeaderProperties?$format=json`);
          showOut('Custom headers', r.length ? r.map(h => h.Name + ' = ' + h.Value).join('\n') : '(none)', guid + '-headers.txt');
        } catch (e) { fail('Custom headers', e); }
      };
      $('#d-att').onclick = () => loadAttachments(guid);
      $('#d-trace').onclick = () => loadSteps(guid);
    } catch (e) { d.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
  }

  async function loadAttachments(guid) {
    const box = $('#dres');
    box.textContent = 'Loading attachments...';
    try {
      const a = await api(`/MessageProcessingLogs('${q(guid)}')/MessageProcessingLogAttachments?$format=json`);
      if (!a.length) { box.textContent = 'No attachments (payload logging via script not used).'; return; }
      box.innerHTML = '<table>' + a.map(x => `<tr><td>${esc(x.Name)}</td><td class="muted">${esc(x.ContentType)}</td>
        <td><button class="b" data-v="${esc(x.Id)}" data-n="${esc(withExt(x.Name, x.ContentType))}">View</button>
        <button class="b" data-s="${esc(x.Id)}" data-n="${esc(withExt(x.Name, x.ContentType))}">Save</button></td></tr>`).join('') + '</table>';
      box.querySelectorAll('button[data-v]').forEach(b => b.onclick = async () => {
        try { showOut('Attachment: ' + b.dataset.n, pretty(await api(`/MessageProcessingLogAttachments('${q(b.dataset.v)}')/$value`, 'text')), b.dataset.n); }
        catch (e) { fail('Attachment', e); }
      });
      box.querySelectorAll('button[data-s]').forEach(b => b.onclick = async () => {
        try { saveBlob(await api(`/MessageProcessingLogAttachments('${q(b.dataset.s)}')/$value`, 'blob'), b.dataset.n); }
        catch (e) { fail('Attachment', e); }
      });
    } catch (e) { box.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
  }

  async function loadSteps(guid) {
    const box = $('#dres');
    box.textContent = 'Loading trace steps...';
    try {
      const runs = await api(`/MessageProcessingLogs('${q(guid)}')/Runs?$format=json`);
      let html = '';
      for (const run of runs) {
        const steps = await api(`/MessageProcessingLogRuns('${q(run.Id)}')/RunSteps?$format=json&$top=500`);
        html += `<div class="sub">Run ${esc(run.Id)}</div><table><tr><th>#</th><th>Step</th><th>Status</th><th></th></tr>` +
          steps.map(s => `<tr><td>${esc(s.ChildCount)}</td><td>${esc(s.StepId || s.ModelStepId)}</td>
            <td>${pill(s.Status)}</td>
            <td><button class="b" data-pl="1" data-r="${esc(s.RunId || run.Id)}" data-c="${esc(s.ChildCount)}" data-n="${esc(s.StepId || s.ModelStepId)}">Payload</button>
            <button class="b" data-pr="1" data-r="${esc(s.RunId || run.Id)}" data-c="${esc(s.ChildCount)}" data-n="${esc(s.StepId || s.ModelStepId)}">Props</button></td></tr>`).join('') + '</table>';
      }
      box.innerHTML = html || 'No runs found.';
      box.querySelectorAll('button[data-pl]').forEach(b => b.onclick = () => stepData(b.dataset, 'payload'));
      box.querySelectorAll('button[data-pr]').forEach(b => b.onclick = () => stepData(b.dataset, 'props'));
    } catch (e) { box.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
  }

  async function stepData(ds, kind) {
    const title = `${kind === 'payload' ? 'Payload' : 'Properties'} - step ${ds.n}`;
    try {
      const tms = await api(`/MessageProcessingLogRunSteps(RunId='${q(ds.r)}',ChildCount=${ds.c})/TraceMessages?$format=json`);
      if (!tms.length) throw new Error('No trace data for this step. Was the log level set to TRACE when the message ran?');
      const tid = tms[0].TraceId;
      const key = async suffix => {
        try { return await api(`/TraceMessages(${tid})/${suffix}`, 'text'); }
        catch (e) { return await api(`/TraceMessages(${tid}L)/${suffix}`, 'text'); }
      };
      if (kind === 'payload') {
        showOut(title, pretty(await key('$value')), `step-${ds.n}-payload.txt`);
      } else {
        let t = await key('ExchangeProperties?$format=json');
        try {
          const j = JSON.parse(t); const arr = j.d && j.d.results ? j.d.results : [];
          t = arr.map(p => p.Name + ' = ' + p.Value).join('\n') || '(none)';
        } catch (e) { /* show raw */ }
        showOut(title, t, `step-${ds.n}-props.txt`);
      }
    } catch (e) { fail(title, e); }
  }

  // ---------- Deployed tab ----------
  let deployed = [];
  function renderDeployed() {
    const f = $('#depfilter').value.toLowerCase();
    const rows = deployed.filter(r => !f || (r.Id + ' ' + r.Name).toLowerCase().includes(f));
    $('#deplist').innerHTML = '<table><tr><th>Artifact</th><th>Type</th><th>Ver</th><th>Status</th><th></th></tr>' +
      rows.map(r => `<tr><td>${esc(r.Name || r.Id)}<div class="muted">${esc(r.Id)}</div></td><td>${esc(r.Type)}</td>
        <td>${esc(r.Version)}</td><td>${pill(r.Status)}</td>
        <td><button class="b" data-e="${esc(r.Id)}">Error</button></td></tr>`).join('') + '</table>';
    $$('#deplist button[data-e]').forEach(b => b.onclick = async () => {
      try { showOut('Deploy error: ' + b.dataset.e, pretty(await api(`/IntegrationRuntimeArtifacts('${q(b.dataset.e)}')/ErrorInformation/$value`, 'text')), b.dataset.e + '-deploy-error.txt'); }
      catch (e) { fail('Deploy error', e); }
    });
  }
  $('#deploadbtn').onclick = async () => {
    $('#deplist').textContent = 'Loading...';
    try { deployed = await api('/IntegrationRuntimeArtifacts?$format=json&$top=500'); renderDeployed(); }
    catch (e) { $('#deplist').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
  };
  $('#depfilter').oninput = renderDeployed;

  // ---------- Tools tab ----------
  $('#dlbtn').onclick = async () => {
    const id = $('#dlid').value.trim(), ver = $('#dlver').value.trim() || 'active';
    if (!id) return showOut('Download', 'Enter an iFlow ID first.');
    try { saveBlob(await api(`/IntegrationDesigntimeArtifacts(Id='${q(id)}',Version='${q(ver)}')/$value`, 'blob'), `${id}_${ver}.zip`); }
    catch (e) { fail('Download iFlow', e); }
  };
  $('#apirun').onclick = async () => {
    const p = $('#apipath').value.trim();
    try { showOut('GET ' + p, pretty(await api(p.startsWith('/') ? p : '/' + p, 'text')), 'api-result.txt'); }
    catch (e) { fail('GET ' + p, e); }
  };

  refreshFlow();
})();
