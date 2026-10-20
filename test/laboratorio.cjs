// O laboratório da API 6: o que a janela do SEELE oferece ao MOD, gerado do
// contrato, com a metade de servidor deste MOD rodando de verdade por baixo.
//
// # Por que ele é gerado do contrato
//
// O laboratório da API 4 imitava a janela à mão, e foi assim que um
// `open_channel` que nunca existiu passou três semanas verde.
// Este lê o `api/v6.json` congelado — copiado em `test/contrato/api-v6.json`, e
// conferido pelo hash ao carregar — e só oferece o que está lá: as formas, as
// figuras, os tipos de superfície, os pontos e os modos, os eventos. Um MOD que
// use um nome fora do contrato falha no teste dele.
//
// O que não está no contrato e o MOD também esbarra vem do renderer do produto
// (`apps/seele-app/ui/mods-regiao.js` e `mods-contribuicoes.js`, no SEELE
// 0.16), dito linha a linha onde aparece: os perfis de orçamento, as
// propriedades que cada nó pode ter, o ponto que pede alvo.
//
// # O que ele não prova
//
// O renderer de verdade, o executor de verdade e os limites de memória e de
// tempo. Para isso há o laboratório no navegador (`ferramentas/test-ui.cjs`) e o
// QuickJS (`ferramentas/quickjs-check`).
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.resolve(__dirname, '..');
const manifesto = JSON.parse(fs.readFileSync(path.join(raiz, 'mod.json'), 'utf8'));

// ---------------------------------------------------------------- o contrato

/**
 * O sha256 de `api/v6.json` em `api/congeladas.sha256`, no SEELE: o da v6
 * com as quatro emendas de depois do corte, antes de sair (o contrato diz o
 * que o produto entrega, e nada além). Depois da quarta, a v6 só muda na API 7.
 */
const HASH_DO_CONTRATO = '8dcf4aaf13f73b957e52b99f462bfdff656a232dd337bccebdad97edaae6f514';
const bytesDoContrato = fs.readFileSync(path.join(__dirname, 'contrato/api-v6.json'));
assert.equal(crypto.createHash('sha256').update(bytesDoContrato).digest('hex'), HASH_DO_CONTRATO,
  'test/contrato/api-v6.json não é o api/v6.json congelado: copie de novo do SEELE, e não edite');
const contrato = JSON.parse(bytesDoContrato);

const FORMAS = new Set(contrato.formas);
const FIGURAS = new Set(contrato.figuras);
const TIPOS_DE_SUPERFICIE = new Set(contrato.superficies.tipos);
const EVENTOS = new Set(contrato.eventos);
const LIMITES = contrato.superficies.limites;
const PONTOS = contrato.contribuicoes.pontos;
const TETO_DA_MENSAGEM = 12 * 1024;

/**
 * O perfil de cada ponto e se ele é por alvo, da tabela do produto
 * (`PONTOS_DE_CONTRIBUICAO`, `mods-contribuicoes.js:76-104`). O contrato diz os
 * pontos e os modos; o perfil e o alvo moram no renderer.
 */
const PERFIL_DO_PONTO = {
  'chamada.palco': ['superficie', false], 'servidor.aparencia': [null, false],
  'pessoa.identidade': ['cartao', true], 'pessoa.cartao': ['cartao', true],
  'pessoa.detalhes': ['superficie', true], 'pessoa.acoes': ['cartao', true],
  'pessoa.avatar': [null, true], 'pessoa.capa': [null, true], 'canal.item': ['cartao', true],
  'canal.cabecalho': ['cartao', true], 'compositor.ferramentas': ['cartao', false],
  'sala.acoes': ['cartao', true], 'servidor.navegacao': [null, false],
};
for (const ponto of Object.keys(PONTOS)) assert.ok(PERFIL_DO_PONTO[ponto], 'o laboratório não conhece o perfil de ' + ponto);

/** Os perfis de orçamento do renderer (`PERFIS_DE_RENDER`, `mods-regiao.js:273`). */
const PERFIS = {
  cartao: { nos: 64, fundura: 6, campos: 0, telas: 0, midias: 64,
    formas: new Set(['texto', 'titulo', 'linha', 'lista', 'item', 'midia', 'caixa', 'pilha', 'grade',
      'separador', 'espaco', 'retrato', 'distintivo']) },
  superficie: { nos: LIMITES.nos, fundura: LIMITES.fundura, campos: LIMITES.campos, telas: LIMITES.telas,
    midias: LIMITES.midias, formas: null },
};

/** As formas que recebem valor de quem usa: as que o `formulario.erros` alcança. */
const CAMPOS = new Set(['campo', 'escolha', 'textoLongo', 'numero', 'deslizante', 'marca', 'interruptor', 'cor']);

/**
 * As propriedades que o renderer lê de um nó (`plano.no.*` e `no.*` em
 * `mods-regiao.js`), e as de toda forma. Uma propriedade fora daqui é ignorada
 * pelo produto em silêncio — e é por isso que ela reprova aqui.
 */
const PROPRIEDADES_DO_NO = new Set(['forma', 'chave', 'classe', 'nomeAcessivel', 'estilo', 'dentro',
  'rotulo', 'valor', 'descricao', 'desligado', 'fonte', 'fundoDeMidia', 'erro', 'endereco', 'doServidor',
  'finalidade', 'emProgresso', 'variante', 'tracos', 'sugestao', 'repetir', 'porqueIndisponivel', 'opcoes',
  'minimo', 'maximo', 'inicial', 'formato', 'fixas', 'figuras', 'daPessoa', 'confirmar', 'tocando', 'tipos',
  'tamanhoMaximo', 'secundario', 'primario', 'passo', 'obrigatorio', 'linhas', 'largura', 'inteiro', 'fundo',
  'altura']);
/** As propriedades de estilo que o produto reconhece (`estiloDeMod`, `mods-estilos.js:219`). */
const PROPRIEDADES_DE_ESTILO = new Set(['cor', 'fundo', 'gradiente', 'opacidade', 'raio', 'borda', 'sombra',
  'familia', 'peso', 'corpo', 'entrelinha', 'espacamento', 'alinhamento', 'transformar', 'direcao', 'alinhar',
  'distribuir', 'quebra', 'crescer', 'encolher', 'base', 'intervalo', 'preenchimento', 'margem', 'largura',
  'altura', 'larguraMinima', 'larguraMaxima', 'alturaMinima', 'alturaMaxima', 'colunas', 'posicao', 'recortar',
  'proporcao', 'linhasMaximas', 'girar', 'escalar', 'mover', 'transicao', 'animacao']);
/** Uma cor de MOD: `#rgb`, `#rrggbb` ou `#rrggbbaa`, ou um nome do tema (`corDeMod`). */
const corValida = v => (typeof v === 'string' ? /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)
  : Boolean(v) && typeof v === 'object' && typeof v.tema === 'string');

/**
 * As partes que o renderer confere uma a uma (`estiloDeMod`, `mods-estilos.js`):
 * uma parte errada de uma propriedade composta conta como recusa, e numa
 * superfície a recusa faz o `montar` responder `falhou`. Aqui, a cor e as três
 * partes da borda, que são as que este MOD declara.
 */
function conferirEstilo(estilo, onde) {
  if (estilo.cor !== undefined) assert.ok(corValida(estilo.cor), `cor que o produto recusa: ${JSON.stringify(estilo.cor)} (${onde})`);
  const borda = estilo.borda;
  if (borda === undefined || borda === false || borda === 'nenhuma') return;
  assert.ok(borda && typeof borda === 'object', `borda que não é objeto (${onde})`);
  if (borda.largura !== undefined) assert.ok(Number.isFinite(Number(borda.largura)), `largura de borda que o produto recusa (${onde})`);
  if (borda.estilo !== undefined) assert.ok(['solida', 'tracejada', 'pontilhada', 'nenhuma'].includes(borda.estilo), `estilo de borda que o produto recusa: «${borda.estilo}» (${onde})`);
  if (borda.cor !== undefined) assert.ok(corValida(borda.cor), `cor de borda que o produto recusa: ${JSON.stringify(borda.cor)} (${onde})`);
}

const PROPRIEDADES_DA_FIGURA = new Set(['tipo', 'chave', 'x', 'y', 'ate_x', 'ate_y', 'largura', 'altura',
  'raio', 'cor', 'dentro', 'corpo', 'espessura']);

const bytes = texto => Buffer.byteLength(String(texto), 'utf8');

/** Quanto o laboratório já trabalhou: `assentar` espera este número parar. */
let atividade = 0;

/**
 * Uma recusa do próprio prelúdio, com a forma de toda recusa: o nome em
 * `message` e em `erro`, e os números em campos.
 */
const recusaDoPreludio = (nome, campos) => Object.assign(new Error(nome), campos, { erro: nome });

/** Uma mensagem à janela cabe nos 12 KiB do prelúdio, contada como ele conta. */
function cabeNaPonte(tipo, carga) {
  const tamanho = bytes(JSON.stringify({ tipo, n: 999999, ...carga }));
  if (tamanho > TETO_DA_MENSAGEM) {
    throw recusaDoPreludio('mensagem-grande', { tipoPedido: tipo, tamanho, teto: TETO_DA_MENSAGEM });
  }
}

/**
 * Confere uma declaração contra o perfil e conta o que ela gasta. Lança com o
 * que o produto recusaria: forma, propriedade, estilo, figura, orçamento.
 */
function conferirDeclaracao(arvore, perfil, onde) {
  const conta = { nos: 0, campos: 0, telas: 0, midias: 0, chaves: [], camposPorChave: new Set() };
  const andar = (no, fundura) => {
    if (no === null || no === undefined || no === false) return;
    if (Array.isArray(no)) { no.forEach(n => andar(n, fundura)); return; }
    // **A palavra também é um nível** (`planejar`, em `mods-regiao.js`): um
    // texto além da fundura é recusado como um galho, e não montado vazio.
    if (typeof no === 'string' || typeof no === 'number') {
      assert.ok(fundura <= perfil.fundura, `${onde} passou da fundura ${perfil.fundura} com um texto`);
      conta.nos += 1;
      return;
    }
    assert.equal(typeof no, 'object', `um nó que não é objeto em ${onde}`);
    assert.ok(FORMAS.has(no.forma), `forma que a API 6 não tem: «${no.forma}» (${onde})`);
    if (perfil.formas) assert.ok(perfil.formas.has(no.forma), `«${no.forma}» não entra num ${onde}`);
    assert.ok(fundura <= perfil.fundura, `${onde} passou da fundura ${perfil.fundura}`);
    for (const chave of Object.keys(no)) {
      assert.ok(PROPRIEDADES_DO_NO.has(chave), `«${chave}» não é propriedade que o renderer lê (em «${no.forma}», ${onde})`);
    }
    if (no.estilo !== undefined) {
      assert.equal(typeof no.estilo, 'object', `o estilo de «${no.forma}» não é um objeto`);
      for (const p of Object.keys(no.estilo)) assert.ok(PROPRIEDADES_DE_ESTILO.has(p), `estilo desconhecido «${p}» em «${no.forma}»`);
      conferirEstilo(no.estilo, `«${no.forma}», ${onde}`);
    }
    conta.nos += 1;
    if (typeof no.chave === 'string') conta.chaves.push(no.chave);
    if (CAMPOS.has(no.forma)) { conta.campos += 1; if (no.chave) conta.camposPorChave.add(no.chave); }
    if (no.forma === 'midia') conta.midias += 1;
    if (no.forma === 'tela') {
      conta.telas += 1;
      assert.ok(Array.isArray(no.figuras), 'tela sem figuras');
      assert.ok(no.figuras.length <= 256, `tela com ${no.figuras.length} figuras, e o teto é 256`);
      for (const f of no.figuras) {
        assert.ok(FIGURAS.has(f.tipo), `figura que a API 6 não tem: «${f.tipo}»`);
        for (const p of Object.keys(f)) assert.ok(PROPRIEDADES_DA_FIGURA.has(p), `«${p}» não é propriedade de figura`);
      }
    }
    andar(no.dentro, fundura + 1);
  };
  andar(arvore, 0);
  assert.ok(conta.nos <= perfil.nos, `${onde} tem ${conta.nos} nós, e o teto do perfil é ${perfil.nos}`);
  assert.ok(conta.campos <= perfil.campos, `${onde} tem ${conta.campos} campos, e o teto é ${perfil.campos}`);
  assert.ok(conta.telas <= perfil.telas, `${onde} tem ${conta.telas} telas, e o teto é ${perfil.telas}`);
  assert.ok(conta.midias <= perfil.midias, `${onde} tem ${conta.midias} mídias, e o teto é ${perfil.midias}`);
  return conta;
}

/** Os campos de uma árvore, com chave. */
function camposDe(arvore) {
  const achados = [];
  const andar = no => {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) { no.forEach(andar); return; }
    if (CAMPOS.has(no.forma) && no.chave) achados.push(no);
    andar(no.dentro);
  };
  andar(arvore);
  return achados;
}

/** O valor de um campo como a caixa dele o mostra: a marca é «true» ou «false». */
const comoTexto = (no, valor) => (no.forma === 'marca' || no.forma === 'interruptor'
  ? String(valor === true)
  : valor === null || valor === undefined ? '' : String(valor));

/** O nó de uma chave numa declaração, como `lugarDaChave` o acha (`mods-superficies.js`). */
function lugarDaChave(arvore, chave) {
  let achado = null;
  const andar = (pai, campo) => {
    const no = pai[campo];
    if (achado || no === null || typeof no !== 'object') return;
    if (Array.isArray(no)) { for (let i = 0; i < no.length && !achado; i += 1) andar(no, i); return; }
    if (no.chave === chave) { achado = { pai, campo }; return; }
    if (no.dentro !== undefined) andar(no, 'dentro');
  };
  const caixa = { arvore };
  andar(caixa, 'arvore');
  return achado ? { ...achado, caixa } : null;
}

// ------------------------------------------------------------- o servidor

const fonteDoServidor = fs.readFileSync(path.join(raiz, manifesto.server), 'utf8');

/**
 * Um servidor SEELE com este MOD ligado: o quintal, a pasta, o volume, os
 * avisos e a presença nas salas, compartilhados por todas as janelas do
 * laboratório.
 */
function criarServidor(opcoes = {}) {
  const data = {}, disco = new Map(), volumes = new Map(), esperas = new Map();
  const salas = new Map(), janelas = new Set(), avisos = [];
  const teto = opcoes.teto ?? 256 * 1024;
  let agora = 1000;
  const usoDe = d => Object.entries(d).reduce((n, [k, v]) => n + bytes(k) + bytes(v), 0);

  /** Uma volta da metade de servidor, como o `pedidos::executar` do SEELE. */
  function pedir(pessoa, canal, valor) {
    atividade += 1;
    const segurados = [];
    const avisar = aviso => {
      if (!aviso || typeof aviso !== 'object') return { ok: false, erro: 'aviso-invalido' };
      if (bytes(JSON.stringify(aviso.carga ?? null)) > 1024) return { ok: false, erro: 'aviso-grande-demais' };
      segurados.push(JSON.parse(JSON.stringify(aviso)));
      return { ok: true };
    };
    const dados = JSON.parse(JSON.stringify(data));
    Object.defineProperty(dados, 'uso', { value: () => usoDe(dados), enumerable: false });
    Object.defineProperty(dados, 'teto', { value: teto, enumerable: false });
    const volume = {
      esperar: (token, caminho, tipos, prazo) => {
        assert.ok(tipos.every(t => ['png', 'jpeg', 'webp', 'gif'].includes(t)) && prazo > 0);
        esperas.set(token, { caminho, pessoa: String(pessoa) });
        return true;
      },
      tamanho: c => volumes.has(c) ? volumes.get(c) : null,
      servir: c => volumes.has(c) ? c : null,
      apagar: c => volumes.delete(c),
    };
    const contexto = vm.createContext({
      dados, volume,
      mundo: { agora: () => agora, avisar, registrar: () => {} },
      arquivos: { ler: p => disco.get(p) ?? null, escrever: (p, v) => (disco.set(p, v), true), apagar: p => disco.delete(p), listar: () => [...disco.keys()] },
    });
    vm.runInContext(fonteDoServidor, contexto);
    const ctx = { person: String(pessoa), channel: canal === 0 ? null : canal, admin: String(pessoa) === '1', write: true, sala: salas.get(String(pessoa)) ?? null };
    let resposta = JSON.parse(contexto.aoPedir(JSON.stringify(ctx), JSON.stringify(valor)));
    if (resposta.ok !== false && usoDe(contexto.dados) > teto) resposta = { ok: false, error: 'quintal-cheio' };
    if (resposta.ok !== false) {
      for (const k of Object.keys(data)) delete data[k];
      Object.assign(data, contexto.dados);
      for (const aviso of segurados) {
        avisos.push(aviso);
        // O aviso sai depois de o quintal gravar, a toda janela deste MOD
        // (inclusive a de quem pediu), como o evento `servidor`.
        for (const janela of janelas) janela.receberAviso(aviso);
      }
    }
    return resposta;
  }

  /** A janela manda os bytes pelo volume, com o token que a metade de servidor deu. */
  function enviar(pessoa, token, tamanho) {
    const espera = esperas.get(token);
    if (!espera || espera.pessoa !== String(pessoa)) { const e = new Error('sem-espera'); e.erro = 'sem-espera'; throw e; }
    if (tamanho > 10 * 1024 * 1024) { const e = new Error('arquivo-grande-demais'); e.erro = 'arquivo-grande-demais'; throw e; }
    esperas.delete(token);
    // O que acontece enquanto os bytes andam: uma rolagem de outra pessoa.
    if (typeof servidor.duranteOEnvio === 'function') servidor.duranteOEnvio();
    volumes.set(espera.caminho, tamanho);
  }

  const servidor = {
    data, disco, volumes, avisos, salas, janelas, pedir, enviar, duranteOEnvio: null, atraso: null, antesDePedir: null, atrasoDaResposta: null,
    avancar: segundos => { agora += segundos; },
    /** Uma escrita direta, sem janela, para semear o caso. */
    escrever(pessoa, canal, valor) {
      const visto = pedir(pessoa, canal, { op: 'view' });
      const revision = visto.campaign ? visto.campaign.revision : 0;
      const r = pedir(pessoa, canal, { nonce: 'semente-' + crypto.randomUUID().slice(0, 8), revision, ...valor });
      assert.notEqual(r.ok, false, JSON.stringify(valor) + ' → ' + r.error);
      return r;
    },
    ver: (pessoa, canal = 1) => pedir(pessoa, canal, { op: 'view' }),
  };
  return servidor;
}

// ----------------------------------------------------------------- a janela

// `MESA_CLIENTE` aponta outro pacote de cliente: é por ele que a prova de
// mutação roda a suíte contra o cliente com um conserto revertido.
const fonteDoCliente = fs.readFileSync(process.env.MESA_CLIENTE || path.join(raiz, manifesto.client), 'utf8');

/**
 * Uma janela do SEELE com este MOD, como o prelúdio da API 6 o monta
 * (`crates/seele-motor/src/preludio.rs`): `SeeleMods.request` sem `snapshot`,
 * `SeeleUI.retrato`, as superfícies, as contribuições, o volume e os eventos.
 */
function criarJanela(servidor, opcoes = {}) {
  const pessoa = String(opcoes.pessoa ?? '1');
  const onde = opcoes.onde ?? 'computador';
  const semEnviar = opcoes.semEnviar === true;
  // Sem a capacidade `arquivo`, o prelúdio não monta `pedaco` nem `soltar`, e
  // o seletor de arquivos não existe (o navegador, enquanto a ponte não tem).
  const semArquivo = opcoes.semArquivo === true;
  const regioes = opcoes.regioes ?? ['redes', 'servidor.navegacao', 'operador.barra', 'canal.cabecalho',
    'conversa.mensagem', 'compositor', 'pessoas.lista', ...(onde === 'celular' ? [] : ['status.barra']),
    'chamada.palco', 'pagina', 'dialogo', 'folha', 'aviso'];
  const retrato = {
    eu: Number(pessoa),
    servidor: { nome: 'Servidor do laboratório' },
    pessoas: opcoes.pessoas ?? [{ id: 1, apelido: 'Alex', falando: false, mudo: false },
      { id: 2, apelido: 'Lia', falando: false, mudo: false }, { id: 3, apelido: 'Rafa', falando: false, mudo: false }],
    salas: opcoes.salas ?? [{ id: 7, nome: 'Taverna', limite: 0, pessoas: [], minha: false },
      { id: 8, nome: 'Porão', limite: 0, pessoas: [], minha: false }],
    canais: opcoes.canais ?? [{ id: 1, nome: 'geral', aberto: true }, { id: 2, nome: 'rpg', aberto: false }],
    onde,
    regioes,
  };

  // O que a janela guardou, para os testes olharem.
  const superficies = new Map();
  const contribuicoes = new Map();
  const avisos = [];
  const recusas = [];
  const erros = [];
  const pedidos = [];
  const mensagens = [];
  const relogios = [];
  const ausentes = new Set(opcoes.ausentes ?? (onde === 'celular' ? ['status.barra'] : []));
  let ouvinte = null;
  let serie = 0;

  /**
   * Um pedido do prelúdio: confere o tamanho, o teto de 8 pedidos em voo
   * (`too-many-requests`) e rejeita como ele. Cada pedido fica em voo até a
   * próxima volta do laço, como a resposta do anfitrião, que nunca é síncrona.
   */
  let emVoo = 0;
  /** As recusas que o caso pede ao produto, por tipo de mensagem: a próxima daquele tipo recusa. */
  const recusasPedidas = new Map();
  const pedir = async (tipo, carga, fazer) => {
    if (emVoo >= 8) {
      recusas.push({ tipo, motivo: 'too-many-requests' });
      throw recusaDoPreludio('too-many-requests', { teto: 8 });
    }
    emVoo += 1;
    atividade += 1;
    try {
      cabeNaPonte(tipo, carga);
      await new Promise(r => setImmediate(r));
      const pedida = recusasPedidas.get(tipo)?.shift();
      if (pedida) throw Object.assign(new Error(pedida.erro), pedida);
      const valor = await fazer();
      mensagens.push({ tipo, ...resumoDaCarga(carga) });
      return valor;
    } catch (erro) {
      recusas.push({ tipo, motivo: erro.message, ...(erro.tamanho ? { tamanho: erro.tamanho } : {}) });
      throw erro;
    } finally {
      emVoo -= 1;
    }
  };
  /** O que cada mensagem levou, sem a árvore: para os testes contarem idas. */
  const resumoDaCarga = carga => ({
    ...(carga.superficie !== undefined ? { superficie: carga.superficie } : {}),
    ...(carga.chave !== undefined ? { chave: carga.chave } : {}),
    ...(carga.handle !== undefined ? { handle: carga.handle } : {}),
    ...(carga.pedido?.ponto !== undefined ? { ponto: carga.pedido.ponto } : {}),
    ...(carga.valor?.op !== undefined ? { op: carga.valor.op, canal: carga.canal } : {}),
    ...(carga.descricao?.id !== undefined ? { superficie: carga.descricao.id } : {}),
  });
  const recusa = (nome, campos = {}) => Object.assign(new Error(nome), { erro: nome, ...campos });

  const visiveisDoTipo = tipo => [...superficies.values()].filter(s => s.tipo === tipo && s.visivel && !s.descartada).length;

  function criarSuperficie(descricao) {
    const id = String(descricao?.id ?? '');
    const tipo = descricao?.tipo ?? 'dialogo';
    if (!TIPOS_DE_SUPERFICIE.has(tipo)) throw recusa('tipo-desconhecido', { tipoPedido: tipo, tipos: [...TIPOS_DE_SUPERFICIE] });
    if (!retrato.regioes.includes(tipo)) throw recusa('regiao-ausente');
    let s = superficies.get(id);
    if (!s || s.descartada) {
      const vivas = [...superficies.values()].filter(v => !v.descartada).length;
      if (vivas >= LIMITES.superficies) throw recusa('teto-de-superficies', { teto: LIMITES.superficies });
      s = { id, tipo, descricao: JSON.parse(JSON.stringify(descricao)), declaracao: null, montagens: 0, atualizacoes: 0,
        visivel: descricao?.visivel === false ? null : false, titulo: String(descricao?.titulo ?? ''), erros: {}, classes: null, suja: false, descartada: false, chaves: new Set(), historico: [],
        // Para o sujo derivado: o valor de cada campo na primeira montagem, e o
        // que a pessoa mudou depois da última declaração dele.
        primeiros: new Map(), tocados: new Map() };
      superficies.set(id, s);
    }
    if (s.visivel === null) { s.visivel = false; return s; }
    if (tipo === 'folha' && !s.visivel && visiveisDoTipo('folha') >= LIMITES.folhas) throw recusa('teto-de-folhas', { teto: LIMITES.folhas });
    s.visivel = true;
    return s;
  }

  function aplicar(s, declaracao, parte = declaracao) {
    const conta = conferirDeclaracao(declaracao, PERFIS.superficie, `a superfície «${s.id}»`);
    s.declaracao = JSON.parse(JSON.stringify(declaracao));
    s.campos = conta.camposPorChave;
    // **O inicial, como o produto o guarda** (`marcarValidade`, em
    // `mods-regiao.js`): o declarado, quando há; senão, o valor da primeira
    // montagem do campo, que não muda depois. E o campo declarado de novo volta
    // a mostrar o valor declarado.
    for (const no of camposDe(parte)) {
      if (!s.primeiros.has(no.chave)) s.primeiros.set(no.chave, comoTexto(no, no.valor));
      s.tocados.delete(no.chave);
    }
  }

  const superficiesDaApi = Object.freeze({
    criar: async descricao => pedir('superficie-criar', { descricao }, async () => {
      const s = criarSuperficie(descricao);
      const id = s.id;
      const viva = () => {
        const atual = superficies.get(id);
        if (!atual || atual.descartada) throw recusa('superficie-desconhecida', { superficie: id });
        return atual;
      };
      return Object.freeze({
        id,
        montar: arvore => pedir('superficie-montar', { superficie: id, arvore }, async () => {
          const atual = viva(); aplicar(atual, arvore); atual.montagens += 1;
          atual.historico.push({ chave: null, arvore: JSON.parse(JSON.stringify(arvore)) });
        }),
        atualizar: (chave, arvore) => pedir('superficie-atualizar', { superficie: id, chave, arvore }, async () => {
          const atual = viva();
          const lugar = lugarDaChave(atual.declaracao, chave);
          if (!lugar) throw recusa('chave-desconhecida', { chave });
          lugar.pai[lugar.campo] = JSON.parse(JSON.stringify(arvore));
          aplicar(atual, lugar.caixa.arvore, arvore);
          atual.atualizacoes += 1;
          atual.historico.push({ chave, arvore: JSON.parse(JSON.stringify(arvore)) });
        }),
        formulario: Object.freeze({
          erros: mapa => pedir('formulario-erros', { superficie: id, erros: mapa }, async () => {
            const atual = viva();
            for (const chave of Object.keys(mapa ?? {})) if (!atual.campos.has(chave)) throw recusa('chave-desconhecida', { chave });
            atual.erros = { ...mapa };
          }),
        }),
        classes: mapa => pedir('superficie-classes', { superficie: id, classes: mapa }, async () => { viva().classes = mapa; }),
        mostrar: () => pedir('superficie-mostrar', { superficie: id }, async () => {
          const atual = viva();
          if (atual.tipo === 'folha' && !atual.visivel && visiveisDoTipo('folha') >= LIMITES.folhas) throw recusa('teto-de-folhas', { teto: LIMITES.folhas });
          atual.visivel = true;
        }),
        ocultar: () => pedir('superficie-ocultar', { superficie: id }, async () => { viva().visivel = false; }),
        suja: valor => pedir('superficie-suja', { superficie: id, suja: valor !== false }, async () => { viva().suja = valor !== false; }),
        titulo: texto => pedir('superficie-titulo', { superficie: id, titulo: texto }, async () => { viva().titulo = String(texto ?? ''); }),
        fechar: motivo => pedir('superficie-fechar', { superficie: id, motivo }, async () => {
          const atual = viva(); atual.visivel = false;
          Promise.resolve().then(() => janela.emitir({ nome: 'fechar', superficie: id, porque: motivo ?? 'mod' }));
        }),
        descartar: () => pedir('superficie-descartar', { superficie: id }, async () => { viva().descartada = true; }),
      });
    }),
    avisar: (texto, tom) => pedir('superficie-criar', { descricao: { id: 'aviso-' + (++serie), tipo: 'aviso', titulo: String(texto ?? ''), tom } },
      async () => { avisos.push({ texto: String(texto ?? ''), tom: tom ?? 'normal' }); return { superficie: 'aviso', reaproveitada: false }; }),
  });

  function conferirContribuicao(ponto, conteudo) {
    const [perfil] = PERFIL_DO_PONTO[ponto];
    if (perfil && conteudo !== undefined && conteudo !== null) {
      conferirDeclaracao(conteudo, PERFIS[perfil], `a contribuição em «${ponto}»`);
    }
  }

  const contribuicoesDaApi = Object.freeze({
    registrar: pedido => pedir('contribuir', { pedido }, async () => {
      const ponto = String(pedido?.ponto ?? '');
      const modo = String(pedido?.modo ?? 'adicionar');
      if (!PONTOS[ponto]) throw recusa('ponto-desconhecido', { ponto });
      if (!PONTOS[ponto].includes(modo)) throw recusa('modo-recusado', { ponto, modo });
      if (opcoes.recusarPontos?.includes(ponto)) throw recusa('teto-de-contribuicoes');
      const [, porAlvo] = PERFIL_DO_PONTO[ponto];
      const alvo = porAlvo ? String(pedido?.alvo ?? '') : '';
      for (const c of contribuicoes.values()) {
        if (c.ponto === ponto && c.modo === modo && c.alvo === alvo) throw recusa('contribuicao-ja-existe');
      }
      const semAlvo = [...contribuicoes.values()].filter(c => !PERFIL_DO_PONTO[c.ponto][1]).length;
      if (!porAlvo && semAlvo >= contrato.contribuicoes.teto) throw recusa('teto-de-contribuicoes');
      conferirContribuicao(ponto, pedido.conteudo);
      const handle = 'c' + (++serie);
      contribuicoes.set(handle, { ...JSON.parse(JSON.stringify(pedido)), handle, ponto, modo, alvo, atualizacoes: 0 });
      // A região que a casca não tem: a contribuição fica registrada, e o MOD
      // recebe o evento (`regiaoAusente`, em `base.js`), uma vez.
      if (ausentes.has(ponto)) {
        Promise.resolve().then(() => janela.emitir({ nome: 'contribuicao', ponto, destino: alvo, motivo: 'regiao-ausente' }));
      }
      return { handle };
    }),
    atualizar: (handle, conteudo) => pedir('atualizar-contribuicao', { handle, conteudo }, async () => {
      const c = contribuicoes.get(handle);
      // O registro devolve `false` a um punho que não está de pé.
      if (!c) return false;
      conferirContribuicao(c.ponto, conteudo);
      c.conteudo = JSON.parse(JSON.stringify(conteudo));
      c.atualizacoes += 1;
      return true;
    }),
    revogar: handle => pedir('revogar-contribuicao', { handle }, async () => contribuicoes.delete(handle)),
  });

  const sandbox = {
    console: { log() {}, info() {}, debug() {}, warn: (...a) => erros.push(a.join(' ')), error: (...a) => erros.push(a.join(' ')) },
    setTimeout: (fn, ms) => { relogios.push({ fn, ms }); return relogios.length; },
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    SeeleMods: Object.freeze({
      request: (id, canal, valor) => pedir('pedido', { id, canal, valor }, async () => {
        assert.equal(id, manifesto.id, 'o MOD pediu em nome de outro');
        pedidos.push({ canal, valor: JSON.parse(JSON.stringify(valor)) });
        // Os ganchos do caso: a rede que demora, e o que outra pessoa escreve
        // enquanto este pedido anda.
        if (servidor.atraso) await servidor.atraso(pessoa, canal, valor);
        if (servidor.antesDePedir) servidor.antesDePedir(pessoa, canal, valor);
        const resposta = servidor.pedir(pessoa, canal, valor);
        // A resposta que demora a voltar: ela fala do servidor de quando ele
        // respondeu, e pode chegar depois de outra mais nova.
        if (servidor.atrasoDaResposta) await servidor.atrasoDaResposta(pessoa, canal, valor);
        return resposta;
      }),
    }),
    SeeleUI: Object.freeze({
      tema: async () => { throw recusa('sem-previa'); },
      retrato: async () => JSON.parse(JSON.stringify(retrato)),
      superficies: superficiesDaApi,
      contribuicoes: contribuicoesDaApi,
      capacidades: () => contrato.compatibilidade['capacidades-por-versao']['6']
        .filter(c => !(semEnviar && c === 'volume') && !(semArquivo && c === 'arquivo')),
      aoEvento: fn => { ouvinte = typeof fn === 'function' ? fn : null; },
      ...(semEnviar ? {} : {
        enviar: (arquivo, token) => pedir('enviar-imagem', { arquivo, token }, async () => {
          const escolhido = escolhidos.get(arquivo);
          if (!escolhido) throw recusa('sem-espera');
          servidor.enviar(pessoa, token, escolhido.bytes);
        }),
      }),
      ...(semArquivo ? {} : {
        pedaco: async () => { throw recusa('nao-usado'); },
        soltar: arquivo => pedir('soltar-arquivo', { arquivo }, async () => { escolhidos.delete(arquivo); }),
      }),
    }),
  };
  const escolhidos = new Map();
  vm.createContext(sandbox);

  const janela = {
    pessoa, retrato, superficies, contribuicoes, avisos, recusas, erros, pedidos, mensagens, relogios, escolhidos,
    /** O que a pessoa faz, ou o que a tela muda: um evento como o produto o manda. */
    emitir(evento) {
      assert.ok(EVENTOS.has(evento.nome), `evento que a API 6 não tem: «${evento.nome}»`);
      assert.ok(ouvinte, 'o MOD não registrou ouvinte de evento');
      // O que a pessoa muda num campo fica na caixa dele até o MOD declará-lo de novo.
      if (['campo', 'numero', 'escolha', 'marca'].includes(evento.nome)) {
        for (const s of superficies.values()) {
          const no = s.descartada ? null : camposDe(s.declaracao).find(c => c.chave === evento.chave);
          if (no) s.tocados.set(no.chave, comoTexto(no, evento.valor));
        }
      }
      ouvinte(JSON.parse(JSON.stringify(evento)));
    },
    receberAviso(aviso) {
      if (!ouvinte) return;
      Promise.resolve().then(() => ouvinte({ nome: 'servidor', canal: aviso.canal ?? null, carga: aviso.carga }));
    },
    /** Abre outro canal de texto: o retrato muda e o evento `canal` sai. */
    abrirCanal(id) {
      for (const c of retrato.canais) c.aberto = c.id === id;
      janela.emitir({ nome: 'canal', canal: id });
    },
    /** Entra numa sala de voz: a presença do servidor e o retrato mudam, e `sala` sai. */
    entrarNaSala(id) {
      servidor.salas.set(pessoa, id);
      for (const s of retrato.salas) s.minha = s.id === id;
      janela.emitir({ nome: 'sala', sala: id });
    },
    sairDaSala() {
      servidor.salas.delete(pessoa);
      for (const s of retrato.salas) s.minha = false;
      janela.emitir({ nome: 'sala', sala: null });
    },
    /** O tamanho do lugar, como `dizerOTamanhoDoPalco` ou o redesenho da sessão o dizem. */
    lugar(largura, altura, regiao) {
      janela.emitir({ nome: 'lugar', onde, regioes: retrato.regioes, largura, altura, ...(regiao ? { regiao } : {}) });
    },
    /** A pessoa escolheu um arquivo no seletor do sistema. */
    escolher(chave, tamanho, tipo = 'image/png') {
      const id = escolhidos.size + 1;
      escolhidos.set(id, { bytes: tamanho });
      janela.emitir({ nome: 'arquivo', chave, arquivo: { id, tipo, papel: 'imagem', bytes: tamanho }, resultado: 'escolhido' });
      return id;
    },
    /**
     * **O produto recusa a próxima mensagem deste tipo**, com o nome e os
     * campos da recusa (`{ erro: 'nos-recusados', recusados, amostra }`). É
     * como o caso exercita uma recusa que o laboratório não teria por que
     * produzir sozinho.
     */
    recusarProxima(tipo, recusa) {
      if (!recusasPedidas.has(tipo)) recusasPedidas.set(tipo, []);
      recusasPedidas.get(tipo).push(recusa);
    },
    /** O tocador do produto avisou: `tocando`, `pausada`, `terminou` ou `recusada`. */
    midia(chave, estado, porque) {
      janela.emitir({ nome: 'midia', chave, estado, ...(porque ? { porque } : {}) });
    },
    /** Quem usa apertou um botão (o produto já confirmou, se havia `confirmar`). */
    apertar(chave) { janela.emitir({ nome: 'botao', chave }); },
    /** Quem usa mandou um formulário: o produto já conferiu as regras declaradas. */
    submeter(superficie, chave, valores) {
      const s = superficies.get(superficie);
      assert.ok(s && s.visivel && !s.descartada, `a superfície «${superficie}» não está à vista`);
      const form = janela.controles(superficie).get(chave);
      assert.ok(form && form.forma === 'formulario', `«${superficie}» não tem o formulário «${chave}»`);
      // O que o produto mandaria: o valor declarado de cada campo, sobre o que
      // a pessoa mudou.
      const todos = {};
      const andar = no => {
        if (!no || typeof no !== 'object') return;
        if (Array.isArray(no)) { no.forEach(andar); return; }
        if (CAMPOS.has(no.forma) && no.chave) todos[no.chave] = no.valor ?? (no.forma === 'marca' || no.forma === 'interruptor' ? false : '');
        andar(no.dentro);
      };
      andar(form.dentro);
      for (const k of Object.keys(valores)) assert.ok(k in todos, `o formulário «${chave}» não tem o campo «${k}»`);
      janela.emitir({ nome: 'submeter', chave, valores: { ...todos, ...valores } });
    },
    /**
     * **A superfície está suja?** Como `temAlteracoes` no produto: o MOD
     * disse `suja`, ou algum campo mostra outra coisa que o inicial dele. Suja,
     * todo pedido de fechar vira a pergunta «fechar sem gravar?».
     */
    suja(id) {
      const s = superficies.get(id);
      assert.ok(s && !s.descartada, `a superfície «${id}» não está de pé`);
      if (s.suja) return true;
      return camposDe(s.declaracao).some(no => {
        const atual = s.tocados.has(no.chave) ? s.tocados.get(no.chave) : comoTexto(no, no.valor);
        const inicial = Object.hasOwn(no, 'inicial') ? comoTexto(no, no.inicial) : s.primeiros.get(no.chave);
        return atual !== inicial;
      });
    },
    /** O que uma regra declarada do produto diria do valor, ou `''`. */
    regraViolada(superficie, chave, valor) {
      const no = janela.controles(superficie).get(chave);
      assert.ok(no, `«${superficie}» não tem o campo «${chave}»`);
      const texto = valor === null || valor === undefined ? '' : String(valor);
      if (no.obrigatorio === true && texto.trim() === '') return 'Preencha este campo.';
      if (no.forma === 'numero' && texto !== '') {
        const n = Number(texto);
        if (no.inteiro === true && !Number.isInteger(n)) return 'Use um número inteiro.';
        if ((no.minimo !== undefined && n < no.minimo) || (no.maximo !== undefined && n > no.maximo)) return 'fora do intervalo';
      }
      if (no.tamanhoMaximo !== undefined && [...texto].length > no.tamanhoMaximo) return 'longo demais';
      return '';
    },
    /** A última declaração de uma superfície, ou `null`. */
    superficie: id => superficies.get(id)?.declaracao ?? null,
    /** Os nós com chave de uma superfície, por chave. */
    controles(id) {
      const achados = new Map();
      const andar = no => {
        if (!no || typeof no !== 'object') return;
        if (Array.isArray(no)) { no.forEach(andar); return; }
        if (no.chave) achados.set(no.chave, no);
        andar(no.dentro);
      };
      andar(janela.superficie(id));
      return achados;
    },
    /** O texto de uma superfície ou contribuição, para procurar uma frase. */
    texto: id => JSON.stringify(janela.superficie(id)),
    contribuicao: ponto => [...contribuicoes.values()].find(c => c.ponto === ponto) ?? null,
  };
  servidor.janelas.add(janela);
  vm.runInContext(fonteDoCliente, sandbox, { timeout: 2000 });
  return janela;
}

/**
 * Espera as idas e voltas assentarem: cada pedido é uma promessa, e cada
 * resposta sai numa volta do laço. Para quando nada anda por dez voltas.
 */
async function assentar() {
  let visto = -1, quietas = 0;
  for (let i = 0; i < 20000 && quietas < 10; i += 1) {
    await new Promise(r => setImmediate(r));
    if (atividade === visto) quietas += 1;
    else { quietas = 0; visto = atividade; }
  }
}

module.exports = { contrato, manifesto, criarServidor, criarJanela, assentar, bytes, conferirDeclaracao, PERFIS };
