"""UI smoke test with Chrome APIs mocked (not an extension-installation E2E test)."""
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 900, 'height': 650})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(open(os.path.join(ROOT, 'tests', 'fixture.html')).read())
    page.evaluate('''() => {
      window.chrome = {
        storage: {local: {get: async defaults => defaults}, onChanged: {addListener() {}}},
        runtime: {sendMessage: async msg => msg.type === 'CC_LIST' ? {ok:true, downloads: [
          {id: 10, name: 'exemplo.png', mime: 'image/png', size: 20480, date: new Date().toISOString()},
          {id: 11, name: 'documento.pdf', mime: 'application/pdf', size: 102400, date: new Date().toISOString()}
        ], fileAccess: false} : {ok:true, name:'exemplo.png', mime:'image/png', base64:'YWJj'}}
      };
    }''')
    page.add_script_tag(path=os.path.join(ROOT,'shared.js'))
    page.add_script_tag(path=os.path.join(ROOT,'content.js'))
    page.locator('#upload').click(timeout=5000, no_wait_after=True)
    page.locator('#cc-extension-root').wait_for(state='attached', timeout=5000)
    print('PASS: painel aberto após clique em input[type=file]')
    page.screenshot(path='/mnt/data/copia-e-cola-smoke.png')
    page.mouse.click(175, 333)
    page.wait_for_timeout(100)
    assert page.locator('#state').text_content() == 'exemplo.png'
    print('PASS: seleção cria File, dispara change e anexa ao input')
    page.locator('#upload').click(timeout=5000, no_wait_after=True)
    page.locator('#cc-extension-root').wait_for(state='attached', timeout=5000)
    page.keyboard.press('Escape')
    assert page.locator('#cc-extension-root').count() == 0
    print('PASS: Escape fecha painel')
    print('JS errors:', errors)
    browser.close()
