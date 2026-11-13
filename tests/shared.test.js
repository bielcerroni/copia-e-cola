const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../shared.js');
test('extrai nome de arquivo Windows e Linux', () => {
  assert.equal(U.basename('C:\\Users\\Downloads\\arquivo.pdf'), 'arquivo.pdf');
  assert.equal(U.basename('/tmp/minha imagem.png'), 'minha imagem.png');
});
test('converte caminhos locais e codifica caracteres especiais', () => {
  assert.equal(U.toFileUrl('C:\\Users\\Meu Nome\\a #1.png'), 'file:///C:/Users/Meu%20Nome/a%20%231.png');
  assert.equal(U.toFileUrl('/home/usuário/a.pdf'), 'file:///home/usu%C3%A1rio/a.pdf');
  assert.throws(() => U.toFileUrl('relative/file.png'));
  assert.throws(() => U.toFileUrl('\\\\server\\share\\a.png'));
});
test('filtra extensão e tipo MIME do input accept', () => {
  assert.equal(U.matchesAccept({name:'relatorio.pdf'}, '.pdf,image/*'), true);
  assert.equal(U.matchesAccept({name:'foto.png'}, 'image/*'), true);
  assert.equal(U.matchesAccept({name:'relatorio.pdf'}, 'image/*'), false);
  assert.equal(U.matchesAccept({name:'abc.docx'}, '.pdf,.docx'), true);
  assert.equal(U.matchesAccept({name:'foto.png'}, ''), true);
  assert.equal(U.matchesAccept({name:'foo.png'}, 'image/jpeg'), false);
});
test('domínios excluídos respeitam limites de subdomínio', () => {
  assert.equal(U.ignoredSite('docs.exemplo.com', ['exemplo.com']), true);
  assert.equal(U.ignoredSite('exemplo.com', ['exemplo.com']), true);
  assert.equal(U.ignoredSite('outroexemplo.com', ['exemplo.com']), false);
});
