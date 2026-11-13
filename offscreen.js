/* Documento de extensão, sem acesso à página e sem monitoramento contínuo. */
'use strict';

const mimeExtensions = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/bmp': 'bmp', 'image/avif': 'avif'
};

function pasteLegacyImage() {
  const target = document.getElementById('paste-target');
  let blob = null;
  const handlePaste = event => {
    const item = [...(event.clipboardData?.items || [])]
      .find(entry => entry.kind === 'file' && entry.type.startsWith('image/'));
    blob = item?.getAsFile() || null;
    event.preventDefault();
  };
  target.addEventListener('paste', handlePaste);
  try {
    target.focus();
    document.execCommand('paste'); // Chrome permite no contexto de extensão com clipboardRead.
  } catch (_) { /* O caminho normal pode ter falhado; fallback será Ctrl+V. */ }
  finally {
    target.removeEventListener('paste', handlePaste);
    target.replaceChildren();
  }
  return blob;
}

async function findImage() {
  // Quando não há foco no documento offscreen, read() pode falhar.
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find(value => value.startsWith('image/'));
      if (type) return await item.getType(type);
    }
  } catch (_) { /* Tenta o método de colagem permitido à extensão. */ }
  return pasteLegacyImage();
}

async function readImage(maxBytes) {
  const image = await findImage();
  if (!image || !image.type.startsWith('image/') || image.size > maxBytes) {
    return {ok: true, hasImage: false};
  }
  const ext = mimeExtensions[image.type] || image.type.split('/')[1].replace(/[^a-z0-9]/g, '') || 'png';
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem copiada'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(image);
  });
  return {ok: true, hasImage: true, name: `imagem-copiada-${Date.now()}.${ext}`,
    mime: image.type, base64};
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== 'CC_OFFSCREEN_READ') return false;
  const maxBytes = Math.max(1, Math.min(40 * 1048576, Number(message.maxBytes) || 12 * 1048576));
  readImage(maxBytes).then(respond, () => respond({ok: true, hasImage: false}));
  return true;
});
