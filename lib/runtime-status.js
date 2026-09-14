(function attachRuntimeStatus(globalScope) {
  'use strict';
  const incidents = [];
  const maxIncidents = 20;

  function normalizeError(error) {
    if (!error) return { name:'Error', message:'Unknown runtime error' };
    return {
      name: error.name || 'Error',
      message: String(error.message || error).slice(0, 240)
    };
  }

  function record(scope, error, details = {}) {
    const item = {
      scope: String(scope || 'runtime'),
      ...normalizeError(error),
      at: new Date().toISOString(),
      fatal: Boolean(details.fatal)
    };
    incidents.push(item);
    if (incidents.length > maxIncidents) incidents.shift();
    return item;
  }

  function showNotice(message) {
    if (!globalScope.document?.body) return;
    let notice = globalScope.document.querySelector('[data-runtime-notice]');
    if (!notice) {
      notice = globalScope.document.createElement('div');
      notice.className = 'runtime-notice';
      notice.dataset.runtimeNotice = '';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      globalScope.document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.hidden = false;
  }

  function report(scope, error, details = {}) {
    const item = record(scope, error, details);
    console.warn(`[Web Worlds:${item.scope}]`, error);
    if (details.visible && details.message) showNotice(details.message);
    return item;
  }

  globalScope.addEventListener?.('error', (event) => {
    record('window', event.error || new Error(event.message || 'Script error'));
  });
  globalScope.addEventListener?.('unhandledrejection', (event) => {
    record('promise', event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled promise rejection')));
  });

  globalScope.WWRuntime = Object.freeze({ incidents, report, record, showNotice });
})(typeof window !== 'undefined' ? window : globalThis);
