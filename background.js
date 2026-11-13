/* MV3 service worker: only accesses local downloads on the user's explicit selection. */
importScripts('shared.js');
const U = globalThis.CopiaColaUtils;

function safeDownload(item) {
  return item && item.state === 'complete' && item.filename && item.exists !== false &&
    (!item.danger || item.danger === 'safe' || item.danger === 'accepted');
}

async function listDownloads(accept = '') {
  const settings = {...U.DEFAULTS, ...await chrome.storage.local.get(U.DEFAULTS)};
  const recentCount = Math.max(1, Math.min(20, Number(settings.recentCount) || 8));
  const results = await chrome.downloads.search({state: 'complete', orderBy: ['-startTime'], limit: 80});
  const items = results.filter(safeDownload)
    .filter(item => U.matchesAccept({name: U.basename(item.filename), type: item.mime}, String(accept).slice(0, 512)))
    .slice(0, recentCount);
  const downloads = await Promise.all(items.map(async item => {
    let icon = null;
    try { icon = await chrome.downloads.getFileIcon(item.id, {size: 32}); } catch (_) { /* icon optional */ }
    return {
      id: item.id, name: U.basename(item.filename),
      mime: U.mimeType(item.filename, item.mime),
      size: Math.max(0, item.fileSize >= 0 ? item.fileSize : item.totalBytes),
      date: item.endTime || item.startTime || '', icon
    };
  }));
  return {downloads, fileAccess: await chrome.extension.isAllowedFileSchemeAccess()};
}

function bytesToBase64(bytes) {
  const chunkSize = 0x8000;
  let output = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(output);
}

async function readDownload(id, preview) {
  if (!Number.isSafeInteger(id) || id < 0) throw new Error('Download inválido');
  if (!await chrome.extension.isAllowedFileSchemeAccess()) {
    throw new Error('Ative "Permitir acesso a URLs de arquivo" nos detalhes da extensão para usar downloads recentes.');
  }
  const items = await chrome.downloads.search({id});
  const item = items[0];
  if (!safeDownload(item)) throw new Error('Arquivo indisponível ou removido');
  const config = {...U.DEFAULTS, ...await chrome.storage.local.get(U.DEFAULTS)};
  const maxBytes = preview ? 1048576 : Math.max(1, Math.min(40, Number(config.maxFileMB) || 12)) * 1048576;
  const reportedSize = item.fileSize >= 0 ? item.fileSize : item.totalBytes;
  if (reportedSize > maxBytes) throw new Error(preview ? 'Miniatura indisponível' : 'Arquivo acima do limite configurado; use "Escolher do computador".');
  const name = U.basename(item.filename);
  const mime = U.mimeType(name, item.mime);
  if (preview && !mime.startsWith('image/')) throw new Error('Sem miniatura');
  let response;
  try { response = await fetch(U.toFileUrl(item.filename)); } catch (_) { throw new Error('Não foi possível ler o arquivo local. Verifique o acesso a URLs de arquivo.'); }
  if (!response.ok) throw new Error('Não foi possível abrir o download');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error('Arquivo acima do limite permitido');
  return {name, mime, base64: bytesToBase64(bytes), size: bytes.byteLength};
}

let creatingOffscreen = null;
async function ensureClipboardDocument() {
  if (creatingOffscreen) return creatingOffscreen;
  creatingOffscreen = (async () => {
    const url = chrome.runtime.getURL('offscreen.html');
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url]
    });
    if (!contexts.length) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['CLIPBOARD'],
        justification: 'Ler imagem copiada somente quando o usuário abre o painel de anexos'
      });
    }
  })();
  try { await creatingOffscreen; } finally { creatingOffscreen = null; }
}

async function readClipboardImage() {
  await ensureClipboardDocument();
  const config = {...U.DEFAULTS, ...await chrome.storage.local.get(U.DEFAULTS)};
  const maxBytes = Math.max(1, Math.min(40, Number(config.maxFileMB) || 12)) * 1048576;
  const result = await chrome.runtime.sendMessage({type: 'CC_OFFSCREEN_READ', maxBytes});
  if (!result?.ok) return {hasImage: false};
  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (!message || !['CC_LIST', 'CC_READ', 'CC_PREVIEW', 'CC_OPTIONS', 'CC_DETAILS', 'CC_CLIPBOARD'].includes(message.type)) return false;
  (async () => {
    if (message.type === 'CC_LIST') return await listDownloads(message.accept);
    if (message.type === 'CC_CLIPBOARD') return await readClipboardImage();
    if (message.type === 'CC_OPTIONS') { await chrome.runtime.openOptionsPage(); return {}; }
    if (message.type === 'CC_DETAILS') { await chrome.tabs.create({url: `chrome://extensions/?id=${chrome.runtime.id}`}); return {}; }
    return await readDownload(message.id, message.type === 'CC_PREVIEW');
  })().then(data => respond({ok: true, ...data}), error => respond({ok: false, error: String(error.message || error)}));
  return true;
});
