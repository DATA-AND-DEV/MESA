// A metade de janela da MESA na API 6, no laboratório gerado do contrato
// (`test/laboratorio.cjs`), com a metade de servidor de verdade por baixo.
//
// Cada teste nasceu falhando contra o cliente da API 4, ou é o guarda de um
// defeito que a 3.1.x tinha. Os nomes dizem o comportamento, e não a função
// que o faz.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const lab = require('./laboratorio.cjs');

const { criarServidor, criarJanela, assentar } = lab;

/** Uma mesa no canal 1, de quem mestra (a pessoa 1), com uma cena, duas fichas e uma peça. */
function mesaPronta(opcoes = {}) {
  const servidor = criarServidor(opcoes.servidor);
  servidor.escrever('1', 1, { op: 'setup', name: 'Coração de Ferro', system: 'dnd5e-2014', gm: '1' });
  if (opcoes.vazia) return servidor;
  servidor.escrever('1', 1, { op: 'scene-create', name: 'Cripta', kind: 'map' });
  servidor.escrever('1', 1, { op: 'scene-show', id: 'scene-1' });
  servidor.escrever('1', 1, { op: 'sheet-create', name: 'Iria', owner: '2' });
  servidor.escrever('1', 1, { op: 'sheet-create', name: 'Bruno', owner: '3' });
  servidor.escrever('1', 1, { op: 'token-add', scene: 'scene-1', sheet: 'sheet-2', x: 2, y: 3 });
  return servidor;
}

/** A campanha como a pessoa a vê agora, direto do servidor. */
const campanha = (servidor, pessoa = '1', canal = 1) => servidor.ver(pessoa, canal).campaign;

/** Os pedidos de uma operação que a janela fez. */
const pedidosDe = (janela, op) => janela.pedidos.filter(p => p.valor.op === op);

/** Uma janela que subiu e assentou. */
async function janelaPronta(servidor, opcoes) {
  const janela = criarJanela(servidor, opcoes);
  await assentar();
  assert.deepEqual(janela.erros, [], 'a janela anotou erros ao subir');
  return janela;
}

/** Abre a página da mesa pela entrada de navegação, como quem usa. */
async function abrirAMesa(janela) {
  janela.emitir({ nome: 'acao', acao: 'abrir-mesa', pessoa: '', canal: '' });
  await assentar();
  const pagina = janela.superficies.get('mesa');
  assert.ok(pagina?.visivel, 'a página da mesa não abriu');
  return pagina;
}

/** Troca de aba, como o produto manda. */
async function aba(janela, nome) {
  janela.emitir({ nome: 'aba', chave: 'aba', valor: 'aba-' + nome });
  await assentar();
}

/** Abre a folha de uma ficha pela aba de fichas. */
async function abrirAFicha(janela, ficha) {
  await aba(janela, 'fichas');
  janela.apertar('abrir-ficha-' + ficha);
  await assentar();
  const folha = janela.superficies.get('mesa-ficha');
  assert.ok(folha?.visivel, 'a folha da ficha não abriu');
  return folha;
}

/** Amarra a mesa do canal 1 à sala 7, pelo servidor. */
function amarrarASala(servidor, sala = 7) {
  const c = campanha(servidor);
  servidor.escrever('1', 1, { op: 'settings', name: c.name, allowMove: true, allowEdit: true, sala });
}

// ------------------------------------------------------------ o laboratório

test('o laboratório é o contrato: o MOD não tem snapshot, região nem painel', async () => {
  const servidor = criarServidor();
  const janela = criarJanela(servidor);
  await assentar();
  assert.equal(lab.contrato.version, 6);
  // O pacote declara a API que o produto aceita: um `mod.json` de API 4 seria
  // recusado pelo app 0.16 com `ApiTooOld`, e o executor daria a ele as
  // capacidades da 4 — sem retrato, sem volume e sem aviso do servidor.
  assert.ok(lab.contratoV7.compatibilidade.aceitas.includes(lab.manifesto.api), 'a API que o pacote declara não é aceita pela v7');
  assert.equal(lab.manifesto.api, 7);
  assert.match(lab.manifesto.version, /^5\./, 'a versão do pacote da API 7 é a 5.x (D-mods-1: 3.x = 0.15, 4.x = API 6, 5.x = API 7)');
  assert.ok(!lab.manifesto.reach.includes('regiao'), 'o reach diz «regiao», que a API 6 não tem');
  assert.ok(!lab.contrato.superficies.tipos.includes('painel'));
  assert.throws(() => lab.conferirDeclaracao({ forma: 'painel' }, lab.PERFIS.superficie, 'x'), /forma que a API 6 não tem/);
  assert.throws(() => lab.conferirDeclaracao({ forma: 'caixa', limiteDeBytes: 1 }, lab.PERFIS.superficie, 'x'), /não é propriedade/);
  assert.throws(() => lab.conferirDeclaracao({ forma: 'tela', figuras: [{ tipo: 'poligono' }] }, lab.PERFIS.superficie, 'x'), /figura que a API 6 não tem/);
  assert.throws(() => lab.conferirDeclaracao({ forma: 'botao', chave: 'b' }, lab.PERFIS.cartao, 'um cartão'), /não entra/);
  // A fundura conta a palavra dentro de um texto: a raiz é o nível 0, o
  // `dentro` desce um, e o que passa de 16 é recusado (`planejar`).
  const funda = n => (n === 0 ? 'a palavra' : { forma: 'caixa', dentro: [funda(n - 1)] });
  assert.doesNotThrow(() => lab.conferirDeclaracao(funda(16), lab.PERFIS.superficie, 'x'));
  assert.throws(() => lab.conferirDeclaracao(funda(17), lab.PERFIS.superficie, 'x'), /fundura/);
  assert.deepEqual(janela.recusas, []);
});

// --------------------------------------------------- o retrato e o canal

test('sobe pelo retrato: consulta o canal marcado aberto, sem snapshot nem relógio', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 2, { op: 'setup', name: 'Outra mesa', system: 'free', gm: '1' });
  const janela = await janelaPronta(servidor, {
    canais: [{ id: 1, nome: 'geral', aberto: false }, { id: 2, nome: 'rpg', aberto: true }],
  });
  const vistas = pedidosDe(janela, 'view');
  assert.ok(vistas.length >= 1);
  assert.ok(vistas.every(p => p.canal === 2), 'consultou um canal que não é o aberto');
  assert.deepEqual(janela.relogios, [], 'a MESA agendou um relógio: o laço de 2 s voltou');
  const cabecalho = janela.contribuicao('canal.cabecalho');
  assert.equal(cabecalho?.alvo, '2');
  assert.match(JSON.stringify(cabecalho.conteudo), /Outra mesa/);
});

test('o evento canal consulta o canal novo e larga o que era do anterior', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 2, { op: 'setup', name: 'Outra mesa', system: 'free', gm: '1' });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.abrirCanal(2);
  await assentar();
  assert.equal(pedidosDe(janela, 'view').at(-1).canal, 2);
  assert.match(janela.texto('mesa'), /Outra mesa|MESTRE/);
  assert.doesNotMatch(janela.texto('mesa'), /Iria/, 'a página continuou mostrando a mesa do canal anterior');
  const folha = janela.superficies.get('mesa-ficha');
  assert.ok(!folha || folha.descartada || !folha.visivel, 'a ficha da outra mesa continuou aberta');
});

test('os nomes de quem joga vêm do retrato, pelo apelido', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await aba(janela, 'fichas');
  assert.match(janela.texto('mesa'), /Lia · nível 1/);
});

// ------------------------------------------------- o aviso no lugar do laço

test('duas janelas: a rolagem de uma aparece na outra sem relógio nenhum', async () => {
  const servidor = mesaPronta();
  const mestre = await janelaPronta(servidor);
  const jogadora = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(jogadora);
  await aba(jogadora, 'registro');
  await abrirAMesa(mestre);
  mestre.emitir({ nome: 'campo', chave: 'formula', valor: '2d6+1' });
  mestre.apertar('rolar');
  await assentar();
  assert.match(jogadora.texto('mesa'), /2d6\+1 = /);
  assert.deepEqual(jogadora.relogios, []);
  assert.deepEqual(mestre.relogios, []);
});

test('parada: sem mudança, nenhuma consulta e nenhuma montagem', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  const pagina = await abrirAMesa(janela);
  const antes = { vistas: pedidosDe(janela, 'view').length, montagens: pagina.montagens, atualizacoes: pagina.atualizacoes, mensagens: janela.mensagens.filter(m => m.tipo !== 'retrato').length };
  await assentar();
  // Um evento que não muda nada do que a mesa mostra: alguém entrou no
  // servidor. A mesa relê o retrato e não manda nada à tela.
  janela.emitir({ nome: 'pessoas', entrou: 3 });
  await assentar();
  assert.equal(pedidosDe(janela, 'view').length, antes.vistas);
  assert.equal(pagina.montagens, antes.montagens);
  assert.equal(pagina.atualizacoes, antes.atualizacoes);
  assert.equal(janela.mensagens.filter(m => m.tipo !== 'retrato').length, antes.mensagens);
  assert.deepEqual(janela.relogios, []);
});

test('o aviso da própria escrita não refaz a consulta: a resposta já trouxe a projeção', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  const vistas = pedidosDe(janela, 'view').length;
  janela.apertar('rolar');
  await assentar();
  assert.equal(pedidosDe(janela, 'view').length, vistas);
  assert.ok(servidor.avisos.some(a => a.canal === 1 && typeof a.carga.revisao === 'number'));
});

test('um aviso de outro canal, que esta janela não mostra, não vira consulta', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 2, { op: 'setup', name: 'Outra mesa', system: 'free', gm: '1' });
  const janela = await janelaPronta(servidor);
  const vistas = pedidosDe(janela, 'view').length;
  servidor.pedir('1', 2, { op: 'roll', formula: '1d4', nonce: 'fora-1', revision: campanha(servidor, '1', 2).revision });
  await assentar();
  assert.equal(pedidosDe(janela, 'view').length, vistas);
});

// ------------------------------------------- a página, o palco e o resto

test('a entrada Mesa na navegação abre a página da mesa do canal', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  const entrada = janela.contribuicao('servidor.navegacao');
  assert.equal(entrada?.acaoPrincipal, 'abrir-mesa');
  assert.equal(entrada.rotulo, 'Mesa');
  const pagina = await abrirAMesa(janela);
  assert.equal(pagina.titulo, 'Coração de Ferro');
  assert.match(janela.texto('mesa'), /Cripta/);
});

test('o cabeçalho do canal mostra a rodada e quem está na vez, e muda por atualizar', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'initiative-add', name: 'Iria', value: 15 });
  servidor.escrever('1', 1, { op: 'initiative-add', name: 'Goblin', value: 9 });
  const janela = await janelaPronta(servidor);
  const cabecalho = janela.contribuicao('canal.cabecalho');
  assert.equal(cabecalho.alvo, '1');
  assert.equal(cabecalho.acaoPrincipal, 'abrir-mesa');
  assert.match(JSON.stringify(cabecalho.conteudo), /rodada 1 · na vez: Iria/);
  servidor.escrever('1', 1, { op: 'initiative-next' });
  await assentar();
  const depois = janela.contribuicao('canal.cabecalho');
  assert.equal(depois.handle, cabecalho.handle, 'o cabeçalho foi revogado e registrado de novo');
  assert.match(JSON.stringify(depois.conteudo), /na vez: Goblin/);
  assert.ok(depois.atualizacoes >= 1);
});

test('o palco monta o tabuleiro da mesa amarrada à sala de voz em que a pessoa está', async () => {
  const servidor = mesaPronta();
  amarrarASala(servidor, 7);
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  assert.equal(janela.contribuicao('chamada.palco'), null, 'o palco apareceu sem a pessoa estar na sala');
  janela.entrarNaSala(7);
  await assentar();
  const palco = janela.contribuicao('chamada.palco');
  assert.ok(palco, 'o palco não foi registrado');
  assert.equal(palco.modo, 'substituir');
  const tela = JSON.stringify(palco.conteudo);
  assert.match(tela, /"chave":"palco:tabuleiro"/);
  assert.match(tela, /peca:token-4/);
  janela.sairDaSala();
  await assentar();
  assert.equal(janela.contribuicao('chamada.palco'), null, 'o palco ficou depois de sair da sala');
});

test('uma sala sem mesa não ganha palco, e quem está fora de sala não recebe canal', async () => {
  const servidor = mesaPronta();
  amarrarASala(servidor, 7);
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  janela.entrarNaSala(8);
  await assentar();
  assert.equal(janela.contribuicao('chamada.palco'), null);
  assert.deepEqual(servidor.pedir('2', 0, { op: 'mesa-da-sala' }), { ok: true, sala: 8, canal: null });
  servidor.salas.delete('2');
  assert.deepEqual(servidor.pedir('2', 0, { op: 'mesa-da-sala', sala: 7 }), { ok: true, sala: null, canal: null });
});

test('a sala amarrada ganha MESA nas ações dela, que abre a página daquela mesa', async () => {
  const servidor = mesaPronta();
  amarrarASala(servidor, 7);
  servidor.escrever('1', 2, { op: 'setup', name: 'Outra mesa', system: 'free', gm: '1' });
  const janela = await janelaPronta(servidor, {
    canais: [{ id: 1, nome: 'geral', aberto: false }, { id: 2, nome: 'rpg', aberto: true }],
  });
  // A sala 7 é da mesa do canal 1, e esta janela abriu o 2: ela só sabe da
  // sala quando vê a mesa do 1.
  janela.abrirCanal(1);
  await assentar();
  const acao = janela.contribuicao('sala.acoes');
  assert.equal(acao?.alvo, '7');
  assert.equal(acao.acaoPrincipal, 'mesa-da-sala');
  janela.abrirCanal(2);
  await assentar();
  janela.emitir({ nome: 'acao', acao: 'mesa-da-sala', pessoa: '', canal: '7' });
  await assentar();
  assert.equal(janela.superficies.get('mesa').titulo, 'Coração de Ferro');
});

// ------------------------------------- a folha e os formulários no diálogo

test('a ficha abre numa folha, com a vida e as ações dela', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  const folha = await abrirAFicha(janela, 'sheet-2');
  assert.equal(folha.tipo, 'folha');
  assert.match(janela.texto('mesa-ficha'), /PV 10\/10/);
  assert.ok(janela.controles('mesa-ficha').has('ficha:ferir'));
});

test('um nível 25 é impedido pelo formulário, sem ida ao servidor', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.apertar('ficha:editar');
  await assentar();
  const nivel = janela.controles('mesa-editar-ficha').get('level');
  assert.equal(nivel.forma, 'numero');
  assert.deepEqual([nivel.minimo, nivel.maximo, nivel.inteiro], [1, 20, true]);
  assert.notEqual(janela.regraViolada('mesa-editar-ficha', 'level', 25), '');
  assert.equal(janela.regraViolada('mesa-editar-ficha', 'level', 5), '');
  assert.notEqual(janela.regraViolada('mesa-editar-ficha', 'name', ''), '');
  assert.notEqual(janela.regraViolada('mesa-editar-ficha', 'notes', 'á'.repeat(3001)), '');
});

test('a recusa do servidor volta ao campo dela, pelo formulário', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.apertar('ficha:editar');
  await assentar();
  // PV acima do PV máximo: só o servidor sabe recusar, porque é uma regra
  // entre dois campos.
  janela.submeter('mesa-editar-ficha', 'form-editar-ficha', { hp: 50, maxHp: 20 });
  await assentar();
  const dialogo = janela.superficies.get('mesa-editar-ficha');
  assert.ok(dialogo.visivel, 'o diálogo fechou com a recusa');
  assert.deepEqual(Object.keys(dialogo.erros), ['hp']);
  assert.equal(campanha(servidor).sheets.find(s => s.id === 'sheet-2').hp, 10);
});

test('editar as notas enquanto o mestre fere a ficha não desfaz o dano', async () => {
  const servidor = mesaPronta();
  const jogadora = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(jogadora);
  await abrirAFicha(jogadora, 'sheet-2');
  jogadora.apertar('ficha:editar');
  await assentar();
  servidor.escrever('1', 1, { op: 'vitality', sheet: 'sheet-2', kind: 'damage', amount: 3 });
  await assentar();
  jogadora.submeter('mesa-editar-ficha', 'form-editar-ficha', { notes: 'Deve um favor ao ferreiro.' });
  await assentar();
  const ficha = campanha(servidor).sheets.find(s => s.id === 'sheet-2');
  assert.equal(ficha.notes, 'Deve um favor ao ferreiro.');
  assert.equal(ficha.hp, 7, 'gravar as notas devolveu os PV de quando o diálogo abriu');
  assert.ok(jogadora.superficies.get('mesa-editar-ficha').descartada, 'o diálogo não fechou depois de gravar');
});

test('uma ficha com os três textos cheios abre num diálogo só, sem mensagem acima de 12 KiB', async () => {
  const servidor = mesaPronta();
  const ficha = campanha(servidor).sheets.find(s => s.id === 'sheet-2');
  const cheio = n => ('Ação à espreita, coração. ').repeat(200).slice(0, n);
  servidor.escrever('1', 1, { op: 'sheet-save', sheet: { ...ficha, inventory: cheio(3000), skills: cheio(1000), notes: cheio(3000) } });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.apertar('ficha:editar');
  await assentar();
  assert.deepEqual(janela.recusas, []);
  const campos = janela.controles('mesa-editar-ficha');
  assert.equal(campos.get('notes').valor, cheio(3000));
  assert.equal(campos.get('inventory').valor, cheio(3000));
  assert.equal(campos.get('skills').valor, cheio(1000));
});

test('o diálogo de edição pergunta antes de fechar com algo escrito', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.apertar('ficha:editar');
  await assentar();
  // O produto pergunta sozinho quando um campo difere do inicial; o inicial
  // de cada campo é o gravado.
  assert.equal(janela.controles('mesa-editar-ficha').get('name').inicial, 'Iria');
  assert.equal(janela.suja('mesa-editar-ficha'), false);
  janela.emitir({ nome: 'campo', chave: 'notes', valor: 'Uma nota que não foi gravada.' });
  assert.equal(janela.suja('mesa-editar-ficha'), true);
});

test('uma rolagem de outra pessoa atualiza o registro com um atualizar só, sem remontar a página', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  const pagina = await abrirAMesa(janela);
  await aba(janela, 'registro');
  const antes = { montagens: pagina.montagens, atualizacoes: pagina.atualizacoes };
  servidor.escrever('2', 1, { op: 'roll', formula: '1d20' });
  await assentar();
  assert.equal(pagina.montagens, antes.montagens, 'a página foi remontada inteira');
  assert.equal(pagina.atualizacoes, antes.atualizacoes + 1);
  assert.equal(pagina.historico.at(-1).chave, 'parte:registro:0');
});

test('uma peça que anda atualiza só o tabuleiro', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  const pagina = await abrirAMesa(janela);
  const antes = pagina.historico.length;
  servidor.escrever('1', 1, { op: 'token-move', scene: 'scene-1', id: 'token-4', x: 5, y: 5 });
  await assentar();
  assert.deepEqual(pagina.historico.slice(antes).map(h => h.chave), ['parte:cena']);
});

test('a página de uma cena cheia monta em partes, sem nenhuma mensagem acima de 12 KiB', async () => {
  const servidor = mesaPronta();
  for (let i = 0; i < 40; i += 1) servidor.escrever('1', 1, { op: 'token-add', scene: 'scene-1', name: 'Esqueleto ' + i, x: i % 20, y: Math.floor(i / 20) + 5 });
  for (let i = 0; i < 40; i += 1) servidor.escrever('1', 1, { op: 'roll', formula: '1d20', label: 'Ataque do esqueleto número ' + i });
  for (let i = 0; i < 12; i += 1) servidor.escrever('1', 1, { op: 'entry-save', name: 'Verbete ' + i, kind: 'magia', level: 1, description: 'Descrição longa, com acentuação. '.repeat(40), published: true });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  for (const nome of ['tabuleiro', 'fichas', 'compendio', 'iniciativa', 'registro']) await aba(janela, nome);
  assert.deepEqual(janela.recusas, []);
  assert.match(janela.texto('mesa'), /Ataque do esqueleto número 0/);
});

// ------------------------------------------------------------- a trilha

test('a trilha toca em laço por contrato, e o fim dela não remonta nada', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'music', command: 'select', preset: 'battle' });
  const janela = await janelaPronta(servidor);
  const pagina = await abrirAMesa(janela);
  const trilha = janela.controles('mesa').get('trilha:battle');
  assert.equal(trilha.repetir, true);
  assert.equal(trilha.tocando, true);
  assert.equal(trilha.fonte, 'som/combate.wav');
  const antes = pagina.historico.length;
  janela.midia('trilha:battle', 'tocando');
  await assentar();
  assert.equal(pagina.historico.length, antes);
});

test('uma trilha recusada aparece na mesa, dita uma vez por motivo', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'music', command: 'select', preset: 'battle' });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  const gesto = 'o som não pôde começar sem um gesto de quem usa';
  janela.midia('trilha:battle', 'recusada', gesto);
  await assentar();
  assert.match(janela.texto('mesa'), /A trilha parou: o som não pôde começar sem um gesto/);
  // Quem usa apertou TOCAR: a linha sai.
  janela.midia('trilha:battle', 'tocando');
  await assentar();
  assert.doesNotMatch(janela.texto('mesa'), /A trilha parou/);
  // O mesmo motivo de novo não volta a ser dito; outro motivo é.
  janela.midia('trilha:battle', 'recusada', gesto);
  await assentar();
  assert.doesNotMatch(janela.texto('mesa'), /A trilha parou/);
  janela.midia('trilha:battle', 'pausada', 'a saída de som do sistema sumiu');
  await assentar();
  assert.match(janela.texto('mesa'), /A trilha parou: a saída de som do sistema sumiu/);
});

test('na sala amarrada, o tocador da trilha mora no palco e não na página', async () => {
  const servidor = mesaPronta();
  amarrarASala(servidor, 7);
  servidor.escrever('1', 1, { op: 'music', command: 'select', preset: 'mystery' });
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  assert.ok(janela.controles('mesa').get('trilha:mystery'));
  janela.entrarNaSala(7);
  await assentar();
  const palco = JSON.stringify(janela.contribuicao('chamada.palco').conteudo);
  assert.match(palco, /"chave":"palco:trilha:mystery"/);
  assert.match(palco, /"repetir":true/);
  assert.equal(janela.controles('mesa').get('trilha:mystery'), undefined, 'a trilha tocava em dois lugares');
  assert.match(janela.texto('mesa'), /toca no palco da chamada/);
});

test('no celular, a trilha nasce desligada, com o TOCAR do produto', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'music', command: 'select', preset: 'battle' });
  const janela = await janelaPronta(servidor, { onde: 'celular' });
  await abrirAMesa(janela);
  assert.equal(janela.controles('mesa').get('trilha:battle').tocando, false);
});

test('reabrir a página religa a trilha: tocando falso e depois verdadeiro', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'music', command: 'select', preset: 'battle' });
  const janela = await janelaPronta(servidor);
  const pagina = await abrirAMesa(janela);
  janela.emitir({ nome: 'fechar', superficie: 'mesa', porque: 'saida' });
  pagina.visivel = false;
  await assentar();
  const antes = pagina.historico.length;
  await abrirAMesa(janela);
  const trilhas = pagina.historico.slice(antes).filter(h => h.chave === 'parte:trilha')
    .map(h => JSON.stringify(h.arvore).match(/"tocando":(true|false)/)[1]);
  assert.deepEqual(trilhas, ['false', 'true']);
});

// ------------------------------------------------------- o volume

test('um mapa de 10 MiB chega num envio só e aparece de fundo, pelo volume', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  assert.equal(janela.controles('mesa').get('mapa')?.forma, 'arquivo');
  janela.escolher('mapa', 10 * 1024 * 1024);
  await assentar();
  assert.deepEqual(janela.pedidos.filter(p => !['view', 'mesa-da-sala'].includes(p.valor.op)).map(p => p.valor.op), ['imagem-comecar', 'imagem-pronta']);
  assert.equal(janela.mensagens.filter(m => m.tipo === 'enviar-imagem').length, 1);
  assert.equal(servidor.volumes.size, 1);
  const tela = janela.controles('mesa').get('tabuleiro');
  assert.deepEqual(tela.fundo.doServidor.pedido, { op: 'asset', scene: 'scene-1', transporte: 'volume' });
  assert.ok(janela.mensagens.some(m => m.tipo === 'soltar-arquivo'), 'o arquivo escolhido não foi devolvido');
});

test('uma rolagem no meio do envio não o interrompe', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  servidor.duranteOEnvio = () => { servidor.escrever('2', 1, { op: 'roll', formula: '1d6' }); };
  janela.escolher('mapa', 2 * 1024 * 1024);
  await assentar();
  const cena = campanha(servidor).scenes.find(s => s.id === 'scene-1');
  assert.equal(cena.assetVolume, true, 'o mapa não ficou na cena');
  assert.doesNotMatch(janela.texto('mesa'), /conflict/);
});

test('uma imagem da 3.1.x continua sendo lida pelas páginas antigas', async () => {
  const servidor = mesaPronta();
  const c = JSON.parse(servidor.data['campaign-1']);
  c.scenes[0].asset = 'channel-1/scene-1-image-velho';
  servidor.data['campaign-1'] = JSON.stringify(c);
  servidor.disco.set('channel-1/scene-1-image-velho', 'data:image/png;base64,AAAA');
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  const tela = janela.controles('mesa').get('tabuleiro');
  assert.deepEqual(tela.fundo.doServidor, { canal: 1, pedido: { op: 'asset', scene: 'scene-1' }, campo: 'image' });
});

test('sem SeeleUI.enviar, não há envio de imagem, e a mesa diz onde ele está', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { semEnviar: true });
  await abrirAMesa(janela);
  assert.equal(janela.controles('mesa').get('mapa'), undefined);
  assert.match(janela.texto('mesa'), /pelo computador/);
  await abrirAFicha(janela, 'sheet-2');
  assert.equal(janela.controles('mesa-ficha').get('ficha:retrato'), undefined);
});

test('o retrato da ficha vai pelo volume e volta por ele', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.escolher('ficha:retrato', 300 * 1024, 'image/webp');
  await assentar();
  const comecar = pedidosDe(janela, 'imagem-comecar')[0];
  assert.deepEqual([comecar.valor.alvo, comecar.valor.id], ['retrato', 'sheet-2']);
  const retrato = janela.controles('mesa-ficha').get('ficha:retrato-imagem');
  assert.deepEqual(retrato.doServidor.pedido, { op: 'portrait-asset', sheet: 'sheet-2', transporte: 'volume' });
});

// ------------------------------------------------------- a tela de jogo

test('cancelou devolve a peça e não manda pedido nenhum', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  const lado = janela.controles('mesa').get('tabuleiro').largura / 20;
  const tracar = (fase, x, y) => janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase, x: x * lado + 1, y: y * lado + 1, alvo: fase === 'comecou' ? 'peca:token-4' : null });
  tracar('comecou', 2, 3);
  tracar('moveu', 6, 6);
  await assentar();
  tracar('cancelou', 6, 6);
  await assentar();
  assert.equal(pedidosDe(janela, 'token-move').length, 0);
  const peca = janela.controles('mesa').get('tabuleiro').figuras.find(f => f.chave === 'peca:token-4');
  assert.equal(peca.x, 2 * lado + lado / 2);
});

test('o arraste que termina move a peça pelo servidor', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  const lado = janela.controles('mesa').get('tabuleiro').largura / 20;
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'comecou', x: 2 * lado + 1, y: 3 * lado + 1, alvo: 'peca:token-4' });
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'terminou', x: 7 * lado + 1, y: 8 * lado + 1, alvo: null });
  await assentar();
  const peca = campanha(servidor).scenes[0].tokens.find(t => t.id === 'token-4');
  assert.deepEqual([peca.x, peca.y], [7, 8]);
});

test('um lugar de 358 px reescala a casa para o tabuleiro caber', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  assert.equal(janela.controles('mesa').get('tabuleiro').largura, 20 * 26);
  janela.lugar(358, 600);
  await assentar();
  const tela = janela.controles('mesa').get('tabuleiro');
  assert.ok(tela.largura <= 358 - 16, 'o tabuleiro de ' + tela.largura + ' px não cabe em 358');
  assert.equal(tela.largura % 20, 0);
});

// ------------------------------- o que o servidor tinha e nada acionava

test('as configurações da mesa amarram a sala da chamada', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('configurar');
  await assentar();
  const sala = janela.controles('mesa-config').get('sala');
  assert.deepEqual(sala.opcoes.map(o => o.valor), ['', '7', '8']);
  janela.submeter('mesa-config', 'form-config', { sala: '7', allowMove: false });
  await assentar();
  const c = campanha(servidor);
  assert.deepEqual([c.sala, c.allowMove], [7, false]);
});

test('publicar e tirar o retrato, pela folha', async () => {
  const servidor = mesaPronta();
  const jogadora = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(jogadora);
  await abrirAFicha(jogadora, 'sheet-2');
  jogadora.escolher('ficha:retrato', 1000);
  await assentar();
  const mestre = await janelaPronta(servidor);
  await abrirAMesa(mestre);
  await abrirAFicha(mestre, 'sheet-2');
  mestre.apertar('ficha:publicar-retrato');
  await assentar();
  assert.equal(campanha(servidor).sheets.find(s => s.id === 'sheet-2').portrait.published, true);
  jogadora.apertar('ficha:tirar-retrato');
  await assentar();
  assert.equal(campanha(servidor).sheets.find(s => s.id === 'sheet-2').portrait.asset, null);
  assert.equal(servidor.volumes.size, 0);
});

test('esconder, mostrar e tirar uma peça; esconder a cena', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('esconder-peca-token-4');
  await assentar();
  assert.equal(campanha(servidor).scenes[0].tokens[0].hidden, true);
  janela.apertar('esconder-peca-token-4');
  await assentar();
  assert.equal(campanha(servidor).scenes[0].tokens[0].hidden, false);
  assert.match(janela.controles('mesa').get('tirar-peca-token-4').confirmar, /Iria/);
  janela.apertar('tirar-peca-token-4');
  await assentar();
  assert.deepEqual(campanha(servidor).scenes[0].tokens, []);
  janela.apertar('esconder-cena');
  await assentar();
  assert.equal(campanha(servidor).active, null);
});

test('uma cena nova pode ser ilustração', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('nova-cena');
  await assentar();
  janela.submeter('mesa-nova-cena', 'form-nova-cena', { name: 'O porto', kind: 'illustration' });
  await assentar();
  assert.equal(campanha(servidor).scenes.at(-1).kind, 'illustration');
});

test('a iniciativa de uma ficha é rolada pelo servidor, e o mestre tira uma entrada', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.apertar('ficha:iniciativa');
  await assentar();
  const pedido = pedidosDe(janela, 'initiative-add')[0].valor;
  assert.equal(pedido.sheet, 'sheet-2');
  assert.equal(pedido.value, undefined, 'a janela deu o valor da iniciativa em vez de o servidor rolar');
  const entrada = campanha(servidor).initiative[0];
  await aba(janela, 'iniciativa');
  janela.apertar('tirar-iniciativa-' + entrada.id);
  await assentar();
  assert.deepEqual(campanha(servidor).initiative, []);
});

test('o mestre põe uma entrada de iniciativa à mão, com o valor', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await aba(janela, 'iniciativa');
  janela.apertar('iniciativa-mao');
  await assentar();
  janela.submeter('mesa-iniciativa', 'form-iniciativa', { name: 'Goblin', value: 14, hidden: true });
  await assentar();
  assert.deepEqual(campanha(servidor).initiative.map(i => [i.name, i.value, i.hidden]), [['Goblin', 14, true]]);
});

test('um teste de perícia com vantagem, pela folha', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.emitir({ nome: 'escolha', chave: 'ficha:teste', valor: 'skill:stealth' });
  janela.emitir({ nome: 'escolha', chave: 'ficha:modo', valor: 'advantage' });
  janela.apertar('ficha:testar');
  await assentar();
  const pedido = pedidosDe(janela, 'check')[0].valor;
  assert.deepEqual([pedido.kind, pedido.key, pedido.mode], ['skill', 'stealth', 'advantage']);
  assert.match(campanha(servidor).log.at(-1).text, /Furtividade · vantagem/);
});

test('PV temporários pela folha', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.emitir({ nome: 'numero', chave: 'ficha:quanto', valor: 5, texto: '5' });
  janela.apertar('ficha:temporarios');
  await assentar();
  assert.equal(campanha(servidor).sheets.find(s => s.id === 'sheet-2').tempHp, 5);
});

test('apagar uma ficha pede confirmação ao produto e tira a ficha da mesa', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  assert.match(janela.controles('mesa-ficha').get('ficha:apagar').confirmar, /Iria/);
  janela.apertar('ficha:apagar');
  await assentar();
  assert.equal(campanha(servidor).sheets.some(s => s.id === 'sheet-2'), false);
  assert.ok(janela.superficies.get('mesa-ficha').descartada || !janela.superficies.get('mesa-ficha').visivel);
});

test('apagar um verbete e uma cena, com confirmação', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'entry-save', name: 'Bola de fogo', kind: 'magia', level: 3, published: true });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await aba(janela, 'compendio');
  const entrada = campanha(servidor).entries[0].id;
  assert.ok(janela.controles('mesa').get('apagar-verbete-' + entrada).confirmar);
  janela.apertar('apagar-verbete-' + entrada);
  await assentar();
  assert.deepEqual(campanha(servidor).entries, []);
  await aba(janela, 'tabuleiro');
  assert.ok(janela.controles('mesa').get('apagar-cena').confirmar);
  janela.apertar('apagar-cena');
  await assentar();
  assert.deepEqual(campanha(servidor).scenes, []);
});

test('criar a mesa num canal sem campanha, pelo formulário', async () => {
  const servidor = criarServidor();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('abrir-criar');
  await assentar();
  janela.submeter('mesa-criar', 'form-criar', { name: 'A Torre', system: 'free', gm: '2' });
  await assentar();
  const c = campanha(servidor);
  assert.deepEqual([c.name, c.system, c.gm], ['A Torre', 'free', '2']);
  assert.ok(janela.superficies.get('mesa-criar').descartada);
  assert.equal(janela.superficies.get('mesa').titulo, 'A Torre');
});

test('quem não administra não vê o formulário de criação', async () => {
  const servidor = criarServidor();
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  assert.equal(janela.controles('mesa').get('abrir-criar'), undefined);
  assert.match(janela.texto('mesa'), /pede a permissão «Criar a mesa de um canal»/);
});

// ------------------------------------------------------------- o celular

test('no celular, o palco não monta ferramenta do mestre e diz por quê', async () => {
  const servidor = mesaPronta();
  amarrarASala(servidor, 7);
  const janela = await janelaPronta(servidor, { onde: 'celular' });
  janela.entrarNaSala(7);
  await assentar();
  const palco = JSON.stringify(janela.contribuicao('chamada.palco').conteudo);
  assert.doesNotMatch(palco, /palco:proximo/);
  assert.match(palco, /Mestrar é no computador/);
  await abrirAMesa(janela);
  assert.equal(janela.controles('mesa').get('nova-cena'), undefined);
  assert.match(janela.texto('mesa'), /Mestrar é no computador/);
});

test('no computador, quem mestra passa o turno pelo palco', async () => {
  const servidor = mesaPronta();
  amarrarASala(servidor, 7);
  servidor.escrever('1', 1, { op: 'initiative-add', name: 'Iria', value: 15 });
  servidor.escrever('1', 1, { op: 'initiative-add', name: 'Goblin', value: 9 });
  const janela = await janelaPronta(servidor);
  janela.entrarNaSala(7);
  await assentar();
  assert.match(JSON.stringify(janela.contribuicao('chamada.palco').conteudo), /na vez: Iria/);
  janela.apertar('palco:proximo');
  await assentar();
  assert.equal(campanha(servidor).turn, 1);
  assert.match(JSON.stringify(janela.contribuicao('chamada.palco').conteudo), /na vez: Goblin/);
});

test('no palco, a rolagem vai à mesa da sala, e não à do canal aberto', async () => {
  const servidor = mesaPronta();
  amarrarASala(servidor, 7);
  servidor.escrever('1', 2, { op: 'setup', name: 'Outra mesa', system: 'free', gm: '1' });
  const janela = await janelaPronta(servidor, {
    pessoa: '2', canais: [{ id: 1, nome: 'geral', aberto: false }, { id: 2, nome: 'rpg', aberto: true }],
  });
  janela.entrarNaSala(7);
  await assentar();
  janela.emitir({ nome: 'campo', chave: 'palco:formula', valor: '1d8' });
  janela.apertar('palco:rolar');
  await assentar();
  assert.equal(pedidosDe(janela, 'roll')[0].canal, 1);
  assert.match(JSON.stringify(janela.contribuicao('chamada.palco').conteudo), /1d8 = /);
});

test('o palco escondido (0 × 0) não reescala o tabuleiro', async () => {
  const servidor = mesaPronta();
  amarrarASala(servidor, 7);
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  janela.entrarNaSala(7);
  await assentar();
  janela.lugar(600, 400, 'chamada.palco');
  await assentar();
  const largura = () => JSON.parse(JSON.stringify(janela.contribuicao('chamada.palco').conteudo).match(/\{"forma":"tela","chave":"palco:tabuleiro","largura":(\d+)/)[1]);
  const antes = largura();
  assert.ok(antes <= 600 - 16);
  janela.lugar(0, 0, 'chamada.palco');
  await assentar();
  assert.equal(largura(), antes);
});

// ------------------------------------------------------------- as recusas

test('uma recusa do servidor vira frase na mesa, e não o código', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.emitir({ nome: 'campo', chave: 'formula', valor: 'muitos dados' });
  janela.apertar('rolar');
  await assentar();
  assert.match(janela.texto('mesa'), /a fórmula de dados não é válida/);
  assert.doesNotMatch(janela.texto('mesa'), /invalid-dice/);
});

// ------------------------------- os guardas da 3.1.x que valem na API 6

test('sem canal de texto, nada é consultado e a mesa diz por quê', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { canais: [] });
  assert.equal(pedidosDe(janela, 'view').length, 0);
  janela.emitir({ nome: 'acao', acao: 'abrir-mesa', pessoa: '', canal: '' });
  await assentar();
  assert.match(janela.avisos.map(a => a.texto).join(' | '), /Abra um canal de texto/);
});

test('uma consulta lenta não abre outra em paralelo: só a mais recente espera', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  let soltar;
  const barreira = new Promise(r => { soltar = r; });
  servidor.atraso = async (pessoa, canal, valor) => { if (valor.op === 'view') await barreira; };
  const antes = pedidosDe(janela, 'view').length;
  for (let i = 0; i < 5; i += 1) servidor.escrever('2', 1, { op: 'roll', formula: '1d4' });
  await assentar();
  servidor.atraso = null;
  soltar();
  await assentar();
  assert.ok(pedidosDe(janela, 'view').length - antes <= 2, 'cinco avisos viraram ' + (pedidosDe(janela, 'view').length - antes) + ' consultas');
  const mostrada = janela.contribuicao('canal.cabecalho');
  assert.ok(mostrada, 'a última revisão não chegou');
});

test('uma consulta recusada é dita, e a próxima recupera', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  servidor.atraso = async (pessoa, canal, valor) => { if (valor.op === 'view') throw new Error('sem-conexao'); };
  servidor.escrever('2', 1, { op: 'roll', formula: '1d4' });
  await assentar();
  assert.match(janela.texto('mesa'), /A mesa não abriu/);
  servidor.atraso = null;
  servidor.escrever('2', 1, { op: 'roll', formula: '1d4' });
  await assentar();
  assert.match(janela.texto('mesa'), /Cripta/);
});

test('a resposta atrasada do canal anterior não aparece depois de trocar de canal', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 2, { op: 'setup', name: 'Outra mesa', system: 'free', gm: '1' });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  let soltar;
  const barreira = new Promise(r => { soltar = r; });
  servidor.atraso = async (pessoa, canal, valor) => { if (valor.op === 'view' && canal === 1) await barreira; };
  servidor.escrever('2', 1, { op: 'roll', formula: '1d4' });
  await assentar();
  janela.abrirCanal(2);
  await assentar();
  soltar();
  await assentar();
  assert.equal(janela.superficies.get('mesa').titulo, 'Outra mesa');
  assert.doesNotMatch(janela.texto('mesa'), /Cripta/);
});

test('pintar parede troca a casa, e não move a peça que está nela', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('modo-parede');
  await assentar();
  const lado = janela.controles('mesa').get('tabuleiro').largura / 20;
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'comecou', x: 2 * lado + 1, y: 3 * lado + 1, alvo: 'peca:token-4' });
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'terminou', x: 9 * lado + 1, y: 9 * lado + 1, alvo: null });
  await assentar();
  const cena = campanha(servidor).scenes[0];
  assert.deepEqual(cena.walls, [{ x: 2, y: 3 }]);
  assert.deepEqual([cena.tokens[0].x, cena.tokens[0].y], [2, 3]);
  assert.equal(pedidosDe(janela, 'token-move').length, 0);
});

test('um toque no vazio do tabuleiro não move peça nenhuma', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'comecou', x: 300, y: 300, alvo: null });
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'moveu', x: 60, y: 80, alvo: null });
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'terminou', x: 60, y: 80, alvo: null });
  await assentar();
  assert.equal(pedidosDe(janela, 'token-move').length, 0);
});

test('uma cena de 60 colunas cabe inteira na tela, e a última coluna se alcança', async () => {
  const servidor = mesaPronta();
  const cena = campanha(servidor).scenes[0];
  servidor.escrever('1', 1, { op: 'scene-save', id: cena.id, name: cena.name, description: '', notes: '', cols: 60, rows: 60, cellMeters: 1.5 });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  const tela = janela.controles('mesa').get('tabuleiro');
  assert.ok(tela.largura <= 1024 && tela.altura <= 1024);
  assert.ok(tela.figuras.length <= 256);
  const lado = tela.largura / 60;
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'comecou', x: 2 * lado + 1, y: 3 * lado + 1, alvo: 'peca:token-4' });
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'terminou', x: 59 * lado + 1, y: 59 * lado + 1, alvo: null });
  await assentar();
  const peca = campanha(servidor).scenes[0].tokens[0];
  assert.deepEqual([peca.x, peca.y], [59, 59]);
});

test('a recusa do servidor devolve a peça e é dita', async () => {
  const servidor = mesaPronta();
  // A peça do Bruno, e quem arrasta é a Lia.
  servidor.escrever('1', 1, { op: 'token-add', scene: 'scene-1', sheet: 'sheet-3', x: 8, y: 8 });
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  const lado = janela.controles('mesa').get('tabuleiro').largura / 20;
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'comecou', x: 8 * lado + 1, y: 8 * lado + 1, alvo: 'peca:token-5' });
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'terminou', x: 1 * lado + 1, y: 1 * lado + 1, alvo: null });
  await assentar();
  const peca = janela.controles('mesa').get('tabuleiro').figuras.find(f => f.chave === 'peca:token-5');
  assert.equal(peca.x, 8 * lado + lado / 2);
  assert.match(janela.texto('mesa'), /isto é de outra pessoa/);
});

test('o pedido que sai da janela carrega a marca e a revisão que ela tem', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('rolar');
  await assentar();
  const { valor } = pedidosDe(janela, 'roll')[0];
  assert.match(valor.nonce, /^[a-z0-9-]{1,64}$/);
  assert.equal(valor.revision, campanha(servidor).revision - 1);
});

test('um comando não é recusado porque outra pessoa escreveu no meio do caminho', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  let uma = true;
  servidor.antesDePedir = (pessoa, canal, valor) => {
    if (uma && valor.op === 'roll') { uma = false; servidor.escrever('2', 1, { op: 'roll', formula: '1d4', label: 'Outra' }); }
  };
  janela.apertar('rolar');
  await assentar();
  const log = campanha(servidor).log.map(l => l.text);
  assert.equal(log.filter(t => t.startsWith('Dados · 1d20')).length, 1, 'a rolagem não foi, ou foi duas vezes');
  assert.doesNotMatch(janela.texto('mesa'), /mudou a mesa ao mesmo tempo/);
});

test('a trilha que o mestre escolhe toca mesmo com a cena em silêncio, e a da cena muda o que toca', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'scene-music', id: 'scene-1', preset: 'silence' });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.emitir({ nome: 'escolha', chave: 'trilha-mesa', valor: 'exploration' });
  await assentar();
  assert.equal(janela.controles('mesa').get('trilha:exploration')?.tocando, true);
  janela.emitir({ nome: 'escolha', chave: 'trilha', valor: 'battle' });
  await assentar();
  assert.equal(janela.controles('mesa').get('trilha:battle')?.fonte, 'som/combate.wav');
  assert.equal(janela.controles('mesa').get('trilha:exploration'), undefined);
});

test('o mestre entrega a ficha a uma jogadora, e ela a vê', async () => {
  const servidor = mesaPronta();
  const mestre = await janelaPronta(servidor);
  const jogadora = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(jogadora);
  await aba(jogadora, 'fichas');
  assert.doesNotMatch(jogadora.texto('mesa'), /Bruno/);
  await abrirAMesa(mestre);
  await abrirAFicha(mestre, 'sheet-3');
  mestre.emitir({ nome: 'escolha', chave: 'ficha:dono', valor: '2' });
  await assentar();
  assert.match(jogadora.texto('mesa'), /Bruno/);
});

test('a peça de uma ficha vai à mesa pela folha, e quem joga a arrasta', async () => {
  const servidor = mesaPronta();
  const mestre = await janelaPronta(servidor);
  await abrirAMesa(mestre);
  await abrirAFicha(mestre, 'sheet-3');
  mestre.apertar('ficha:por-na-mesa');
  await assentar();
  const peca = campanha(servidor).scenes[0].tokens.find(t => t.sheet === 'sheet-3');
  assert.ok(peca, 'a peça da ficha não foi à mesa');
  const jogador = await janelaPronta(servidor, { pessoa: '3' });
  await abrirAMesa(jogador);
  const lado = jogador.controles('mesa').get('tabuleiro').largura / 20;
  jogador.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'comecou', x: 1, y: 1, alvo: 'peca:' + peca.id });
  jogador.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'terminou', x: 4 * lado + 1, y: 4 * lado + 1, alvo: null });
  await assentar();
  const depois = campanha(servidor).scenes[0].tokens.find(t => t.id === peca.id);
  assert.deepEqual([depois.x, depois.y], [4, 4]);
});

test('quem joga não recebe os controles que o servidor recusaria', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  for (const chave of ['nova-cena', 'configurar', 'trilha-mesa', 'mapa']) assert.equal(janela.controles('mesa').get(chave), undefined, chave);
  await abrirAFicha(janela, 'sheet-2');
  for (const chave of ['ficha:iniciativa', 'ficha:apagar', 'ficha:dono']) assert.equal(janela.controles('mesa-ficha').get(chave), undefined, chave);
});

test('a entrada recusada é dita uma vez, e não a cada revisão', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { recusarPontos: ['servidor.navegacao'] });
  servidor.escrever('2', 1, { op: 'roll', formula: '1d4' });
  await assentar();
  servidor.escrever('2', 1, { op: 'roll', formula: '1d4' });
  await assentar();
  assert.equal(janela.avisos.filter(a => /A entrada Mesa foi recusada/.test(a.texto)).length, 1);
});

test('abrir outra ficha não leva o que era da anterior', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.emitir({ nome: 'numero', chave: 'ficha:quanto', valor: 7, texto: '7' });
  await assentar();
  janela.apertar('ficha:editar');
  await assentar();
  await abrirAFicha(janela, 'sheet-3');
  assert.equal(janela.controles('mesa-ficha').get('ficha:quanto').valor, null);
  janela.apertar('ficha:editar');
  await assentar();
  assert.equal(janela.controles('mesa-editar-ficha').get('name').valor, 'Bruno');
});

test('a ficha em jogo fere, cura e marca condição', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  const ficha = () => campanha(servidor).sheets.find(s => s.id === 'sheet-2');
  janela.emitir({ nome: 'numero', chave: 'ficha:quanto', valor: 4, texto: '4' });
  janela.apertar('ficha:ferir');
  await assentar();
  assert.equal(ficha().hp, 6);
  janela.emitir({ nome: 'numero', chave: 'ficha:quanto', valor: 2, texto: '2' });
  janela.apertar('ficha:curar');
  await assentar();
  assert.equal(ficha().hp, 8);
  janela.apertar('ficha:atordoar');
  await assentar();
  assert.deepEqual(ficha().conditions, ['stunned']);
  assert.match(janela.texto('mesa-ficha'), /TIRAR ATORDOADO/);
});

test('ações com fórmula, usos e recuperação se criam, usam e saem', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.apertar('ficha:nova-acao');
  await assentar();
  janela.submeter('mesa-acao', 'form-acao', { name: 'Espada longa', kind: 'action', formula: '1d8+3', max: 2, recharge: 'long', description: 'Corte.' });
  await assentar();
  const acao = campanha(servidor, '2').sheets[0].actions[0];
  assert.deepEqual([acao.name, acao.formula, acao.max, acao.used], ['Espada longa', '1d8+3', 2, 0]);
  janela.apertar('ficha:usar-' + acao.id);
  await assentar();
  assert.equal(campanha(servidor, '2').sheets[0].actions[0].used, 1);
  assert.match(campanha(servidor).log.at(-1).text, /Espada longa · ação · 1d8\+3 = /);
  janela.apertar('ficha:tirar-acao-' + acao.id);
  await assentar();
  assert.deepEqual(campanha(servidor, '2').sheets[0].actions, []);
});

test('espaços de magia: preparar e conjurar gastam o espaço', async () => {
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'entry-save', name: 'Mísseis mágicos', kind: 'magia', level: 1, published: true });
  const s = campanha(servidor).sheets.find(f => f.id === 'sheet-2');
  s.slots[0].max = 2;
  servidor.escrever('1', 1, { op: 'sheet-save', sheet: s });
  const entrada = campanha(servidor).entries[0].id;
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  janela.apertar('ficha:preparar-' + entrada);
  await assentar();
  assert.deepEqual(campanha(servidor, '2').sheets[0].spells, [entrada]);
  janela.apertar('ficha:conjurar-' + entrada);
  await assentar();
  assert.equal(campanha(servidor, '2').sheets[0].slots[0].used, 1);
  assert.match(janela.texto('mesa-ficha'), /1º 1\/2/);
});

test('um verbete se cria pelo formulário e se publica', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await aba(janela, 'compendio');
  janela.apertar('novo-verbete');
  await assentar();
  janela.submeter('mesa-verbete', 'form-verbete', { name: 'Bola de fogo', kind: 'magia', level: 3, description: 'Explode.' });
  await assentar();
  const e = campanha(servidor).entries[0];
  assert.deepEqual([e.name, e.level, e.published], ['Bola de fogo', 3, false]);
  janela.apertar('publicar-verbete-' + e.id);
  await assentar();
  assert.equal(campanha(servidor).entries[0].published, true);
  assert.equal(campanha(servidor, '2').entries.length, 1);
});

test('a cena se ajusta pelo formulário, e a grade que deixaria uma peça de fora volta ao campo', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('ajustar-cena');
  await assentar();
  janela.submeter('mesa-cena', 'form-cena', { cols: 2 });
  await assentar();
  assert.deepEqual(Object.keys(janela.superficies.get('mesa-cena').erros), ['cols']);
  janela.submeter('mesa-cena', 'form-cena', { cols: 30, description: 'Úmida.', notes: 'O baú é mímico.' });
  await assentar();
  const cena = campanha(servidor).scenes[0];
  assert.deepEqual([cena.cols, cena.description, cena.notes], [30, 'Úmida.', 'O baú é mímico.']);
  assert.equal(campanha(servidor, '2').scenes[0].notes, undefined, 'as notas do mestre vazaram para quem joga');
});

test('no limite da campanha a página continua montando, e diz o que ficou de fora', async () => {
  const servidor = mesaPronta({ servidor: { teto: 4 * 1024 * 1024 } });
  for (let i = 0; i < 14; i += 1) servidor.escrever('1', 1, { op: 'sheet-create', name: 'Ficha número ' + i, owner: '2' });
  for (let i = 0; i < 100; i += 1) servidor.escrever('1', 1, { op: 'entry-save', name: 'Verbete com nome comprido ' + i, kind: 'magia', level: i % 10, description: 'Descrição, com acentuação e vírgulas. '.repeat(20), published: true });
  for (let i = 0; i < 47; i += 1) servidor.escrever('1', 1, { op: 'token-add', scene: 'scene-1', name: 'Peça ' + i, x: i % 20, y: Math.floor(i / 20) });
  for (let i = 0; i < 128; i += 1) servidor.escrever('1', 1, { op: 'wall', scene: 'scene-1', x: i % 20, y: 5 + Math.floor(i / 20) });
  for (let i = 0; i < 40; i += 1) servidor.escrever('1', 1, { op: 'roll', formula: '1d20+5', label: 'Uma rolagem com um rótulo longo ' + i });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  for (const nome of ['tabuleiro', 'fichas', 'compendio', 'iniciativa', 'registro']) await aba(janela, nome);
  assert.deepEqual(janela.recusas, []);
  await aba(janela, 'compendio');
  assert.match(janela.texto('mesa'), /verbetes não cabem aqui/);
  await abrirAFicha(janela, 'sheet-2');
  assert.deepEqual(janela.recusas, []);
});

test('uma resposta velha que chega depois de uma nova não volta a mesa no tempo', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await aba(janela, 'registro');
  let soltar, primeira = true;
  const barreira = new Promise(r => { soltar = r; });
  servidor.atrasoDaResposta = async (pessoa, canal, valor) => {
    if (valor.op === 'view' && primeira) { primeira = false; await barreira; }
  };
  // Outra pessoa rola: o aviso faz consultar, e a resposta dessa consulta fica
  // presa no caminho.
  servidor.escrever('2', 1, { op: 'roll', formula: '1d4', label: 'Dela' });
  await assentar();
  // Esta janela rola, e a resposta dela chega antes.
  janela.apertar('rolar');
  await assentar();
  assert.match(janela.texto('mesa'), /Dados · 1d20/);
  soltar();
  await assentar();
  assert.match(janela.texto('mesa'), /Dados · 1d20/, 'a resposta velha apagou a rolagem nova');
});

test('mandar o formulário duas vezes seguidas cria uma vez só', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await aba(janela, 'fichas');
  janela.apertar('nova-ficha');
  await assentar();
  janela.submeter('mesa-nova-ficha', 'form-nova-ficha', { name: 'Cora', owner: '2' });
  janela.submeter('mesa-nova-ficha', 'form-nova-ficha', { name: 'Cora', owner: '2' });
  await assentar();
  assert.equal(campanha(servidor).sheets.filter(s => s.name === 'Cora').length, 1);
  assert.equal(pedidosDe(janela, 'sheet-create').length, 1);
});

test('quem já está na sala ganha o palco quando o mestre amarra a mesa a ela', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  janela.entrarNaSala(7);
  await assentar();
  assert.equal(janela.contribuicao('chamada.palco'), null);
  amarrarASala(servidor, 7);
  await assentar();
  assert.ok(janela.contribuicao('chamada.palco'), 'o palco não apareceu sem a pessoa sair e voltar');
});

test('no celular, o retrato não se envia, e a ficha diz onde se envia', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { pessoa: '2', onde: 'celular' });
  await abrirAMesa(janela);
  await abrirAFicha(janela, 'sheet-2');
  assert.equal(janela.controles('mesa-ficha').get('ficha:retrato'), undefined);
  assert.match(janela.texto('mesa-ficha'), /O envio do retrato é pelo computador/);
});

test('uma recusa da lista fechada do SEELE vira frase, e não o nome', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  // O seletor devolveu um arquivo que não é imagem, e o produto recusou pelo
  // nome da lista fechada, com o papel.
  janela.emitir({ nome: 'arquivo', chave: 'mapa', arquivo: null, resultado: 'falhou', erro: 'papel-nao-serve', papel: 'imagem' });
  await assentar();
  assert.match(janela.texto('mesa'), /este arquivo não é uma imagem/);
  assert.doesNotMatch(janela.texto('mesa'), /papel-nao-serve/);
  // E o genérico: o motivo foi ao registro do SEELE, e a mesa diz isso.
  janela.emitir({ nome: 'arquivo', chave: 'mapa', arquivo: null, resultado: 'falhou', erro: 'falhou' });
  await assentar();
  assert.match(janela.texto('mesa'), /o SEELE não disse o motivo aqui/);
});

test('no modo parede, um toque que vira rolagem da página não pinta parede', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('modo-parede');
  await assentar();
  const lado = janela.controles('mesa').get('tabuleiro').largura / 20;
  // O dedo desceu no vazio e a página rolou: o produto manda o começo e,
  // quando a rolagem toma o gesto, o cancelamento.
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'comecou', x: 7 * lado + 1, y: 7 * lado + 1, alvo: null });
  janela.emitir({ nome: 'traco', chave: 'tabuleiro', fase: 'cancelou', x: 7 * lado + 1, y: 2 * lado + 1, alvo: null });
  await assentar();
  assert.deepEqual(campanha(servidor).scenes[0].walls, []);
  assert.equal(pedidosDe(janela, 'wall').length, 0);
});

test('o que a mesa já gravou não deixa a página nem a folha sujas', async () => {
  // Suja, a superfície pergunta «fechar sem gravar?» a cada VOLTAR: a trilha
  // escolhida, a cena mostrada e a fórmula dos dados não são rascunho.
  const servidor = mesaPronta();
  servidor.escrever('1', 1, { op: 'scene-create', name: 'Porto', kind: 'map' });
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  assert.equal(janela.suja('mesa'), false);
  janela.emitir({ nome: 'escolha', chave: 'trilha-mesa', valor: 'mystery' });
  await assentar();
  assert.equal(campanha(servidor).music.preset, 'mystery');
  assert.equal(janela.suja('mesa'), false, 'a trilha gravada deixou a página suja');
  janela.emitir({ nome: 'escolha', chave: 'cena', valor: 'scene-5' });
  await assentar();
  assert.equal(campanha(servidor).active, 'scene-5');
  assert.equal(janela.suja('mesa'), false, 'a cena mostrada deixou a página suja');
  janela.emitir({ nome: 'campo', chave: 'formula', valor: '2d6+1' });
  await assentar();
  assert.equal(janela.suja('mesa'), false, 'a fórmula dos dados deixou a página suja');
  await abrirAFicha(janela, 'sheet-2');
  janela.emitir({ nome: 'numero', chave: 'ficha:quanto', valor: 4, texto: '4' });
  janela.emitir({ nome: 'escolha', chave: 'ficha:teste', valor: 'skill:stealth' });
  janela.emitir({ nome: 'escolha', chave: 'ficha:dono', valor: '3' });
  await assentar();
  assert.equal(campanha(servidor).sheets.find(s => s.id === 'sheet-2').owner, '3');
  assert.equal(janela.suja('mesa-ficha'), false, 'a folha ficou suja com o que ela já gravou ou só usa');
});

test('sem a capacidade arquivo, não há envio de imagem, mesmo com enviar', async () => {
  // O seletor de arquivos e o `soltar` são da capacidade `arquivo`; o `enviar`,
  // da `volume`. Um envio só acontece com as duas.
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor, { semArquivo: true });
  await abrirAMesa(janela);
  assert.equal(janela.controles('mesa').get('mapa'), undefined);
  assert.match(janela.texto('mesa'), /pelo computador/);
  await abrirAFicha(janela, 'sheet-2');
  assert.equal(janela.controles('mesa-ficha').get('ficha:retrato'), undefined);
});

test('uma parte que o SEELE não montou inteira é dita com frase, e a mesa segue', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  await aba(janela, 'registro');
  const amostra = [{ motivo: 'forma-fora-do-lugar', chave: 'x', forma: 'tela' }];
  janela.recusarProxima('superficie-atualizar', { erro: 'nos-recusados', recusados: 1, amostra });
  servidor.escrever('2', 1, { op: 'roll', formula: '1d4', label: 'Primeira' });
  await assentar();
  const ditos = janela.avisos.map(a => a.texto).join(' | ');
  assert.match(ditos, /o SEELE não montou parte do que a mesa declarou/);
  assert.doesNotMatch(ditos, /nos-recusados/);
  assert.ok(janela.erros.some(e => /forma-fora-do-lugar/.test(e)), 'a amostra não foi ao registro');
  // A próxima revisão monta a parte que faltou.
  servidor.escrever('2', 1, { op: 'roll', formula: '1d4', label: 'Segunda' });
  await assentar();
  assert.match(janela.texto('mesa'), /Primeira · 1d4/);
  assert.match(janela.texto('mesa'), /Segunda · 1d4/);
});

test('as classes recusadas pelo SEELE não impedem a página de abrir', async () => {
  const servidor = mesaPronta();
  const janela = await janelaPronta(servidor);
  janela.recusarProxima('superficie-classes', { erro: 'nos-recusados', recusados: 1, amostra: [{ motivo: 'propriedade', classe: 'fichas' }] });
  const pagina = await abrirAMesa(janela);
  assert.ok(pagina.montagens >= 1);
  assert.match(janela.texto('mesa'), /Cripta/);
  assert.match(janela.avisos.map(a => a.texto).join(' | '), /o SEELE não montou parte do que a mesa declarou/);
});

// ------------------------------------------------- a API 7: criar a mesa é uma ação

test('API 7: criar a mesa vai por SeeleMods.acao(id, canal, «criar-campanha», valor); a leitura segue por request', async () => {
  const servidor = criarServidor();
  const janela = await janelaPronta(servidor);
  await abrirAMesa(janela);
  janela.apertar('abrir-criar');
  await assentar();
  janela.submeter('mesa-criar', 'form-criar', { name: 'A Torre', system: 'free', gm: '2' });
  await assentar();
  assert.deepEqual(janela.acoes.map(a => [a.canal, a.nome, a.valor.op]), [[1, 'criar-campanha', 'setup']]);
  assert.ok(janela.pedidos.every(p => p.valor.op !== 'setup'), 'a criação saiu pelo request comum');
  assert.equal(JSON.parse(servidor.data['campaign-1']).name, 'A Torre');
});

test('API 7: sem a permissão a mesa DIZ por quê (visível), e quem a recebeu sem ser admin cria', async () => {
  const servidor = criarServidor();
  const semAcao = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(semAcao);
  assert.equal(semAcao.controles('mesa').get('abrir-criar'), undefined);
  assert.match(semAcao.texto('mesa'), /pede a permissão «Criar a mesa de um canal»/);
  servidor.concessoes.set('2', ['criar-campanha']);
  const comAcao = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(comAcao);
  assert.ok(comAcao.controles('mesa').get('abrir-criar'), 'quem recebeu a ação não vê CRIAR MESA');
  comAcao.apertar('abrir-criar'); await assentar();
  comAcao.submeter('mesa-criar', 'form-criar', { name: 'Da pessoa comum', system: 'free', gm: '2' });
  await assentar();
  assert.equal(JSON.parse(servidor.data['campaign-1']).name, 'Da pessoa comum');
});

test('API 7: a revogação no servidor nega a criação com a janela já aberta, e a recusa aparece na mesa', async () => {
  const servidor = criarServidor();
  servidor.concessoes.set('2', ['criar-campanha']);
  const janela = await janelaPronta(servidor, { pessoa: '2' });
  await abrirAMesa(janela);
  assert.ok(janela.controles('mesa').get('abrir-criar'));
  servidor.concessoes.set('2', []);
  janela.apertar('abrir-criar'); await assentar();
  janela.submeter('mesa-criar', 'form-criar', { name: 'Revogada', system: 'free', gm: '2' });
  await assentar(20);
  assert.equal(servidor.data['campaign-1'], undefined, 'criou depois da revogação');
  assert.equal(janela.acoes.length, 1, 'a janela deixou de pedir: ela não decide nada');
  const dito = JSON.stringify([...janela.superficies.values()].map(sf => sf.declaracao ?? null)) + JSON.stringify(janela.avisos);
  assert.match(dito, /não tem a permissão «Criar a mesa de um canal»/);
});
