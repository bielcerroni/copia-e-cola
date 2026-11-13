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
  let filterText = '';
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
    :host {
      all: initial;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      color-scheme: light;
      --cc-bg: #fbfcff; --cc-surface: #ffffff; --cc-raised: #f5f7fc;
      --cc-text: #20243a; --cc-sub: #6f7990; --cc-faint: #98a1b4;
      --cc-border: #e5e8f1; --cc-accent: #6d5bea; --cc-accent-text: #6351dc;
      --cc-accent-soft: #f1edff; --cc-head: #f8f7ff; --cc-scroll: #c9cfdd;
      --cc-shadow: 0 28px 76px rgba(25, 32, 68, .22), 0 7px 20px rgba(25, 32, 68, .12);
    }
    @media (prefers-color-scheme: dark) {
      :host {
        color-scheme: dark;
        --cc-bg: #151b29; --cc-surface: #1d2535; --cc-raised: #242d3f;
        --cc-text: #f3f5fd; --cc-sub: #a7b3ca; --cc-faint: #7e8ca6;
        --cc-border: #313a4f; --cc-accent: #9483ff; --cc-accent-text: #b3a5ff;
        --cc-accent-soft: #292643; --cc-head: #1e2034; --cc-scroll: #515e76;
        --cc-shadow: 0 30px 80px rgba(0, 0, 0, .52), 0 8px 20px rgba(0, 0, 0, .28);
      }
    }
    * { box-sizing: border-box; }
    .panel {
      position: fixed; display: flex; flex-direction: column; overflow: hidden;
      width: min(414px, calc(100vw - 24px)); max-height: min(620px, calc(100vh - 24px));
      border: 1px solid var(--cc-border); border-radius: 21px;
      background: var(--cc-bg); color: var(--cc-text); box-shadow: var(--cc-shadow);
      pointer-events: auto; font-size: 13px; line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }
    button, input { font: inherit; }
    button { color: inherit; cursor: pointer; }
    button:focus-visible, input:focus-visible {
      outline: 2px solid var(--cc-accent); outline-offset: 2px;
    }
    .head {
      display: flex; align-items: center; gap: 13px; flex: none;
      padding: 19px 19px 17px;
      border-bottom: 1px solid var(--cc-border);
      background: radial-gradient(ellipse at 3% 0%, var(--cc-accent-soft), transparent 60%), var(--cc-head);
    }
    .logo {
      display: grid; place-items: center; flex: none; width: 44px; height: 44px;
      border-radius: 14px; color: white;
      background: linear-gradient(145deg, #8d7dff 0%, #6450dd 82%);
      border: 1px solid rgba(255,255,255,.2);
      box-shadow: 0 5px 16px rgba(109, 91, 234, .27);
    }
    .brand { min-width: 0; flex: 1; }
    .name { font-weight: 760; font-size: 16px; letter-spacing: -.45px; line-height: 1.2; }
    .subtitle { font-size: 11px; color: var(--cc-sub); margin-top: 5px; }
    .close {
      display: grid; place-items: center; margin-left: auto; flex: none;
      width: 31px; height: 31px; border: 1px solid transparent;
      background: transparent; border-radius: 10px; color: var(--cc-sub);
      transition: background .15s, color .15s;
    }
    .close:hover { background: var(--cc-raised); color: var(--cc-text); }
    .scroller { overflow-y: auto; min-height: 0; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--cc-scroll) transparent; }
    .scroller::-webkit-scrollbar { width: 7px; }
    .scroller::-webkit-scrollbar-track { background: transparent; }
    .scroller::-webkit-scrollbar-thumb { background: var(--cc-scroll); border: 2px solid var(--cc-bg); border-radius: 8px; }
    .body { padding: 18px 17px 14px; }
    .section { margin-bottom: 19px; }
    .section:last-child { margin-bottom: 6px; }
    .label {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin: 0 2px 11px; color: var(--cc-sub);
      font-size: 10px; font-weight: 780; letter-spacing: .9px; text-transform: uppercase;
    }
    .labelTitle { display: flex; align-items: center; gap: 7px; }
    .labelTitle svg { color: var(--cc-accent-text); }
    .labelCount {
      color: var(--cc-accent-text); background: var(--cc-accent-soft);
      border-radius: 20px; padding: 4px 8px;
      font-size: 10px; font-weight: 720; letter-spacing: .2px; text-transform: none;
    }
    .clipboard {
      display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
      padding: 11px; min-height: 83px; border-radius: 15px;
      background: linear-gradient(115deg, var(--cc-accent-soft), var(--cc-surface) 85%);
      border: 1px solid var(--cc-border);
      transition: border-color .17s, transform .17s, background .17s;
    }
    .clipboard:hover { border-color: var(--cc-accent); transform: translateY(-1px); }
    .preview {
      flex: none; width: 57px; height: 57px; object-fit: cover;
      border-radius: 11px; background: var(--cc-raised); border: 1px solid var(--cc-border);
    }
    .clipEyebrow {
      color: var(--cc-accent-text); font-size: 9px; font-weight: 780;
      letter-spacing: .55px; text-transform: uppercase; margin-bottom: 5px;
    }
    .clipName { font-size: 13px; font-weight: 740; line-height: 1.2; }
    .clipHint { color: var(--cc-sub); font-size: 11px; margin-top: 5px; }
    .clipArrow { display: grid; place-items: center; flex: none; width: 29px; height: 29px;
      border-radius: 9px; color: var(--cc-accent-text); background: var(--cc-accent-soft); }
    .empty {
      padding: 14px; color: var(--cc-sub); font-size: 12px; line-height: 1.55;
      border: 1px dashed var(--cc-border); border-radius: 12px; background: var(--cc-raised);
    }
    .search {
      display: flex; align-items: center; gap: 9px; width: 100%; height: 38px;
      padding: 0 12px; margin: 0 0 10px; border-radius: 11px;
      background: var(--cc-surface); border: 1px solid var(--cc-border);
      color: var(--cc-faint); transition: border-color .15s, box-shadow .15s;
    }
    .search:focus-within { border-color: var(--cc-accent); box-shadow: 0 0 0 3px var(--cc-accent-soft); }
    .search input {
      outline: 0; border: 0; min-width: 0; width: 100%; padding: 0;
      background: transparent; color: var(--cc-text); font-size: 12px;
    }
    .search input:focus-visible { outline: 0; }
    .search input::placeholder { color: var(--cc-faint); }
    .search input::-webkit-search-cancel-button { cursor: pointer; }
    .files { display: flex; flex-direction: column; gap: 6px; }
    .item {
      position: relative; display: flex; align-items: center; gap: 11px;
      width: 100%; min-height: 64px; padding: 9px 10px;
      border-radius: 12px; border: 1px solid transparent;
      background: transparent; text-align: left;
      transition: background .16s, border-color .16s;
    }
    .item:hover { background: var(--cc-surface); border-color: var(--cc-border); }
    .item.selected, .clipboard.selected {
      border-color: var(--cc-accent); background: var(--cc-accent-soft);
    }
    .fileIcon {
      display: grid; place-items: center; flex: none;
      width: 46px; height: 46px; border-radius: 11px;
      background: var(--cc-raised); color: var(--cc-accent-text);
      font-size: 10px; font-weight: 800; border: 1px solid var(--cc-border);
      overflow: hidden;
    }
    .fileIcon img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .fileText { flex: 1; min-width: 0; }
    .fileTitle {
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
      font-weight: 670; font-size: 12px; line-height: 1.4;
    }
    .fileMeta { color: var(--cc-sub); font-size: 10.5px; margin-top: 5px; }
    .fileTag {
      flex: none; border: 1px solid var(--cc-border);
      color: var(--cc-sub); border-radius: 6px; padding: 3px 5px;
      font-size: 9px; font-weight: 760; letter-spacing: .45px;
      background: var(--cc-raised);
    }
    .check { display: grid; place-items: center; flex: none; color: var(--cc-accent-text);
      font-size: 16px; font-weight: 800; }
    .check:empty { display: none; }
    .notice {
      border: 1px solid var(--cc-border); border-radius: 11px;
      background: var(--cc-raised); padding: 11px 12px;
      margin: 0 0 10px; color: var(--cc-sub); font-size: 11px; line-height: 1.6;
    }
    .notice button { color: var(--cc-accent-text); border: 0; padding: 0; margin: 4px 0 0;
      background: transparent; font-weight: 750; text-decoration: underline; }
    .error { color: #e86976; font-size: 11px; margin: 0 0 8px; }
    .error:empty { display: none; }
    .footer {
      display: flex; flex: none; align-items: center; gap: 9px;
      padding: 13px 17px 4px; border-top: 1px solid var(--cc-border);
      background: var(--cc-bg);
    }
    .minor, .primary {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      border-radius: 11px; padding: 11px 12px; min-height: 42px;
      font-size: 12px; font-weight: 760; transition: filter .15s, background .15s;
    }
    .minor { flex: 1; background: var(--cc-surface); border: 1px solid var(--cc-border); }
    .minor:hover { background: var(--cc-raised); }
    .primary { flex: 1; color: white; border: 1px solid #6754e5; background: linear-gradient(135deg,#8774ff,#6751df); }
    .primary:hover { filter: brightness(1.08); }
    .primary:disabled { opacity: .5; cursor: not-allowed; }
    .primary[hidden] { display: none; }
    .bottom {
      display: flex; align-items: center; justify-content: space-between;
      flex: none; padding: 4px 19px 12px; color: var(--cc-faint);
      background: var(--cc-bg); font-size: 10px;
    }
    .settings { display: inline-flex; align-items: center; gap: 5px;
      background: transparent; border: 0; padding: 5px 0; color: var(--cc-sub);
      font-size: 10px; font-weight: 650; }
    .settings:hover { color: var(--cc-accent-text); }
    @media (max-width: 370px) {
      .head { padding: 14px; }
      .body { padding: 14px 12px 9px; }
      .footer { padding-left: 12px; padding-right: 12px; }
      .fileTag { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .clipboard, .item, .search, .minor, .primary, .close { transition: none; }
    }
  `;

  const svgIcon = (name, size = 18) => {
    const paths = {
      upload: 'M12 16V3m0 0L7 8m5-5 5 5M4 17v3h16v-3',
      close: 'M18 6 6 18M6 6l12 12',
      clipboard: 'M9 4h6m-8 3H5v14h14V7h-2M9 3h6v4H9z',
      download: 'M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3',
      search: 'M21 21l-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
      folder: 'M3 6h7l2 2h9v11H3z',
      settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.3 12a7 7 0 0 0-.1-1l2-1.6-2-3.5-2.4 1a8 8 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 2.6h4l.4-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.6a7 7 0 0 0 .1-1Z',
      arrow: 'M5 12h14m-5-5 5 5-5 5'
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', paths[name] || paths.upload);
    svg.append(path);
    return svg;
  };

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
    filterText = '';
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
  function sectionLabel(title, extra = '', glyph = '') {
    const label = el('div', 'label');
    const titleNode = el('span', 'labelTitle');
    if (glyph) titleNode.append(svgIcon(glyph, 14));
    titleNode.append(el('span', '', title));
    label.append(titleNode);
    if (extra) label.append(el('span', 'labelCount', extra));
    return label;
  }
  function renderClipboard(message = '') {
    const section = root?.querySelector('#cc-clip');
    if (!section) return;
    section.replaceChildren(sectionLabel('Área de transferência', '', 'clipboard'));
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
    text.append(el('div', 'clipEyebrow', 'Disponível agora'), el('div', 'clipName', 'Imagem copiada'), el('div', 'clipHint', `${U.sizeLabel(clipFile.size)} · Clique para anexar`));
    const arrow = el('span', 'clipArrow'); arrow.append(svgIcon('arrow', 16));
    button.append(img, text, arrow, el('span', 'check'));
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
  function drawDownloadItems(list, message = '') {
    list.replaceChildren();
    const visible = downloads.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(filterText.toLocaleLowerCase('pt-BR')));
    if (!visible.length) {
      list.append(el('div', 'empty', filterText ? 'Nenhum arquivo corresponde à busca.' : (message || 'Nenhum download compatível encontrado.')));
      return;
    }
    for (const item of visible) {
      const button = el('button', 'item'); button.type = 'button';
      button.dataset.key = `download:${item.id}`;
      button.setAttribute('aria-label', item.name);
      button.setAttribute('aria-pressed', 'false');
      const fileIcon = el('span', 'fileIcon');
      if (item.previewUrl || (item.icon && item.icon.startsWith('data:'))) {
        const img = el('img'); img.src = item.previewUrl || item.icon; img.alt = ''; fileIcon.append(img);
      } else fileIcon.textContent = (U.extension(item.name) || 'FILE').slice(0, 4).toUpperCase();
      const fileText = el('span', 'fileText');
      fileText.append(el('div', 'fileTitle', item.name),
        el('div', 'fileMeta', `${U.sizeLabel(item.size)} · ${item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'Recente'}`));
      const tag = el('span', 'fileTag', (U.extension(item.name) || 'FILE').slice(0, 5).toUpperCase());
      button.append(fileIcon, fileText, tag, el('span', 'check'));
      button.addEventListener('click', () => chooseItem(button.dataset.key));
      list.append(button);
    }
    paintSelections();
  }
  function renderDownloads(message = '') {
    const section = root?.querySelector('#cc-files');
    if (!section) return;
    section.replaceChildren(sectionLabel('Downloads recentes', `${downloads.length} arquivos`, 'download'));
    if (downloads.length > 0) {
      const search = el('label', 'search');
      search.append(svgIcon('search', 16));
      const input = el('input', 'searchInput');
      input.type = 'search'; input.placeholder = 'Buscar arquivo pelo nome...';
      input.setAttribute('aria-label', 'Buscar downloads recentes');
      input.value = filterText;
      search.append(input);
      section.append(search);
      const list = el('div', 'files'); section.append(list);
      input.addEventListener('input', () => {filterText = input.value; drawDownloadItems(list);});
      drawDownloadItems(list, message);
      return;
    }
    const list = el('div', 'files');
    section.append(list);
    drawDownloadItems(list, message);
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
          item.previewUrl = img.src;
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
    const w = Math.min(414, window.innerWidth - 24);
    const h = Math.min(panel.getBoundingClientRect().height, 620, window.innerHeight - 24);
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
    const logo = el('span', 'logo'); logo.append(svgIcon('upload', 22));
    const brand = el('div', 'brand'); brand.append(el('div', 'name', 'Copia & Cola'), el('div', 'subtitle', 'Anexe arquivos sem sair da página'));
    const closeButton = el('button', 'close'); closeButton.append(svgIcon('close', 18)); closeButton.type = 'button'; closeButton.setAttribute('aria-label', 'Fechar');
    closeButton.addEventListener('click', close);
    head.append(logo, brand, closeButton);
    const scroller = el('div', 'scroller');
    const body = el('div', 'body');
    if (prefs.showClipboard) { const section = el('section', 'section'); section.id = 'cc-clip'; body.append(section); }
    const files = el('section', 'section'); files.id = 'cc-files'; body.append(files);
    const access = el('div'); access.id = 'cc-access'; body.append(access);
    const error = el('div', 'error'); error.setAttribute('role', 'status'); body.append(error);
    const footer = el('div', 'footer');
    const native = el('button', 'minor'); native.append(svgIcon('folder', 17), el('span', '', 'Escolher do computador')); native.type = 'button';
    native.addEventListener('click', openNativePicker);
    const action = el('button', 'primary'); action.type = 'button';
    action.addEventListener('click', attachSelection);
    footer.append(native, action);
    const bottom = el('div', 'bottom');
    bottom.append(el('span', '', 'Esc para fechar'));
    const settings = el('button', 'settings'); settings.append(svgIcon('settings', 13), el('span', '', 'Preferências')); settings.type = 'button';
    settings.addEventListener('click', () => send({type: 'CC_OPTIONS'})); bottom.append(settings);
    scroller.append(body);
    panel.append(head, scroller, footer, bottom); root.append(panel);
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
