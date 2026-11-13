/* Helpers shared by the content script, service worker and Node tests. */
(function (root) {
  'use strict';
  const DEFAULTS = Object.freeze({recentCount: 8, maxFileMB: 12, showClipboard: true, excludedSites: []});
  const MIME = Object.freeze({
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    bmp: 'image/bmp', svg: 'image/svg+xml', avif: 'image/avif', pdf: 'application/pdf',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json', zip: 'application/zip',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm'
  });
  function basename(path) { return String(path || '').split(/[\\/]/).pop() || 'arquivo'; }
  function extension(name) { const match = /\.([a-z0-9]+)$/i.exec(basename(name)); return match ? match[1].toLowerCase() : ''; }
  function mimeType(name, declared) { return declared || MIME[extension(name)] || 'application/octet-stream'; }
  function matchesAccept(file, accept) {
    if (!accept || !accept.trim()) return true;
    const name = String(file.name || '').toLowerCase();
    const type = mimeType(name, file.type).toLowerCase();
    return accept.split(',').some(raw => {
      const token = raw.trim().toLowerCase();
      if (!token) return false;
      if (token[0] === '.') return name.endsWith(token);
      if (token === '*/*') return true;
      if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
  }
  function toFileUrl(filename) {
    const path = String(filename || '').replace(/\\/g, '/');
    if (!path || path.startsWith('//') || (!path.startsWith('/') && !/^[a-z]:\//i.test(path))) {
      throw new Error('Caminho local não suportado');
    }
    return 'file:///' + path.replace(/^\/+/, '').split('/').map((part, i) => i === 0 && /^[a-z]:$/i.test(part) ? part : encodeURIComponent(part)).join('/');
  }
  function sizeLabel(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }
  function ignoredSite(hostname, sites) {
    const host = String(hostname || '').toLowerCase();
    return (sites || []).some(raw => {
      const site = String(raw || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      return site && (host === site || host.endsWith('.' + site));
    });
  }
  const api = {DEFAULTS, basename, extension, mimeType, matchesAccept, toFileUrl, sizeLabel, ignoredSite};
  root.CopiaColaUtils = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
