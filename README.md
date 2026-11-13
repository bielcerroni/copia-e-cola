# Copia & Cola — extensão de anexos rápidos para Chrome

Extensão **Manifest V3** para anexar rapidamente imagens da área de transferência e arquivos recém-baixados. O comportamento foi inspirado no recurso *Easy Files* do Opera; este projeto é independente e não é afiliado ao Opera.

## Funcionalidades (v0.1.2)

- Painel flutuante ao clicar em um `input[type=file]` em páginas HTTP/HTTPS.
- Imagens copiadas para a área de transferência (com alternativa **Ctrl+V**).
- Downloads recentes do Chrome, com filtro pelo atributo `accept` do campo e miniaturas para imagens pequenas quando houver permissão de arquivo.
- Upload de um ou vários arquivos, conforme o atributo `multiple` do campo.
- Seletor nativo sempre disponível.
- Tema claro/escuro automático, painel com cabeçalho e rodapé fixos, rolagem interna, miniaturas, cartões e campo de busca local nos downloads; visual isolado em Shadow DOM.
- Preferências: quantidade de downloads, limite de tamanho, ativar/desativar clipboard e domínios ignorados.
- Sem backend, telemetria ou envio de arquivos à extensão via rede. Os arquivos escolhidos são entregues ao campo da página selecionada.

## Instalação local

1. Baixe/extraia os arquivos desta pasta.
2. Abra **`chrome://extensions`**.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
5. Abra uma página com um botão de envio de arquivo e clique nele.
6. Para anexar arquivos **baixados**, abra os detalhes da extensão e ative **Permitir acesso a URLs de arquivo**. Esta permissão é opcional para usar a área de transferência, mas necessária para ler os downloads locais.

> A leitura automática depende das capacidades reais do Chrome: em alguns sistemas, `navigator.clipboard.read()` pode falhar por falta de foco até no documento offscreen. Nesses casos tentamos a colagem clássica (`execCommand("paste")`) e, se necessário, use **Ctrl+V com o painel selecionado**.

> A permissão **downloads** lista somente o histórico de downloads do Chrome, não todos os arquivos do sistema. O acesso ao conteúdo local exige a opção citada acima. A permissão **clipboardRead** permite tentar ler imagens copiadas quando o usuário abre o painel; se a leitura for bloqueada, é possível usar Ctrl+V.

## Como funciona

Ao clicar no campo de upload, o `content.js` bloqueia temporariamente o seletor nativo e exibe as opções. Ao escolher um arquivo, a extensão cria objetos `File`, monta um `DataTransfer`, atribui `input.files` e dispara eventos `input` e `change`. Downloads são consultados pelo service worker (`background.js`) e só têm o conteúdo lido quando selecionados, exceto miniaturas de imagens pequenas mostradas no painel.

## Privacidade e permissões

- `downloads`: acessar nomes e metadados de downloads recentes.
- `clipboardRead`: tentar ler imagens copiadas **ao abrir o painel**.
- `offscreen`: permite executar a leitura no contexto da extensão, sem depender da Permissions Policy do WhatsApp Web.
- `storage`: armazenar somente preferências locais.
- `file:///*`: ler um download selecionado, condicionado ao consentimento em `chrome://extensions`.
- Injeção em páginas HTTP/HTTPS para identificar e complementar campos de upload; sites listados nas preferências ficam de fora.

Nenhum conteúdo de arquivo ou clipboard é armazenado persistentemente pela extensão. **O site de destino recebe os arquivos quando você opta por anexá-los**, como em um upload normal.

## Atualização 0.1.1

- Redesenho visual do painel de upload e das preferências, sem alterar o mecanismo de anexação.
- Busca por nome nos downloads recentes; seleção e pré-visualização preservadas.
- Rolagem apenas na lista: cabeçalho e botão de seleção de arquivos ficam sempre visíveis.
- Correção do botão de anexar múltiplos arquivos oculto em uploads simples.

## Atualização 0.1.2

- Leitura da área de transferência movida para um documento offscreen de extensão (permissão `offscreen`), sem chamar `navigator.clipboard.read()` no WhatsApp Web. O Chrome pode restringir a leitura automática mesmo assim; o painel continua oferecendo Ctrl+V como alternativa.
- `Ctrl+V` passa a ser capturado **somente se o foco estiver no painel do Copia & Cola**, preservando a colagem normal na conversa do WhatsApp e a extensão Neblina.
- A janela não se sobrepõe ao escudo de privacidade ativo do Neblina. Não remove nem desativa regras de privacidade.
- Eventos de clique cancelam apenas o seletor padrão de arquivos, sem `stopImmediatePropagation` que silenciava outros listeners.
- Ao abrir o painel, ele recebe foco para possibilitar a colagem manual.
- A imagem copiada é lida apenas a pedido (quando o painel é aberto); nenhum histórico é guardado.

## Limitações atuais

- Intercepta campos HTML `input[type=file]` e acionamentos de tais campos, mas controles que usam APIs próprias de upload/drag-and-drop podem exigir adaptadores específicos.
- Não tem acesso nativo a todos os arquivos recentes do Windows/macOS/Linux nem ao histórico de arquivos usados em outros aplicativos.
- Downloads maiores que o limite configurado devem ser escolhidos pelo seletor padrão; o limite evita mensagens muito grandes entre os processos do Chrome.
- Extensões não podem atuar em páginas protegidas como `chrome://` e Chrome Web Store.
- Não garante compatibilidade com todos os frameworks de upload sem homologação em sites reais.

## Testes

- `node --test tests/shared.test.js` — filtros, MIME e caminhos locais.
- `python tests/browser_smoke.py` — teste de interface com Playwright (Python) e APIs do Chrome simuladas. Requer Chromium e `playwright`. Não substitui teste com extensão realmente instalada.

## Organização

- `manifest.json` — permissões e scripts da extensão.
- `content.js` — painel e integração com inputs.
- `background.js` — downloads e encaminhamento da leitura de clipboard.
- `offscreen.html` / `offscreen.js` — leitura sob demanda da imagem copiada, isolada do WhatsApp.
- `shared.js` — utilitários puros.
- `options.html` / `options.js` — tela de preferências.
- `tests/` — testes automatizados e página de teste.

## Próximos incrementos

Testes com Gmail, WhatsApp Web e GitHub; suporte explícito a áreas de drop; atalhos de teclado; histórico opcional de arquivos escolhidos pelo usuário; revisão de acessibilidade e publicação na Chrome Web Store.
