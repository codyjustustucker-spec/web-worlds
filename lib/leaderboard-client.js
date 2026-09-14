(function attachLeaderboardClient(globalScope) {
  'use strict';

  class LeaderboardError extends Error {
    constructor(message, status = 0, code = 'unavailable') {
      super(message);
      this.name = 'LeaderboardError';
      this.status = status;
      this.code = code;
    }
  }

  function trimBase(value) {
    return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
  }

  function formatDuration(durationMs) {
    const value = Number(durationMs);
    if (!Number.isFinite(value) || value < 0) return '—';
    const seconds = value / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  function createLeaderboardClient(options = {}) {
    const baseUrl = trimBase(options.baseUrl);
    const fetchImpl = options.fetchImpl || globalScope.fetch?.bind(globalScope);
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 3500;
    const configured = Boolean(baseUrl && fetchImpl);

    async function request(path, init = {}) {
      if (!configured) throw new LeaderboardError('Online scores are not configured for this deployment.', 0, 'not-configured');
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetchImpl(`${baseUrl}${path}`, { ...init, signal: controller?.signal, cache: 'no-store' });
        let data = null;
        try { data = await response.json(); } catch { data = null; }
        if (!response.ok) throw new LeaderboardError(data?.error || `Score service returned ${response.status}.`, response.status, response.status === 429 ? 'rate-limited' : 'request-failed');
        return data;
      } catch (error) {
        if (error instanceof LeaderboardError) throw error;
        if (error?.name === 'AbortError') throw new LeaderboardError('Score service timed out.', 0, 'timeout');
        throw new LeaderboardError('Online scores are temporarily unavailable.', 0, 'network');
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }

    return Object.freeze({
      configured,
      baseUrl,
      getScores(mode, limit = 10) {
        return request(`/scores?mode=${encodeURIComponent(mode)}&limit=${encodeURIComponent(limit)}`);
      },
      submitScore(score) {
        return request('/scores', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(score) });
      },
      health() { return request('/health'); }
    });
  }

  const api = Object.freeze({ LeaderboardError, createLeaderboardClient, formatDuration });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.WWLeaderboard = api;
})(typeof window !== 'undefined' ? window : globalThis);
