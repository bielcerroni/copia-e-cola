/* Non-invasive file input enhancement, isolated from the host page via Shadow DOM. */
(() => {
  'use strict';
  if (globalThis.__copiaColaReady) return;
  globalThis.__copiaColaReady = true;
  const U = globalThis.CopiaColaUtils;
  let prefs = {...U.DEFAULTS};
  let bypass = false;
  let host = null;
  let root = null;
  let activeInput = null;
  let clipFile = null;
  let clipPreviewUrl = null;
  let downloads = [];
  let selected = new Set();
  let fileAccess = false;
  let anchor = {x: 24, y: 80};
  let lastGesture = 0;
  let generation = 0;
  let busy = false;

  chrome.storage.local.get(U.DEFAULTS).then(data => {prefs = {...U.DEFAULTS, ...data};}).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, entry] of Object.entries(changes)) if (key in prefs) prefs[key] = entry.newValue;
  });

  const CSS = `
    :host { all: initial; font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif;
      color: #202638; --cc-bg: #fff; --cc-text: #202638; --cc-sub: #667187;
      --cc-border: #e5e8f0; --cc-hover: #f4f3ff; --cc-muted: #f7f8fb;
      --cc-accent: #675ce7; --cc-shadow: 0 18px 55px rgba(25,29,55,.22); }
    @media (prefers-color-scheme: dark) { :host { --cc-bg: #1f2430; --cc-text: #edf0f7;
      --cc-sub: #acb4c6; --cc-border: #373e50; --cc-hover: #2d2b4b;
      --cc-muted: #292f3d; --cc-shadow: 0 18px 55px rgba(0,0,0,.48); } }
    * { box-sizing: border-box; }
    .panel { position: fixed; width: min(390px, calc(100vw - 24px)); max-height: min(590px, calc(100vh - 24px));
      overflow-y: auto; overscroll-behavior: contain; border-radius: 17px; background: var(--cc-bg);
      color: var(--cc-text); border: 1px solid var(--cc-border); box-shadow: var(--cc-shadow);
      pointer-events: auto; font-size: 13px; line-height: 1.4; }
    .head { display: flex; align-items: center; gap: 11px; padding: 16px 17px 13px; }
    .logo { width: 35px; height: 35px; display: grid; place-items: center; color: #fff;
      background: linear-gradient(140deg, #756af4, #4e45c9); border-radius: 11px; font-size: 20px; font-weight: 800; }
    .name { font-size: 15px; font-weight: 750; letter-spacing: -.3px; }
    .subtitle { font-size: 11px; color: var(--cc-sub); margin-top: 2px; }
    button { font: inherit; cursor: pointer; color: inherit; }
    .close { margin-left: auto; width: 28px; height: 28px; border: none; background: transparent;
      color: var(--cc-sub); border-radius: 8px; font-size: 22px; line-height: 1; }
    .close:hover, .minor:hover { background: var(--cc-hover); }
    .body { padding: 0 14px; }
    .label { display: flex; align-items: center; justify-content: space-between; color: var(--cc-sub);
      font-weight: 650; font-size: 11px; text-transform: uppercase; letter-spacing: .65px; margin: 8px 4px 9px; }
    .section { margin-bottom: 14px; }
    .clipboard { width: 100%; display: flex; align-items: center; padding: 9px; gap: 11px;
      background: var(--cc-muted); border: 1px solid var(--cc-border); text-align: left;
      border-radius: 11px; min-height: 67px; }
    .clipboard:hover, .item:hover { background: var(--cc-hover); }
    .clipboard.selected, .item.selected { border-color: var(--cc-accent); background: var(--cc-hover); }
    .preview { width: 49px; height: 49px; object-fit: cover; flex-shrink: 0;
      border-radius: 8px; background: var(--cc-bg); border: 1px solid var(--cc-border); }
    .clipName { font-weight: 650; font-size: 13px; }
    .clipHint { color: var(--cc-sub); font-size: 11px; margin-top: 2px; }
    .empty { font-size: 12px; color: var(--cc-sub); background: var(--cc-muted);
      border-radius: 9px; padding: 12px; }
    .files { display: flex; flex-direction: column; gap: 5px; }
    .item { width: 100%; display: flex; align-items: center; gap: 11px; text-align: left;
      background: transparent; border: 1px solid transparent; border-radius: 10px; min-height: 52px; padding: 6px 8px; }
    .fileIcon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 9px;
      background: var(--cc-muted); flex-shrink: 0; font-size: 10px; color: var(--cc-accent); font-weight: 800; }
    .fileIcon img { width: 29px; height: 29px; object-fit: contain; }
    .fileTitle { font-size: 12px; font-weight: 650; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; max-width: 265px; }
    .fileMeta { font-size: 11px; color: var(--cc-sub); margin-top: 3px; }
    .fileText { flex: 1; min-width: 0; }
    .check { font-size: 17px; color: var(--cc-accent); margin-left: auto; }
    .notice { background: var(--cc-muted); border-radius: 9px; padding: 10px;
      margin: 0 0 12px; color: var(--cc-sub); font-size: 11px; line-height: 1.5; }
    .notice button { color: var(--cc-accent); padding: 0; border: none; background: transparent;
      font-weight: 700; text-decoration: underline; margin-top: 4px; }
    .error { color: #c63a49; font-size: 11px; margin: 0 0 9px; min-height: 0; }
    .footer { display: flex; padding: 12px 15px; border-top: 1px solid var(--cc-border); gap: 9px; align-items: center; }
    .primary { background: var(--cc-accent); border: 1px solid var(--cc-accent); border-radius: 9px;
      color: #fff; font-weight: 650; padding: 10px 12px; flex: 1; }
    .primary:disabled { opacity: .5; cursor: wait; }
    .minor { border: 1px solid var(--cc-border); border-radius: 9px; background: transparent; padding: 10px 12px; }
    .settings { margin-left: auto; border: 0; background: transparent; color: var(--cc-sub);
      padding: 6px 1px; text-decoration: underline; font-size: 11px; }
    .bottom { padding: 0 17px 11px; display: flex; justify-content: space-between;
      align-items: center; color: var(--cc-sub); font-size: 10px; }
    .spinner { opacity: .8; }
    button:focus-visible { outline: 2px solid var(--cc-accent); outline-offset: 2px; }
  `;

  const send = message => chrome.runtime.sendMessage(message);
  const el = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };

  function clearPreview() {
    if (clipPreviewUrl) URL.revokeObjectURL(clipPreviewUrl);
    clipPreviewUrl = null;
  }
  function close() {
    generation++;
    if (host) host.remove();
    host = root = activeInput = null;
    clearPreview();
    clipFile = null;
    downloads = [];
    selected.clear();
    busy = false;
  }
  function setError(message) {
    const error = root?.querySelector('.error');
    if (error) error.textContent = message || '';
  }
  function setBusy(value) {
    busy = value;
    if (!root) return;
    const buttons = root.querySelectorAll('button');
    for (const button of buttons) button.disabled = value;
    if (!value) updateAction();
  }
  function updateAction() {
    const action = root?.querySelector('.primary');
    if (!action) return;
    action.hidden = !activeInput?.multiple;
    if (activeInput?.multiple) {
      action.textContent = selected.size ? `Anexar ${selected.size} arquivo(s)` : 'Selecione arquivos';
      action.disabled = selected.size === 0 || busy;
    }
  }
  function chooseItem(key) {
    if (busy) return;
    if (activeInput?.multiple) {
      selected.has(key) ? selected.delete(key) : selected.add(key);
      paintSelections();
      updateAction();
    } else {
      selected.clear(); selected.add(key);
      attachSelection();
    }
  }
  function paintSelections() {
    root?.querySelectorAll('[data-key]').forEach(button => {
      const isSelected = selected.has(button.dataset.key);
      button.classList.toggle('selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
      const check = button.querySelector('.check');
      if (check) check.textContent = isSelected ? '✓' : '';
    });
  }
  function makeFile(bytes, name, type) {
    return new File([Uint8Array.from(atob(bytes), char => char.charCodeAt(0))], name, {type});
  }
  async function attachSelection() {
    if (busy || !activeInput?.isConnected || selected.size === 0) return;
    setBusy(true);
    setError('');
    try {
      const input = activeInput;
      const dt = new DataTransfer();
      for (const key of selected) {
        let file;
        if (key === 'clipboard') file = clipFile;
        else {
          const id = Number(key.slice('download:'.length));
          if (!downloads.some(item => item.id === id)) throw new Error('Download não está na lista');
          const result = await send({type: 'CC_READ', id});
          if (!result?.ok) throw new Error(result?.error || 'Erro ao carregar o arquivo');
          file = makeFile(result.base64, result.name, result.mime);
        }
        if (!file || !U.matchesAccept(file, input.accept)) throw new Error('Este campo não aceita o tipo do arquivo.');
        dt.items.add(file);
      }
      if (!input.multiple && dt.files.length > 1) throw new Error('Este campo aceita apenas um arquivo.');
      input.files = dt.files;
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
      close();
    } catch (error) {
      setError(error?.message || 'Não foi possível anexar. Use o seletor padrão.');
      setBusy(false);
    }
  }
  function sectionLabel(title, extra = '') {
    const label = el('div', 'label');
    label.append(el('span', '', title));
    if (extra) label.append(el('span', '', extra));
    return label;
  }
  function renderClipboard(message = '') {
    const section = root?.querySelector('#cc-clip');
    if (!section) return;
    section.replaceChildren(sectionLabel('Área de transferência'));
    if (!clipFile) {
      section.append(el('div', 'empty', message || 'Copie uma imagem ou pressione Ctrl+V com este painel aberto.'));
      return;
    }
    const button = el('button', 'clipboard');
    button.type = 'button'; button.dataset.key = 'clipboard';
    button.setAttribute('aria-pressed', 'false');
    const img = el('img', 'preview');
    img.alt = 'Imagem copiada';
    img.src = clipPreviewUrl;
    const text = el('div', 'fileText');
    text.append(el('div', 'clipName', 'Imagem copiada'), el('div', 'clipHint', `${U.sizeLabel(clipFile.size)} · Clique para anexar`));
    button.append(img, text, el('span', 'check'));
    button.addEventListener('click', () => chooseItem('clipboard'));
    section.append(button);
    paintSelections();
  }
  async function readClipboard(token) {
    if (!prefs.showClipboard) return;
    if (!navigator.clipboard?.read) {
      renderClipboard('Pressione Ctrl+V com o painel aberto para usar a imagem copiada.');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      if (token !== generation || !root) return;
      const item = items.find(clip => clip.types.some(type => type.startsWith('image/')));
      if (!item) { renderClipboard(); return; }
      const type = item.types.find(value => value.startsWith('image/'));
      const blob = await item.getType(type);
      if (token !== generation || !root) return;
      assignClipboardFile(new File([blob], `imagem-copiada-${Date.now()}.${type === 'image/jpeg' ? 'jpg' : type === 'image/svg+xml' ? 'svg' : type.split('/')[1]}`, {type}));
    } catch (_) {
      if (token === generation && root) renderClipboard('Acesso não disponível. Copie uma imagem e pressione Ctrl+V aqui.');
    }
  }
  function assignClipboardFile(file) {
    if (!root || !activeInput || !U.matchesAccept(file, activeInput.accept)) {
      if (root) renderClipboard('Este campo não aceita a imagem copiada.');
      return;
    }
    clearPreview();
    clipFile = file;
    clipPreviewUrl = URL.createObjectURL(file);
    renderClipboard();
  }
  function renderDownloads(message) {
    const section = root?.querySelector('#cc-files');
    if (!section) return;
    section.replaceChildren(sectionLabel('Downloads recentes', `${downloads.length} arquivos`));
    const list = el('div', 'files');
    if (!downloads.length) list.append(el('div', 'empty', message || 'Nenhum download compatível encontrado.'));
    for (const item of downloads) {
      const button = el('button', 'item'); button.type = 'button';
      button.dataset.key = `download:${item.id}`;
      button.title = item.name;
      button.setAttribute('aria-pressed', 'false');
      const icon = el('span', 'fileIcon');
      if (item.icon && item.icon.startsWith('data:')) {
        const img = el('img'); img.src = item.icon; img.alt = ''; icon.append(img);
      } else icon.textContent = (U.extension(item.name) || 'FILE').slice(0, 4).toUpperCase();
      const text = el('span', 'fileText');
      text.append(el('div', 'fileTitle', item.name), el('div', 'fileMeta', `${U.sizeLabel(item.size)} · ${item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'Recente'}`));
      button.append(icon, text, el('span', 'check'));
      button.addEventListener('click', () => chooseItem(button.dataset.key));
      list.append(button);
    }
    section.append(list);
    paintSelections();
  }
  async function loadPreviews(token) {
    for (const item of downloads.slice(0, 8)) {
      if (token !== generation || !root) return;
      if (!item.mime?.startsWith('image/') || item.size > 1048576) continue;
      try {
        const data = await send({type: 'CC_PREVIEW', id: item.id});
        if (token !== generation || !root || !data?.ok) continue;
        const element = [...root.querySelectorAll('.item')].find(node => node.dataset.key === `download:${item.id}`);
        const icon = element?.querySelector('.fileIcon');
        if (icon) {
          const img = el('img'); img.src = `data:${data.mime};base64,${data.base64}`; img.alt = '';
          img.style.cssText = 'width:38px;height:38px;object-fit:cover;border-radius:8px;';
          icon.replaceChildren(img);
        }
      } catch (_) { /* previews optional */ }
    }
  }
  async function loadDownloads(token) {
    try {
      const result = await send({type: 'CC_LIST', accept: activeInput?.accept || ''});
      if (token !== generation || !root) return;
      if (!result?.ok) throw new Error(result?.error || 'Falha ao listar downloads');
      fileAccess = Boolean(result.fileAccess);
      downloads = (result.downloads || []).filter(item => U.matchesAccept({name: item.name, type: item.mime}, activeInput?.accept || ''));
      renderDownloads();
      if (fileAccess) loadPreviews(token);
      const note = root.querySelector('#cc-access');
      if (!fileAccess && downloads.length && note) {
        const msg = el('div', 'notice', 'Para anexar downloads, ative “Permitir acesso a URLs de arquivo” nos detalhes da extensão. ');
        const btn = el('button', '', 'Abrir detalhes'); btn.type = 'button';
        btn.addEventListener('click', () => send({type: 'CC_DETAILS'}));
        msg.append(btn); note.replaceChildren(msg);
      }
    } catch (error) {
      if (token === generation && root) renderDownloads(error?.message || 'Não foi possível obter os downloads.');
    }
  }
  function openNativePicker() {
    const input = activeInput;
    close();
    if (!input?.isConnected) return;
    bypass = true;
    try { input.click(); } finally { bypass = false; }
  }
  function position(rect) {
    const panel = root.querySelector('.panel');
    const w = Math.min(390, window.innerWidth - 24);
    const h = Math.min(panel.scrollHeight, 590, window.innerHeight - 24);
    const x = rect?.width > 0 ? rect.left : anchor.x;
    const y = rect?.height > 0 ? rect.bottom + 8 : anchor.y + 9;
    const left = Math.max(12, Math.min(x, window.innerWidth - w - 12));
    const top = y + h + 10 < window.innerHeight ? y : Math.max(12, (rect?.top || anchor.y) - h - 8);
    panel.style.left = `${left}px`; panel.style.top = `${top}px`;
  }
  function open(input) {
    close();
    activeInput = input;
    selected = new Set();
    const token = generation;
    host = el('div'); host.id = 'cc-extension-root';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    (document.documentElement || document.body).append(host);
    root = host.attachShadow({mode: 'closed'});
    const style = el('style'); style.textContent = CSS;
    root.append(style);
    const panel = el('section', 'panel'); panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Copia & Cola, selecionar anexo');
    const head = el('div', 'head');
    const logo = el('span', 'logo', '↥');
    const brand = el('div'); brand.append(el('div', 'name', 'Copia & Cola'), el('div', 'subtitle', 'Anexe sem procurar em pastas'));
    const closeButton = el('button', 'close', '×'); closeButton.type = 'button'; closeButton.setAttribute('aria-label', 'Fechar');
    closeButton.addEventListener('click', close);
    head.append(logo, brand, closeButton);
    const body = el('div', 'body');
    if (prefs.showClipboard) { const section = el('section', 'section'); section.id = 'cc-clip'; body.append(section); }
    const files = el('section', 'section'); files.id = 'cc-files'; body.append(files);
    const access = el('div'); access.id = 'cc-access'; body.append(access);
    const error = el('div', 'error'); error.setAttribute('role', 'status'); body.append(error);
    const footer = el('div', 'footer');
    const native = el('button', 'minor', 'Escolher do computador'); native.type = 'button';
    native.addEventListener('click', openNativePicker);
    const action = el('button', 'primary'); action.type = 'button';
    action.addEventListener('click', attachSelection);
    footer.append(native, action);
    const bottom = el('div', 'bottom');
    bottom.append(el('span', '', 'Esc para fechar'));
    const settings = el('button', 'settings', 'Preferências'); settings.type = 'button';
    settings.addEventListener('click', () => send({type: 'CC_OPTIONS'})); bottom.append(settings);
    panel.append(head, body, footer, bottom); root.append(panel);
    if (prefs.showClipboard) renderClipboard('Lendo área de transferência…');
    renderDownloads('Carregando downloads…');
    updateAction();
    position(input.getBoundingClientRect());
    if (prefs.showClipboard) readClipboard(token); // starts during the click user gesture
    loadDownloads(token);
    requestAnimationFrame(() => { if (token === generation && root) position(input.getBoundingClientRect()); });
  }

  document.addEventListener('pointerdown', event => {
    if (event.isTrusted) {lastGesture = Date.now(); anchor = {x: event.clientX, y: event.clientY};}
    if (host && !host.contains(event.target)) close();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.isTrusted) lastGesture = Date.now();
    if (host && event.key === 'Escape') {event.preventDefault(); close();}
  }, true);
  document.addEventListener('paste', event => {
    if (!root || !prefs.showClipboard || !event.clipboardData) return;
    const clipboard = [...event.clipboardData.items].find(item => item.kind === 'file' && item.type.startsWith('image/'));
    const file = clipboard?.getAsFile();
    if (!file) return;
    event.preventDefault(); event.stopImmediatePropagation();
    assignClipboardFile(new File([file], `imagem-copiada-${Date.now()}.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'}`, {type: file.type}));
  }, true);
  document.addEventListener('click', event => {
    if (bypass || event.defaultPrevented || U.ignoredSite(location.hostname, prefs.excludedSites)) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'file' || target.disabled) return;
    // Intercept a genuine click, or a page-triggered input.click() following a user gesture.
    if (!event.isTrusted && Date.now() - lastGesture > 2000) return;
    event.preventDefault(); event.stopImmediatePropagation();
    try {open(target);} catch (_) {openNativePicker();}
  }, true);
})();
