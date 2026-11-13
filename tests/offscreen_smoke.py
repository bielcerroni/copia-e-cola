"""Testa o fallback clipboard de um documento offscreen com APIs simuladas."""
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.set_content(open(os.path.join(ROOT, 'offscreen.html'), encoding='utf-8').read().replace('<script src="offscreen.js"></script>',''))
    page.evaluate('''() => {
      window.chrome={runtime:{onMessage:{addListener: fn => window.receiver=fn}}};
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read: async()=>{
        throw new Error('Document is not focused');
      }}});
      document.execCommand = command => {
        if(command !== 'paste') return false;
        const clipboardData=new DataTransfer();
        clipboardData.items.add(new File(['image-data'],'print.png',{type:'image/png'}));
        const e=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData});
        document.getElementById('paste-target').dispatchEvent(e);
        return true;
      };
    }''')
    page.add_script_tag(path=os.path.join(ROOT,'offscreen.js'))
    result = page.evaluate('''() => new Promise(resolve => {
      receiver({type:'CC_OFFSCREEN_READ',maxBytes:100000},null,resolve);
    })''')
    assert result['ok'] and result['hasImage'] and result['mime']=='image/png', result
    assert result['base64']=='aW1hZ2UtZGF0YQ==', result
    print('PASS: leitura pelo paste fallback após falha de clipboard.read no offscreen')
    assert not errors, errors
    browser.close()
