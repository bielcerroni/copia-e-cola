"""UI smoke test with Chrome APIs mocked (not an extension-installation E2E test)."""
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 900, 'height': 650}, color_scheme='dark')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(open(os.path.join(ROOT, 'tests', 'fixture.html'), encoding='utf-8').read())
    page.evaluate('''() => {
      const original = HTMLElement.prototype.attachShadow;
      HTMLElement.prototype.attachShadow = function (config) {
        const shadow = original.call(this, config);
        if (this.id === 'cc-extension-root') window.__testRoot = shadow;
        return shadow;
      };
      window.chrome = {
        storage: {local: {get: async defaults => defaults}, onChanged: {addListener() {}}},
        runtime: {sendMessage: async msg => msg.type === 'CC_LIST' ? {ok:true, downloads: [
          {id: 10, name: 'exemplo.png', mime: 'image/png', size: 20480, date: new Date().toISOString()},
          {id: 11, name: 'documento.pdf', mime: 'application/pdf', size: 102400, date: new Date().toISOString()},
          ...Array.from({length: 8}, (_, i) => ({id: i + 12, name: `arquivo-${i + 1}.jpg`, mime: 'image/jpeg', size: 80912, date: new Date().toISOString()}))
        ], fileAccess: false} : {ok:true, name:'exemplo.png', mime:'image/png', base64:'YWJj'}}
      };
    }''')
    page.add_script_tag(path=os.path.join(ROOT, 'shared.js'))
    page.add_script_tag(path=os.path.join(ROOT, 'content.js'))
    page.locator('#upload').click(timeout=5000, no_wait_after=True)
    page.locator('#cc-extension-root').wait_for(state='attached', timeout=5000)
    page.wait_for_function('() => window.__testRoot?.querySelectorAll(".item").length === 10')
    print('PASS: painel aberto e listagem com 10 arquivos')
    page.screenshot(path='/mnt/data/copia-e-cola-dark-v0.1.1.png')
    geometry = page.evaluate('''() => {
      const root = window.__testRoot;
      const r = sel => root.querySelector(sel).getBoundingClientRect().toJSON();
      return {panel:r('.panel'), header:r('.head'), scroller:r('.scroller'), footer:r('.footer')};
    }''')
    assert geometry['panel']['height'] <= 620
    assert geometry['footer']['bottom'] <= geometry['panel']['bottom']
    assert geometry['scroller']['bottom'] <= geometry['footer']['top'] + 1
    print('PASS: rolagem isolada no corpo, com cabeçalho e rodapé fixos')
    page.evaluate('''() => {
      const input = window.__testRoot.querySelector('.searchInput');
      input.value = 'exemplo';
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }''')
    assert page.evaluate('() => window.__testRoot.querySelectorAll(".item").length') == 1
    page.evaluate('''() => {
      const input = window.__testRoot.querySelector('.searchInput');
      input.value = '';
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }''')
    assert page.evaluate('() => window.__testRoot.querySelectorAll(".item").length') == 10
    print('PASS: busca filtra e restaura downloads')
    page.evaluate('() => window.__testRoot.querySelector("[data-key=\\"download:10\\"]").click()')
    page.wait_for_timeout(100)
    assert page.locator('#state').text_content() == 'exemplo.png'
    print('PASS: seleção cria File, dispara change e anexa ao input')
    page.locator('#upload').click(timeout=5000, no_wait_after=True)
    page.locator('#cc-extension-root').wait_for(state='attached', timeout=5000)
    page.keyboard.press('Escape')
    assert page.locator('#cc-extension-root').count() == 0
    print('PASS: Escape fecha painel')
    assert not errors, errors
    print('PASS: nenhum erro JavaScript')
    browser.close()
