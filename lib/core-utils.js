(function attachWebWorldsCore(globalScope) {
  'use strict';

  const THEMES = Object.freeze(['cool', 'cute', 'royal', 'scary']);

  function normalizeTheme(value) {
    return THEMES.includes(value) ? value : 'cool';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return 'Not measured';
    if (value < 1024) return `${Math.round(value)} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} KB`;
    return `${(value / (1024 ** 2)).toFixed(value >= 10 * 1024 ** 2 ? 1 : 2)} MB`;
  }

  function normalizeQualityStatus(value) {
    return ['pass', 'warn', 'fail', 'pending', 'info'].includes(value) ? value : 'pending';
  }

  const api = Object.freeze({ THEMES, normalizeTheme, clamp, safeInteger, formatBytes, normalizeQualityStatus });

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.WWCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
