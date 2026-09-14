(() => {
  'use strict';

  const core = window.WWCore || {};
  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node && value !== undefined && value !== null) node.textContent = String(value);
  };
  const setStatus = (node, status, text) => {
    if (!node) return;
    const normalized = core.normalizeQualityStatus ? core.normalizeQualityStatus(status) : status;
    node.dataset.status = normalized || 'pending';
    if (text) node.textContent = text;
  };
  const humanStatus = (status) => ({ pass:'Passed', warn:'Attention', fail:'Failed', pending:'Pending', info:'Configured' }[status] || 'Pending');
  const formatBytes = core.formatBytes || ((value) => `${value} B`);

  async function loadJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  function renderRelease(release) {
    setText('[data-release-version]', `v${release.version || '0.27'}`);
    setText('[data-release-name]', release.name || 'Production Hardening + Full-Stack Proof');
    setText('[data-footer-version]', release.version || '0.27');
    setText('[data-production-host]', release.deployment?.platform || 'Cloudflare Pages');
  }

  function renderQuality(quality) {
    const artifactStatus = document.querySelector('[data-artifact-status]');
    const suiteStatus = document.querySelector('[data-suite-status]');
    const lighthouseStatus = document.querySelector('[data-lighthouse-status]');

    setStatus(artifactStatus, quality.artifactVerification?.status || 'pending', humanStatus(quality.artifactVerification?.status));
    setText('[data-artifact-note]', quality.artifactVerification?.note || 'Verified release snapshot unavailable.');

    const suite = quality.automatedSuite || {};
    setStatus(suiteStatus, suite.status || 'pending', suite.status === 'pass' ? 'Passing' : suite.status === 'info' ? 'Configured' : humanStatus(suite.status));
    setText('[data-suite-note]', suite.note || 'Automated suite status unavailable.');

    const lighthouse = quality.lighthouse || {};
    const measured = ['performance','accessibility','bestPractices','seo'].some((key) => Number.isFinite(lighthouse[key]));
    setStatus(lighthouseStatus, measured ? 'pass' : 'pending', measured ? `${lighthouse.performance ?? '—'} / 100` : 'Not measured');

    setText('[data-unit-count]', suite.unitCases ?? '—');
    setText('[data-e2e-count]', suite.e2eCases ?? '—');
    setText('[data-a11y-count]', suite.a11yCases ?? '—');
    setText('[data-api-count]', suite.apiCases ?? '—');
    setText('[data-link-count]', quality.staticAnalysis?.localReferencesChecked ?? '—');
    setText('[data-quality-verified]', quality.verifiedAt ? `verified ${quality.verifiedAt}` : 'release snapshot');

    const size = quality.sourceSize || {};
    setText('[data-size-js]', formatBytes(size.javascriptBytes));
    setText('[data-size-css]', formatBytes(size.cssBytes));
    setText('[data-size-html]', formatBytes(size.htmlBytes));
    setText('[data-size-total]', formatBytes(size.totalTrackedBytes));

    const sourceBars = document.querySelector('[data-source-bars]');
    if (sourceBars) {
      sourceBars.replaceChildren();
      const total = Math.max(1, Number(size.totalTrackedBytes) || 1);
      const sourceMetrics = [
        ['JavaScript', Number(size.javascriptBytes) || 0],
        ['CSS', Number(size.cssBytes) || 0],
        ['HTML', Number(size.htmlBytes) || 0]
      ];
      sourceMetrics.forEach(([label, value]) => {
        const row = document.createElement('div'); row.className = 'performance-row';
        const name = document.createElement('span'); name.className = 'performance-label'; name.textContent = label;
        const track = document.createElement('span'); track.className = 'performance-track';
        const fill = document.createElement('span'); fill.className = 'performance-fill'; fill.style.width = `${Math.max(1, value / total * 100)}%`;
        track.appendChild(fill);
        const out = document.createElement('span'); out.className = 'performance-value'; out.textContent = formatBytes(value);
        row.append(name, track, out); sourceBars.appendChild(row);
      });
    }

    const list = document.querySelector('[data-test-list]');
    if (list) {
      list.replaceChildren();
      (quality.checks || []).forEach((check) => {
        const li = document.createElement('li');
        li.dataset.status = check.status || 'pending';
        const dot = document.createElement('span'); dot.className = 'check-dot';
        const copy = document.createElement('span'); copy.className = 'test-copy';
        const strong = document.createElement('strong'); strong.textContent = check.label || 'Check';
        const small = document.createElement('small'); small.textContent = check.note || '';
        copy.append(strong, small);
        const count = document.createElement('span'); count.className = 'test-count'; count.textContent = check.result || humanStatus(check.status);
        li.append(dot, copy, count);
        list.appendChild(li);
      });
    }

    const performanceBars = document.querySelector('[data-performance-bars]');
    if (performanceBars) {
      performanceBars.replaceChildren();
      const metrics = [
        ['Performance', lighthouse.performance],
        ['Accessibility', lighthouse.accessibility],
        ['Best practices', lighthouse.bestPractices],
        ['SEO', lighthouse.seo]
      ];
      metrics.forEach(([label, value]) => {
        const row = document.createElement('div'); row.className = 'performance-row';
        const name = document.createElement('span'); name.className = 'performance-label'; name.textContent = label;
        const track = document.createElement('span'); track.className = 'performance-track';
        const fill = document.createElement('span'); fill.className = 'performance-fill'; fill.style.width = Number.isFinite(value) ? `${Math.max(0, Math.min(100, value))}%` : '0%';
        track.appendChild(fill);
        const out = document.createElement('span'); out.className = 'performance-value'; out.textContent = Number.isFinite(value) ? `${value} / 100` : 'Not measured';
        row.append(name, track, out);
        performanceBars.appendChild(row);
      });
    }
  }

  function renderHistory(history) {
    const shell = document.querySelector('[data-history-shell]');
    if (!shell) return;
    const points = Array.isArray(history?.releases) ? history.releases.filter((item) => Number.isFinite(item.performance)) : [];
    if (points.length < 2) {
      const releases = Array.isArray(history?.releases) ? history.releases : [];
      shell.replaceChildren();
      const wrap = document.createElement('div'); wrap.className = 'release-history-table';
      releases.forEach((release) => {
        const row = document.createElement('div'); row.className = 'release-history-row';
        const version = document.createElement('strong'); version.textContent = release.version || 'release';
        const tests = document.createElement('span'); tests.textContent = `${(release.unitCases || 0) + (release.apiCases || 0)} deterministic tests`;
        const size = document.createElement('span'); size.textContent = formatBytes(release.trackedBytes);
        const perf = document.createElement('span'); perf.textContent = Number.isFinite(release.performance) ? `Lighthouse ${release.performance}` : 'Lighthouse pending';
        row.append(version, tests, size, perf); wrap.appendChild(row);
      });
      const note = document.createElement('p'); note.className = 'history-note'; note.textContent = 'Release history is real even before two reproducible Lighthouse points exist. No decorative trend line is invented.';
      shell.append(wrap, note);
      return;
    }
    const width = 720, height = 150, pad = 26;
    const min = Math.max(0, Math.min(...points.map((p) => p.performance)) - 5);
    const max = 100;
    const xFor = (i) => pad + (i * (width - pad * 2) / Math.max(1, points.length - 1));
    const yFor = (v) => height - pad - ((v - min) / Math.max(1, max - min)) * (height - pad * 2);
    const coords = points.map((p, i) => `${xFor(i)},${yFor(p.performance)}`).join(' ');
    shell.innerHTML = `<div class="history-chart" aria-label="Lighthouse performance history"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Performance by release"><line class="axis" x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}"></line><polyline class="line" points="${coords}"></polyline>${points.map((p,i)=>`<circle class="point" cx="${xFor(i)}" cy="${yFor(p.performance)}" r="5"></circle><text x="${xFor(i)}" y="${height-5}" text-anchor="middle">${p.version}</text><text x="${xFor(i)}" y="${yFor(p.performance)-10}" text-anchor="middle">${p.performance}</text>`).join('')}</svg></div>`;
  }

  async function runLiveChecks() {
    const list = document.querySelector('[data-live-checks]');
    const summary = document.querySelector('[data-live-summary]');
    if (!list || !summary) return;
    const base = new URL('../', window.location.href);
    const checks = [
      { label:'Shared runtime booted', note:'Theme, navigation, motion preferences, and diagnostics initialized.', run: async () => Boolean(window.WebWorldsDiagnostics?.booted) },
      { label:'Core utility layer', note:'Shared deterministic helpers are available.', run: async () => Boolean(window.WWCore?.normalizeTheme) },
      { label:'Critical asset', note:'Favicon/static asset responds from this origin.', run: async () => (await fetch(new URL('assets/icons/favicon.svg', base), { cache:'no-store' })).ok },
      { label:'Home route', note:'World gateway responds from this deployment.', run: async () => (await fetch(base, { cache:'no-store' })).ok },
      { label:'Interactive routes', note:'Playground, 3D, Lab, Room, and Tunnel route documents respond.', run: async () => {
          const paths = ['playground/','3d/','lab/','room/','tunnel/'];
          const responses = await Promise.all(paths.map((path) => fetch(new URL(path, base), { cache:'no-store' })));
          return responses.every((response) => response.ok);
        } },
      { label:'Professional routes', note:'About and Engineering route documents respond.', run: async () => {
          const responses = await Promise.all(['about/','engineering/'].map((path) => fetch(new URL(path, base), { cache:'no-store' })));
          return responses.every((response) => response.ok);
        } }
    ];

    list.replaceChildren();
    let passed = 0;
    for (const check of checks) {
      const li = document.createElement('li'); li.dataset.status = 'pending';
      const dot = document.createElement('span'); dot.className = 'check-dot';
      const copy = document.createElement('span'); copy.className = 'live-check-copy';
      const strong = document.createElement('strong'); strong.textContent = check.label;
      const small = document.createElement('small'); small.textContent = check.note;
      copy.append(strong, small);
      const state = document.createElement('span'); state.className = 'live-check-state'; state.textContent = 'checking';
      li.append(dot, copy, state); list.appendChild(li);
      try {
        const ok = await check.run();
        li.dataset.status = ok ? 'pass' : 'fail';
        state.textContent = ok ? 'PASS' : 'FAIL';
        if (ok) passed += 1;
      } catch (error) {
        li.dataset.status = 'fail';
        state.textContent = 'UNAVAILABLE';
      }
    }
    summary.textContent = `${passed}/${checks.length} passing now`;
  }

  async function runBackendHealth() {
    const apiStatus = document.querySelector('[data-backend-api-status]');
    const dbStatus = document.querySelector('[data-backend-db-status]');
    const apiNote = document.querySelector('[data-backend-api-note]');
    const dbNote = document.querySelector('[data-backend-db-note]');
    if (!apiStatus || !dbStatus) return;

    const baseUrl = window.siteConfig?.backend?.apiBase || '';
    const leaderboard = window.WWLeaderboard?.createLeaderboardClient?.({ baseUrl, timeoutMs: 3500 });
    if (!leaderboard?.configured) {
      setStatus(apiStatus, 'pending', 'Deployment pending');
      setStatus(dbStatus, 'pending', 'Deployment pending');
      if (apiNote) apiNote.textContent = 'Worker code and tests are included; set the deployed Worker /api URL in config.js to activate live checks.';
      if (dbNote) dbNote.textContent = 'D1 migration is included and remains intentionally unclaimed until the production binding is configured.';
      setText('[data-backend-latency]', 'Not measured');
      return;
    }

    setStatus(apiStatus, 'pending', 'Checking…');
    setStatus(dbStatus, 'pending', 'Checking…');
    const started = performance.now();
    try {
      const result = await leaderboard.health();
      const roundTrip = Math.max(0, Math.round(performance.now() - started));
      const apiOk = result?.worker === 'ok';
      const dbOk = result?.database === 'ok';
      setStatus(apiStatus, apiOk ? 'pass' : 'fail', apiOk ? 'Healthy' : 'Degraded');
      setStatus(dbStatus, dbOk ? 'pass' : 'fail', dbOk ? 'Healthy' : 'Unavailable');
      if (apiNote) apiNote.textContent = apiOk ? 'Worker answered the live health request.' : 'Worker returned a degraded health state.';
      if (dbNote) dbNote.textContent = dbOk ? 'D1 answered a lightweight SELECT 1 health query.' : 'Worker is reachable but D1 did not pass its health query.';
      setText('[data-backend-latency]', `${roundTrip} ms`);
    } catch (error) {
      setStatus(apiStatus, 'fail', 'Unavailable');
      setStatus(dbStatus, 'warn', 'Unknown');
      if (apiNote) apiNote.textContent = error.message || 'Worker health request failed.';
      if (dbNote) dbNote.textContent = 'Database state cannot be inferred while the Worker is unreachable.';
      setText('[data-backend-latency]', 'Unavailable');
    }
  }

  async function boot() {
    try {
      const [release, quality, history] = await Promise.all([
        loadJson('data/release.json'),
        loadJson('data/quality.json'),
        loadJson('data/history.json')
      ]);
      renderRelease(release);
      renderQuality(quality);
      renderHistory(history);
    } catch (error) {
      console.warn('Engineering release evidence unavailable', error);
      const artifact = document.querySelector('[data-artifact-status]');
      const suite = document.querySelector('[data-suite-status]');
      setStatus(artifact, 'warn', 'Unavailable');
      setText('[data-artifact-note]', 'Release snapshot could not be loaded. No success state is being assumed.');
      setStatus(suite, 'warn', 'Unavailable');
      setText('[data-suite-note]', 'Automated suite data could not be loaded.');
    }
    runLiveChecks();
    runBackendHealth();
  }

  boot();
})();
