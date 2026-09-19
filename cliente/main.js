/* Gerado por ferramentas/build.mjs. API 3. */
(() => {
"use strict";
// Executado exclusivamente no executor do MOD. Cada pacote inclui sua cópia.
//
// A casca dos MODs oficiais: o que os três fazem igual, num lugar só.
//
// # O que mudou com a API 3 completa
//
// A versão anterior sabia **redesenhar por relógio** e nada mais: perguntava ao
// servidor a cada quatro segundos e mostrava a resposta. Um MOD assim é uma tela
// de leitura, e foi nisso que os três oficiais viraram depois da migração.
//
// Agora ela sabe três coisas a mais:
//
// - **receber evento.** `SeeleUI.aoEvento` traz o que a pessoa fez — digitou,
//   escolheu, apertou, arrastou — sem que o MOD tenha perguntado;
// - **redesenhar na hora.** Um evento muda o estado local e a tela acompanha
//   imediatamente, em vez de esperar o próximo relógio;
// - **guardar rascunho.** O que está sendo editado **não** é sobrescrito pela
//   resposta do servidor. Sem isso, digitar durante um ciclo de quatro segundos
//   perderia o que foi digitado — e o produto preservar o foco não bastaria: o
//   foco ficaria numa caixa cujo valor o próprio MOD acabou de trocar.
function interfaceMod(id, titulo, intervalo = 4000) {
  const api = globalThis.SeeleMods, ui = globalThis.SeeleUI;
  if (!api || !ui) throw new Error('Este MOD exige a API 3 do SEELE.');

  const texto = dentro => ({ forma: 'texto', dentro: String(dentro ?? '') });
  const cabecalho = dentro => ({ forma: 'titulo', dentro: String(dentro ?? '') });
  const lista = itens => ({ forma: 'lista', dentro: itens.map(dentro => ({ forma: 'item', dentro: String(dentro) })) });
  const campo = (chave, rotulo, valor) => ({ forma: 'campo', chave, rotulo, valor: String(valor ?? '') });
  const escolha = (chave, rotulo, valor, opcoes) => ({ forma: 'escolha', chave, rotulo, valor: String(valor ?? ''), opcoes });
  const botao = (chave, dentro, desligado = false) => ({ forma: 'botao', chave, dentro: String(dentro), desligado });
  const linha = dentro => ({ forma: 'linha', dentro });

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

  return { texto, cabecalho, lista, campo, escolha, botao, linha, request, iniciar, desenhar };
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

const { texto, cabecalho, lista, campo, escolha, botao, linha, request, iniciar } =
  interfaceMod('seele/mesa', 'MESA', 2000);

/** O lado de uma célula na tela, em pixels. */
const CELULA = 26;
/** O maior lado de tela que o produto monta. */
const LADO_MAXIMO = 1024;

let ultimo = null;
let aviso = '';
let formula = '1d20';
/** O que está sendo escrito nos campos de criação e edição. */
const rascunho = { campanha: '', cena: '', ficha: '', peca: '', dano: '', entrada: '' };
/** A ficha sendo editada, campo a campo, até alguém gravar. */
let fichaEmEdicao = null;
/** Pintar parede em vez de arrastar peça: a mesma tela, dois modos. */
let modoParede = false;

/** As trilhas que o servidor conhece. `inherit` é «o que a cena disser». */
const TRILHAS = [
  { valor: 'silence', dentro: 'SILÊNCIO' },
  { valor: 'exploration', dentro: 'EXPLORAÇÃO' },
  { valor: 'mystery', dentro: 'MISTÉRIO' },
  { valor: 'battle', dentro: 'COMBATE' },
];

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
  return { forma: 'tela', chave: 'tabuleiro', largura, altura, figuras };
}

function oTabuleiro(campanha) {
  const cena = cenaAtiva(campanha);
  if (!cena) return [texto('Nenhuma cena em cima da mesa.')];
  const partes = [cabecalho(cena.name)];
  if (cena.asset) {
    // A imagem da cena vem da metade de servidor deste MOD. O produto a busca,
    // reconhece o formato pelos bytes e monta — a janela de quem joga não vai
    // buscar bytes na rede de ninguém.
    partes.push({
      forma: 'midia', chave: 'cena:' + cena.id,
      doServidor: { canal: ultimo.canal, pedido: { op: 'asset', scene: cena.id }, campo: 'image' },
      descricao: 'Mapa de ' + cena.name,
    });
  }
  if (cena.kind === 'map') partes.push(tabuleiro(cena));
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

function desenhoDoEstado() {
  if (!ultimo) return [texto('Consultando a campanha deste canal…')];
  const campanha = ultimo.campaign;
  if (!campanha) {
    // **Criar a mesa é daqui.** Antes isto dizia «crie pelo servidor», que é o
    // mesmo que não oferecer: não há «pelo servidor» para quem usa o produto.
    return [
      texto('Nenhuma campanha neste canal.'),
      linha([
        campo('nova-campanha', 'NOME DA CAMPANHA', rascunho.campanha),
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
  // Devolvido na hora: dez megabytes presos até a saída seriam dez megabytes
  // que ninguém mais vai ler.
  await SeeleUI.soltar(escolhido.id);
}

/** Da tela para a grade, e dentro dos limites da cena. */
const naGrade = (valor, teto) => Math.max(0, Math.min(teto - 1, Math.floor(valor / CELULA)));

/**
 * Escreve no servidor e **adota a campanha que ele devolveu**.
 *
 * Toda escrita aqui responde com a projeção nova. Redesenhar com a antiga
 * mostraria o resultado só na consulta seguinte — até dois segundos depois —, e
 * quem rolou um dado ficaria olhando um registro que não tem a rolagem dele.
 */
function escrever(canal, pedido) {
  return request(canal, pedido).then(resposta => {
    if (resposta.campaign) ultimo = { ...ultimo, ...resposta };
    return resposta;
  });
}

iniciar(
  async (snapshot, canal) => {
    const resposta = await request(canal, { op: 'view' });
    ultimo = { ...resposta, presentes: snapshot.presentes, canal };
    return desenhoDoEstado();
  },
  async () => { ultimo = null; arrastando = null; },
  (evento, canal, repintar) => {
    if (!ultimo) return null;
    const campanha = ultimo.campaign;
    const cena = campanha ? cenaAtiva(campanha) : null;
    // Sem campanha só há um caminho: criar uma. Os outros pedem uma mesa.
    if (!campanha && !(evento.nome === 'campo' || evento.chave === 'criar-campanha')) {
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
        repintar(desenhoDoEstado());
        return null;
      }
      // Os três rascunhos com prefixo próprio: ação, verbete e cena.
      if (evento.chave.startsWith('ac-')) {
        acaoEmEdicao = { ...(acaoEmEdicao ?? {}) };
        const nome = evento.chave.slice(3);
        acaoEmEdicao[nome] = nome === 'max' ? (Number(evento.valor) || 0) : evento.valor;
        repintar(desenhoDoEstado());
        return null;
      }
      if (evento.chave.startsWith('v-')) {
        verbeteEmEdicao = { ...(verbeteEmEdicao ?? {}) };
        const nome = evento.chave.slice(2);
        verbeteEmEdicao[nome] = nome === 'level' ? (Number(evento.valor) || 0) : evento.valor;
        repintar(desenhoDoEstado());
        return null;
      }
      if (evento.chave.startsWith('c-') && cena) {
        cenaEmEdicao = { ...(cenaEmEdicao ?? cena) };
        const nome = evento.chave.slice(2);
        const numerico = nome === 'cols' || nome === 'rows';
        cenaEmEdicao[nome] = numerico ? (Number(evento.valor) || 0) : evento.valor;
        repintar(desenhoDoEstado());
        return null;
      }
      if (evento.chave.startsWith('s-') && ficha) {
        // Os espaços de magia entram no mesmo rascunho da ficha: eles são dela.
        fichaEmEdicao = JSON.parse(JSON.stringify(fichaEmEdicao ?? ficha));
        const nivel = Number(evento.chave.slice(2));
        fichaEmEdicao.slots = (fichaEmEdicao.slots ?? []).map((s, i) =>
          i === nivel ? { ...s, max: Number(evento.valor) || 0 } : s);
        repintar(desenhoDoEstado());
        return null;
      }
      const onde = {
        'nova-campanha': 'campanha', 'nova-cena': 'cena',
        'nova-ficha': 'ficha', 'nova-peca': 'peca',
        'nova-entrada': 'entrada', dano: 'dano',
      }[evento.chave];
      if (!onde) return null;
      rascunho[onde] = evento.valor;
      repintar(desenhoDoEstado());
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
          () => repintar(desenhoDoEstado()),
          erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
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
          repintar(desenhoDoEstado());
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
        () => repintar(desenhoDoEstado()),
        erro => {
          aviso = 'a peça não se move: ' + (erro.message || String(erro));
          repintar(desenhoDoEstado());
        },
      );
    }

    if (evento.nome === 'escolha' && evento.chave.startsWith('ac-')) {
      acaoEmEdicao = { ...(acaoEmEdicao ?? {}) };
      acaoEmEdicao[evento.chave.slice(3)] = evento.valor;
      repintar(desenhoDoEstado());
      return null;
    }
    if (evento.nome === 'escolha' && evento.chave === 'trilha-mesa') {
      return escrever(canal, { op: 'music', command: 'select', preset: evento.valor }).then(
        () => repintar(desenhoDoEstado()),
        erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
      );
    }
    if (evento.nome === 'escolha' && evento.chave === 'trilha' && cena) {
      return escrever(canal, { op: 'scene-music', id: cena.id, preset: evento.valor }).then(
        () => repintar(desenhoDoEstado()),
        erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
      );
    }
    if (evento.nome === 'escolha' && evento.chave === 'cena') {
      aviso = 'trocando a cena…';
      repintar(desenhoDoEstado());
      return escrever(canal, { op: 'scene-show', id: evento.valor }).then(
        () => { aviso = ''; repintar(desenhoDoEstado()); },
        erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
      );
    }

    if (evento.nome === 'arquivo') {
      // Cancelar é uma resposta: `null` quer dizer que o seletor foi fechado.
      if (!evento.arquivo) {
        aviso = evento.porque ?? 'nenhum arquivo escolhido';
        repintar(desenhoDoEstado());
        return null;
      }
      if (canal === null) return null;
      const paraRetrato = evento.chave === 'retrato';
      if (paraRetrato && !fichaAberta) return null;
      if (!paraRetrato && !cena) return null;
      aviso = paraRetrato ? 'enviando o retrato…' : 'enviando o mapa…';
      repintar(desenhoDoEstado());
      const enviando = paraRetrato
        ? enviarImagem(canal, evento.arquivo, (extra) => ({ op: 'portrait-part', sheet: fichaAberta, ...extra }))
        : enviarImagem(canal, evento.arquivo, (extra) => ({ op: 'image-part', scene: cena.id, ...extra }));
      return enviando.then(
        () => { aviso = paraRetrato ? 'retrato enviado' : 'mapa enviado'; repintar(desenhoDoEstado()); },
        erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
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
        repintar(desenhoDoEstado());
        return null;
      }
      const conjurar = daFicha('conjurar-');
      if (conjurar) {
        const entrada = campanha.entries.find(e => e.id === conjurar);
        return escrever(canal, {
          op: 'cast', sheet: ficha.id, entry: conjurar, level: entrada?.level ?? 0,
        }).then(
          () => repintar(desenhoDoEstado()),
          erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
        );
      }
      const usar = daFicha('usar-acao-');
      if (usar) {
        return escrever(canal, { op: 'action-use', sheet: ficha.id, id: usar }).then(
          () => repintar(desenhoDoEstado()),
          erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
        );
      }
      const editar = daFicha('editar-acao-');
      if (editar) {
        acaoEmEdicao = { ...(ficha.actions ?? []).find(a => a.id === editar) };
        repintar(desenhoDoEstado());
        return null;
      }
      const tirar = daFicha('tirar-acao-');
      if (tirar) {
        return escrever(canal, { op: 'action-remove', sheet: ficha.id, id: tirar }).then(
          () => repintar(desenhoDoEstado()),
          erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
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
          () => { acaoEmEdicao = null; repintar(desenhoDoEstado()); },
          erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
        );
      }
      if (evento.chave === 'descansar') {
        return escrever(canal, { op: 'rest', sheet: ficha.id }).then(
          () => repintar(desenhoDoEstado()),
          erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
        );
      }
    }
    if (campanha && evento.chave.startsWith('editar-verbete-')) {
      const id = evento.chave.slice('editar-verbete-'.length);
      verbeteEmEdicao = { ...campanha.entries.find(e => e.id === id) };
      repintar(desenhoDoEstado());
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
        () => repintar(desenhoDoEstado()),
        erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
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
        () => { verbeteEmEdicao = null; repintar(desenhoDoEstado()); },
        erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
      );
    }
    if (evento.chave === 'descartar-cena') {
      cenaEmEdicao = null;
      repintar(desenhoDoEstado());
      return null;
    }
    if (evento.chave === 'gravar-cena' && cenaEmEdicao && cena) {
      const c = cenaEmEdicao;
      return escrever(canal, {
        op: 'scene-save', id: cena.id, name: c.name, description: c.description ?? '',
        notes: c.notes ?? '', cols: c.cols, rows: c.rows, cellMeters: cena.cellMeters,
      }).then(
        () => { cenaEmEdicao = null; repintar(desenhoDoEstado()); },
        erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
      );
    }
    if (campanha && evento.chave.startsWith('abrir-ficha-')) {
      fichaAberta = evento.chave.slice('abrir-ficha-'.length);
      repintar(desenhoDoEstado());
      return null;
    }
    if (evento.chave === 'fechar-ficha') {
      fichaAberta = null;
      fichaEmEdicao = null;
      repintar(desenhoDoEstado());
      return null;
    }
    if (evento.chave === 'descartar-ficha') {
      fichaEmEdicao = null;
      repintar(desenhoDoEstado());
      return null;
    }
    if (evento.chave === 'modo-parede') {
      modoParede = !modoParede;
      repintar(desenhoDoEstado());
      return null;
    }
    if (evento.chave === 'gravar-ficha' && fichaEmEdicao) {
      const enviada = fichaEmEdicao;
      return escrever(canal, { op: 'sheet-save', sheet: enviada }).then(
        () => { fichaEmEdicao = null; aviso = 'ficha gravada'; repintar(desenhoDoEstado()); },
        erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
      );
    }
    const quanto = Number(rascunho.dano) || 0;
    const pedido = evento.chave === 'rolar' ? { op: 'roll', formula, label: 'Dados' }
      : evento.chave === 'iniciativa-proximo' ? { op: 'initiative-next' }
        : evento.chave === 'iniciativa-limpar' ? { op: 'initiative-clear' }
          : evento.chave === 'criar-campanha'
            ? { op: 'setup', name: rascunho.campanha, system: 'free', gm: String(ultimo.me ?? '') }
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
        repintar(desenhoDoEstado());
      },
      erro => { aviso = erro.message || String(erro); repintar(desenhoDoEstado()); },
    );
  },
);

})();
