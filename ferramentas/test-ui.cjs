// O laboratório, exercitado num navegador de verdade, com o renderer do produto.
//
// O que ele afirma, na API 6:
//
// - **nada abre sozinho**: a mesa começa por um gesto (a entrada **Mesa** da
//   navegação), e não há faixa nenhuma — a `regiao` saiu da 6;
// - **o que o MOD declara aparece**, montado pelo renderer do produto: a
//   página com o tabuleiro, a folha da ficha, o cabeçalho do canal e o palco
//   da chamada para quem entra na sala amarrada;
// - **o mapa vai pelo volume** e vira o fundo da tela;
// - **não há `script`** dentro do que o MOD declarou, **nem endereço externo**:
//   a fronteira não mudou em nenhuma versão da API;
// - **o que é de outra pessoa não vaza**;
// - **sair solta tudo**: superfícies, contribuições e o que elas seguravam;
// - **no celular** (390 × 844, `onde: 'celular'`), o tabuleiro cabe na largura
//   e quem mestra lê que mestrar é no computador.
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'mod.json')));

/** Um PNG de verdade, pequeno: o produto prova a imagem pelos bytes. */
function png(lado = 8) {
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const pedaco = (tipo, dados) => {
    const t = Buffer.from(tipo); const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, dados])));
    return Buffer.concat([tam, t, dados, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4); ihdr[8] = 8; ihdr[9] = 2;
  const linhas = Buffer.concat(Array.from({ length: lado }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(lado * 3, 0x80)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pedaco('IHDR', ihdr), pedaco('IDAT', zlib.deflateSync(linhas)), pedaco('IEND', Buffer.alloc(0))]);
}

(async () => {
  assert.equal(manifest.id, 'seele/mesa', 'este roteiro é da MESA');
  const temp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'seele-lab-'));
  const pacote = path.join(temp, 'pacote');
  execFileSync(process.execPath, [path.join(__dirname, 'package.mjs'), pacote]);

  const filho = spawn(process.execPath, [path.join(__dirname, 'preview.cjs')], {
    env: { ...process.env, MOD_PORT: '0', MOD_PACKAGE: pacote },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let navegador;
  try {
    const url = await new Promise((resolve, reject) => {
      const prazo = setTimeout(() => reject(Error('Laboratório não iniciou')), 10000);
      filho.stdout.on('data', pedaco => {
        const m = String(pedaco).match(/http:\/\/127\.0\.0\.1:\d+/);
        if (m) { clearTimeout(prazo); resolve(m[0]); }
      });
      filho.stderr.on('data', pedaco => { clearTimeout(prazo); reject(Error(String(pedaco))); });
      filho.once('exit', codigo => { clearTimeout(prazo); reject(Error('Laboratório saiu: ' + codigo)); });
    });

    /** Uma escrita direta no servidor deste MOD, para semear o caso. */
    let serie = 0;
    const chamar = async (corpo, pessoa = '1') => {
      const pedir = async c => (await fetch(url + '/pedido', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servidor: 'a', pessoa, canal: 1, corpo: c }),
      })).json();
      const visto = await pedir({ op: 'view' });
      const r = await pedir({ revision: visto.campaign?.revision ?? 0, nonce: 'semente-' + (++serie), ...corpo });
      assert.equal(r.ok, true, JSON.stringify(r));
      return r;
    };
    await chamar({ op: 'setup', name: 'Campanha do laboratório', system: 'dnd5e-2014', gm: '1' });
    await chamar({ op: 'scene-create', name: 'Cripta', kind: 'map' });
    await chamar({ op: 'scene-show', id: 'scene-1' });
    await chamar({ op: 'sheet-create', name: 'Iria <img src=x>', owner: '2' });
    await chamar({ op: 'sheet-create', name: 'Segredo do terceiro', owner: '3' });
    await chamar({ op: 'token-add', scene: 'scene-1', sheet: 'sheet-2', x: 2, y: 3 });
    await chamar({ op: 'settings', name: 'Campanha do laboratório', allowMove: true, allowEdit: true, sala: 7 });
    await chamar({ op: 'music', command: 'select', preset: 'mystery' });

    navegador = await chromium.launch({ headless: true });
    const erros = [];
    const abrir = async (consulta, viewport) => {
      const aba = await navegador.newPage({ viewport });
      aba.on('pageerror', e => erros.push(e.message));
      // `LAB_CONSOLE=1` mostra o console da janela: é por onde se acha por que
      // uma etapa esperou para sempre.
      if (process.env.LAB_CONSOLE) aba.on('console', m => console.log('[janela ' + m.type() + '] ' + m.text()));
      await aba.goto(url + '/' + consulta);
      return aba;
    };
    const doMod = aba => aba.locator('[data-mod="' + manifest.id + '"]');
    // **Um erro dito também é erro.** A MESA pega a recusa de uma montagem e a
    // diz num aviso: sem esta conferência, uma parte recusada pelo produto (uma
    // forma, um estilo) passaria aqui com a tela do jeito que estava.
    const semErroDito = async (janela, onde) => {
      const ditos = await janela.locator('.aviso-de-mod[data-tom="erro"]').allTextContents();
      assert.deepEqual(ditos, [], 'a MESA disse um erro ' + onde);
    };

    // ---------------------------------------------------- no computador
    const aba = await abrir('?pessoa=2', { width: 1280, height: 900 });
    const entrada = aba.locator('#lista-mods-navegacao button');
    await entrada.first().waitFor({ timeout: 15000 });
    assert.equal(await aba.locator('.superficie-de-mod').count(), 0, 'uma superfície abriu sem ninguém pedir');
    assert.equal(await aba.locator('#regioes-dos-mods').count(), 0, 'a faixa da API 3 voltou ao laboratório');

    // O cabeçalho do canal, que é contribuição: a linha da mesa e o botão.
    await aba.locator('#canal-cabecalho-mods').getByText('MESA · Campanha do laboratório').waitFor({ timeout: 15000 });

    await entrada.first().click();
    const paginaDaMesa = aba.locator('.pagina-de-mod');
    await paginaDaMesa.waitFor({ timeout: 15000 });
    await paginaDaMesa.getByText('Cripta').first().waitFor({ timeout: 15000 });
    assert.ok(await paginaDaMesa.locator('canvas').count() > 0, 'o tabuleiro não virou tela');
    assert.equal(await paginaDaMesa.locator('.superficie-de-mod-sair').count(), 1, 'a página ficou sem a saída do produto');

    // A folha da ficha, ao lado da página.
    await paginaDaMesa.getByRole('tab', { name: 'FICHAS' }).click();
    await paginaDaMesa.getByRole('button', { name: 'ABRIR' }).first().click();
    const folhaDaFicha = aba.locator('.folha-de-mod');
    await folhaDaFicha.getByText('PV 10/10').waitFor({ timeout: 15000 });
    assert.ok(await paginaDaMesa.isVisible(), 'a folha tirou a página da vista');
    await semErroDito(aba, 'com a página e a folha abertas');

    // O que é de outra pessoa não vaza, e a fronteira continua de pé.
    const sessao = aba.locator('#tela-sessao');
    assert.ok(!(await sessao.textContent()).includes('Segredo do terceiro'), 'a ficha de outra pessoa apareceu');
    assert.equal(await sessao.locator('script').count(), 0, 'apareceu um <script> dentro do que o MOD declarou');
    assert.equal(await sessao.locator('[src^="http"],[href^="http"]').count(), 0, 'o MOD montou um endereço externo');
    assert.ok((await sessao.textContent()).includes('Iria <img src=x>'), 'o nome da ficha não apareceu como texto');

    // O palco, ao entrar na sala amarrada à mesa.
    await aba.selectOption('#sala', '7');
    const palco = aba.locator('#palco-de-mods');
    await palco.getByText('PALCO DE seele/mesa').waitFor({ timeout: 15000 });
    assert.ok(await palco.locator('canvas').count() > 0, 'o palco não montou o tabuleiro');
    await paginaDaMesa.getByText('A trilha desta mesa toca no palco da chamada.').waitFor({ timeout: 15000 });
    await semErroDito(aba, 'com o palco');

    // ---- sair solta tudo ----
    await aba.click('#sair');
    await aba.waitForTimeout(500);
    const sobreviventes = await doMod(aba).evaluateAll(
      ns => ns.map(n => n.tagName + '.' + n.className + ' pai=' + (n.parentElement?.id || n.parentElement?.className || '?')),
    );
    assert.deepEqual(sobreviventes, [], 'o que o MOD desenhou sobreviveu à saída da sessão');
    assert.equal(await aba.locator('.superficie-de-mod').count(), 0, 'uma superfície sobreviveu à saída da sessão');
    assert.equal(await aba.locator('#lista-mods-navegacao button').count(), 0, 'a entrada sobreviveu à saída da sessão');

    // E recarregar monta de novo, do estado do servidor, pelo mesmo gesto.
    await aba.reload();
    try { await aba.locator('#lista-mods-navegacao button').first().waitFor({ timeout: 8000 }); } catch (e) {
      if (process.env.LAB_CONSOLE) { console.log(await aba.locator('body').evaluate(n => n.outerHTML.slice(0, 3000))); await aba.screenshot({ path: process.env.LAB_CONSOLE + '/falha.png' }); }
      throw e;
    }
    await aba.locator('#lista-mods-navegacao button').first().click();
    await aba.locator('.pagina-de-mod').getByText('Cripta').first().waitFor({ timeout: 15000 });

    // ------------------------------------------------ o mapa pelo volume
    const mestre = await abrir('?pessoa=1', { width: 1280, height: 900 });
    await mestre.locator('#lista-mods-navegacao button').first().click();
    const paginaDoMestre = mestre.locator('.pagina-de-mod');
    await paginaDoMestre.getByText('ENVIAR MAPA').waitFor({ timeout: 15000 });
    const [seletor] = await Promise.all([
      mestre.waitForEvent('filechooser'),
      paginaDoMestre.getByText('ENVIAR MAPA').click(),
    ]);
    await seletor.setFiles({ name: 'cripta.png', mimeType: 'image/png', buffer: png(64) });
    let cena;
    for (let i = 0; i < 50; i += 1) {
      await mestre.waitForTimeout(100);
      cena = (await (await fetch(url + '/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servidor: 'a', pessoa: '1', canal: 1, corpo: { op: 'view' } }) })).json()).campaign.scenes[0];
      if (cena.assetVolume) break;
    }
    assert.equal(cena.assetVolume, true, 'o mapa não chegou pelo volume');
    await semErroDito(mestre, 'ao mestre, com o mapa enviado');

    // **O que já foi gravado não é rascunho.** A superfície suja pergunta
    // «fechar sem gravar?» a cada saída; trocar a trilha da mesa grava na
    // hora, e VOLTAR fecha a página sem pergunta.
    await paginaDoMestre.locator('[data-chave-do-mod="trilha-mesa"] select').selectOption('battle');
    for (let i = 0; i < 50; i += 1) {
      await mestre.waitForTimeout(100);
      const musica = (await (await fetch(url + '/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servidor: 'a', pessoa: '1', canal: 1, corpo: { op: 'view' } }) })).json()).campaign.music;
      if (musica.preset === 'battle') break;
    }
    await mestre.waitForTimeout(300);
    await paginaDoMestre.locator('.superficie-de-mod-sair').first().click();
    await mestre.waitForTimeout(300);
    assert.equal(await mestre.locator('#moderar').isVisible(), false, 'a trilha gravada fez a página perguntar «fechar sem gravar?»');
    assert.equal(await paginaDoMestre.isVisible(), false, 'a página não fechou');

    // -------------------------------------------------------- no celular
    const celular = await abrir('?pessoa=1&onde=celular', { width: 390, height: 844 });
    await celular.locator('#lista-mods-navegacao button').first().click();
    const paginaNoCelular = celular.locator('.pagina-de-mod');
    await paginaNoCelular.getByText(/Mestrar é no computador/).first().waitFor({ timeout: 15000 });
    const tela = paginaNoCelular.locator('canvas').first();
    await tela.waitFor({ timeout: 15000 });
    const largura = await tela.evaluate(n => n.getBoundingClientRect().width);
    assert.ok(largura <= 390, 'o tabuleiro de ' + Math.round(largura) + ' px não cabe nos 390 do celular');
    assert.equal(await paginaNoCelular.getByText('NOVA CENA').count(), 0, 'as ferramentas do mestre apareceram no celular');
    await semErroDito(celular, 'no celular');

    assert.deepEqual(erros, [], 'a janela registrou erros: ' + erros.join(' · '));
    console.log(manifest.id + ': renderer e prelúdio da 0.16, página, folha, palco, cabeçalho, volume, '
      + 'celular, dados autorizados, saída e reconexão conferidos.');
  } finally {
    await navegador?.close();
    filho.kill();
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
