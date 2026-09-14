(() => {
  'use strict';
  const api = window.WWLeaderboard;
  if (!api) return;

  const configuredBase = window.siteConfig?.backend?.apiBase || '';
  const client = api.createLeaderboardClient({ baseUrl: configuredBase });
  const widgets = [...document.querySelectorAll('[data-leaderboard]')];
  if (!widgets.length) return;

  const nameKey = 'web-worlds-score-name';
  const pendingPrefix = 'web-worlds-pending-score:';

  const readStorage = (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const writeStorage = (key, value) => {
    try { localStorage.setItem(key, value); } catch {}
  };
  const removeStorage = (key) => {
    try { localStorage.removeItem(key); } catch {}
  };

  function setState(widget, state, message) {
    widget.dataset.state = state;
    const node = widget.querySelector('[data-leaderboard-status]');
    if (node) node.textContent = message;
  }

  function renderRows(widget, scores) {
    const list = widget.querySelector('[data-leaderboard-list]');
    if (!list) return;
    list.replaceChildren();
    if (!scores.length) {
      const li = document.createElement('li');
      li.className = 'leaderboard-empty';
      li.textContent = 'No verified runs yet. First clear gets the tiny crown.';
      list.appendChild(li);
      return;
    }
    scores.forEach((entry, index) => {
      const li = document.createElement('li');
      const rank = document.createElement('span'); rank.className = 'leaderboard-rank'; rank.textContent = String(index + 1).padStart(2, '0');
      const player = document.createElement('strong'); player.className = 'leaderboard-player'; player.textContent = entry.displayName || 'Anonymous';
      const score = document.createElement('span'); score.className = 'leaderboard-score'; score.textContent = String(entry.score ?? '—');
      const duration = document.createElement('span'); duration.className = 'leaderboard-time'; duration.textContent = api.formatDuration(entry.durationMs);
      li.append(rank, player, score, duration);
      list.appendChild(li);
    });
  }

  async function refresh(widget) {
    const mode = widget.dataset.leaderboardMode;
    if (!client.configured) {
      setState(widget, 'pending', 'Backend ready in code. Deploy the Worker and set its API URL to activate global scores.');
      return;
    }
    setState(widget, 'loading', 'Checking global scores…');
    try {
      const data = await client.getScores(mode, 8);
      renderRows(widget, Array.isArray(data?.scores) ? data.scores : []);
      setState(widget, 'ready', 'Global leaderboard online. Only completed runs can be submitted.');
    } catch (error) {
      setState(widget, 'offline', error.message || 'Online scores temporarily unavailable.');
    }
  }

  function restorePending(widget) {
    const mode = widget.dataset.leaderboardMode;
    const raw = readStorage(`${pendingPrefix}${mode}`);
    if (!raw) return;
    try {
      const pending = JSON.parse(raw);
      if (!pending || pending.mode !== mode || !Number.isInteger(pending.score) || !Number.isInteger(pending.durationMs)) return;
      widget._pendingScore = pending;
      const submit = widget.querySelector('[data-score-submit]');
      if (submit) submit.disabled = false;
      const result = widget.querySelector('[data-score-result]');
      if (result) result.textContent = `Saved run: ${pending.score} pts · ${api.formatDuration(pending.durationMs)}. Ready to submit.`;
    } catch {}
  }

  widgets.forEach((widget) => {
    const mode = widget.dataset.leaderboardMode;
    const input = widget.querySelector('[data-score-name]');
    const submit = widget.querySelector('[data-score-submit]');
    const refreshButton = widget.querySelector('[data-score-refresh]');
    if (input) input.value = readStorage(nameKey) || '';

    restorePending(widget);
    refresh(widget);

    refreshButton?.addEventListener('click', () => refresh(widget));
    input?.addEventListener('input', () => writeStorage(nameKey, input.value.trim().slice(0, 20)));

    submit?.addEventListener('click', async () => {
      const pending = widget._pendingScore;
      if (!pending) return;
      const displayName = input?.value.trim() || '';
      if (!displayName) {
        setState(widget, 'warn', 'Add a display name before submitting the run.');
        input?.focus();
        return;
      }
      if (!client.configured) {
        setState(widget, 'pending', 'Run saved locally. Online submission activates after the Worker endpoint is configured.');
        return;
      }
      submit.disabled = true;
      setState(widget, 'loading', 'Submitting verified clear…');
      try {
        await client.submitScore({ ...pending, displayName });
        removeStorage(`${pendingPrefix}${mode}`);
        widget._pendingScore = null;
        const result = widget.querySelector('[data-score-result]');
        if (result) result.textContent = 'Run submitted. Tiny crown acquired. ✦';
        setState(widget, 'ready', 'Score accepted. Refreshing the board…');
        await refresh(widget);
      } catch (error) {
        submit.disabled = false;
        setState(widget, 'offline', `${error.message || 'Submission failed.'} Your run is still saved locally.`);
      }
    });
  });

  window.addEventListener('webworlds:brick-breaker-complete', (event) => {
    const run = event.detail;
    if (!run?.mode) return;
    const widget = widgets.find((item) => item.dataset.leaderboardMode === run.mode);
    if (!widget) return;
    const pending = { mode:run.mode, score:run.score, durationMs:run.durationMs };
    widget._pendingScore = pending;
    writeStorage(`${pendingPrefix}${run.mode}`, JSON.stringify(pending));
    const submit = widget.querySelector('[data-score-submit]');
    if (submit) submit.disabled = false;
    const result = widget.querySelector('[data-score-result]');
    if (result) result.textContent = `Field clear: ${run.score} pts · ${api.formatDuration(run.durationMs)}. Run saved locally until submitted.`;
    widget.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'nearest' });
  });
})();
