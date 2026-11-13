"""Regression: clipboard policy, WhatsApp native paste and Neblina coexistence."""
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 950, 'height': 730}, color_scheme='dark')
    page_errors = []
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    page.set_content('''<!doctype html><html data-nb-active="true" data-nb-messages="true"><head>
      <style>html[data-nb-active="true"] #app { filter: blur(9px) !important; }</style>
      </head><body><div id="app"><div id="main"><footer>
      <div id="whatsapp-editor" contenteditable="true" role="textbox">Olá</div>
      <input id="whatsapp-attach" type="file" accept="image/*"></footer></div></div>
      <div id="state"></div></body></html>''')
    page.evaluate('''() => {
      const original = HTMLElement.prototype.attachShadow;
      HTMLElement.prototype.attachShadow = function (config) {
        const shadow = original.call(this, config);
        if (this.id === 'cc-extension-root') window.__testRoot = shadow;
        return shadow;
      };
      let tries=0;
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
        read: async () => { tries++; throw new Error('Não deveria ler no contexto WhatsApp!'); }
      }});
      window.readTries=()=>tries;
      window.chrome={storage:{local:{get: async x=>x},onChanged:{addListener(){}}},
        runtime:{sendMessage: async msg=>{
          if(msg.type==='CC_CLIPBOARD') return {ok:true,hasImage:true,name:'print.png',mime:'image/png',base64:'iVBORw0KGgo='};
          if(msg.type==='CC_LIST') return {ok:true,fileAccess:false,downloads:[]};
          return {ok:true};
        }}
      };
      document.getElementById('whatsapp-attach').addEventListener('change',e=>{
        document.getElementById('state').textContent=e.target.files[0]?.name||'';
      });
    }''')
    page.add_script_tag(path=os.path.join(ROOT,'shared.js'))
    page.add_script_tag(path=os.path.join(ROOT,'content.js'))
    page.locator('#whatsapp-attach').click(timeout=4000, no_wait_after=True)
    page.wait_for_function('() => window.__testRoot?.querySelector(".clipboard")?.dataset.key === "clipboard"')
    assert page.evaluate('() => readTries()') == 0
    assert page.evaluate('() => !!window.__testRoot.querySelector(".preview")')
    assert page.evaluate('() => window.__testRoot.querySelector(".panel").getBoundingClientRect().width > 0')
    assert page.evaluate('() => getComputedStyle(window.__testRoot.querySelector(".panel")).filter') == 'none'
    print('PASS: clipboard via service worker, sem chamada à Clipboard API bloqueada pelo WhatsApp')
    print('PASS: painel mantém estilo isolado sob máscara Neblina em #app')

    # Clipboard paste in the WhatsApp composer must not be captured by the extension.
    untouched = page.evaluate('''() => {
      const target = document.getElementById('whatsapp-editor');
      const dt=new DataTransfer(); dt.items.add(new File(['abc'],'foto.png',{type:'image/png'}));
      let recorded=false;
      target.addEventListener('paste',()=>{recorded=true;},{once:true});
      const event = new ClipboardEvent('paste',{bubbles:true,cancelable:true,composed:true,clipboardData:dt});
      const result=target.dispatchEvent(event);
      return {recorded,prevented:event.defaultPrevented,result};
    }''')
    assert untouched == {'recorded': True, 'prevented': False, 'result': True}, untouched
    print('PASS: Ctrl+V do WhatsApp não é interceptado')

    page.evaluate('() => window.__testRoot.querySelector(".clipboard").click()')
    page.wait_for_function('() => document.getElementById("state").textContent === "print.png"')
    print('PASS: arquivo copiado anexado ao campo do WhatsApp')

    # Explicit paste inside Copia & Cola panel should still work.
    page.locator('#whatsapp-attach').click(timeout=4000, no_wait_after=True)
    page.wait_for_function('() => !!window.__testRoot?.querySelector(".panel")')
    result = page.evaluate('''() => {
      const dt=new DataTransfer(); dt.items.add(new File(['xyz'],'foto2.png',{type:'image/png'}));
      const event=new ClipboardEvent('paste',{bubbles:true,cancelable:true,composed:true,clipboardData:dt});
      window.__testRoot.querySelector('.panel').dispatchEvent(event);
      return {prevented:event.defaultPrevented, exists:!!window.__testRoot.querySelector('.clipboard')};
    }''')
    assert result['prevented'] and result['exists'], result
    print('PASS: Ctrl+V dentro do painel atualiza imagem copiada')

    page.keyboard.press('Escape')
    page.evaluate('''() => {
      const overlay=document.createElement('div'); overlay.id='nb-privacy-shield'; document.body.append(overlay);
      document.documentElement.dataset.nbShield='true';
    }''')
    page.locator('#whatsapp-attach').click(timeout=4000, no_wait_after=True)
    assert page.locator('#cc-extension-root').count()==0
    print('PASS: Copia & Cola respeita escudo de privacidade ativo')
    assert not page_errors, page_errors
    browser.close()
