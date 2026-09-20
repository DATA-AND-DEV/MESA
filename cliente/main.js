/* Gerado por ferramentas/build.mjs. API 3. */
(() => {
"use strict";
// Executado exclusivamente no executor do MOD. Cada pacote inclui sua cópia.
//
// A casca dos MODs oficiais: o que os três fazem igual, num lugar só.
//
// # O que mudou com a API 4
//
// A casca da API 3 sabia desenhar **uma região** — a faixa de 240 px que a
// auditoria de 20/09/2026 chamou de «o mesmo formulário estreito para
// atividades diferentes». Ela sabia receber evento, redesenhar na hora e
// guardar rascunho, e isso continua valendo.
//
// O que ela não sabia era **abrir**. Não havia gesto para começar uma
// atividade: os três MODs desenhavam ao conectar porque a região era o único
// lugar onde eles podiam existir.
//
// Agora ela sabe mais três coisas:
//
// - **registrar uma entrada.** `entrada()` põe um nome na navegação do
//   servidor; ele não ocupa altura nenhuma até alguém apertá-lo;
// - **abrir uma superfície.** `pagina()`, `painel()` e `dialogo()` devolvem
//   punhos com `montar`, `fechar` e estado de alteração;
// - **apresentar dentro do SEELE.** `contribuir()` registra um ponto
//   semântico — o cartão de uma pessoa, por exemplo — e devolve o handle que
//   o revoga.
//
// # A degradação é explícita
//
// `SeeleUI.superficies` **não existe** quando o pacote declara `api: 3`. Não é
// um método que falha: é um método ausente, e o `TypeError` acontece na linha
// que o chama. `temSuperficies` é como um MOD pergunta antes, quando quer
// degradar em vez de falhar.
function interfaceMod(id, titulo, intervalo = 4000) {
  const api = globalThis.SeeleMods, ui = globalThis.SeeleUI;
  if (!api || !ui) throw new Error('Este MOD exige a API 3 do SEELE.');

  // ---- as formas da API 3 ----
  const texto = dentro => ({ forma: 'texto', dentro: String(dentro ?? '') });
  const cabecalho = dentro => ({ forma: 'titulo', dentro: String(dentro ?? '') });
  const lista = itens => ({ forma: 'lista', dentro: itens.map(dentro => ({ forma: 'item', dentro: String(dentro) })) });
  const campo = (chave, rotulo, valor, extra) => ({ forma: 'campo', chave, rotulo, valor: String(valor ?? ''), ...extra });
  const escolha = (chave, rotulo, valor, opcoes) => ({ forma: 'escolha', chave, rotulo, valor: String(valor ?? ''), opcoes });
  const botao = (chave, dentro, desligado = false, extra) => ({ forma: 'botao', chave, dentro: String(dentro), desligado, ...extra });
  const linha = (dentro, estilo) => ({ forma: 'linha', dentro, ...(estilo ? { estilo } : {}) });

  // ---- as formas de composição da API 4 ----
  //
  // Elas existem para o MOD montar **os componentes dele**. Um perfil com
  // faixa, retrato sobreposto e nome não é um formulário mais largo; é uma
  // caixa dentro de outra, com posição, recorte e camada.
  //
  // **`estilo` e `extra` são argumentos separados, e isso não é arrumação.**
  // `classe`, `chave` e `nomeAcessivel` são do **nó**; `fundo` e `intervalo`
  // são do estilo dele. Misturá-los num objeto só faria `classe: 'editor'`
  // virar uma propriedade de estilo que o validador do produto recusa — e a
  // recusa chegaria como «a superfície não montou», sem dizer qual chave.
  const caixa = (dentro, estilo, extra) => ({ forma: 'caixa', dentro, ...(estilo ? { estilo } : {}), ...extra });
  const pilha = (dentro, estilo, extra) => ({ forma: 'pilha', dentro, ...(estilo ? { estilo } : {}), ...extra });
  const grade = (dentro, estilo, extra) => ({ forma: 'grade', dentro, ...(estilo ? { estilo } : {}), ...extra });
  const rolagem = (dentro, estilo, extra) => ({ forma: 'rolagem', dentro, ...(estilo ? { estilo } : {}), ...extra });
  const separador = (estilo, extra) => ({ forma: 'separador', ...(estilo ? { estilo } : {}), ...extra });
  const espaco = (estilo, extra) => ({ forma: 'espaco', ...(estilo ? { estilo } : {}), ...extra });

  // ---- os controles da API 4 ----
  const formulario = (chave, dentro, extra) => ({ forma: 'formulario', chave, dentro, ...extra });
  const acoes = (dentro, fixas = false) => ({ forma: 'acoes', dentro, ...(fixas ? { fixas: true } : {}) });
  const abas = (chave, valor, dentro) => ({ forma: 'abas', chave, valor, dentro });
  const aba = (chave, rotulo, dentro) => ({ forma: 'aba', chave, rotulo, dentro });
  const textoLongo = (chave, rotulo, valor, extra) => ({ forma: 'textoLongo', chave, rotulo, valor: String(valor ?? ''), ...extra });
  const numero = (chave, rotulo, valor, extra) => ({ forma: 'numero', chave, rotulo, valor, ...extra });
  const deslizante = (chave, rotulo, valor, extra) => ({ forma: 'deslizante', chave, rotulo, valor, ...extra });
  const marca = (chave, rotulo, valor) => ({ forma: 'marca', chave, rotulo, valor: valor === true });
  const interruptor = (chave, rotulo, valor) => ({ forma: 'interruptor', chave, rotulo, valor: valor === true });
  const cor = (chave, rotulo, valor) => ({ forma: 'cor', chave, rotulo, valor: String(valor ?? '#000000') });
  const retrato = (chave, extra) => ({ forma: 'retrato', chave, ...extra });
  const distintivo = (dentro, estilo) => ({ forma: 'distintivo', dentro, ...(estilo ? { estilo } : {}) });
  const link = (chave, dentro, endereco) => ({ forma: 'link', chave, dentro: String(dentro), endereco });
  const arquivo = (chave, dentro, extra) => ({ forma: 'arquivo', chave, dentro: String(dentro), ...extra });
  const midia = (chave, extra) => ({ forma: 'midia', chave, ...extra });

  const canalDe = snapshot => {
    const id = snapshot.open_channel ?? snapshot.channels?.[0]?.id;
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  async function request(canal, valor) {
    const resposta = await api.request(id, canal, valor);
    if (!resposta?.ok) throw new Error(resposta?.error || 'O servidor recusou a consulta.');
    return resposta;
  }

  // O último canal visto, para um evento saber a quem falar sem perguntar de
  // novo: `snapshot` é uma ida à ponte, e um arraste não pode pagar uma por
  // quadro.
  let canalAtual = null;
  let pintando = false;
  let pendente = null;

  /**
   * Uma pintura de cada vez, e **nenhuma perdida**.
   *
   * Dois `regiao` em voo chegariam fora de ordem, e o desenho de trás apagaria
   * o da frente — por isso a segunda espera. Mas a primeira versão **descartava**
   * a segunda, e dois eventos seguidos (escolher a densidade e a fonte, no mesmo
   * quadro) perdiam o desenho do segundo: a tela ficava mostrando a escolha
   * anterior, e só o relógio a corrigia, quatro segundos depois.
   *
   * Guardar a última e pintá-la ao fim da que está em voo é o que resolve. É a
   * mesma forma do aviso que chega durante uma colheita: o que não cabe agora
   * não se joga fora, fica marcado.
   */
  const desenhar = async partes => {
    if (pintando) { pendente = partes; return; }
    pintando = true;
    try {
      let atual = partes;
      for (;;) {
        pendente = null;
        await ui.regiao([cabecalho(titulo), ...atual]);
        if (!pendente) return;
        atual = pendente;
      }
    } finally {
      pintando = false;
    }
  };

  // ---- as superfícies ----
  //
  // **Ausente, e não recusado.** Quando o pacote declara `api: 3`, o prelúdio
  // monta um `SeeleUI` em que `superficies` simplesmente não está. Um MOD que
  // queira degradar pergunta por `temSuperficies` antes; um que não pergunte
  // recebe um `TypeError` na linha que chamou, com pilha, em vez de uma
  // promessa que rejeita com um código.
  const temSuperficies = Boolean(ui.superficies);
  const temContribuicoes = Boolean(ui.contribuicoes);

  /**
   * Abre (ou reabre) uma superfície e devolve o punho dela.
   *
   * Reabrir **não recria**: chamar com o mesmo `id` mostra a que já existe, e
   * o que estava escrito nos campos dela continua lá. É a diferença entre
   * «mostre aquela» e «comece de novo», e um MOD que quisesse a segunda
   * `descarta` a primeira.
   */
  async function superficie(descricao) {
    if (!temSuperficies) throw new Error('Este SEELE não oferece superfícies de MOD.');
    return ui.superficies.criar(descricao);
  }

  const pagina = (chaveDaTela, titulo, extra) =>
    superficie({ id: chaveDaTela, tipo: 'pagina', titulo, ...extra });
  const painel = (chaveDaTela, titulo, extra) =>
    superficie({ id: chaveDaTela, tipo: 'painel', titulo, ...extra });
  const dialogo = (chaveDaTela, titulo, extra) =>
    superficie({ id: chaveDaTela, tipo: 'dialogo', modal: true, titulo, ...extra });

  /** Um aviso curto. A fila dele tem fim; ver `enfileirarAviso` no produto. */
  const avisar = (mensagem, tom) => {
    if (!temSuperficies) return Promise.resolve(null);
    return ui.superficies.avisar(mensagem, tom);
  };

  /** Registra uma contribuição e devolve o handle que a revoga. */
  const contribuir = pedido => {
    if (!temContribuicoes) throw new Error('Este SEELE não oferece contribuições de MOD.');
    return ui.contribuicoes.registrar(pedido);
  };
  const revogar = handle => {
    if (!temContribuicoes) return Promise.resolve(false);
    return ui.contribuicoes.revogar(handle);
  };

  /**
   * Uma entrada na navegação do servidor.
   *
   * **U03 pelo nome**: sem ela, o MOD não tem gesto de abertura, e desenhar ao
   * conectar é a única forma de existir. Com ela, a atividade começa quando a
   * pessoa a escolhe.
   */
  const entrada = (rotulo, acao = 'abrir', extra) => contribuir({
    ponto: 'servidor.navegacao',
    modo: 'adicionar',
    rotulo,
    acaoPrincipal: acao,
    ...extra,
  });

  function iniciar(consultar, semCanal = async () => {}, aoEvento = null) {
    /**
     * Redesenha com o que o estado local diz **agora**.
     *
     * É o que um evento chama. Ele não vai ao servidor: quem digita espera a
     * letra aparecer, e não esperar a rede.
     */
    const repintar = partes => { void desenhar(partes); };

    if (aoEvento) {
      ui.aoEvento(evento => {
        // O erro do MOD fica com o MOD, e é dito na região em vez de sumir.
        try {
          const talvez = aoEvento(evento, canalAtual, repintar);
          if (talvez && typeof talvez.catch === 'function') {
            talvez.catch(erro => void desenhar([texto('Falhou: ' + (erro.message || String(erro)))]));
          }
        } catch (erro) {
          void desenhar([texto('Falhou: ' + (erro.message || String(erro)))]);
        }
      });
    }

    async function atualizar() {
      try {
        const snapshot = await api.snapshot(), canal = canalDe(snapshot);
        canalAtual = canal;
        if (canal === null) {
          await semCanal();
          await desenhar([texto('Entre em um servidor com um canal de texto.')]);
        } else {
          const resultado = await consultar(snapshot, canal);
          // Não apresente uma resposta do canal anterior após a navegação.
          if (canalDe(await api.snapshot()) === canal) await desenhar(resultado);
          else await desenhar([texto('Canal alterado. Atualizando…')]);
        }
      } catch (erro) {
        try { await desenhar([texto('Não foi possível atualizar: ' + (erro.message || String(erro)))]); }
        catch (falha) { console.error(titulo + ': ' + (falha.message || String(falha))); }
      } finally {
        // Agenda depois de concluir: nunca sobrepõe consultas nem repete
        // escritas. O SEELE encerra o executor e seus temporizadores ao sair.
        setTimeout(atualizar, intervalo);
      }
    }
    void atualizar();
  }

  return {
    // API 3
    texto, cabecalho, lista, campo, escolha, botao, linha, arquivo, midia,
    request, iniciar, desenhar,
    // API 4 — composição
    caixa, pilha, grade, rolagem, separador, espaco,
    // API 4 — controle
    formulario, acoes, abas, aba, textoLongo, numero, deslizante,
    marca, interruptor, cor,
    // API 4 — apresentação
    retrato, distintivo, link,
    // API 4 — superfícies e integração
    temSuperficies, temContribuicoes,
    superficie, pagina, painel, dialogo, avisar,
    contribuir, revogar, entrada,
  };
}

// A MESA: o tabuleiro, as peças que se arrastam, os dados e a iniciativa.
//
// A versão anterior **listava** o tabuleiro — «Grade: 20 × 14» e uma linha por
// peça com a posição dela — e dizia que «criação, edição, rolagens, tabuleiro
// interativo, imagens e áudio aguardam suporte da API do SEELE». Uma mesa de
// jogo que não se joga.
//
// Com a API 3 completa o tabuleiro é uma `tela` com **figuras declaradas**: a
// grade, as paredes, a imagem da cena e uma peça por ficha. Arrastar uma peça
// manda `token-move`, e é o servidor que decide se quem arrastou podia — este
// lado não tem autoridade nenhuma e não finge ter.
//
// Enviar o mapa de uma cena voltou junto: a pessoa aperta, o seletor é do
// sistema, e este MOD recebe um identificador — não um caminho. Os bytes saem
// do produto em pedaços e entram pelo `image-part` que o servidor já tinha.
//
// A gestão também: criar campanha, criar e salvar cena, criar ficha, pôr peça,
// mexer em vida e condições, e a ordem de iniciativa.

const {
  texto, cabecalho, lista, campo, escolha, botao, linha, arquivo, midia,
  caixa, pilha, grade, separador, espaco,
  acoes, abas, aba, formulario, textoLongo, numero, distintivo,
  request, iniciar, temSuperficies, temContribuicoes,
  pagina, dialogo, contribuir, entrada, avisar,
} = interfaceMod('seele/mesa', 'MESA', 2000);

/** A aba aberta na página da mesa. */
let abaAberta = 'tabuleiro';
/** Os punhos das superfícies de pé. */
const telas = { mesa: null, criar: null };
/** A entrada de navegação já foi registrada nesta sessão? */
let entradaRegistrada = false;

/** O lado de uma célula na tela, em pixels. */
const CELULA = 26;
/** O maior lado de tela que o produto monta. */
const LADO_MAXIMO = 1024;

let ultimo = null;
let aviso = '';
let formula = '1d20';
/** O que está sendo escrito nos campos de criação e edição. */
const rascunho = { campanha: '', cena: '', ficha: '', peca: '', dano: '', entrada: '',
  // O sistema e o mestre da campanha a criar. A versão anterior da MESA os
  // oferecia; a migração passou a fixar `free` e «quem apertou», e ninguém
  // decidiu isso — ficou por omissão.
  sistema: 'free', gm: '' };
/** A ficha sendo editada, campo a campo, até alguém gravar. */
let fichaEmEdicao = null;
/** Pintar parede em vez de arrastar peça: a mesma tela, dois modos. */
let modoParede = false;

/** Os sistemas que este servidor aceita em `setup`. */
const SISTEMAS = [
  { valor: 'free', dentro: 'LIVRE' },
  { valor: 'dnd5e-2014', dentro: 'D&D 5E (2014)' },
];

/** As trilhas que o servidor conhece. `inherit` é «o que a cena disser». */
const TRILHAS = [
  { valor: 'silence', dentro: 'SILÊNCIO' },
  { valor: 'exploration', dentro: 'EXPLORAÇÃO' },
  { valor: 'mystery', dentro: 'MISTÉRIO' },
  { valor: 'battle', dentro: 'COMBATE' },
];

/**
 * A trilha de cada ambiente, como arquivo **deste pacote**.
 *
 * A auditoria de 20/09/2026 anotou o vão: «As escolhas de trilha alteram
 * estado no servidor, mas o cliente atual não declara tocador de som nem
 * sintetizador equivalente ao anterior.» O estado ia e ninguém ouvia nada.
 *
 * Os arquivos vêm no pacote e são declarados no `mod.json` — um som que o
 * manifesto não nomeia não é servido, e essa é a regra que impede um MOD de
 * tocar bytes que ninguém reviu. São laços curtos e de baixa taxa de
 * amostragem: ambientação, e não acervo. `silence` não tem arquivo porque
 * silêncio não é um som.
 */
const TRILHAS_EM_ARQUIVO = {
  exploration: 'som/exploracao.wav',
  mystery: 'som/misterio.wav',
  battle: 'som/combate.wav',
};

/** Os tipos de ação e as recuperações que o servidor conhece. */
const TIPOS_DE_ACAO = [
  { valor: 'action', dentro: 'AÇÃO' },
  { valor: 'bonus', dentro: 'BÔNUS' },
  { valor: 'reaction', dentro: 'REAÇÃO' },
  { valor: 'free', dentro: 'LIVRE' },
];
const RECUPERACOES = [
  { valor: 'manual', dentro: 'MANUAL' },
  { valor: 'long', dentro: 'DESCANSO LONGO' },
];

/** A ação sendo criada ou editada, e o verbete idem. */
let acaoEmEdicao = null;
let verbeteEmEdicao = null;
/** A cena sendo ajustada: grade, descrição e notas. */
let cenaEmEdicao = null;

/** Os seis atributos, na ordem de sempre. */
const ATRIBUTOS = [['str', 'FOR'], ['dex', 'DES'], ['con', 'CON'], ['int', 'INT'], ['wis', 'SAB'], ['cha', 'CAR']];
/** Qual ficha está aberta para edição, e qual cena para ajuste. */
let fichaAberta = null;
/** Quanto cabe num fragmento de imagem deste servidor. */
const FRAGMENTO = 7000;
/** A peça sendo arrastada e onde ela está agora, para a tela acompanhar. */
let arrastando = null;

const nomeDe = id => {
  const pessoa = ultimo?.presentes?.find(p => String(p.id) === String(id));
  return pessoa?.nickname || pessoa?.apelido || 'Pessoa ' + id;
};

/** Quem está aqui, na forma que uma `escolha` aceita. */
const pessoasComoOpcoes = () =>
  (ultimo?.presentes ?? []).map(p => ({
    valor: String(p.id),
    dentro: p.nickname || p.apelido || ('Pessoa ' + p.id),
  }));

const cenaAtiva = campanha =>
  campanha.scenes.find(c => c.id === campanha.active) ?? null;

/** Onde uma peça está agora: o arraste em curso manda, senão o servidor. */
const ondeEsta = peca =>
  arrastando && arrastando.id === peca.id
    ? { x: arrastando.x, y: arrastando.y }
    : { x: peca.x, y: peca.y };

/**
 * O tabuleiro: grade, paredes e peças, tudo declarado.
 *
 * As peças vêm **por último** de propósito: a última figura declarada é a que o
 * toque encontra primeiro, e uma peça em cima de uma parede tem de ser a peça
 * que se pega.
 */
function tabuleiro(cena) {
  const largura = Math.min(cena.cols * CELULA, LADO_MAXIMO);
  const altura = Math.min(cena.rows * CELULA, LADO_MAXIMO);
  const figuras = [];
  // **O mapa é o fundo desta tela, e não uma imagem ao lado dela.**
  //
  // A auditoria de 20/09/2026 anotou: «O mapa é montado como mídia separada do
  // canvas, em vez de fundo sob as peças.» Um `<img>` ao lado de um `<canvas>`
  // é um mapa que não tem relação nenhuma com onde as peças estão — as
  // coordenadas ficam em dois planos que ninguém alinha.
  const fundo = cena.asset
    ? {
      doServidor: {
        canal: ultimo.canal,
        pedido: { op: 'asset', scene: cena.id },
        campo: 'image',
      },
    }
    : null;

  // A grade. Linhas não são pegas — elas são régua, e pegá-las roubaria o toque
  // de toda peça em cima delas.
  for (let c = 0; c <= cena.cols; c += 1) {
    figuras.push({ tipo: 'linha', x: c * CELULA, y: 0, ate_x: c * CELULA, ate_y: altura, cor: '#241f19' });
  }
  for (let l = 0; l <= cena.rows; l += 1) {
    figuras.push({ tipo: 'linha', x: 0, y: l * CELULA, ate_x: largura, ate_y: l * CELULA, cor: '#241f19' });
  }
  for (const parede of cena.walls ?? []) {
    figuras.push({
      tipo: 'retangulo', x: parede.x * CELULA, y: parede.y * CELULA,
      largura: CELULA, altura: CELULA, cor: '#3a322a',
    });
  }
  for (const peca of cena.tokens ?? []) {
    const { x, y } = ondeEsta(peca);
    figuras.push({
      tipo: 'circulo', chave: 'peca:' + peca.id,
      x: x * CELULA + CELULA / 2, y: y * CELULA + CELULA / 2,
      raio: CELULA / 2 - 3, cor: peca.hidden ? '#908574' : '#f2521f',
    });
    figuras.push({
      tipo: 'texto', x: x * CELULA + 2, y: y * CELULA + CELULA - 10,
      dentro: (peca.name || '').slice(0, 6), corpo: 9, cor: '#eae3cf',
    });
  }
  return {
    forma: 'tela', chave: 'tabuleiro', largura, altura, figuras,
    ...(fundo ? { fundo } : {}),
  };
}

function oTabuleiro(campanha) {
  const cena = cenaAtiva(campanha);
  if (!cena) return [texto('Nenhuma cena em cima da mesa.')];
  const partes = [cabecalho(cena.name)];
  if (cena.kind === 'map') {
    // A imagem da cena vem da metade de servidor deste MOD e entra **dentro**
    // da tela, sob as peças. Ver `tabuleiro`.
    partes.push(tabuleiro(cena));
  } else if (cena.asset) {
    // Uma ilustração não é tabuleiro: ela não tem grade nem peça, e por isso
    // continua sendo mídia — só que no lugar dela, e não ao lado de um mapa.
    partes.push(midia('cena:' + cena.id, {
      doServidor: { canal: ultimo.canal, pedido: { op: 'asset', scene: cena.id }, campo: 'image' },
      descricao: 'Ilustração de ' + cena.name,
    }));
  }
  if (cena.description) partes.push(texto(cena.description));
  if (ultimo.isGM && cena.notes) partes.push(texto('Notas do GM: ' + cena.notes));
  return partes;
}

function osControles(campanha) {
  const partes = [
    linha([campo('formula', 'DADOS', formula), botao('rolar', 'ROLAR')]),
  ];
  const cena = cenaAtiva(campanha);
  if (ultimo.isGM) {
    const cenas = campanha.scenes.map(c => ({ valor: String(c.id), dentro: c.name }));
    if (cenas.length) {
      partes.push(escolha('cena', 'CENA EM CIMA DA MESA', String(campanha.active ?? ''), cenas));
    }
    partes.push(linha([
      campo('nova-cena', 'CENA NOVA', rascunho.cena),
      botao('criar-cena', 'CRIAR CENA', !rascunho.cena),
    ]));
    if (cena) {
      partes.push(linha([
        { forma: 'arquivo', chave: 'mapa', dentro: 'ENVIAR MAPA' },
        campo('nova-peca', 'PEÇA NOVA', rascunho.peca),
        botao('criar-peca', 'PÔR PEÇA', !rascunho.peca || cena.kind !== 'map'),
      ]));
      // **Dois modos na mesma tela.** Arrastar move peça; pintar troca parede.
      // Um modo é mais honesto que adivinhar pela figura sob o dedo: quem pinta
      // uma parede quer pintar mesmo onde há peça.
      partes.push(linha([
        botao('modo-parede', modoParede ? 'PARAR DE PINTAR PAREDE' : 'PINTAR PAREDE'),
        escolha('trilha', 'TRILHA DA CENA', cena.ambience ?? 'inherit', [
          { valor: 'inherit', dentro: 'A DA MESA' }, ...TRILHAS,
        ]),
      ]));
    }
    partes.push(escolha('trilha-mesa', 'TRILHA DA MESA', campanha.music?.preset ?? 'silence', TRILHAS));
    partes.push(linha([
      campo('nova-entrada', 'VERBETE NOVO', rascunho.entrada),
      botao('criar-entrada', 'CRIAR VERBETE', !rascunho.entrada),
    ]));
    partes.push(linha([
      campo('nova-ficha', 'FICHA NOVA', rascunho.ficha),
      botao('criar-ficha', 'CRIAR FICHA', !rascunho.ficha),
    ]));
    partes.push(linha([
      botao('iniciativa-proximo', 'PRÓXIMO TURNO', !campanha.initiative.length),
      botao('iniciativa-limpar', 'LIMPAR INICIATIVA', !campanha.initiative.length),
    ]));
  }
  if (aviso) partes.push(texto(aviso));
  return partes;
}

/** A ficha aberta: vida, condições, os campos dela e o retrato. */
function aFichaAberta(campanha) {
  const ficha = campanha.sheets.find(s => s.id === fichaAberta);
  if (!ficha) return [];
  const edit = fichaEmEdicao ?? ficha;
  const mudou = fichaEmEdicao !== null && JSON.stringify(fichaEmEdicao) !== JSON.stringify(ficha);
  const partes = [
    cabecalho('FICHA · ' + ficha.name),
    texto('PV ' + ficha.hp + '/' + ficha.maxHp + ' · CA ' + ficha.ac),
    linha([
      campo('dano', 'QUANTO', rascunho.dano),
      botao('ferir', 'FERIR', !rascunho.dano),
      botao('curar', 'CURAR', !rascunho.dano),
    ]),
    linha([
      botao('condicao-atordoado', ficha.conditions?.includes('stunned') ? 'TIRAR ATORDOADO' : 'ATORDOAR'),
      botao('iniciativa-add', 'PÔR NA INICIATIVA'),
      botao('fechar-ficha', 'FECHAR'),
    ]),
  ];
  if (ficha.portrait) {
    partes.push({
      forma: 'midia', chave: 'retrato:' + ficha.id,
      doServidor: {
        canal: ultimo.canal,
        pedido: { op: 'portrait-asset', sheet: ficha.id },
        campo: 'image',
      },
      descricao: 'Retrato de ' + ficha.name,
    });
  }
  partes.push({ forma: 'arquivo', chave: 'retrato', dentro: 'ENVIAR RETRATO' });

  // **A ficha inteira, e não só a vida.** Editar só os pontos de vida seria
  // outra forma de tela de leitura: o que se muda numa mesa é a ficha.
  partes.push(
    linha([
      campo('f-name', 'NOME', edit.name),
      campo('f-className', 'CLASSE', edit.className ?? ''),
      campo('f-level', 'NÍVEL', edit.level),
    ]),
    linha([
      campo('f-ancestry', 'ANCESTRALIDADE', edit.ancestry ?? ''),
      campo('f-background', 'ANTECEDENTES', edit.background ?? ''),
    ]),
    linha([
      campo('f-hp', 'PV', edit.hp),
      campo('f-maxHp', 'PV MÁXIMO', edit.maxHp),
      campo('f-ac', 'CA', edit.ac),
      campo('f-speed', 'DESLOCAMENTO', edit.speed),
    ]),
    linha(ATRIBUTOS.map(([chave, rotulo]) => campo('a-' + chave, rotulo, edit.abilities?.[chave] ?? 10))),
    campo('f-inventory', 'INVENTÁRIO', edit.inventory ?? ''),
    campo('f-skills', 'PERÍCIAS', edit.skills ?? ''),
    campo('f-notes', 'NOTAS', edit.notes ?? ''),
    linha([
      botao('gravar-ficha', mudou ? 'GRAVAR FICHA' : 'GRAVADA', !mudou),
      botao('descartar-ficha', 'DESCARTAR', !mudou),
      botao('descansar', 'DESCANSO LONGO'),
    ]),
  );

  // **Espaços de magia, nível a nível.** Eles são do jogo, e um VTT que os
  // mostra sem deixar mexer é um VTT em que se anota noutro lugar.
  partes.push(cabecalho('ESPAÇOS DE MAGIA'));
  partes.push(linha((edit.slots ?? []).map((slot, i) => campo(
    's-' + i, 'NÍVEL ' + (i + 1), String(slot.max ?? 0),
  ))));
  partes.push(texto((edit.slots ?? []).map((s, i) =>
    (i + 1) + ': ' + ((s.max ?? 0) - (s.used ?? 0)) + '/' + (s.max ?? 0)).join(' · ')));

  // **Magias preparadas**: quais verbetes do compêndio esta ficha leva, e o
  // botão que gasta um espaço ao conjurar.
  partes.push(cabecalho('MAGIAS PREPARADAS'));
  const preparadas = new Set(edit.spells ?? []);
  for (const entrada of campanha.entries) {
    partes.push(linha([
      texto(entrada.name + ' · nível ' + entrada.level),
      botao('magia-' + entrada.id, preparadas.has(entrada.id) ? 'TIRAR' : 'PREPARAR'),
      ...(preparadas.has(entrada.id) ? [botao('conjurar-' + entrada.id, 'CONJURAR')] : []),
    ]));
  }
  if (!campanha.entries.length) partes.push(texto('O compêndio está vazio.'));

  // **Ações**: o que a ficha faz, com fórmula, usos e recuperação.
  partes.push(cabecalho('AÇÕES'));
  for (const acao of ficha.actions ?? []) {
    partes.push(linha([
      texto(acao.name + ' · ' + acao.kind + (acao.formula ? ' · ' + acao.formula : '')
        + (acao.max ? ' · ' + (acao.max - acao.used) + '/' + acao.max : '')),
      botao('usar-acao-' + acao.id, 'USAR'),
      botao('editar-acao-' + acao.id, 'EDITAR'),
      botao('tirar-acao-' + acao.id, 'TIRAR'),
    ]));
  }
  const acao = acaoEmEdicao;
  partes.push(linha([
    campo('ac-name', 'AÇÃO', acao?.name ?? ''),
    escolha('ac-kind', 'TIPO', acao?.kind ?? 'action', TIPOS_DE_ACAO),
    campo('ac-formula', 'FÓRMULA', acao?.formula ?? ''),
  ]));
  partes.push(linha([
    campo('ac-max', 'USOS', String(acao?.max ?? 0)),
    escolha('ac-recharge', 'RECUPERA', acao?.recharge ?? 'manual', RECUPERACOES),
    campo('ac-description', 'DESCRIÇÃO', acao?.description ?? ''),
    botao('gravar-acao', acao?.id ? 'GRAVAR AÇÃO' : 'CRIAR AÇÃO', !acao?.name),
  ]));
  return partes;
}

/** O compêndio, editável: criar, mudar e publicar um verbete. */
function oCompendio(campanha) {
  if (!ultimo.isGM) return [];
  const e = verbeteEmEdicao;
  return [
    cabecalho('COMPÊNDIO'),
    ...campanha.entries.map(entrada => linha([
      texto(entrada.name + ' · ' + entrada.kind + ' · nível ' + entrada.level
        + (entrada.published ? ' · publicado' : ' · só o GM vê')),
      botao('editar-verbete-' + entrada.id, 'EDITAR'),
      botao('publicar-verbete-' + entrada.id, entrada.published ? 'RECOLHER' : 'PUBLICAR'),
    ])),
    linha([
      campo('v-name', 'VERBETE', e?.name ?? ''),
      campo('v-kind', 'TIPO', e?.kind ?? 'nota'),
      campo('v-level', 'NÍVEL', String(e?.level ?? 0)),
    ]),
    linha([
      campo('v-range', 'ALCANCE', e?.range ?? ''),
      campo('v-cost', 'CUSTO', e?.cost ?? ''),
      campo('v-formula', 'FÓRMULA', e?.formula ?? ''),
    ]),
    linha([
      campo('v-description', 'DESCRIÇÃO', e?.description ?? ''),
      botao('gravar-verbete', e?.id ? 'GRAVAR VERBETE' : 'CRIAR VERBETE', !e?.name),
    ]),
  ];
}

/** A cena ativa, ajustável: grade, descrição e notas do GM. */
function aCenaEmAjuste(campanha) {
  const cena = cenaAtiva(campanha);
  if (!cena || !ultimo.isGM) return [];
  const c = cenaEmEdicao ?? cena;
  const mudou = cenaEmEdicao !== null;
  return [
    cabecalho('AJUSTE DA CENA'),
    linha([
      campo('c-name', 'NOME', c.name ?? ''),
      campo('c-cols', 'COLUNAS', String(c.cols ?? 20)),
      campo('c-rows', 'LINHAS', String(c.rows ?? 14)),
    ]),
    campo('c-description', 'DESCRIÇÃO', c.description ?? ''),
    campo('c-notes', 'NOTAS DO GM', c.notes ?? ''),
    linha([
      botao('gravar-cena', mudou ? 'GRAVAR CENA' : 'GRAVADA', !mudou),
      botao('descartar-cena', 'DESCARTAR', !mudou),
    ]),
  ];
}

/**
 * A iniciativa e o resto, para a faixa de um SEELE sem superfícies.
 *
 * Na página, cada um destes assuntos tem a aba dele: `asFichas`, `osVerbetes`
 * e `oRegistro`. Esta função é o caminho de compatibilidade, e ela continua
 * sendo a lista longa que a auditoria descreveu — porque sem superfícies a
 * lista longa era tudo o que havia.
 */
function oResto(campanha) {
  const partes = [
    cabecalho('Iniciativa · rodada ' + campanha.round),
    lista(campanha.initiative.map(p => {
      const ativo = p.id === campanha.currentTurn
        || (ultimo.isGM && campanha.initiative[campanha.turn]?.id === p.id);
      return p.name + ' · ' + p.value + (ativo ? ' · turno atual' : '') + (p.hidden ? ' · oculto' : '');
    })),
    cabecalho(ultimo.isGM ? 'Fichas da campanha' : 'Suas fichas'),
  ];
  for (const ficha of campanha.sheets) {
    partes.push(
      linha([
        cabecalho(ficha.name),
        botao('abrir-ficha-' + ficha.id, 'ABRIR'),
      ]),
      texto(nomeDe(ficha.owner) + ' · nível ' + ficha.level + ' · ' + (ficha.className || 'Classe livre')),
      texto('PV ' + ficha.hp + '/' + ficha.maxHp + ' · temporários ' + (ficha.tempHp || 0) + ' · CA ' + ficha.ac),
      lista(Object.entries(ficha.abilities || {}).map(([chave, valor]) =>
        (ultimo.rules.abilities[chave] || chave) + ': ' + valor)),
      texto('Condições: ' + ((ficha.conditions || []).join(', ') || 'nenhuma')),
    );
    for (const [chave, rotulo] of [['ancestry', 'Ancestralidade'], ['background', 'Antecedentes'], ['inventory', 'Inventário'], ['skills', 'Perícias anotadas'], ['notes', 'Notas']]) {
      if (ficha[chave]) partes.push(texto(rotulo + ': ' + ficha[chave]));
    }
    partes.push(lista((ficha.actions || []).map(a =>
      a.name + ' · ' + a.kind + ': ' + a.description + (a.formula ? ' · ' + a.formula : ''))));
  }
  partes.push(cabecalho('Compêndio'));
  for (const entrada of campanha.entries) {
    partes.push(cabecalho(entrada.name), texto(entrada.kind + ' · nível ' + entrada.level), texto(entrada.description));
  }
  partes.push(
    cabecalho('Registro'),
    lista(campanha.log.slice(-8).reverse().map(l => nomeDe(l.person) + ': ' + l.text)),
  );
  return partes;
}

// ------------------------------------------------- a mesa como espaço

/**
 * A página da mesa: abas para o tabuleiro, as fichas, o compêndio e o registro.
 *
 * # O achado que ela responde
 *
 * U01 e U25 são a mesma coisa vista por fora e por dentro: «jogar exige rolar
 * um rodapé» de 240px, e «MESA não cria campanha». O segundo era o contrato de
 * escrita; o primeiro era isto.
 *
 * Uma mesa de RPG tem quatro assuntos que não cabem numa lista só — o que está
 * em cima da mesa, quem está jogando, o que o mundo tem, e o que aconteceu — e
 * empilhá-los num rodapé faz cada um deles estar a uma rolagem de distância dos
 * outros três. As abas os separam sem escondê-los, e **só a aberta é montada**:
 * um tabuleiro com sessenta peças não é desenhado enquanto alguém lê o
 * compêndio.
 */
function aPaginaDaMesa() {
  if (!ultimo) return [texto('Consultando a campanha deste canal…')];
  const campanha = ultimo.campaign;
  if (!campanha) return oConvite();

  const cena = cenaAtiva(campanha);
  return [
    caixa([
      caixa([campanha.name], { corpo: 18, peso: 'forte', crescer: 1 }),
      distintivo([ultimo.isGM ? 'MESTRE' : 'JOGADOR'],
        { borda: { largura: 1, cor: '#f2521f' }, cor: '#f2521f' }),
      caixa(['sistema ' + campanha.system + ' · GM ' + nomeDe(campanha.gm)
        + ' · revisão ' + campanha.revision], { corpo: 11, opacidade: 0.7 }),
    ], { direcao: 'linha', alinhar: 'centro', intervalo: 10, quebra: 'sim' }),

    ...aTrilhaQueToca(campanha, cena),

    abas('aba', abaAberta, [
      aba('tabuleiro', 'TABULEIRO', [
        ...oTabuleiro(campanha),
        ...osControles(campanha),
        ...aCenaEmAjuste(campanha),
      ]),
      aba('fichas', 'FICHAS', [
        ...aFichaAberta(campanha),
        ...asFichas(campanha),
      ]),
      aba('compendio', 'COMPÊNDIO', [
        ...oCompendio(campanha),
        ...osVerbetes(campanha),
      ]),
      aba('iniciativa', 'INICIATIVA', aIniciativa(campanha)),
      aba('registro', 'REGISTRO', oRegistro(campanha)),
    ]),
  ];
}

/**
 * A trilha que está tocando, e o tocador dela.
 *
 * A auditoria anotou: «As escolhas de trilha alteram estado no servidor, mas o
 * cliente atual não declara tocador de som nem sintetizador equivalente ao
 * anterior.» O estado ia ao servidor e ninguém ouvia nada.
 *
 * O tocador é uma `midia` do produto, com o arquivo que **este pacote** traz —
 * a única origem de som que a API oferece além do servidor do MOD, e a que faz
 * sentido para ambientação, que é a mesma para todo mundo.
 *
 * `position` e `startedAt` do servidor ficam de fora de propósito: o §8 do
 * plano é explícito em não prometer sincronismo perfeito, e uma trilha que
 * finge estar alinhada é pior que uma que toca do começo.
 */
function aTrilhaQueToca(campanha, cena) {
  const daCena = cena?.ambience && cena.ambience !== 'inherit' ? cena.ambience : null;
  const preset = daCena ?? campanha.music?.preset ?? null;
  const arquivoDaTrilha = preset ? TRILHAS_EM_ARQUIVO[preset] : null;
  if (!preset || !arquivoDaTrilha) {
    return preset
      ? [caixa(['Trilha escolhida: ' + preset + '. Este pacote não traz o som dela.'],
        { corpo: 11, opacidade: 0.7 })]
      : [];
  }
  return [caixa([
    caixa(['TRILHA'], { corpo: 10, peso: 'forte', opacidade: 0.7 }),
    midia('trilha:' + preset, {
      fonte: arquivoDaTrilha,
      descricao: 'Ambientação: ' + preset,
      tocando: campanha.music?.playing === true,
    }),
  ], { intervalo: 6 })];
}

/** O convite a criar a mesa, ou a explicação de quem não pode. */
function oConvite() {
  // **Quem não pode criar não vê um formulário que vai ser recusado.** O
  // servidor só aceita `setup` de quem administra, e a projeção já diz isso em
  // `canSetup`. Desenhar o campo e o botão para todo mundo fazia quem não
  // administra preencher um nome e receber `admin-only` — um erro depois do
  // trabalho, no lugar de uma explicação antes dele.
  if (!ultimo.canSetup) {
    return [
      texto('Nenhuma campanha neste canal.'),
      texto('Quem administra este servidor pode criar a mesa. Peça a criação '
        + 'ou escolha outro canal.'),
      ...(aviso ? [texto(aviso)] : []),
    ];
  }
  return [
    texto('Nenhuma campanha neste canal.'),
    acoes([botao('abrir-criar', 'CRIAR MESA', false, { variante: 'primaria' })]),
    ...(aviso ? [texto(aviso)] : []),
  ];
}

/**
 * O diálogo de criação: nome, sistema e mestre.
 *
 * A auditoria anotou que «a criação fixa sistema `free` e GM atual; a versão
 * anterior oferecia sistema e GM no diálogo». Fixar os dois não foi uma
 * decisão: foi o que coube na faixa.
 */
function oDialogoDeCriacao() {
  return [
    formulario('criar', [
      campo('nova-campanha', 'NOME DA CAMPANHA', rascunho.campanha),
      escolha('novo-sistema', 'SISTEMA', rascunho.sistema, SISTEMAS),
      escolha('novo-gm', 'MESTRE', rascunho.gm || String(ultimo.me ?? ''), pessoasComoOpcoes()),
      caixa(['O mestre pode ser outra pessoa: quem administra o servidor cria a '
        + 'mesa, e quem joga com ela a conduz.'], { corpo: 11, opacidade: 0.7 }),
    ]),
    ...(aviso ? [caixa([aviso], { corpo: 11, cor: '#f2521f' })] : []),
    acoes([
      botao('cancelar-criar', 'CANCELAR', false, { variante: 'discreta' }),
      espaco(),
      botao('criar-campanha', 'CRIAR MESA', !rascunho.campanha, { variante: 'primaria' }),
    ], true),
  ];
}

/** As fichas da campanha, uma caixa por ficha. */
function asFichas(campanha) {
  const partes = [
    cabecalho(ultimo.isGM ? 'Fichas da campanha' : 'Suas fichas'),
  ];
  if (!campanha.sheets.length) {
    partes.push(texto('Nenhuma ficha nesta mesa ainda.'));
    return partes;
  }
  partes.push(grade(campanha.sheets.map(ficha => caixa([
    caixa([
      caixa([ficha.name], { peso: 'forte', corpo: 14, crescer: 1 }),
      botao('abrir-ficha-' + ficha.id, fichaAberta === ficha.id ? 'ABERTA' : 'ABRIR',
        fichaAberta === ficha.id),
    ], { direcao: 'linha', alinhar: 'centro', intervalo: 8 }),
    caixa([nomeDe(ficha.owner) + ' · nível ' + ficha.level + ' · '
      + (ficha.className || 'Classe livre')], { corpo: 11, opacidade: 0.75 }),
    caixa([
      distintivo(['PV ' + ficha.hp + '/' + ficha.maxHp]),
      distintivo(['CA ' + ficha.ac]),
      ...(ficha.tempHp ? [distintivo(['TEMP ' + ficha.tempHp])] : []),
    ], { direcao: 'linha', intervalo: 6, quebra: 'sim' }),
    ...((ficha.conditions || []).length
      ? [caixa([
        ...(ficha.conditions || []).map(c => distintivo([c],
          { borda: { largura: 1, cor: '#FF1A1A' }, cor: '#FF1A1A' })),
      ], { direcao: 'linha', intervalo: 6, quebra: 'sim' })]
      : []),
  ], {
    intervalo: 8,
    preenchimento: 12,
    borda: { largura: 1, cor: '#3a322a' },
    raio: 6,
  })), { colunas: 2, intervalo: 12 }, { classe: 'fichas' }));
  return partes;
}

/** Os verbetes do compêndio, um por caixa. */
function osVerbetes(campanha) {
  if (!campanha.entries.length) return [texto('Nenhum verbete neste compêndio.')];
  return [pilha(campanha.entries.map(entrada => caixa([
    caixa([
      caixa([entrada.name], { peso: 'forte', corpo: 13, crescer: 1 }),
      distintivo([entrada.kind + (entrada.level ? ' · nível ' + entrada.level : '')]),
      ...(entrada.published ? [] : [distintivo(['NÃO PUBLICADO'],
        { borda: { largura: 1, cor: '#f2521f' }, cor: '#f2521f' })]),
    ], { direcao: 'linha', alinhar: 'centro', intervalo: 8, quebra: 'sim' }),
    ...(entrada.description ? [caixa([entrada.description], { corpo: 12, entrelinha: 1.5 })] : []),
  ], {
    intervalo: 6,
    preenchimento: 10,
    borda: { largura: 1, cor: '#3a322a' },
    raio: 6,
  })), { intervalo: 10 })];
}

/** O que aconteceu, do mais recente para o mais antigo. */
function oRegistro(campanha) {
  if (!campanha.log.length) return [texto('Nada aconteceu nesta mesa ainda.')];
  return [pilha(campanha.log.slice(-40).reverse().map(l => caixa([
    caixa([nomeDe(l.person)], { corpo: 10, opacidade: 0.7 }),
    caixa([l.text], { corpo: 12 }),
  ], {
    intervalo: 2,
    preenchimento: 8,
    borda: { largura: 1, cor: '#241f19' },
    raio: 4,
  })), { intervalo: 6 })];
}

/**
 * A ordem de iniciativa, com o turno atual dito em palavra.
 *
 * `specs/06-clientes-gui.md` recusa informação que só a cor carregue, e é por
 * isso que «na vez» é um distintivo com texto e não uma linha destacada.
 */
function aIniciativa(campanha) {
  if (!campanha.initiative.length) {
    return [
      texto('Nenhuma ordem de iniciativa nesta mesa.'),
      ...(ultimo.isGM ? [texto('Abra uma ficha e use ENTRAR NA INICIATIVA.')] : []),
    ];
  }
  return [
    caixa(['Rodada ' + campanha.round], { corpo: 12, opacidade: 0.75 }),
    pilha(campanha.initiative.map((p, onde) => {
      const naVez = p.id === campanha.currentTurn
        || (ultimo.isGM && campanha.turn === onde);
      return caixa([
        caixa([String(p.value)], { corpo: 16, peso: 'forte', largura: 40 }),
        caixa([p.name], { crescer: 1 }),
        ...(naVez ? [distintivo(['NA VEZ'],
          { borda: { largura: 1, cor: '#f2521f' }, cor: '#f2521f' })] : []),
        ...(p.hidden ? [distintivo(['OCULTO'])] : []),
      ], {
        direcao: 'linha',
        alinhar: 'centro',
        intervalo: 10,
        preenchimento: 8,
        borda: { largura: 1, cor: naVez ? '#f2521f' : '#241f19' },
        raio: 4,
      });
    }), { intervalo: 6 }),
    ...(ultimo.isGM ? [acoes([
      botao('iniciativa-proximo', 'PRÓXIMO TURNO', !campanha.initiative.length),
      botao('iniciativa-limpar', 'LIMPAR INICIATIVA', !campanha.initiative.length),
    ])] : []),
  ];
}

/** As classes da página: o que muda quando ela aperta. */
const CLASSES_DA_MESA = {
  fichas: {
    base: {},
    consultas: [{ ateLargura: 640, estilo: { colunas: 1 } }],
  },
};

/**
 * O que continua na faixa.
 *
 * Uma linha: qual mesa, de quem é o turno, e a porta. Tudo o que era rolagem
 * mudou de endereço.
 */
function aRegiao() {
  if (!ultimo) return [texto('Consultando a campanha deste canal…')];
  if (!temSuperficies) return desenhoDoEstado();
  const campanha = ultimo.campaign;
  if (!campanha) {
    return [
      caixa([
        caixa([ultimo.canSetup
          ? 'Nenhuma campanha neste canal.'
          : 'Nenhuma campanha neste canal. Quem administra pode criar a mesa.'],
        { opacidade: 0.8, crescer: 1 }),
        ...(ultimo.canSetup
          ? [botao('abrir-criar', 'CRIAR MESA', false, { variante: 'primaria' })]
          : []),
      ], { direcao: 'linha', alinhar: 'centro', intervalo: 8, quebra: 'sim' }),
      ...(aviso ? [texto(aviso)] : []),
    ];
  }
  const naVez = campanha.initiative[campanha.turn];
  return [
    caixa([
      caixa([campanha.name], { peso: 'forte', crescer: 1 }),
      ...(naVez ? [distintivo(['NA VEZ: ' + naVez.name],
        { borda: { largura: 1, cor: '#f2521f' }, cor: '#f2521f' })] : []),
      distintivo(['RODADA ' + campanha.round]),
      botao('abrir-mesa', 'ABRIR A MESA', false, { variante: 'primaria' }),
    ], { direcao: 'linha', alinhar: 'centro', intervalo: 8, quebra: 'sim' }),
    ...(aviso ? [texto(aviso)] : []),
  ];
}

// ------------------------------------------------------ abrir e repintar

async function abrirMesa() {
  if (!temSuperficies) return;
  telas.mesa ??= await pagina('mesa', 'Mesa');
  await telas.mesa.classes(CLASSES_DA_MESA);
  await telas.mesa.titulo(ultimo?.campaign?.name || 'Mesa');
  await telas.mesa.montar(aPaginaDaMesa());
  await telas.mesa.mostrar();
}

async function abrirCriacao() {
  if (!temSuperficies) return;
  telas.criar ??= await dialogo('mesa-criar', 'Criar campanha', {
    tamanho: { largura: 520 },
    focoInicial: 'nova-campanha',
    fecharComAlteracoes: 'confirmar',
  });
  await telas.criar.montar(oDialogoDeCriacao());
  await telas.criar.suja(Boolean(rascunho.campanha));
  await telas.criar.mostrar();
}

/** Redesenha o que estiver aberto, sem ir ao servidor. */
async function repintarTelas() {
  if (telas.mesa) {
    await telas.mesa.titulo(ultimo?.campaign?.name || 'Mesa');
    await telas.mesa.montar(aPaginaDaMesa());
  }
  if (telas.criar) {
    await telas.criar.montar(oDialogoDeCriacao());
    await telas.criar.suja(Boolean(rascunho.campanha));
  }
}

function desenhoDoEstado() {
  if (!ultimo) return [texto('Consultando a campanha deste canal…')];
  const campanha = ultimo.campaign;
  if (!campanha) {
    // **Criar a mesa é daqui.** Antes isto dizia «crie pelo servidor», que é o
    // mesmo que não oferecer: não há «pelo servidor» para quem usa o produto.
    //
    // **E quem não pode criar não vê um formulário que vai ser recusado.** O
    // servidor só aceita `setup` de quem administra, e a projeção já diz isso
    // em `canSetup`. Desenhar o campo e o botão para todo mundo fazia quem não
    // administra preencher um nome e receber `admin-only` — um erro depois do
    // trabalho, no lugar de uma explicação antes dele.
    if (!ultimo.canSetup) {
      return [
        texto('Nenhuma campanha neste canal.'),
        texto('Quem administra este servidor pode criar a mesa. Peça a criação '
          + 'ou escolha outro canal.'),
        ...(aviso ? [texto(aviso)] : []),
      ];
    }
    return [
      texto('Nenhuma campanha neste canal.'),
      linha([
        campo('nova-campanha', 'NOME DA CAMPANHA', rascunho.campanha),
        escolha('novo-sistema', 'SISTEMA', rascunho.sistema, SISTEMAS),
        escolha('novo-gm', 'MESTRE', rascunho.gm || String(ultimo.me ?? ''), pessoasComoOpcoes()),
        botao('criar-campanha', 'CRIAR MESA', !rascunho.campanha),
      ]),
      ...(aviso ? [texto(aviso)] : []),
    ];
  }
  return [
    cabecalho(campanha.name),
    texto((ultimo.isGM ? 'GM' : 'Jogador') + ' · revisão ' + campanha.revision
      + ' · sistema ' + campanha.system + ' · GM ' + nomeDe(campanha.gm)),
    ...oTabuleiro(campanha),
    ...osControles(campanha),
    ...aFichaAberta(campanha),
    ...aCenaEmAjuste(campanha),
    ...oCompendio(campanha),
    ...oResto(campanha),
  ];
}

/**
 * Manda uma imagem escolhida ao servidor, em fragmentos.
 *
 * Os bytes nunca estão inteiros aqui: o produto os entrega em pedaços, e cada
 * pedaço é recortado no tamanho que este servidor aceita. O primeiro fragmento
 * carrega o prefixo `data:`, que é o que o servidor confere.
 */
async function enviarImagem(canal, escolhido, montarPedido) {
  if (escolhido.papel !== 'imagem') throw new Error('Escolha uma imagem.');
  const prefixo = 'data:' + escolhido.tipo + ';base64,';
  const total = prefixo.length + Math.ceil(escolhido.bytes / 3) * 4;
  // Este servidor quer saber **quantos** fragmentos virão, e não o tamanho.
  const fragmentos = Math.ceil(total / FRAGMENTO);
  const marca = 'envio-' + escolhido.id;

  let sobra = prefixo;
  let lidos = 0;
  // **`finally`, e não depois do laço** — um dos riscos que a auditoria de
  // 20/09/2026 mandou reproduzir: «MESA chama `soltar` apenas depois do laço
  // bem-sucedido. Verificar liberação em `finally`.»
  //
  // Um envio que falha no meio — fragmento recusado, revisão trocada, disco
  // cheio do outro lado — deixava os bytes presos no produto até a saída da
  // sessão. Dez megabytes que ninguém mais vai ler, segurados por um caminho
  // de erro que ninguém percorre de propósito.
  //
  // O `finally` cobre os três desfechos: o laço terminou, o laço lançou, ou
  // alguém desistiu. O próprio `soltar` é idempotente do lado do produto, e
  // uma falha nele não pode esconder a falha que nos trouxe aqui.
  try {
    for (let indice = 0; indice < fragmentos; indice += 1) {
      while (sobra.length < FRAGMENTO && lidos < escolhido.bytes) {
        const pedaco = await SeeleUI.pedaco(escolhido.id, lidos);
        if (!pedaco) throw new Error('O arquivo acabou antes do esperado.');
        lidos += (pedaco.length / 4) * 3;
        sobra += pedaco;
      }
      const parte = sobra.slice(0, FRAGMENTO);
      sobra = sobra.slice(parte.length);
      await escrever(canal, montarPedido({
        upload: marca, total: fragmentos, index: indice, part: parte,
      }));
    }
  } finally {
    // Devolvido na hora: dez megabytes presos até a saída seriam dez megabytes
    // que ninguém mais vai ler.
    try {
      await SeeleUI.soltar(escolhido.id);
    } catch (erro) {
      // Uma falha ao devolver não pode substituir a falha que a trouxe: quem
      // está esperando o erro do envio precisa do erro do envio.
      console.error('MESA: o arquivo não foi devolvido: ' + (erro.message || erro));
    }
  }
}

/** Da tela para a grade, e dentro dos limites da cena. */
const naGrade = (valor, teto) => Math.max(0, Math.min(teto - 1, Math.floor(valor / CELULA)));

/**
 * O contador que dá nome a cada tentativa lógica de escrita.
 *
 * **Uma tentativa, um nome; uma repetição, o mesmo nome.** O servidor guarda
 * os últimos 64 recibos `pessoa:nonce` e devolve a projeção sem reaplicar o
 * que já aplicou. É isso que faz uma resposta perdida não virar duas
 * campanhas — e é por isso que repetir uma escrita reaproveita a marca em vez
 * de sortear outra.
 */
let serieDeEscrita = 0;
/** Um prefixo por execução, para duas janelas não colidirem de nome. */
const marcaDaExecucao = Math.floor(Math.random() * 0xffffff).toString(36);

/** Uma marca nova, dentro do que `key()` do servidor aceita: `[a-z0-9-]{1,64}`. */
const proximaMarca = () => 'e-' + marcaDaExecucao + '-' + (++serieDeEscrita);

/**
 * Escreve no servidor e **adota a campanha que ele devolveu**.
 *
 * Toda escrita aqui responde com a projeção nova. Redesenhar com a antiga
 * mostraria o resultado só na consulta seguinte — até dois segundos depois —, e
 * quem rolou um dado ficaria olhando um registro que não tem a rolagem dele.
 *
 * # Os dois campos que faltavam, e o que a falta custava
 *
 * O servidor recusa **antes de qualquer escrita**: `key(r.nonce)` roda para
 * toda operação, e `r.revision === c.revision` para toda operação que não seja
 * a criação. Sem `nonce`, `key(undefined)` falha com `invalid-id`; sem
 * `revision`, a segunda operação falha com `conflict`.
 *
 * Este lado nunca os mandava. A auditoria de 20/09/2026 reproduziu isolado:
 * `setup` como o cliente enviava devolvia `invalid-id`, e nenhuma campanha
 * podia ser criada pelo produto. O teste do cliente não pegava porque **ele**
 * completava os dois campos antes de chamar o servidor — provando um caminho
 * que o produto não percorre.
 *
 * `revision` sai de `ultimo.campaign`, que é a projeção mais recente que este
 * lado recebeu; `setup` não a manda porque não há campanha de que tirá-la, e o
 * servidor não a exige nesse caso.
 *
 * @param {number} canal O canal desta campanha.
 * @param {object} pedido O que a operação diz — **sem** `nonce` e `revision`.
 * @param {string} [marca] A marca de uma tentativa anterior, para repeti-la.
 */
function escrever(canal, pedido, marca = proximaMarca()) {
  const campanha = ultimo?.campaign;
  const completo = { ...pedido, nonce: marca };
  // `setup` cria; as outras exigem concordar com a revisão que está lá.
  if (pedido.op !== 'setup' && campanha) completo.revision = campanha.revision;
  return request(canal, completo).then(resposta => {
    if (resposta.campaign) ultimo = { ...ultimo, ...resposta };
    return resposta;
  });
}

/**
 * O canal a que o que está sendo editado pertence.
 *
 * # Por que ele existe
 *
 * Um dos riscos que a auditoria de 20/09/2026 mandou reproduzir: «Rascunhos e
 * respostas em voo atravessando mudança de canal: o helper consulta
 * periodicamente, e o evento usa `canalAtual`. Prender abertura/edição à
 * entidade e ao canal de origem.»
 *
 * Uma campanha é **por canal**. Tudo o que está sendo editado — o nome da mesa
 * nova, a cena, a ficha aberta, a ação, o verbete — pertence à campanha daquele
 * canal. Trocar de canal e continuar com a ficha `sheet-3` aberta é ter aberta
 * a ficha de outra mesa, com o mesmo número.
 *
 * A casca já impede desenhar a resposta do canal anterior. O que faltava era
 * impedir a **edição** de atravessar, e é isto.
 */
let canalDaEdicao = null;

/** Esquece o que estava sendo editado, porque ele era de outro canal. */
function largarAEdicao() {
  fichaAberta = null;
  fichaEmEdicao = null;
  acaoEmEdicao = null;
  verbeteEmEdicao = null;
  cenaEmEdicao = null;
  arrastando = null;
  modoParede = false;
  abaAberta = 'tabuleiro';
  for (const chave of Object.keys(rascunho)) {
    rascunho[chave] = chave === 'sistema' ? 'free' : '';
  }
  aviso = '';
}

iniciar(
  async (snapshot, canal) => {
    // **Antes de perguntar**, e não depois de responder: se o canal mudou, o
    // que estava sendo editado é de outra mesa, e desenhá-lo por um ciclo já
    // seria mostrar a ficha errada.
    if (canalDaEdicao !== null && canalDaEdicao !== canal) largarAEdicao();
    canalDaEdicao = canal;
    const resposta = await request(canal, { op: 'view' });
    ultimo = { ...resposta, presentes: snapshot.presentes, canal };
    // A entrada, uma vez por sessão. Registrá-la a cada consulta seria uma
    // entrada nova a cada dois segundos.
    if (temContribuicoes && !entradaRegistrada) {
      try {
        await entrada('Mesa', 'abrir-mesa');
        entradaRegistrada = true;
      } catch (erro) {
        console.warn('MESA: a entrada foi recusada: ' + (erro.message || erro));
      }
    }
    await repintarTelas();
    return aRegiao();
  },
  async () => {
    ultimo = null;
    canalDaEdicao = null;
    largarAEdicao();
    telas.mesa = null;
    telas.criar = null;
    entradaRegistrada = false;
  },
  (evento, canal, repintar) => {
    if (!ultimo) return null;
    const campanha = ultimo.campaign;
    const cena = campanha ? cenaAtiva(campanha) : null;

    /**
     * Redesenha os dois lugares onde esta mesa aparece.
     *
     * A faixa e a página mostram o **mesmo** estado local, e um só deles
     * atualizado é a metade da tela dizendo uma coisa e a outra metade dizendo
     * outra. Um ajudante só, e não dois caminhos: dois caminhos é como uma
     * delas vai ficar para trás no dia em que alguém acrescentar um botão.
     */
    const redesenhar = () => {
      repintar(aRegiao());
      void repintarTelas();
    };

    // ---- o que o produto manda, e não a região ----
    if (evento.nome === 'acao') {
      if (evento.acao === 'abrir-mesa') {
        return campanha ? abrirMesa() : abrirCriacao();
      }
      return null;
    }
    // O host pediu para fechar. Aceitar é a regra: ver `pedirFechamento`.
    if (evento.nome === 'fechar' || evento.nome === 'fechar-pedido') return null;

    if (evento.nome === 'aba') {
      abaAberta = evento.valor;
      return repintarTelas();
    }

    // Sem campanha só há dois caminhos: preencher o formulário de criação e
    // apertar. Os outros pedem uma mesa.
    if (!campanha && !(evento.nome === 'campo' || evento.nome === 'escolha'
      || evento.chave === 'criar-campanha' || evento.chave === 'abrir-criar'
      || evento.chave === 'cancelar-criar')) {
      return null;
    }

    if (evento.chave === 'abrir-mesa') return abrirMesa();
    if (evento.chave === 'abrir-criar') return abrirCriacao();
    if (evento.chave === 'cancelar-criar') {
      // Cancelar **não** apaga o que foi escrito: o rascunho é da entidade, e
      // reabrir o diálogo o encontra. É a mesma regra de U26 no PERFIS.
      return telas.criar ? telas.criar.fechar('cancelado') : null;
    }

    // O sistema e o mestre escolhidos antes de existir campanha. Ficam no
    // rascunho como o nome fica: são a mesma decisão, em três controles.
    if (evento.nome === 'escolha' && !campanha) {
      if (evento.chave === 'novo-sistema') rascunho.sistema = evento.valor;
      else if (evento.chave === 'novo-gm') rascunho.gm = evento.valor;
      else return null;
      redesenhar();
      return null;
    }

    if (evento.nome === 'campo') {
      if (evento.chave === 'formula') { formula = evento.valor; return null; }
      const ficha = campanha?.sheets.find(s => s.id === fichaAberta);
      if (ficha && (evento.chave.startsWith('f-') || evento.chave.startsWith('a-'))) {
        // O rascunho da ficha nasce do que o servidor tem, e daí em diante é
        // dele: sem isso a consulta de dois segundos apagaria o que está sendo
        // digitado, e o foco ficaria numa caixa cujo valor este MOD trocou.
        fichaEmEdicao = JSON.parse(JSON.stringify(fichaEmEdicao ?? ficha));
        if (evento.chave.startsWith('a-')) {
          fichaEmEdicao.abilities = { ...fichaEmEdicao.abilities };
          fichaEmEdicao.abilities[evento.chave.slice(2)] = Number(evento.valor) || 0;
        } else {
          const nome = evento.chave.slice(2);
          const numerico = ['level', 'hp', 'maxHp', 'ac', 'speed'].includes(nome);
          fichaEmEdicao[nome] = numerico ? (Number(evento.valor) || 0) : evento.valor;
        }
        redesenhar();
        return null;
      }
      // Os três rascunhos com prefixo próprio: ação, verbete e cena.
      if (evento.chave.startsWith('ac-')) {
        acaoEmEdicao = { ...(acaoEmEdicao ?? {}) };
        const nome = evento.chave.slice(3);
        acaoEmEdicao[nome] = nome === 'max' ? (Number(evento.valor) || 0) : evento.valor;
        redesenhar();
        return null;
      }
      if (evento.chave.startsWith('v-')) {
        verbeteEmEdicao = { ...(verbeteEmEdicao ?? {}) };
        const nome = evento.chave.slice(2);
        verbeteEmEdicao[nome] = nome === 'level' ? (Number(evento.valor) || 0) : evento.valor;
        redesenhar();
        return null;
      }
      if (evento.chave.startsWith('c-') && cena) {
        cenaEmEdicao = { ...(cenaEmEdicao ?? cena) };
        const nome = evento.chave.slice(2);
        const numerico = nome === 'cols' || nome === 'rows';
        cenaEmEdicao[nome] = numerico ? (Number(evento.valor) || 0) : evento.valor;
        redesenhar();
        return null;
      }
      if (evento.chave.startsWith('s-') && ficha) {
        // Os espaços de magia entram no mesmo rascunho da ficha: eles são dela.
        fichaEmEdicao = JSON.parse(JSON.stringify(fichaEmEdicao ?? ficha));
        const nivel = Number(evento.chave.slice(2));
        fichaEmEdicao.slots = (fichaEmEdicao.slots ?? []).map((s, i) =>
          i === nivel ? { ...s, max: Number(evento.valor) || 0 } : s);
        redesenhar();
        return null;
      }
      const onde = {
        'nova-campanha': 'campanha', 'nova-cena': 'cena',
        'nova-ficha': 'ficha', 'nova-peca': 'peca',
        'nova-entrada': 'entrada', dano: 'dano',
      }[evento.chave];
      if (!onde) return null;
      rascunho[onde] = evento.valor;
      redesenhar();
      return null;
    }

    if (evento.nome === 'traco') {
      if (!cena || cena.kind !== 'map') return null;
      const x = naGrade(evento.x, cena.cols);
      const y = naGrade(evento.y, cena.rows);
      if (modoParede) {
        // No modo parede o `alvo` não importa: o que vale é a casa, e pintar
        // sobre uma peça é exatamente o que quem pinta uma parede quer.
        if (evento.fase !== 'comecou') return null;
        return escrever(canal, { op: 'wall', scene: cena.id, x, y }).then(
          () => redesenhar(),
          erro => { aviso = erro.message || String(erro); redesenhar(); },
        );
      }
      if (evento.fase === 'comecou') {
        // `alvo` é a chave da figura que o dedo pegou. Sem ele, este lado teria
        // de refazer o acerto que o produto acabou de fazer para pintar.
        // **Texto, e não número.** Os identificadores desta campanha são
        // `token-2`, `scene-1` — converter para número dá `NaN`, e `NaN` não é
        // igual a nada, nem a si mesmo: a peça deixava de se reconhecer e não
        // acompanhava o dedo, sem erro nenhum aparecer.
        const id = typeof evento.alvo === 'string' && evento.alvo.startsWith('peca:')
          ? evento.alvo.slice('peca:'.length)
          : null;
        arrastando = id === null ? null : { id, x, y };
        return null;
      }
      if (!arrastando) return null;
      if (evento.fase === 'moveu') {
        // A peça acompanha o dedo **aqui**, sem ir ao servidor: um arraste manda
        // dezenas de pontos por segundo, e um pedido por ponto é a forma mais
        // fácil de saturar a fila.
        if (arrastando.x !== x || arrastando.y !== y) {
          arrastando = { ...arrastando, x, y };
          redesenhar();
        }
        return null;
      }
      // Solta: **agora** o servidor decide. Ele pode recusar — peça oculta,
      // ficha de outra pessoa, movimento travado pelo GM — e a recusa volta como
      // frase, com a peça de volta onde ela estava.
      const solto = arrastando;
      arrastando = null;
      aviso = '';
      return escrever(canal, { op: 'token-move', scene: cena.id, id: solto.id, x, y }).then(
        () => redesenhar(),
        erro => {
          aviso = 'a peça não se move: ' + (erro.message || String(erro));
          redesenhar();
        },
      );
    }

    if (evento.nome === 'escolha' && evento.chave.startsWith('ac-')) {
      acaoEmEdicao = { ...(acaoEmEdicao ?? {}) };
      acaoEmEdicao[evento.chave.slice(3)] = evento.valor;
      redesenhar();
      return null;
    }
    if (evento.nome === 'escolha' && evento.chave === 'trilha-mesa') {
      return escrever(canal, { op: 'music', command: 'select', preset: evento.valor }).then(
        () => redesenhar(),
        erro => { aviso = erro.message || String(erro); redesenhar(); },
      );
    }
    if (evento.nome === 'escolha' && evento.chave === 'trilha' && cena) {
      return escrever(canal, { op: 'scene-music', id: cena.id, preset: evento.valor }).then(
        () => redesenhar(),
        erro => { aviso = erro.message || String(erro); redesenhar(); },
      );
    }
    if (evento.nome === 'escolha' && evento.chave === 'cena') {
      aviso = 'trocando a cena…';
      redesenhar();
      return escrever(canal, { op: 'scene-show', id: evento.valor }).then(
        () => { aviso = ''; redesenhar(); },
        erro => { aviso = erro.message || String(erro); redesenhar(); },
      );
    }

    if (evento.nome === 'arquivo') {
      // Cancelar é uma resposta: `null` quer dizer que o seletor foi fechado.
      if (!evento.arquivo) {
        aviso = evento.porque ?? 'nenhum arquivo escolhido';
        redesenhar();
        return null;
      }
      if (canal === null) return null;
      const paraRetrato = evento.chave === 'retrato';
      if (paraRetrato && !fichaAberta) return null;
      if (!paraRetrato && !cena) return null;
      aviso = paraRetrato ? 'enviando o retrato…' : 'enviando o mapa…';
      redesenhar();
      const enviando = paraRetrato
        ? enviarImagem(canal, evento.arquivo, (extra) => ({ op: 'portrait-part', sheet: fichaAberta, ...extra }))
        : enviarImagem(canal, evento.arquivo, (extra) => ({ op: 'image-part', scene: cena.id, ...extra }));
      return enviando.then(
        () => { aviso = paraRetrato ? 'retrato enviado' : 'mapa enviado'; redesenhar(); },
        erro => { aviso = erro.message || String(erro); redesenhar(); },
      );
    }

    if (evento.nome !== 'botao' || canal === null) return null;
    // `campanha` é nula até alguém criar a mesa, e o único botão que chega aqui
    // nesse estado é o que a cria. Declarada **antes** de qualquer uso: entre a
    // linha que a lê e a que a declarava havia uma zona morta, e o erro que ela
    // produzia era «não consegui criar a cena» — que fala de outra coisa.
    const ficha = campanha?.sheets.find(s => s.id === fichaAberta);
    // Os botões por identificador, antes dos de nome fixo.
    if (campanha && ficha) {
      const daFicha = (prefixo) => evento.chave.startsWith(prefixo)
        ? evento.chave.slice(prefixo.length) : null;
      const magia = daFicha('magia-');
      if (magia) {
        fichaEmEdicao = JSON.parse(JSON.stringify(fichaEmEdicao ?? ficha));
        const tinha = (fichaEmEdicao.spells ?? []).includes(magia);
        fichaEmEdicao.spells = tinha
          ? fichaEmEdicao.spells.filter(s => s !== magia)
          : [...(fichaEmEdicao.spells ?? []), magia];
        redesenhar();
        return null;
      }
      const conjurar = daFicha('conjurar-');
      if (conjurar) {
        const entrada = campanha.entries.find(e => e.id === conjurar);
        return escrever(canal, {
          op: 'cast', sheet: ficha.id, entry: conjurar, level: entrada?.level ?? 0,
        }).then(
          () => redesenhar(),
          erro => { aviso = erro.message || String(erro); redesenhar(); },
        );
      }
      const usar = daFicha('usar-acao-');
      if (usar) {
        return escrever(canal, { op: 'action-use', sheet: ficha.id, id: usar }).then(
          () => redesenhar(),
          erro => { aviso = erro.message || String(erro); redesenhar(); },
        );
      }
      const editar = daFicha('editar-acao-');
      if (editar) {
        acaoEmEdicao = { ...(ficha.actions ?? []).find(a => a.id === editar) };
        redesenhar();
        return null;
      }
      const tirar = daFicha('tirar-acao-');
      if (tirar) {
        return escrever(canal, { op: 'action-remove', sheet: ficha.id, id: tirar }).then(
          () => redesenhar(),
          erro => { aviso = erro.message || String(erro); redesenhar(); },
        );
      }
      if (evento.chave === 'gravar-acao' && acaoEmEdicao?.name) {
        const a = acaoEmEdicao;
        return escrever(canal, {
          op: 'action-save', sheet: ficha.id, id: a.id, name: a.name,
          kind: a.kind ?? 'action', formula: a.formula ?? '',
          description: a.description ?? '', max: a.max ?? 0, used: a.used ?? 0,
          recharge: a.recharge ?? 'manual',
        }).then(
          () => { acaoEmEdicao = null; redesenhar(); },
          erro => { aviso = erro.message || String(erro); redesenhar(); },
        );
      }
      if (evento.chave === 'descansar') {
        return escrever(canal, { op: 'rest', sheet: ficha.id }).then(
          () => redesenhar(),
          erro => { aviso = erro.message || String(erro); redesenhar(); },
        );
      }
    }
    if (campanha && evento.chave.startsWith('editar-verbete-')) {
      const id = evento.chave.slice('editar-verbete-'.length);
      verbeteEmEdicao = { ...campanha.entries.find(e => e.id === id) };
      redesenhar();
      return null;
    }
    if (campanha && evento.chave.startsWith('publicar-verbete-')) {
      const id = evento.chave.slice('publicar-verbete-'.length);
      const entrada = campanha.entries.find(e => e.id === id);
      return escrever(canal, {
        op: 'entry-save', id, name: entrada.name, kind: entrada.kind,
        level: entrada.level, range: entrada.range, cost: entrada.cost,
        description: entrada.description, formula: entrada.formula,
        published: !entrada.published,
      }).then(
        () => redesenhar(),
        erro => { aviso = erro.message || String(erro); redesenhar(); },
      );
    }
    if (evento.chave === 'gravar-verbete' && verbeteEmEdicao?.name) {
      const v = verbeteEmEdicao;
      return escrever(canal, {
        op: 'entry-save', id: v.id, name: v.name, kind: v.kind ?? 'nota',
        level: v.level ?? 0, range: v.range ?? '', cost: v.cost ?? '',
        description: v.description ?? '', formula: v.formula ?? '',
        published: v.published === true,
      }).then(
        () => { verbeteEmEdicao = null; redesenhar(); },
        erro => { aviso = erro.message || String(erro); redesenhar(); },
      );
    }
    if (evento.chave === 'descartar-cena') {
      cenaEmEdicao = null;
      redesenhar();
      return null;
    }
    if (evento.chave === 'gravar-cena' && cenaEmEdicao && cena) {
      const c = cenaEmEdicao;
      return escrever(canal, {
        op: 'scene-save', id: cena.id, name: c.name, description: c.description ?? '',
        notes: c.notes ?? '', cols: c.cols, rows: c.rows, cellMeters: cena.cellMeters,
      }).then(
        () => { cenaEmEdicao = null; redesenhar(); },
        erro => { aviso = erro.message || String(erro); redesenhar(); },
      );
    }
    if (campanha && evento.chave.startsWith('abrir-ficha-')) {
      fichaAberta = evento.chave.slice('abrir-ficha-'.length);
      redesenhar();
      return null;
    }
    if (evento.chave === 'fechar-ficha') {
      fichaAberta = null;
      fichaEmEdicao = null;
      redesenhar();
      return null;
    }
    if (evento.chave === 'descartar-ficha') {
      fichaEmEdicao = null;
      redesenhar();
      return null;
    }
    if (evento.chave === 'modo-parede') {
      modoParede = !modoParede;
      redesenhar();
      return null;
    }
    if (evento.chave === 'gravar-ficha' && fichaEmEdicao) {
      const enviada = fichaEmEdicao;
      return escrever(canal, { op: 'sheet-save', sheet: enviada }).then(
        () => { fichaEmEdicao = null; aviso = 'ficha gravada'; redesenhar(); },
        erro => { aviso = erro.message || String(erro); redesenhar(); },
      );
    }
    const quanto = Number(rascunho.dano) || 0;
    const pedido = evento.chave === 'rolar' ? { op: 'roll', formula, label: 'Dados' }
      : evento.chave === 'iniciativa-proximo' ? { op: 'initiative-next' }
        : evento.chave === 'iniciativa-limpar' ? { op: 'initiative-clear' }
          : evento.chave === 'criar-campanha'
            ? {
                op: 'setup',
                name: rascunho.campanha,
                system: rascunho.sistema || 'free',
                gm: rascunho.gm || String(ultimo.me ?? ''),
              }
            : evento.chave === 'criar-cena' ? { op: 'scene-create', name: rascunho.cena, kind: 'map' }
              : evento.chave === 'criar-ficha' ? { op: 'sheet-create', name: rascunho.ficha, owner: String(ultimo.me ?? '') }
                : evento.chave === 'criar-entrada'
                  ? { op: 'entry-save', name: rascunho.entrada, kind: 'nota', level: 0 }
                : evento.chave === 'criar-peca' && cena
                  ? { op: 'token-add', scene: cena.id, name: rascunho.peca, x: 0, y: 0 }
                  : evento.chave === 'ferir' && ficha
                    ? { op: 'vitality', sheet: ficha.id, kind: 'damage', amount: quanto }
                    : evento.chave === 'curar' && ficha
                      ? { op: 'vitality', sheet: ficha.id, kind: 'heal', amount: quanto }
                      : evento.chave === 'condicao-atordoado' && ficha
                        ? {
                            op: 'conditions',
                            sheet: ficha.id,
                            conditions: ficha.conditions?.includes('stunned')
                              ? ficha.conditions.filter(c => c !== 'stunned')
                              : [...(ficha.conditions ?? []), 'stunned'],
                          }
                        : evento.chave === 'iniciativa-add' && ficha
                          ? { op: 'initiative-add', name: ficha.name, value: 10 }
                          : null;
    if (!pedido) return null;
    aviso = '';
    return escrever(canal, pedido).then(
      () => {
        // O que foi criado saiu do rascunho: deixá-lo cheio faria o botão
        // continuar ligado e a próxima criação repetir o nome.
        if (evento.chave.startsWith('criar-')) {
          rascunho[evento.chave.slice('criar-'.length)] = '';
        }
        redesenhar();
      },
      erro => { aviso = erro.message || String(erro); redesenhar(); },
    );
  },
);

})();
