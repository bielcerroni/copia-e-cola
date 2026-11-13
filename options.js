'use strict';
const prefs = globalThis.CopiaColaUtils.DEFAULTS;
const form = document.getElementById('preferences');
const status = document.getElementById('status');
chrome.storage.local.get(prefs).then(data => {
  document.getElementById('recentCount').value = data.recentCount;
  document.getElementById('maxFileMB').value = data.maxFileMB;
  document.getElementById('showClipboard').checked = data.showClipboard;
  document.getElementById('excludedSites').value = (data.excludedSites || []).join('\n');
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const recentCount = Number(document.getElementById('recentCount').value);
  const maxFileMB = Number(document.getElementById('maxFileMB').value);
  if (!Number.isInteger(recentCount) || recentCount < 1 || recentCount > 20 ||
      !Number.isInteger(maxFileMB) || maxFileMB < 1 || maxFileMB > 40) return;
  await chrome.storage.local.set({
    recentCount, maxFileMB,
    showClipboard: document.getElementById('showClipboard').checked,
    excludedSites: document.getElementById('excludedSites').value.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
  });
  status.textContent = 'Preferências salvas.';
});
