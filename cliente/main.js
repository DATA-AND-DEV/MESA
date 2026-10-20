/* Gerado por ferramentas/build.mjs. API 6. */
(() => {
"use strict";
// Executado exclusivamente no executor do MOD. Cada pacote inclui sua cópia.
//
// A casca dos MODs oficiais: o que os três fazem igual, num lugar só.
//
// # O que mudou com a API 6
//
// A API 6 é a única do app 0.16, e ela não estende a 5: a faixa (`regiao`), o
// `snapshot` e os cartões saíram. O que a casca sabe agora:
//
// - **ler a tela pelo retrato.** `lerRetrato()` é `SeeleUI.retrato()`: quem
//   usa, as pessoas, as salas, os canais (com o `aberto`), onde a casca está e
//   que regiões ela tem. Ele é projetado por lista branca, e só isso chega;
// - **ouvir.** A tela avisa o que muda (`canal`, `sala`, `pessoas`, `lugar`) e
//   a metade de servidor avisa o que ela gravou (`servidor`). Nada aqui pergunta
//   de tempos em tempos: o laço de 2 s da API 4 saiu;
// - **abrir superfícies**: `pagina()`, `dialogo()` e `folha()` devolvem punhos
//   com `montar`, `atualizar` (a montagem por partes), `formulario.erros`,
//   `fechar` e o resto. O `painel` saiu da 6: a `folha` o substitui;
// - **contribuir**: `contribuir()` registra um ponto semântico e devolve o
//   handle; `atualizarContribuicao()` troca o conteúdo sem revogar;
// - **mandar uma imagem pelo volume**: `enviar(arquivo, token)`, quando a
//   plataforma tem (no celular, ela pode faltar; `podeEnviar` diz).
//
// # Ausente é ausente
//
// Num app sem a API 6, `SeeleUI.retrato` não existe. A casca não degrada: ela
// diz qual app este pacote exige, na primeira linha, e o MOD não sobe pela
// metade.
function interfaceMod(id, titulo) {
  const api = globalThis.SeeleMods, ui = globalThis.SeeleUI;
  if (!api || !ui || typeof ui.retrato !== 'function' || !ui.superficies || !ui.contribuicoes) {
    throw new Error(titulo + ' 4 exige a API 6 do SEELE (o app 0.16). A linha legada usa a 3.1.');
  }

  // ---- as formas ----
  const texto = dentro => ({ forma: 'texto', dentro: String(dentro ?? '') });
  const cabecalho = dentro => ({ forma: 'titulo', dentro: String(dentro ?? '') });
  const lista = itens => ({ forma: 'lista', dentro: itens.map(dentro => ({ forma: 'item', dentro: String(dentro) })) });
  const campo = (chave, rotulo, valor, extra) => ({ forma: 'campo', chave, rotulo, valor: String(valor ?? ''), ...extra });
  const escolha = (chave, rotulo, valor, opcoes, extra) => ({ forma: 'escolha', chave, rotulo, valor: String(valor ?? ''), opcoes, ...extra });
  const botao = (chave, dentro, desligado = false, extra) => ({ forma: 'botao', chave, dentro: String(dentro), desligado, ...extra });
  const linha = (dentro, estilo) => ({ forma: 'linha', dentro, ...(estilo ? { estilo } : {}) });

  // **`estilo` e `extra` são argumentos separados, e isso não é arrumação.**
  // `classe`, `chave` e `nomeAcessivel` são do **nó**; `fundo` e `intervalo`
  // são do estilo dele. Misturá-los num objeto só faria `classe: 'editor'`
  // virar uma propriedade de estilo que o validador do produto recusa — e a
  // recusa chegaria como «a superfície não montou», sem dizer qual chave.
  const caixa = (dentro, estilo, extra) => ({ forma: 'caixa', dentro, ...(estilo ? { estilo } : {}), ...extra });
  const pilha = (dentro, estilo, extra) => ({ forma: 'pilha', dentro, ...(estilo ? { estilo } : {}), ...extra });
  const grade = (dentro, estilo, extra) => ({ forma: 'grade', dentro, ...(estilo ? { estilo } : {}), ...extra });
  const separador = (estilo, extra) => ({ forma: 'separador', ...(estilo ? { estilo } : {}), ...extra });
  const espaco = (estilo, extra) => ({ forma: 'espaco', ...(estilo ? { estilo } : {}), ...extra });

  // ---- os controles ----
  //
  // **A validação é declarada** (API 6, §5): `obrigatorio`, `minimo`,
  // `maximo`, `inteiro` e `tamanhoMaximo` vão no `extra` do campo, e o produto
  // impede o `submeter` com a frase dele, sem ida ao MOD. Os primários e
  // secundários do formulário são do produto: `primario` e `secundario` dão o
  // texto deles.
  const formulario = (chave, dentro, extra) => ({ forma: 'formulario', chave, dentro, ...extra });
  const acoes = (dentro, fixas = false) => ({ forma: 'acoes', dentro, ...(fixas ? { fixas: true } : {}) });
  const abas = (chave, valor, dentro) => ({ forma: 'abas', chave, valor, dentro });
  const aba = (chave, rotulo, dentro) => ({ forma: 'aba', chave, rotulo, dentro });
  const textoLongo = (chave, rotulo, valor, extra) => ({ forma: 'textoLongo', chave, rotulo, valor: String(valor ?? ''), ...extra });
  const numero = (chave, rotulo, valor, extra) => ({ forma: 'numero', chave, rotulo, valor, ...extra });
  const marca = (chave, rotulo, valor, extra) => ({ forma: 'marca', chave, rotulo, valor: valor === true, ...extra });
  const distintivo = (dentro, estilo) => ({ forma: 'distintivo', dentro, ...(estilo ? { estilo } : {}) });
  const arquivo = (chave, dentro, extra) => ({ forma: 'arquivo', chave, dentro: String(dentro), ...extra });
  const midia = (chave, extra) => ({ forma: 'midia', chave, ...extra });

  /**
   * Escreve no registro de quem hospeda, **quando há registro**.
   *
   * O `console` do executor nativo só existe a partir da v0.15.1 do SEELE, e
   * a API 4 desde a v0.13.0. Nos apps do meio, um `console.error` num caminho
   * de erro virava `ReferenceError` e derrubava justamente o que ele só queria
   * contar.
   */
  const anotar = (nivel, mensagem) => {
    try { globalThis.console?.[nivel]?.(mensagem); } catch { /* sem registro, não há a quem dizer */ }
  };

  /**
   * O canal de texto aberto, pelo retrato: o que tem `aberto`.
   *
   * O primeiro canal continua sendo a resposta quando nenhum está aberto, que
   * é o instante entre entrar e o produto abrir um.
   */
  const canalDe = retrato => {
    const id = retrato?.canais?.find(c => c?.aberto === true)?.id
      ?? retrato?.canais?.[0]?.id;
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  /**
   * Um pedido à metade de servidor deste MOD.
   *
   * A recusa vira um `Error` com a frase de `error`. Quando ela é de campos, os
   * `erros` dela (a `chave` do controle e o motivo, a forma combinada entre os
   * MODs oficiais) vão presos no erro, para o formulário pô-los nos campos.
   */
  async function request(canal, valor) {
    const resposta = await api.request(id, canal, valor);
    if (!resposta?.ok) {
      const falha = new Error(resposta?.error || 'O servidor recusou a consulta.');
      if (resposta?.erros && typeof resposta.erros === 'object') falha.erros = resposta.erros;
      throw falha;
    }
    return resposta;
  }

  /** Uma atualização em voo e apenas o estado mais recente aguardando. */
  function agruparAtualizacoes(atualizar) {
    let emVoo = null;
    let proxima = null;
    return (...args) => {
      proxima = args;
      if (!emVoo) {
        emVoo = Promise.resolve().then(async () => {
          while (proxima) {
            const atuais = proxima;
            proxima = null;
            await atualizar(...atuais);
          }
        }).finally(() => { emVoo = null; });
      }
      return emVoo;
    };
  }

  // ---- as superfícies ----

  /**
   * Abre (ou reabre) uma superfície e devolve o punho dela.
   *
   * Reabrir **não recria**: chamar com o mesmo `id` mostra a que já existe, e
   * o que estava escrito nos campos dela continua lá. É a diferença entre
   * «mostre aquela» e «comece de novo», e um MOD que quisesse a segunda
   * `descarta` a primeira.
   */
  const superficie = descricao => ui.superficies.criar(descricao);
  const pagina = (chaveDaTela, titulo, extra) =>
    superficie({ id: chaveDaTela, tipo: 'pagina', titulo, ...extra });
  const dialogo = (chaveDaTela, titulo, extra) =>
    superficie({ id: chaveDaTela, tipo: 'dialogo', modal: true, titulo, ...extra });
  /** A folha: ao lado da página, ou por cima do palco da chamada; até 3 à vista. */
  const folha = (chaveDaTela, titulo, extra) =>
    superficie({ id: chaveDaTela, tipo: 'folha', titulo, ...extra });

  /** Um aviso curto. A fila dele tem fim; ver `enfileirarAviso` no produto. */
  const avisar = (mensagem, tom) => ui.superficies.avisar(mensagem, tom);

  /**
   * Diz alguma coisa a quem está olhando, **sem ocupar a sessão**, e sem
   * lançar: um aviso que não sai não pode virar o erro de quem o chamou.
   */
  const dizer = (mensagem, tom = 'normal') =>
    avisar(mensagem, tom).then(() => {}, falha => anotar('warn', titulo + ': ' + (falha?.message || String(falha))));

  // ---- as contribuições ----

  /** Registra uma contribuição e devolve o handle. */
  const contribuir = pedido => ui.contribuicoes.registrar(pedido);
  /** Troca o conteúdo sem revogar: o produto não redesenha o nativo no meio. */
  const atualizarContribuicao = (handle, conteudo) => ui.contribuicoes.atualizar(handle, conteudo);
  const revogar = handle => ui.contribuicoes.revogar(handle);

  /**
   * Uma entrada na navegação do servidor: o gesto que abre a atividade.
   * Ela não ocupa altura nenhuma até alguém apertá-la.
   */
  const entrada = (rotulo, acao = 'abrir', extra) => contribuir({
    ponto: 'servidor.navegacao',
    modo: 'adicionar',
    rotulo,
    acaoPrincipal: acao,
    ...extra,
  });

  // ---- a tela ----

  /** O retrato da tela agora. Uma ida à ponte: leia ao subir e quando um evento disser que mudou. */
  const lerRetrato = () => ui.retrato();

  /**
   * O ouvinte dos eventos, **um só**: o último registrado vence.
   *
   * O erro do MOD fica com o MOD, e é dito em vez de sumir — síncrono ou de
   * promessa.
   */
  const ouvir = fn => {
    const falhou = erro => void dizer('Falhou: ' + (erro?.message || String(erro)), 'erro');
    ui.aoEvento(evento => {
      try {
        const talvez = fn(evento);
        if (talvez && typeof talvez.catch === 'function') talvez.catch(falhou);
      } catch (erro) {
        falhou(erro);
      }
    });
  };

  // ---- o volume ----
  //
  // **A imagem vai inteira, por um token que a metade de servidor deu**
  // (ADR 0048). O envio pede duas capacidades: a `volume`, que dá o `enviar`,
  // e a `arquivo`, que dá o seletor e o `soltar`. Sem as duas — o navegador e
  // o celular cuja ponte não as tem —, o MOD não oferece envio, e diz onde ele
  // está.
  const podeEnviar = typeof ui.enviar === 'function' && typeof ui.soltar === 'function';
  const enviar = (arquivoEscolhido, token) => ui.enviar(arquivoEscolhido, token);
  const soltar = arquivoEscolhido => (typeof ui.soltar === 'function' ? ui.soltar(arquivoEscolhido) : Promise.resolve(false));

  return {
    // formas
    texto, cabecalho, lista, campo, escolha, botao, linha, arquivo, midia,
    caixa, pilha, grade, separador, espaco,
    formulario, acoes, abas, aba, textoLongo, numero, marca, distintivo,
    // servidor
    request, agruparAtualizacoes, anotar, canalDe,
    // superfícies e contribuições
    superficie, pagina, dialogo, folha, avisar, dizer,
    contribuir, atualizarContribuicao, revogar, entrada,
    // tela e volume
    lerRetrato, ouvir, podeEnviar, enviar, soltar,
  };
}

// A MESA: o tabuleiro, as peças que se arrastam, os dados, as fichas e a
// iniciativa — na API 6.
//
// # Onde a mesa mora
//
// - **na página**, aberta pela entrada **Mesa** da navegação, pelo cabeçalho do
//   canal que tem mesa, ou pela ação **MESA** da sala de voz amarrada a uma.
//   Ela mostra a mesa de um canal de texto: o aberto, ou o da sala;
// - **no palco da chamada** (`chamada.palco`), para quem está numa sala de voz
//   amarrada a uma mesa: o tabuleiro, quem está na vez, os dados e a trilha.
//   Quem amarra é o mestre, nas configurações; a metade de servidor responde
//   `mesa-da-sala` pela sala em que a pessoa está, e a janela nunca diz qual;
// - **numa folha**, a ficha em jogo: vida, condições, testes, ações e magias;
// - **em diálogos**, os formulários: criar a mesa, editar a ficha, a ação, o
//   verbete, a cena, a peça, a iniciativa à mão e as configurações.
//
// # O que muda e o que não muda
//
// **Nada aqui pergunta de tempos em tempos.** A metade de servidor avisa cada
// revisão nova (`mundo.avisar`), e a janela consulta quando o aviso fala de uma
// mesa que ela mostra e de uma revisão que ela não tem. A própria escrita já
// devolve a projeção nova.
//
// **Nada é remontado inteiro sem precisar.** Cada superfície nasce de um
// esqueleto com partes de chave própria, e uma revisão nova troca só as partes
// que mudaram (`superficie.atualizar`). Cada parte cabe nos 12 KiB de uma
// mensagem, cortada por `caber` quando não cabe.
//
// **A autoridade continua do servidor.** Este lado não decide quem pode mover
// uma peça ou editar uma ficha; ele pede, e o servidor recusa com o código e,
// quando é de campo, com o campo — que volta ao formulário.

const {
  texto, cabecalho, campo, escolha, botao, linha, arquivo, midia,
  caixa, pilha, grade, espaco, formulario, acoes, abas, aba, textoLongo, numero, marca, distintivo,
  request, agruparAtualizacoes, anotar, canalDe,
  pagina, dialogo, folha, dizer, contribuir, atualizarContribuicao, revogar, entrada,
  lerRetrato, ouvir, podeEnviar, enviar, soltar,
} = interfaceMod('seele/mesa', 'MESA');

// ------------------------------------------------------------ o vocabulário

/** Os sistemas que este servidor aceita em `setup`. */
const SISTEMAS = [
  { valor: 'free', dentro: 'LIVRE' },
  { valor: 'dnd5e-2014', dentro: 'D&D 5E (2014)' },
];

/** As trilhas que o servidor conhece. */
const TRILHAS = [
  { valor: 'silence', dentro: 'SILÊNCIO' },
  { valor: 'exploration', dentro: 'EXPLORAÇÃO' },
  { valor: 'mystery', dentro: 'MISTÉRIO' },
  { valor: 'battle', dentro: 'COMBATE' },
];

/**
 * A trilha de cada ambiente, como arquivo **deste pacote**, declarado no
 * `mod.json`: um som que o manifesto não nomeia não é servido. `silence` não
 * tem arquivo porque silêncio não é um som.
 */
const TRILHAS_EM_ARQUIVO = {
  exploration: 'som/exploracao.wav',
  mystery: 'som/misterio.wav',
  battle: 'som/combate.wav',
};

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
const MODOS_DE_TESTE = [
  { valor: 'normal', dentro: 'NORMAL' },
  { valor: 'advantage', dentro: 'VANTAGEM' },
  { valor: 'disadvantage', dentro: 'DESVANTAGEM' },
];

/** Os seis atributos, na ordem de sempre. */
const ATRIBUTOS = [['str', 'FOR'], ['dex', 'DES'], ['con', 'CON'], ['int', 'INT'], ['wis', 'SAB'], ['cha', 'CAR']];

/**
 * O que cada recusa quer dizer, para quem usa.
 *
 * O servidor recusa por código, e o código é para quem escreve MOD. Uma mesa
 * que mostrasse `gm-only` a quem joga estaria falando com a pessoa errada.
 */
const FRASES = {
  conflict: 'outra pessoa mudou a mesa ao mesmo tempo; tente de novo',
  'gm-only': 'só quem mestra pode fazer isto',
  'not-owner': 'isto é de outra pessoa',
  'admin-only': 'só quem administra o servidor cria a mesa',
  'already-created': 'este canal já tem uma mesa',
  'not-found': 'isto não está mais na mesa',
  limit: 'a mesa chegou ao teto deste tipo de coisa: apague um para pôr outro',
  'campanha-cheia': 'o espaço das mesas deste servidor acabou: apague cenas, verbetes ou notas longas',
  'quintal-cheio': 'o espaço das mesas deste servidor acabou: apague cenas, verbetes ou notas longas',
  'campaign-full': 'esta mesa chegou ao tamanho máximo: apague cenas, verbetes ou notas longas',
  'sala-ocupada': 'esta sala já tem a mesa de outro canal',
  'invalid-dice': 'a fórmula de dados não é válida: use algo como 1d20+3',
  'no-slot': 'não há espaço de magia livre desse nível',
  'no-use': 'esta ação não tem mais usos até recuperar',
  'not-prepared': 'esta magia não está preparada nesta ficha',
  'empty-initiative': 'a iniciativa está vazia',
  'read-only': 'você só lê este canal',
  'grid-occupied': 'há peça ou parede fora da grade nova',
  'volume-fechado': 'o servidor não abriu o envio de imagens agora',
  'envio-desconhecido': 'o servidor não esperava mais esta imagem; envie de novo',
  'imagem-nao-chegou': 'a imagem não chegou ao servidor; envie de novo',
  'image-too-large': 'a imagem passa de 10 MiB',
  'arquivo-grande-demais': 'a imagem passa de 10 MiB',
  'tipo-recusado': 'este arquivo não é uma imagem PNG, JPEG, WebP ou GIF',
  'formato-desconhecido': 'este arquivo não é uma imagem PNG, JPEG, WebP ou GIF',
  'sem-espera': 'o servidor não esperava esta imagem; envie de novo',
  'nao-gravei': 'o servidor não gravou a imagem; envie de novo',
  incompleto: 'a imagem chegou pela metade; envie de novo',
  'sessao-encerrada': 'a sessão acabou antes de a imagem chegar',
  'too-many-requests': 'a mesa está ocupada com outros pedidos; tente de novo',
  // A lista fechada das recusas do SEELE: um nome fora dela chega como
  // `falhou`, e o motivo fica no registro de quem hospeda.
  falhou: 'o SEELE não disse o motivo aqui; ele está no registro do app',
  'fila-cheia': 'o SEELE está ocupado; tente de novo',
  'mensagem-grande': 'o que a mesa quis mostrar não coube numa mensagem do SEELE',
  // A montagem que não coube inteira: o que coube ficou na tela, e a amostra
  // do resto vai ao registro (`semCair`).
  'nos-recusados': 'o SEELE não montou parte do que a mesa declarou; o resto está na tela',
  'tipo-desconhecido': 'este SEELE não oferece o que a mesa pediu',
  'papel-nao-serve': 'este arquivo não é uma imagem',
  'arquivo-ilegivel': 'o arquivo escolhido não se lê',
  'arquivo-nao-esta-de-pe': 'o arquivo escolhido não está mais disponível; escolha de novo',
  'arquivo-de-outro-mod': 'o arquivo escolhido não é desta mesa; escolha de novo',
  'arquivos-demais-de-pe': 'há arquivos escolhidos demais esperando; tente de novo daqui a pouco',
  'caminho-invalido': 'o seletor devolveu algo que não é um arquivo',
  'banco-indisponivel': 'o SEELE não conseguiu registrar o arquivo escolhido; tente de novo',
};

/** A frase de uma recusa: a do código, quando há, e a mensagem dela, quando não. */
const frase = erro => {
  const codigo = String(erro?.erro || erro?.message || erro || '');
  return FRASES[codigo] ?? codigo;
};

// ------------------------------------------------- o que cabe numa mensagem

/**
 * Quanto cabe numa parte: o teto por mensagem do produto, menos o envelope.
 *
 * O produto recusa toda mensagem do MOD acima de 12 KiB, e cada `atualizar` é
 * uma mensagem. O envelope — `tipo`, `n`, a superfície e a chave — fica de
 * fora com folga.
 */
const TETO_DA_MONTAGEM = 12 * 1024 - 512;

/** O tamanho em bytes UTF-8 do que vai à ponte: a mesma conta do prelúdio. */
function bytesNaPonte(valor) {
  const t = JSON.stringify(valor);
  let bytes = 0;
  for (let i = 0; i < t.length; i += 1) {
    const unidade = t.charCodeAt(i);
    if (unidade < 0x80) bytes += 1;
    else if (unidade < 0x800) bytes += 2;
    else if (unidade >= 0xd800 && unidade <= 0xdbff) { bytes += 4; i += 1; }
    else bytes += 3;
  }
  return bytes;
}

/** Nada cortado: listas inteiras, textos inteiros, a cena com tudo. */
const SEM_CORTE = Object.freeze({ lista: Infinity, texto: Infinity, rotulos: true, grade: true });
/**
 * O que esta parte cortou para caber. `caber` o aperta, um passo de cada vez,
 * e o devolve a `SEM_CORTE` no fim: fora de uma montagem nada é cortado.
 */
let corte = SEM_CORTE;
/**
 * Os passos, do que menos se sente ao que mais se sente. **Campo editável
 * nunca é cortado**: um texto encurtado num campo voltaria ao servidor
 * encurtado na próxima gravação.
 */
const PASSOS_DO_CORTE = [
  { lista: 24 }, { texto: 400 }, { lista: 12 }, { rotulos: false },
  { texto: 160 }, { lista: 6 }, { grade: false }, { lista: 3, texto: 80 },
];

/**
 * Monta a árvore que cabe, ou diz por que não coube.
 *
 * @param {() => any} montar Quem constrói a árvore, lendo `corte`.
 * @param {(bytes: number) => any} quandoNaoCabe A árvore que explica, com o
 *   tamanho da que não coube.
 */
function caber(montar, quandoNaoCabe) {
  try {
    corte = SEM_CORTE;
    let arvore = montar();
    for (const passo of PASSOS_DO_CORTE) {
      if (bytesNaPonte(arvore) <= TETO_DA_MONTAGEM) return arvore;
      corte = { ...corte, ...passo };
      arvore = montar();
    }
    const bytes = bytesNaPonte(arvore);
    if (bytes <= TETO_DA_MONTAGEM) return arvore;
    corte = SEM_CORTE;
    return quandoNaoCabe(bytes);
  } finally {
    corte = SEM_CORTE;
  }
}

/** Os primeiros itens de uma lista, quantos o corte deixa. */
const oQueCabe = itens => itens.slice(0, corte.lista);
/** A frase do que ficou de fora de uma lista, quando ficou alguma coisa. */
const oQueFicouDeFora = (itens, oQue) => {
  const fora = itens.length - Math.min(itens.length, corte.lista);
  return fora > 0
    ? [caixa(['+' + fora + ' ' + oQue + ' não cabem aqui: cada parte da tela do SEELE leva até 12 KiB.'],
      { corpo: 11, opacidade: 0.7 })]
    : [];
};
/** Um texto de leitura, encurtado pelo corte. Nunca o valor de um campo. */
const resumir = t => {
  const s = String(t ?? '');
  return s.length > corte.texto ? s.slice(0, corte.texto) + '…' : s;
};

/** A parte que nem cortada coube: diz o tamanho, em vez de não montar. */
const naoCoube = bytes => [estadoVazio('Esta parte não coube numa tela do SEELE',
  'Ela tem ' + bytes + ' bytes mesmo cortada, e cada parte leva até 12.288. '
  + 'O que mais pesa são os textos longos: encurte-os.')];

/**
 * Uma superfície montada **em partes**.
 *
 * O esqueleto vai num `montar`, com uma caixa vazia de chave própria no lugar
 * de cada parte; cada parte vai num `atualizar`, e só quando mudou. Um
 * esqueleto novo (uma aba trocada, a mesa que passou a existir) remonta, e as
 * partes vão de novo.
 */
class EmPartes {
  constructor(punho) {
    this.punho = punho;
    this.esqueleto = null;
    this.partes = new Map();
  }

  /** Esquece o que foi mandado: a próxima pintura remonta tudo. */
  esquecer() {
    this.esqueleto = null;
    this.partes.clear();
  }

  /**
   * @param {any[]} esqueleto A árvore, com `parte(chave)` onde cada parte vai.
   * @param {Array<[string, () => any[]]>} partes Cada chave e quem a constrói.
   */
  async pintar(esqueleto, partes) {
    const json = JSON.stringify(esqueleto);
    if (json !== this.esqueleto) {
      await this.punho.montar(esqueleto);
      this.esqueleto = json;
      this.partes.clear();
      for (const [chave] of partes) this.partes.set(chave, JSON.stringify(parte(chave)));
    }
    for (const [chave, construir] of partes) {
      const no = parte(chave, caber(construir, naoCoube));
      const feito = JSON.stringify(no);
      if (this.partes.get(chave) === feito) continue;
      await this.punho.atualizar(chave, no);
      this.partes.set(chave, feito);
    }
  }
}

/** O lugar de uma parte no esqueleto, ou a parte com o que ela tem dentro. */
const parte = (chave, dentro = []) => caixa(dentro, { direcao: 'coluna', intervalo: 12 }, { chave });

// ------------------------------------------------------------- o estado

/** O retrato da tela: quem usa, as pessoas, as salas, os canais, onde. */
let tela = null;
/** O canal de texto aberto. */
let canalAberto = null;

/**
 * A última projeção de cada mesa que esta janela mostrou, por canal: o que o
 * servidor respondeu a `view` ou a uma escrita. `{ erro }` quando a consulta
 * foi recusada.
 */
const vistas = new Map();

/** A página da mesa. */
const pag = {
  punho: null, partes: null, aberta: false, titulo: null,
  /** O canal cuja mesa ela mostra, e se ela segue o canal aberto. */
  canal: null, segueOCanal: true,
  aba: 'aba-tabuleiro',
  /** A largura da sessão, do evento `lugar`. */
  largura: 0,
  /** A página fechou e vai reabrir: a trilha precisa de `tocando` mudando. */
  religar: false,
  formula: '1d20', rolando: false, ultimaRolagem: null, aviso: '',
  modoParede: false, arrasto: null, enviando: false,
  /** A casa onde o gesto de pintar parede começou. */
  pincel: null,
};

/** O palco da chamada: a mesa da sala de voz em que a pessoa está. */
const palco = {
  sala: null, canal: null, handle: null, json: null,
  /** O tamanho do palco, do evento `lugar` com `regiao: 'chamada.palco'`. */
  largura: 0, altura: 0,
  formula: '1d20', rolando: false, ultimaRolagem: null, aviso: '', arrasto: null,
};

/** A folha da ficha em jogo. */
const ficha = {
  punho: null, partes: null, aberta: false, titulo: null,
  canal: null, id: null,
  quanto: '', teste: 'skill:perception', modo: 'normal', aviso: '', enviando: false,
};

/** Os diálogos de pé, por id: `{ punho, partes, canal, tipo, base, campos, enviando }`. */
const dialogos = new Map();

/** O cabeçalho do canal aberto: `{ canal, handle, json }`. */
const cabecalhoDoCanal = { canal: null, handle: null, json: null };

/** As salas de voz amarradas que esta janela conhece: sala → canal. */
const salasConhecidas = new Map();
/** As ações MESA registradas nas salas: sala → `{ canal, handle }`. */
const acoesDasSalas = new Map();

/** A entrada da navegação. */
const navegacao = { handle: null, recusaDita: '' };

/** A trilha parou: o motivo, e se ele já foi dito. */
const trilha = { parou: '', ditos: new Set() };

const celular = () => tela?.onde === 'celular';
/**
 * **Enviar imagem é no computador**: onde a plataforma não tem `enviar`, e no
 * celular, onde mestrar e preparar a mesa ficam de fora.
 */
const enviaAqui = () => podeEnviar && !celular();

// --------------------------------------------------------- quem é quem

const nomeDe = id => {
  const pessoa = tela?.pessoas?.find(p => String(p.id) === String(id));
  return pessoa?.apelido || 'Pessoa ' + id;
};

/** Quem está aqui, na forma que uma `escolha` aceita. */
const pessoasComoOpcoes = (incluir = []) => {
  const opcoes = (tela?.pessoas ?? []).map(p => ({ valor: String(p.id), dentro: p.apelido || 'Pessoa ' + p.id }));
  // Quem é dono e não está conectado continua sendo uma opção: sumir com ele
  // faria a escolha mostrar outra pessoa.
  for (const id of incluir) {
    if (id && !opcoes.some(o => o.valor === String(id))) opcoes.push({ valor: String(id), dentro: nomeDe(id) });
  }
  return opcoes;
};

const cenaAtiva = c => c.scenes.find(s => s.id === c.active) ?? null;

/** Quem está na vez: o que o servidor diz a quem joga, e o índice a quem mestra. */
const naVez = c => c.initiative.find(i => i.id === c.currentTurn)
  ?? (c.turn !== undefined ? c.initiative[c.turn] ?? null : null);

/** A projeção de um canal, ou `null`. */
const vistaDe = canal => (canal === null ? null : vistas.get(canal) ?? null);

// ----------------------------------------------- o servidor: ler e escrever

const consultas = new Map();

/**
 * Consulta a mesa de um canal. **Uma consulta em voo por canal, e só a mais
 * recente esperando**: dois avisos seguidos não viram duas idas.
 */
function consultar(canal) {
  if (canal === null) return Promise.resolve();
  if (!consultas.has(canal)) {
    consultas.set(canal, agruparAtualizacoes(async () => {
      try {
        adotar(canal, await request(canal, { op: 'view' }));
      } catch (erro) {
        vistas.set(canal, { erro: frase(erro) });
        repintar();
      }
    }));
  }
  return consultas.get(canal)();
}

/**
 * Guarda a projeção que o servidor devolveu e repinta o que a mostra.
 *
 * Uma resposta mais velha que a que já está aqui não volta no tempo: uma
 * consulta que saiu antes de uma escrita pode chegar depois dela.
 */
function adotar(canal, resposta) {
  const antes = vistas.get(canal);
  if (antes?.campaign && resposta.campaign && resposta.campaign.revision < antes.campaign.revision) return;
  const { envio: _envio, ...projecao } = resposta;
  vistas.set(canal, projecao);
  // As salas amarradas que esta mesa diz: a dela, e nenhuma outra deste canal.
  const sala = projecao.campaign?.sala ?? null;
  for (const [outra, dono] of salasConhecidas) if (dono === canal && outra !== sala) salasConhecidas.delete(outra);
  if (sala !== null) salasConhecidas.set(sala, canal);
  repintar();
}

let serieDeEscrita = 0;
/** Um prefixo por execução, para duas janelas não colidirem de nome. */
const marcaDaExecucao = Math.floor(Math.random() * 0xffffff).toString(36);
/** Uma marca nova, dentro do que `key()` do servidor aceita: `[a-z0-9-]{1,64}`. */
const proximaMarca = () => 'e-' + marcaDaExecucao + '-' + (++serieDeEscrita);

/**
 * Escreve no servidor e **adota a campanha que ele devolveu**.
 *
 * O servidor exige `nonce` (o recibo que faz uma resposta perdida não virar
 * duas escritas) e `revision` (a revisão sobre a qual a escrita foi pensada).
 * Numa recusa por `conflict` nada foi aplicado: este lado consulta e repete
 * **uma vez**, com a mesma marca. O pedido pode ser uma função, e então ele é
 * refeito sobre a projeção nova — é o que faz a gravação da ficha ir sobre a
 * ficha que acabou de chegar.
 *
 * @param {number} canal O canal desta mesa.
 * @param {object | (() => object)} pedido O que a operação diz, sem `nonce` e
 *   `revision`, ou quem o monta a partir da projeção de agora.
 */
async function escrever(canal, pedido, marca = proximaMarca()) {
  escritasEmVoo.set(canal, (escritasEmVoo.get(canal) ?? 0) + 1);
  try {
    return await escreverJa(canal, pedido, marca);
  } finally {
    const resta = escritasEmVoo.get(canal) - 1;
    if (resta > 0) escritasEmVoo.set(canal, resta);
    else {
      escritasEmVoo.delete(canal);
      // O aviso que chegou com a escrita em voo, decidido agora: a resposta
      // dela já trouxe a revisão que ele anunciava, ou não trouxe.
      const anunciada = avisosGuardados.get(canal);
      avisosGuardados.delete(canal);
      if (anunciada !== undefined && anunciada > (vistaDe(canal)?.campaign?.revision ?? -1)) void consultar(canal);
    }
  }
}

/**
 * As escritas em voo por canal, e o aviso que chegou durante elas.
 *
 * **O aviso da própria escrita pode chegar antes da resposta dela**: os dois
 * saem do servidor por caminhos diferentes. Decidido na chegada, ele falaria
 * de uma revisão que a resposta ainda não trouxe, e viraria uma consulta à
 * toa a cada rolagem. Ele espera a escrita assentar.
 */
const escritasEmVoo = new Map();
const avisosGuardados = new Map();

async function escreverJa(canal, pedido, marca) {
  const montar = typeof pedido === 'function' ? pedido : () => pedido;
  const tentar = () => {
    const corpo = montar();
    const completo = { ...corpo, nonce: marca };
    const c = vistaDe(canal)?.campaign;
    if (corpo.op !== 'setup' && c) completo.revision = c.revision;
    return request(canal, completo);
  };
  let resposta;
  try {
    resposta = await tentar();
  } catch (erro) {
    if (erro?.message !== 'conflict') throw erro;
    adotar(canal, await request(canal, { op: 'view' }));
    resposta = await tentar();
  }
  if (resposta.campaign !== undefined) adotar(canal, resposta);
  return resposta;
}

/** A sala de voz em que a pessoa está, e a mesa dela, pelo servidor. */
const perguntarASala = agruparAtualizacoes(async () => {
  let resposta;
  try {
    resposta = await request(0, { op: 'mesa-da-sala' });
  } catch (erro) {
    anotar('warn', 'MESA: a mesa da sala não respondeu: ' + frase(erro));
    resposta = { sala: null, canal: null };
  }
  const canal = Number.isSafeInteger(resposta.canal) ? resposta.canal : null;
  if (resposta.sala !== null && canal !== null) salasConhecidas.set(resposta.sala, canal);
  if (canal !== palco.canal) {
    Object.assign(palco, { arrasto: null, aviso: '', ultimaRolagem: null, rolando: false });
  }
  palco.sala = resposta.sala ?? null;
  palco.canal = canal;
  if (canal !== null) await consultar(canal);
  repintar();
});

// --------------------------------------------------------- o que se vê

/** Uma tarefa de tela por vez: o prelúdio aceita só 8 pedidos em voo. */
let fila = Promise.resolve();
const naFila = tarefa => {
  const vez = fila.then(tarefa);
  fila = vez.catch(() => {});
  return vez;
};

/** O que o SEELE recusou, para o registro: a conta e a amostra, quando ele as dá. */
const doRecusado = erro => (Array.isArray(erro?.amostra)
  ? ' (' + (erro.recusados ?? erro.amostra.length) + ' recusado(s): ' + JSON.stringify(erro.amostra) + ')'
  : '');

/** As falhas de pintura já ditas, por lugar, para não repeti-las a cada revisão. */
const falhasDitas = new Map();
async function semCair(lugar, pintar) {
  try {
    await pintar();
    falhasDitas.delete(lugar);
  } catch (erro) {
    const motivo = frase(erro);
    anotar('error', 'MESA: ' + lugar + ': ' + motivo + doRecusado(erro));
    if (falhasDitas.get(lugar) !== motivo) {
      falhasDitas.set(lugar, motivo);
      await dizer('A MESA não conseguiu desenhar ' + lugar + ': ' + motivo, 'erro');
    }
  }
}

/** Redesenha tudo o que está de pé, com o que esta janela sabe agora. */
const repintar = agruparAtualizacoes(() => naFila(async () => {
  largarOQueNaoEstaAVista();
  await semCair('a entrada', pintarAEntrada);
  await semCair('o cabeçalho do canal', pintarOCabecalho);
  await semCair('as ações da sala', pintarAsSalas);
  await semCair('o palco', pintarOPalco);
  await semCair('a página', pintarAPagina);
  await semCair('a ficha', pintarAFicha);
  for (const d of dialogos.values()) await semCair('o diálogo', () => pintarODialogo(d));
}));

/** Os canais que alguma coisa de pé mostra. */
const canaisAVista = () => new Set([pag.canal, palco.canal, ficha.aberta ? ficha.canal : null,
  ...[...dialogos.values()].map(d => d.canal), canalAberto].filter(c => c !== null));

/**
 * **O que estava sendo editado não atravessa de mesa.** Uma campanha é por
 * canal, e a ficha `sheet-3` aberta de uma é outra ficha, com o mesmo número,
 * na outra. Quando nem a página nem o palco mostram mais a mesa de uma folha
 * ou de um diálogo, eles saem.
 */
function largarOQueNaoEstaAVista() {
  const mostradas = new Set([pag.canal, palco.canal].filter(c => c !== null));
  if (ficha.aberta && !mostradas.has(ficha.canal)) void fecharAFicha();
  for (const [id, d] of dialogos) if (!mostradas.has(d.canal)) void descartarODialogo(id);
}

// ------------------------------------------------- a entrada e o cabeçalho

async function pintarAEntrada() {
  if (navegacao.handle) return;
  try {
    navegacao.handle = (await entrada('Mesa', 'abrir-mesa', { nomeAcessivel: 'Abrir a mesa de RPG deste canal' })).handle;
  } catch (erro) {
    // **A porta recusada é dita a quem usa**, uma vez por motivo: ela é um dos
    // jeitos de abrir a mesa, e a próxima pintura tenta de novo.
    const motivo = frase(erro);
    if (motivo !== navegacao.recusaDita) {
      navegacao.recusaDita = motivo;
      await dizer('A entrada Mesa foi recusada pelo SEELE: ' + motivo, 'erro');
    }
  }
}

/** A linha que diz em que pé a mesa está: o nome, a rodada e quem está na vez. */
function resumoDaMesa(c) {
  const vez = naVez(c);
  return 'MESA · ' + c.name + (c.initiative.length ? ' · rodada ' + c.round : '')
    + (vez ? ' · na vez: ' + vez.name : '');
}

/**
 * **O cabeçalho do canal aberto**, quando ele tem mesa: a linha de estado e o
 * botão que abre a página. A revisão nova o **atualiza**, sem revogar: o
 * produto não volta ao nativo entre os dois.
 */
async function pintarOCabecalho() {
  const c = vistaDe(canalAberto)?.campaign ?? null;
  const conteudo = c ? caixa([resumoDaMesa(c)], { corpo: 12 }) : null;
  const json = JSON.stringify(conteudo);
  if (cabecalhoDoCanal.handle && (cabecalhoDoCanal.canal !== canalAberto || !c)) {
    const handle = cabecalhoDoCanal.handle;
    Object.assign(cabecalhoDoCanal, { canal: null, handle: null, json: null });
    await revogar(handle);
  }
  if (!c) return;
  if (!cabecalhoDoCanal.handle) {
    const { handle } = await contribuir({
      ponto: 'canal.cabecalho', modo: 'adicionar', alvo: String(canalAberto), conteudo,
      acaoPrincipal: 'abrir-mesa', rotulo: 'ABRIR A MESA', nomeAcessivel: 'Abrir a mesa deste canal',
    });
    Object.assign(cabecalhoDoCanal, { canal: canalAberto, handle, json });
  } else if (cabecalhoDoCanal.json !== json) {
    await atualizarContribuicao(cabecalhoDoCanal.handle, conteudo);
    cabecalhoDoCanal.json = json;
  }
}

/** **MESA** nas ações de cada sala de voz amarrada que esta janela conhece. */
async function pintarAsSalas() {
  for (const [sala, registrada] of acoesDasSalas) {
    if (salasConhecidas.get(sala) === registrada.canal) continue;
    acoesDasSalas.delete(sala);
    await revogar(registrada.handle);
  }
  for (const [sala, canal] of salasConhecidas) {
    if (acoesDasSalas.has(sala)) continue;
    const { handle } = await contribuir({
      ponto: 'sala.acoes', modo: 'adicionar', alvo: String(sala),
      acaoPrincipal: 'mesa-da-sala', rotulo: 'MESA', nomeAcessivel: 'Abrir a mesa desta sala',
    });
    acoesDasSalas.set(sala, { canal, handle });
  }
}

// ------------------------------------------------------------ o tabuleiro

/** O lado de uma célula, em pixels, quando a grade cabe. */
const CELULA = 26;
/** O maior lado de tela que o produto monta. */
const LADO_MAXIMO = 1024;
/** O que a tela deixa para a margem do lugar onde ela mora. */
const MARGEM = 32;

/**
 * O lado da casa desta cena: 26 px, ou menos quando a grade não cabe no lugar.
 *
 * A largura vem do evento `lugar` — a sessão, para a página; o palco, para o
 * palco —, e a altura só conta no palco, que não rola. Sem tamanho dito, conta
 * contra o teto da tela.
 */
function ladoDaCasa(cena, largura = 0, altura = 0) {
  const cabeLargura = Math.min(LADO_MAXIMO, largura > 0 ? largura - MARGEM : LADO_MAXIMO);
  const cabeAltura = altura > 0 ? Math.min(LADO_MAXIMO, altura - 160) : LADO_MAXIMO;
  const lado = Math.min(CELULA,
    Math.floor(cabeLargura / Math.max(cena.cols, 1)),
    Math.floor(cabeAltura / Math.max(cena.rows, 1)));
  return Math.max(6, lado);
}

/** As paredes vizinhas de cada linha, juntas: `{ x, y, casas }`. */
function muros(paredes) {
  const ordenadas = [...paredes].sort((a, b) => a.y - b.y || a.x - b.x);
  const juntos = [];
  for (const parede of ordenadas) {
    const anterior = juntos.at(-1);
    if (anterior && anterior.y === parede.y && anterior.x + anterior.casas === parede.x) anterior.casas += 1;
    else juntos.push({ x: parede.x, y: parede.y, casas: 1 });
  }
  return juntos;
}

/**
 * A imagem de uma cena ou de um retrato, pedida à metade de servidor: pelo
 * volume quando ela foi enviada por ele, e pelas páginas antigas quando veio de
 * uma campanha da 3.1.
 */
const doServidor = (canal, pedido, pelovolume) => ({
  canal, pedido: pelovolume ? { ...pedido, transporte: 'volume' } : pedido, campo: 'image',
});

/**
 * O tabuleiro: grade, paredes e peças, tudo declarado.
 *
 * As peças vêm **por último** de propósito: a última figura declarada é a que o
 * toque encontra primeiro. **O mapa é o fundo da tela**, e não uma imagem ao
 * lado: as coordenadas das peças são as dele.
 *
 * Uma tela cabe numa mensagem, e é a mensagem que manda (`limites` do
 * contrato: com chave e cor cabem 155 figuras em 12 KiB, antes das 256 que a
 * tela aceita). Quando ela não cabe, os nomes das peças saem primeiro, e a
 * grade depois (`corte`).
 */
function tabuleiro(onde, canal, cena, lado) {
  const largura = cena.cols * lado;
  const altura = cena.rows * lado;
  const pecas = cena.tokens ?? [];
  const paredes = muros(cena.walls ?? []);
  const { grade, rotulos } = corte;
  const figuras = [];
  if (grade) {
    for (let c = 0; c <= cena.cols; c += 1) figuras.push({ tipo: 'linha', x: c * lado, y: 0, ate_x: c * lado, ate_y: altura, cor: '#241f19' });
    for (let l = 0; l <= cena.rows; l += 1) figuras.push({ tipo: 'linha', x: 0, y: l * lado, ate_x: largura, ate_y: l * lado, cor: '#241f19' });
  }
  for (const muro of paredes) {
    figuras.push({ tipo: 'retangulo', x: muro.x * lado, y: muro.y * lado, largura: muro.casas * lado, altura: lado, cor: '#3a322a' });
  }
  const arrasto = onde.arrasto;
  for (const peca of pecas) {
    const { x, y } = arrasto && arrasto.id === peca.id ? arrasto : peca;
    figuras.push({
      tipo: 'circulo', chave: 'peca:' + peca.id,
      x: x * lado + lado / 2, y: y * lado + lado / 2,
      raio: Math.max(2, lado / 2 - 3), cor: peca.hidden ? '#908574' : '#f2521f',
    });
    if (rotulos) {
      figuras.push({ tipo: 'texto', x: x * lado + 2, y: y * lado + lado - 10, dentro: (peca.name || '').slice(0, 6), corpo: 9, cor: '#eae3cf' });
    }
  }
  return {
    no: {
      forma: 'tela', chave: onde === palco ? 'palco:tabuleiro' : 'tabuleiro', largura, altura, figuras,
      ...(cena.asset ? { fundo: { doServidor: doServidor(canal, { op: 'asset', scene: cena.id }, cena.assetVolume === true) } } : {}),
    },
    cortou: !grade ? 'A grade e os nomes das peças saíram' : !rotulos ? 'Os nomes das peças saíram' : '',
  };
}

function estadoVazio(titulo, orientacao) {
  return caixa([cabecalho(titulo), texto(orientacao)], {
    direcao: 'coluna', intervalo: 12, preenchimento: 24,
    borda: { largura: 1, estilo: 'tracejada', cor: '#3a322a' },
    largura: 'total', entrelinha: 1.5,
  });
}

/** A cena em cima da mesa: o tabuleiro, ou a ilustração, e a descrição. */
function aCena(onde, canal, v, largura, altura) {
  const c = v.campaign;
  const cena = cenaAtiva(c);
  if (!cena) {
    return [estadoVazio('A mesa está vazia', v.isGM
      ? (celular() ? 'Mestrar é no computador: lá se cria a cena.' : 'Crie uma cena abaixo para começar: um mapa com peças ou uma ilustração.')
      : 'Quem mestra prepara a cena. Enquanto isso, você já pode rolar dados.')];
  }
  const partes = [cabecalho(cena.name)];
  if (cena.kind === 'map') {
    const { no, cortou } = tabuleiro(onde, canal, cena, ladoDaCasa(cena, largura, altura));
    partes.push(no);
    if (cortou) partes.push(caixa([cortou + ' para esta cena caber numa tela do SEELE.'], { corpo: 11, opacidade: 0.7 }));
  } else if (cena.asset) {
    partes.push(midia((onde === palco ? 'palco:' : '') + 'cena:' + cena.id, {
      doServidor: doServidor(canal, { op: 'asset', scene: cena.id }, cena.assetVolume === true),
      descricao: 'Ilustração de ' + cena.name,
    }));
  }
  if (onde === pag) {
    if (cena.description) partes.push(texto(resumir(cena.description)));
    if (v.isGM && cena.notes) partes.push(texto('Notas do mestre: ' + resumir(cena.notes)));
  }
  return partes;
}

/**
 * **Um controle vivo declara o inicial igual ao valor.** Suja, a superfície
 * pergunta «fechar sem gravar?» a cada saída, e o produto acha a sujeira
 * comparando cada campo com o inicial dele — que, sem declarar, é o da primeira
 * montagem e não muda mais. A trilha escolhida, a cena mostrada e a fórmula
 * dos dados já foram para onde iam: não são rascunho.
 */
const vivo = valor => ({ inicial: valor === null || valor === undefined ? '' : valor });

/** Os dados: a fórmula, o botão e a última rolagem daqui. */
function osDados(onde, prefixo) {
  return [caixa([
    linha([campo(prefixo + 'formula', 'DADOS', onde.formula, vivo(onde.formula)),
      botao(prefixo + 'rolar', onde.rolando ? 'ROLANDO…' : 'ROLAR', false, { emProgresso: onde.rolando })]),
    ...(onde.ultimaRolagem ? [caixa([onde.ultimaRolagem.texto], {
      corpo: 14, entrelinha: 1.5, cor: onde.ultimaRolagem.erro ? '#ff7970' : '#eae3cf',
    })] : []),
  ], { larguraMaxima: 420, direcao: 'coluna', intervalo: 12 })];
}

/**
 * O tocador da trilha, com o arquivo **deste pacote** e `repetir`: ela volta
 * ao começo sem redesenho, e o MOD não recebe `terminou` dela.
 *
 * **No celular ela nasce desligada**, com o TOCAR do produto: `tocando` vale
 * na mudança, e a declaração não muda depois. `position` e `startedAt` do
 * servidor ficam de fora: uma trilha que finge estar alinhada é pior que uma
 * que toca do começo.
 */
function oTocador(c, prefixo, parada = false) {
  const preset = c.music?.preset ?? null;
  if (!preset) return [];
  const nome = TRILHAS.find(t => t.valor === preset)?.dentro ?? preset;
  const fonte = TRILHAS_EM_ARQUIVO[preset];
  if (!fonte) return [caixa(['Trilha escolhida: ' + nome + '. Este pacote não traz o som dela.'], { corpo: 11, opacidade: 0.7 })];
  return [caixa([
    caixa(['TRILHA'], { corpo: 10, peso: 'forte', opacidade: 0.7 }),
    midia(prefixo + 'trilha:' + preset, {
      fonte,
      descricao: 'Ambientação: ' + nome.toLowerCase(),
      tocando: c.music?.playing === true && !celular() && !parada,
      repetir: true,
    }),
    ...(trilha.parou ? [caixa([trilha.parou], { corpo: 11, cor: '#f2521f' })] : []),
  ], { intervalo: 6 })];
}

/** O palco está de pé: a pessoa está numa sala amarrada a uma mesa que ela vê. */
const palcoAtivo = () => palco.canal !== null && Boolean(vistaDe(palco.canal)?.campaign);

// -------------------------------------------------------------- a página

const ABAS = [
  { chave: 'aba-tabuleiro', rotulo: 'TABULEIRO', partes: ['parte:cena', 'parte:dados', 'parte:mestre'] },
  { chave: 'aba-fichas', rotulo: 'FICHAS', partes: ['parte:fichas'] },
  { chave: 'aba-compendio', rotulo: 'COMPÊNDIO', partes: ['parte:compendio'] },
  { chave: 'aba-iniciativa', rotulo: 'INICIATIVA', partes: ['parte:iniciativa'] },
  { chave: 'aba-registro', rotulo: 'REGISTRO', partes: ['parte:registro:0', 'parte:registro:1', 'parte:registro:2', 'parte:registro:3'] },
];

/** As classes da página: o que muda quando ela aperta. */
const CLASSES_DA_MESA = { fichas: { base: {}, consultas: [{ ateLargura: 640, estilo: { colunas: 1 } }] } };

/**
 * Abre a página da mesa de um canal.
 *
 * @param {boolean} segue Se ela acompanha o canal aberto: sim pela navegação e
 *   pelo cabeçalho; não pela sala, que mostra a mesa dela.
 */
async function abrirMesa(canal, segue) {
  if (canal === null) {
    await dizer('Abra um canal de texto para ver a mesa dele.');
    return;
  }
  if (pag.canal !== canal) largarAPagina();
  pag.canal = canal;
  pag.segueOCanal = segue;
  await naFila(async () => {
    if (!pag.punho) {
      // **Não imersiva**: a folha da ficha convive com a página só assim, e a
      // ficha aberta fica ao lado do tabuleiro.
      pag.punho = await pagina('mesa', 'Mesa');
      pag.partes = new EmPartes(pag.punho);
      // **As classes não travam a página.** Recusadas, o que serviu delas
      // vale, e a mesa abre do mesmo jeito: só a grade das fichas deixa de
      // virar uma coluna na página estreita.
      try {
        await pag.punho.classes(CLASSES_DA_MESA);
      } catch (erro) {
        anotar('error', 'MESA: as classes da página: ' + frase(erro) + doRecusado(erro));
        await dizer('A MESA não conseguiu declarar o estilo da página: ' + frase(erro), 'erro');
      }
    } else if (!pag.aberta) {
      await pag.punho.mostrar();
      // **A trilha que tocava aqui foi pausada pelo produto ao fechar**, e
      // `tocando` vale na mudança: a mesma declaração não a religa.
      pag.religar = true;
    }
    pag.aberta = true;
  });
  if (!vistas.has(canal)) await consultar(canal);
  repintar();
}

/** Esquece o que a página editava: era de outra mesa. */
function largarAPagina() {
  Object.assign(pag, { arrasto: null, pincel: null, modoParede: false, aviso: '', ultimaRolagem: null, rolando: false, aba: 'aba-tabuleiro' });
}

async function pintarAPagina() {
  if (!pag.aberta) return;
  const v = vistaDe(pag.canal);
  const titulo = v?.campaign?.name || 'Mesa';
  if (titulo !== pag.titulo) {
    await pag.punho.titulo(titulo);
    pag.titulo = titulo;
  }
  if (!v) return pag.partes.pintar([texto('Consultando a mesa deste canal…')], []);
  if (v.erro) return pag.partes.pintar([estadoVazio('A mesa não abriu', v.erro)], []);
  if (!v.campaign) return pag.partes.pintar([parte('parte:convite')], [['parte:convite', () => oConvite(v)]]);
  const aberta = ABAS.find(a => a.chave === pag.aba) ?? ABAS[0];
  const esqueleto = [
    parte('parte:topo'), parte('parte:trilha'), parte('parte:aviso'),
    abas('aba', aberta.chave, ABAS.map(a => aba(a.chave, a.rotulo, a === aberta ? a.partes.map(chave => parte(chave)) : []))),
  ];
  const partes = [
    ['parte:topo', () => oTopo(v)],
    ['parte:trilha', () => aTrilhaDaPagina(v)],
    ['parte:aviso', () => (pag.aviso ? [caixa([pag.aviso], { corpo: 12, cor: '#f2521f' })] : [])],
    ...aberta.partes.map(chave => [chave, () => aParte(chave, v)]),
  ];
  if (pag.religar) {
    pag.religar = false;
    const parada = partes.map(([chave, construir]) =>
      [chave, chave === 'parte:trilha' ? () => aTrilhaDaPagina(v, true) : construir]);
    await pag.partes.pintar(esqueleto, parada);
  }
  await pag.partes.pintar(esqueleto, partes);
}

function aParte(chave, v) {
  if (chave === 'parte:cena') return aCena(pag, pag.canal, v, pag.largura, 0);
  if (chave === 'parte:dados') return osDados(pag, '');
  if (chave === 'parte:mestre') return asFerramentasDoMestre(v);
  if (chave === 'parte:fichas') return asFichas(v);
  if (chave === 'parte:compendio') return oCompendio(v);
  if (chave === 'parte:iniciativa') return aIniciativa(v);
  if (chave.startsWith('parte:registro:')) return oRegistro(v, Number(chave.slice('parte:registro:'.length)));
  return [];
}

/** O papel de quem olha, o sistema e o mestre. O nome da mesa é o título. */
function oTopo(v) {
  const c = v.campaign;
  return [caixa([
    distintivo([v.isGM ? 'MESTRE' : 'JOGADOR'], { borda: { largura: 1, cor: '#f2521f' }, cor: '#f2521f', corpo: 10 }),
    caixa(['Sistema ' + (SISTEMAS.find(s => s.valor === c.system)?.dentro ?? c.system)
      + ' · Mestre ' + nomeDe(c.gm)], { corpo: 11, opacidade: 0.7, crescer: 1 }),
  ], { direcao: 'linha', alinhar: 'centro', intervalo: 10, quebra: 'sim' })];
}

/**
 * A trilha na página — ou a frase que diz onde ela está. **Ela toca num lugar
 * só**: com a pessoa numa sala amarrada, o tocador é do palco, que continua
 * soando escondido.
 */
function aTrilhaDaPagina(v, parada = false) {
  if (!v.campaign.music?.preset) return [];
  if (palcoAtivo()) {
    return [caixa([palco.canal === pag.canal
      ? 'A trilha desta mesa toca no palco da chamada.'
      : 'A trilha fica no palco da chamada em que você está.'], { corpo: 11, opacidade: 0.7 })];
  }
  return oTocador(v.campaign, '', parada);
}

/** O convite a criar a mesa, ou a explicação de quem não pode. */
function oConvite(v) {
  if (!v.canSetup) {
    return [estadoVazio('Nenhuma mesa neste canal',
      'Quem administra este servidor pode criar a mesa. Peça a criação ou escolha outro canal.')];
  }
  return [
    estadoVazio('Nenhuma mesa neste canal', 'Crie a mesa: o nome, o sistema e quem mestra.'),
    acoes([botao('abrir-criar', 'CRIAR MESA', false, { variante: 'primaria' })]),
  ];
}

/** As ferramentas de quem mestra, no computador. */
function asFerramentasDoMestre(v) {
  if (!v.isGM) return [];
  if (celular()) {
    return [caixa(['Mestrar é no computador: criar e ajustar cena, pintar parede, pôr peça, '
      + 'enviar mapa e configurar a mesa ficam lá.'], { corpo: 11, opacidade: 0.7 })];
  }
  const c = v.campaign;
  const cena = cenaAtiva(c);
  const partes = [cabecalho('QUEM MESTRA')];
  if (c.scenes.length) {
    partes.push(escolha('cena', 'CENA EM CIMA DA MESA', String(c.active ?? ''), [
      ...(c.active ? [] : [{ valor: '', dentro: 'NENHUMA' }]),
      ...c.scenes.map(s => ({ valor: s.id, dentro: s.name })),
    ], vivo(String(c.active ?? ''))));
  }
  partes.push(acoes([
    botao('nova-cena', 'NOVA CENA'),
    ...(cena ? [
      botao('ajustar-cena', 'AJUSTAR CENA'),
      botao('esconder-cena', 'TIRAR DA MESA'),
      botao('apagar-cena', 'APAGAR CENA', false, {
        variante: 'perigo', confirmar: 'A cena «' + cena.name + '» sai da campanha, com as peças, as paredes e a imagem dela.',
      }),
    ] : []),
    botao('configurar', 'CONFIGURAR A MESA'),
  ]));
  if (cena) {
    partes.push(enviaAqui()
      ? arquivo('mapa', cena.kind === 'map' ? 'ENVIAR MAPA' : 'ENVIAR ILUSTRAÇÃO', {
        tipos: ['imagem'], finalidade: 'A imagem da cena «' + cena.name + '», até 10 MiB', desligado: pag.enviando,
      })
      : caixa(['O envio de imagens é pelo computador.'], { corpo: 11, opacidade: 0.7 }));
    if (cena.kind === 'map') {
      partes.push(acoes([
        botao('por-peca', 'PÔR PEÇA'),
        botao('modo-parede', pag.modoParede ? 'PARAR DE PINTAR PAREDE' : 'PINTAR PAREDE'),
      ]));
    }
    partes.push(escolha('trilha', 'TRILHA DA CENA', cena.ambience ?? 'inherit', [{ valor: 'inherit', dentro: 'A DA MESA' }, ...TRILHAS],
      vivo(cena.ambience ?? 'inherit')));
    const pecas = cena.tokens ?? [];
    if (pecas.length) {
      partes.push(cabecalho('PEÇAS'));
      for (const peca of oQueCabe(pecas)) {
        partes.push(linha([
          texto(peca.name + (peca.hidden ? ' · oculta' : '')),
          botao('esconder-peca-' + peca.id, peca.hidden ? 'MOSTRAR' : 'ESCONDER'),
          botao('tirar-peca-' + peca.id, 'TIRAR', false, { variante: 'perigo', confirmar: 'A peça «' + peca.name + '» sai do tabuleiro.' }),
        ]));
      }
      partes.push(...oQueFicouDeFora(pecas, 'peças'));
    }
  }
  partes.push(escolha('trilha-mesa', 'TRILHA DA MESA', c.music?.preset ?? 'silence', TRILHAS, vivo(c.music?.preset ?? 'silence')));
  return partes;
}

/** As fichas da campanha, uma caixa por ficha. */
function asFichas(v) {
  const c = v.campaign;
  const partes = [];
  if (v.isGM && !celular()) partes.push(acoes([botao('nova-ficha', 'NOVA FICHA')]));
  if (!c.sheets.length) {
    partes.push(estadoVazio('Nenhuma ficha disponível', v.isGM
      ? 'Crie uma ficha para começar a campanha.'
      : 'Você ainda não tem uma ficha. Peça a quem mestra para atribuir uma a você.'));
    return partes;
  }
  partes.push(grade(oQueCabe(c.sheets).map(s => caixa([
    caixa([
      caixa([s.name], { peso: 'forte', corpo: 14, crescer: 1 }),
      botao('abrir-ficha-' + s.id, ficha.aberta && ficha.id === s.id ? 'ABERTA' : 'ABRIR'),
    ], { direcao: 'linha', alinhar: 'centro', intervalo: 8 }),
    caixa([nomeDe(s.owner) + ' · nível ' + s.level + ' · ' + (s.className || 'Classe livre')], { corpo: 11, opacidade: 0.75 }),
    caixa([
      distintivo(['PV ' + s.hp + '/' + s.maxHp]),
      distintivo(['CA ' + s.ac]),
      ...(s.tempHp ? [distintivo(['TEMP ' + s.tempHp])] : []),
      ...(s.conditions ?? []).map(cond => distintivo([cond], { borda: { largura: 1, cor: '#FF1A1A' }, cor: '#FF1A1A' })),
    ], { direcao: 'linha', intervalo: 6, quebra: 'sim' }),
  ], { intervalo: 8, preenchimento: 12, borda: { largura: 1, cor: '#3a322a' }, raio: 0 })),
  { colunas: 2, intervalo: 12 }, { classe: 'fichas' }));
  partes.push(...oQueFicouDeFora(c.sheets, 'fichas'));
  return partes;
}

/** Os verbetes do compêndio, um por caixa. */
function oCompendio(v) {
  const c = v.campaign;
  const partes = [];
  if (v.isGM && !celular()) partes.push(acoes([botao('novo-verbete', 'NOVO VERBETE')]));
  if (!c.entries.length) {
    partes.push(estadoVazio('Compêndio vazio', v.isGM
      ? 'Adicione um verbete para organizar o mundo da campanha.'
      : 'Os verbetes publicados por quem mestra aparecerão aqui.'));
    return partes;
  }
  partes.push(pilha(oQueCabe(c.entries).map(e => caixa([
    caixa([
      caixa([e.name], { peso: 'forte', corpo: 13, crescer: 1 }),
      distintivo([e.kind + (e.level ? ' · nível ' + e.level : '')]),
      ...(e.published ? [] : [distintivo(['NÃO PUBLICADO'], { borda: { largura: 1, cor: '#f2521f' }, cor: '#f2521f' })]),
    ], { direcao: 'linha', alinhar: 'centro', intervalo: 8, quebra: 'sim' }),
    ...(e.description ? [caixa([resumir(e.description)], { corpo: 12, entrelinha: 1.5 })] : []),
    ...(v.isGM && !celular() ? [acoes([
      botao('editar-verbete-' + e.id, 'EDITAR'),
      botao('publicar-verbete-' + e.id, e.published ? 'RECOLHER' : 'PUBLICAR'),
      botao('apagar-verbete-' + e.id, 'APAGAR', false, {
        variante: 'perigo', confirmar: 'O verbete «' + e.name + '» sai do compêndio e das magias preparadas de cada ficha.',
      }),
    ])] : []),
  ], { intervalo: 6, preenchimento: 10, borda: { largura: 1, cor: '#3a322a' }, raio: 0 })), { intervalo: 10 }));
  partes.push(...oQueFicouDeFora(c.entries, 'verbetes'));
  return partes;
}

/**
 * A ordem de iniciativa, com o turno atual dito em palavra: informação que só
 * a cor carregue não é informação para todo mundo.
 */
function aIniciativa(v) {
  const c = v.campaign;
  const doMestre = v.isGM && !celular();
  if (!c.initiative.length) {
    return [
      estadoVazio('A iniciativa ainda não começou', v.isGM
        ? 'Abra uma ficha e use PÔR NA INICIATIVA: o servidor rola o d20 com a Destreza.'
        : 'Quem mestra define a ordem dos turnos. Ela aparecerá aqui.'),
      ...(doMestre ? [acoes([botao('iniciativa-mao', 'PÔR À MÃO')])] : []),
    ];
  }
  const vez = naVez(c);
  return [
    caixa(['Rodada ' + c.round], { corpo: 12, opacidade: 0.75 }),
    pilha(c.initiative.map(p => caixa([
      caixa([String(p.value)], { corpo: 16, peso: 'forte', largura: 40 }),
      caixa([p.name], { crescer: 1 }),
      ...(vez?.id === p.id ? [distintivo(['NA VEZ'], { borda: { largura: 1, cor: '#f2521f' }, cor: '#f2521f' })] : []),
      ...(p.hidden ? [distintivo(['OCULTO'])] : []),
      ...(doMestre ? [botao('tirar-iniciativa-' + p.id, 'TIRAR')] : []),
    ], {
      direcao: 'linha', alinhar: 'centro', intervalo: 10, preenchimento: 8,
      borda: { largura: 1, cor: vez?.id === p.id ? '#f2521f' : '#241f19' }, raio: 0,
    })), { intervalo: 6 }),
    ...(doMestre ? [acoes([
      botao('iniciativa-proximo', 'PRÓXIMO TURNO'),
      botao('iniciativa-mao', 'PÔR À MÃO'),
      botao('iniciativa-limpar', 'LIMPAR', false, { variante: 'perigo', confirmar: 'A ordem de iniciativa inteira sai, e a rodada volta a 1.' }),
    ])] : []),
  ];
}

/**
 * O que aconteceu, do mais recente para o mais antigo, **em blocos de dez**:
 * uma rolagem nova muda o primeiro bloco e empurra os outros, e cada bloco é
 * uma mensagem que cabe.
 */
function oRegistro(v, bloco) {
  const recentes = v.campaign.log.slice(-40).reverse();
  if (!recentes.length) {
    return bloco === 0
      ? [estadoVazio('O registro está vazio', 'Role um dado no Tabuleiro. Os resultados e acontecimentos da campanha ficam aqui.')]
      : [];
  }
  const daqui = recentes.slice(bloco * 10, bloco * 10 + 10);
  return daqui.length ? [pilha(oQueCabe(daqui).map(l => caixa([
    caixa([nomeDe(l.person)], { corpo: 10, opacidade: 0.7 }),
    caixa([resumir(l.text)], { corpo: 12 }),
  ], { intervalo: 2, preenchimento: 8, borda: { largura: 1, cor: '#241f19' }, raio: 0 })), { intervalo: 6 })] : [];
}

// --------------------------------------------------------------- o palco

/** O conteúdo do palco: o tabuleiro e o que se usa com ele aberto. */
function oPalco() {
  const v = vistaDe(palco.canal);
  if (!v || v.erro) return [texto(v?.erro ? 'A mesa desta sala não abriu: ' + v.erro : 'Consultando a mesa desta sala…')];
  const c = v.campaign;
  const vez = naVez(c);
  const partes = [
    caixa([
      caixa([c.name], { peso: 'forte', crescer: 1 }),
      ...(c.initiative.length ? [distintivo(['RODADA ' + c.round])] : []),
      ...(vez ? [distintivo(['na vez: ' + vez.name], { borda: { largura: 1, cor: '#f2521f' }, cor: '#f2521f' })] : []),
    ], { direcao: 'linha', alinhar: 'centro', intervalo: 8, quebra: 'sim' }),
    ...aCena(palco, palco.canal, v, palco.largura, palco.altura),
    ...osDados(palco, 'palco:'),
    ...oTocador(c, 'palco:'),
  ];
  const minhas = c.sheets.filter(s => v.isGM || s.owner === v.me);
  partes.push(acoes([
    ...(minhas.length ? [botao('palco:ficha', v.isGM ? 'FICHAS' : 'MINHA FICHA')] : []),
    ...(v.isGM && !celular() && c.initiative.length ? [botao('palco:proximo', 'PRÓXIMO TURNO')] : []),
    botao('palco:abrir-mesa', 'ABRIR A MESA'),
  ]));
  if (v.isGM && celular()) partes.push(caixa(['Mestrar é no computador: o palco do celular é para jogar.'], { corpo: 11, opacidade: 0.7 }));
  if (palco.aviso) partes.push(caixa([palco.aviso], { corpo: 12, cor: '#f2521f' }));
  return partes;
}

/**
 * **O palco é uma contribuição**: registrado ao entrar na sala amarrada,
 * atualizado inteiro a cada mudança — uma mensagem que cabe —, e revogado ao
 * sair dela.
 */
async function pintarOPalco() {
  if (!palcoAtivo()) {
    if (palco.handle) {
      const handle = palco.handle;
      Object.assign(palco, { handle: null, json: null });
      await revogar(handle);
    }
    return;
  }
  const conteudo = caber(oPalco, naoCoube);
  const json = JSON.stringify(conteudo);
  if (!palco.handle) {
    palco.handle = (await contribuir({
      ponto: 'chamada.palco', modo: 'substituir', conteudo, rotulo: 'MESA', nomeAcessivel: 'A mesa de RPG desta sala',
    })).handle;
    palco.json = json;
  } else if (json !== palco.json) {
    await atualizarContribuicao(palco.handle, conteudo);
    palco.json = json;
  }
}

// ---------------------------------------------------------- a ficha em jogo

async function abrirAFicha(canal, id) {
  const v = vistaDe(canal);
  const s = v?.campaign?.sheets.find(f => f.id === id);
  if (!s) return;
  if (ficha.id !== id || ficha.canal !== canal) Object.assign(ficha, { quanto: '', aviso: '' });
  ficha.canal = canal;
  ficha.id = id;
  await naFila(async () => {
    if (!ficha.punho) {
      ficha.punho = await folha('mesa-ficha', s.name, { lado: 'direita', tamanho: { largura: 380 } });
      ficha.partes = new EmPartes(ficha.punho);
      ficha.titulo = s.name;
    } else if (!ficha.aberta) {
      await ficha.punho.mostrar();
    }
    ficha.aberta = true;
  });
  repintar();
}

async function fecharAFicha() {
  if (!ficha.punho) return;
  const punho = ficha.punho;
  Object.assign(ficha, { punho: null, partes: null, aberta: false, titulo: null, id: null, canal: null });
  await naFila(() => punho.descartar()).catch(() => {});
}

const PARTES_DA_FICHA = ['parte:topo', 'parte:vida', 'parte:testes', 'parte:acoes', 'parte:magias', 'parte:edicao', 'parte:mestre'];

async function pintarAFicha() {
  if (!ficha.aberta) return;
  const v = vistaDe(ficha.canal);
  const s = v?.campaign?.sheets.find(f => f.id === ficha.id);
  if (!s) {
    await ficha.partes.pintar([estadoVazio('A ficha não está mais aqui', 'Ela foi apagada, ou deixou de ser sua.')], []);
    return;
  }
  if (s.name !== ficha.titulo) {
    await ficha.punho.titulo(s.name);
    ficha.titulo = s.name;
  }
  await ficha.partes.pintar(PARTES_DA_FICHA.map(chave => parte(chave)),
    PARTES_DA_FICHA.map(chave => [chave, () => aParteDaFicha(chave, v, s)]));
}

/** Os testes que uma ficha rola: perícias, atributos e resistências. */
function testesDe(v) {
  const regras = v.rules ?? { skills: [], abilities: {} };
  return [
    ...regras.skills.map(([id, , nome]) => ({ valor: 'skill:' + id, dentro: nome })),
    ...ATRIBUTOS.map(([id]) => ({ valor: 'ability:' + id, dentro: regras.abilities[id] ?? id })),
    ...ATRIBUTOS.map(([id]) => ({ valor: 'save:' + id, dentro: 'Resistência · ' + (regras.abilities[id] ?? id) })),
  ];
}

function aParteDaFicha(chave, v, s) {
  const c = v.campaign;
  const mestre = v.isGM;
  if (chave === 'parte:topo') {
    return [
      caixa([
        distintivo(['PV ' + s.hp + '/' + s.maxHp]),
        distintivo(['CA ' + s.ac]),
        ...(s.tempHp ? [distintivo(['TEMP ' + s.tempHp])] : []),
        distintivo(['NÍVEL ' + s.level]),
      ], { direcao: 'linha', intervalo: 6, quebra: 'sim' }),
      caixa([nomeDe(s.owner) + ' · ' + (s.className || 'Classe livre')
        + (s.ancestry ? ' · ' + s.ancestry : '')], { corpo: 11, opacidade: 0.75 }),
      caixa(['Condições: ' + ((s.conditions ?? []).join(', ') || 'nenhuma')], { corpo: 12 }),
      ...(s.portrait?.asset ? [midia('ficha:retrato-imagem', {
        doServidor: doServidor(ficha.canal, { op: 'portrait-asset', sheet: s.id }, s.portrait.volume === true),
        descricao: 'Retrato de ' + s.name,
      })] : []),
      ...(ficha.aviso ? [caixa([ficha.aviso], { corpo: 12, cor: '#f2521f' })] : []),
    ];
  }
  if (chave === 'parte:vida') {
    return [
      numero('ficha:quanto', 'QUANTO', ficha.quanto === '' ? null : Number(ficha.quanto), { minimo: 0, maximo: 9999, inteiro: true, ...vivo(ficha.quanto) }),
      acoes([
        botao('ficha:ferir', 'FERIR', ficha.quanto === ''),
        botao('ficha:curar', 'CURAR', ficha.quanto === ''),
        botao('ficha:temporarios', 'PV TEMPORÁRIOS', ficha.quanto === ''),
      ]),
      acoes([
        botao('ficha:atordoar', (s.conditions ?? []).includes('stunned') ? 'TIRAR ATORDOADO' : 'ATORDOAR'),
        botao('ficha:descansar', 'DESCANSO LONGO'),
      ]),
    ];
  }
  if (chave === 'parte:testes') {
    return [
      cabecalho('TESTES'),
      linha([
        escolha('ficha:teste', 'TESTE', ficha.teste, testesDe(v), vivo(ficha.teste)),
        escolha('ficha:modo', 'MODO', ficha.modo, MODOS_DE_TESTE, vivo(ficha.modo)),
      ]),
      acoes([botao('ficha:testar', 'ROLAR TESTE')]),
    ];
  }
  if (chave === 'parte:acoes') {
    const lista = s.actions ?? [];
    return [
      cabecalho('AÇÕES'),
      ...oQueCabe(lista).map(a => linha([
        texto(a.name + ' · ' + (TIPOS_DE_ACAO.find(t => t.valor === a.kind)?.dentro ?? a.kind)
          + (a.formula ? ' · ' + a.formula : '') + (a.max ? ' · ' + (a.max - a.used) + '/' + a.max : '')),
        botao('ficha:usar-' + a.id, 'USAR', Boolean(a.max) && a.used >= a.max),
        botao('ficha:editar-acao-' + a.id, 'EDITAR'),
        botao('ficha:tirar-acao-' + a.id, 'TIRAR', false, { variante: 'perigo', confirmar: 'A ação «' + a.name + '» sai da ficha.' }),
      ])),
      ...oQueFicouDeFora(lista, 'ações'),
      ...(lista.length ? [] : [texto('Nenhuma ação nesta ficha.')]),
      acoes([botao('ficha:nova-acao', 'NOVA AÇÃO')]),
    ];
  }
  if (chave === 'parte:magias') {
    const preparadas = new Set(s.spells ?? []);
    // As preparadas primeiro: se a lista for cortada para caber, o que sai é o
    // que esta ficha não leva.
    const magias = [...c.entries].sort((a, b) => Number(preparadas.has(b.id)) - Number(preparadas.has(a.id)));
    const espacos = (s.slots ?? []).map((sl, i) => ({ ...sl, nivel: i + 1 })).filter(sl => sl.max > 0);
    return [
      cabecalho('MAGIAS'),
      ...(espacos.length ? [texto('Espaços: ' + espacos.map(sl => sl.nivel + 'º ' + (sl.max - sl.used) + '/' + sl.max).join(' · '))] : []),
      ...oQueCabe(magias).map(e => linha([
        texto(e.name + ' · ' + (e.level ? 'nível ' + e.level : 'truque')),
        botao('ficha:preparar-' + e.id, preparadas.has(e.id) ? 'TIRAR' : 'PREPARAR'),
        ...(preparadas.has(e.id) ? [botao('ficha:conjurar-' + e.id, 'CONJURAR')] : []),
      ])),
      ...oQueFicouDeFora(magias, 'verbetes'),
      ...(c.entries.length ? [] : [texto('O compêndio está vazio.')]),
    ];
  }
  if (chave === 'parte:edicao') {
    return [acoes([
      botao('ficha:editar', 'EDITAR FICHA'),
      ...(enviaAqui() ? [arquivo('ficha:retrato', 'ENVIAR RETRATO', {
        tipos: ['imagem'], finalidade: 'O retrato de ' + s.name + ', até 10 MiB', desligado: ficha.enviando,
      })] : []),
      ...(s.portrait?.asset ? [botao('ficha:tirar-retrato', 'TIRAR RETRATO', false, { confirmar: 'O retrato de ' + s.name + ' é apagado.' })] : []),
    ]), ...(enviaAqui() ? [] : [caixa(['O envio do retrato é pelo computador.'], { corpo: 11, opacidade: 0.7 })])];
  }
  if (chave === 'parte:mestre') {
    if (!mestre) return [];
    const cena = cenaAtiva(c);
    const jaEsta = (cena?.tokens ?? []).some(t => t.sheet === s.id);
    return [
      cabecalho('QUEM MESTRA'),
      escolha('ficha:dono', 'DONO DA FICHA', String(s.owner), pessoasComoOpcoes([s.owner]), vivo(String(s.owner))),
      acoes([
        ...(cena?.kind === 'map' ? [botao('ficha:por-na-mesa', jaEsta ? 'A PEÇA ESTÁ NA MESA' : 'PÔR A PEÇA NA MESA', jaEsta)] : []),
        botao('ficha:iniciativa', 'PÔR NA INICIATIVA'),
        ...(s.portrait?.asset ? [botao('ficha:publicar-retrato', s.portrait.published ? 'RECOLHER RETRATO' : 'PUBLICAR RETRATO')] : []),
        botao('ficha:apagar', 'APAGAR FICHA', false, {
          variante: 'perigo', confirmar: 'A ficha de ' + s.name + ' sai da campanha, com a peça dela, o lugar na iniciativa e o retrato.',
        }),
      ]),
    ];
  }
  return [];
}

// ------------------------------------------------------------ os diálogos

/**
 * Um diálogo com formulário. **A validação é declarada** e o produto impede o
 * envio fora dela; **o servidor tem a última palavra**, e a recusa dele volta
 * ao campo pela chave. O que muda os campos é a pessoa: este lado não remonta
 * o formulário com a projeção nova, porque isso apagaria o que ela escreveu.
 *
 * @param {object} d `{ tipo, canal, titulo, base, largura }`: o que o diálogo
 *   edita, como estava quando ele abriu.
 */
async function abrirODialogo(d) {
  const id = 'mesa-' + d.tipo;
  await descartarODialogo(id);
  await naFila(async () => {
    const punho = await dialogo(id, d.titulo, {
      tamanho: { largura: d.largura ?? 560 }, focoInicial: 'name',
    });
    // **O formulário é montado uma vez**, com o que ele edita como estava ao
    // abrir. Remontá-lo a cada revisão apagaria o que a pessoa escreveu; o que
    // mudou enquanto isso entra pela mescla, no envio.
    const { campos, longos, primario } = FORMULARIOS[d.tipo](d);
    const estado = {
      ...d, punho, partes: new EmPartes(punho), erro: '', enviando: false, longos,
      esqueleto: [formulario('form-' + d.tipo, [...campos, ...longos.map(([chave]) => parte(chave)), parte('parte:erro')], {
        primario, secundario: 'CANCELAR',
      })],
      campos: chavesDeCampo([campos, longos.map(([, construir]) => construir())]),
    };
    dialogos.set(id, estado);
    await pintarODialogo(estado);
  });
}

async function descartarODialogo(id) {
  const d = dialogos.get(id);
  if (!d) return;
  dialogos.delete(id);
  await naFila(() => d.punho.descartar()).catch(() => {});
}

/** As chaves de campo de uma árvore: as que `formulario.erros` alcança. */
function chavesDeCampo(no, achadas = new Set()) {
  if (Array.isArray(no)) { no.forEach(n => chavesDeCampo(n, achadas)); return achadas; }
  if (!no || typeof no !== 'object') return achadas;
  if (['campo', 'escolha', 'textoLongo', 'numero', 'marca'].includes(no.forma) && no.chave) achadas.add(no.chave);
  chavesDeCampo(no.dentro, achadas);
  return achadas;
}

/** O formulário e os textos longos dele; depois, só a frase da recusa muda. */
async function pintarODialogo(d) {
  await d.partes.pintar(d.esqueleto, [
    ...d.longos,
    ['parte:erro', () => (d.erro ? [caixa([d.erro], { corpo: 12, cor: '#f2521f' })] : [])],
  ]);
}

/** Um número declarado como o servidor o confere. */
const inteiro = (chave, rotulo, valor, minimo, maximo) =>
  numero(chave, rotulo, valor, { minimo, maximo, inteiro: true, obrigatorio: true, inicial: valor });
/** Um texto declarado como o servidor o confere. */
const textoCurto = (chave, rotulo, valor, tamanhoMaximo, obrigatorio = false) =>
  campo(chave, rotulo, valor, { tamanhoMaximo, inicial: String(valor ?? ''), ...(obrigatorio ? { obrigatorio: true } : {}) });
const longo = (chave, rotulo, valor, tamanhoMaximo) =>
  textoLongo(chave, rotulo, valor, { tamanhoMaximo, inicial: String(valor ?? ''), linhas: 6 });
const deEscolha = (chave, rotulo, valor, opcoes) => escolha(chave, rotulo, valor, opcoes, { inicial: String(valor ?? '') });

/** As salas de voz, para amarrar a mesa a uma. */
const salasComoOpcoes = () => [
  { valor: '', dentro: 'NENHUMA' },
  ...(tela?.salas ?? []).map(s => ({ valor: String(s.id), dentro: s.nome })),
];

/**
 * Cada formulário: os campos (num `montar`), os textos longos (cada um num
 * `atualizar`, porque três deles cheios passam dos 12 KiB de uma mensagem) e
 * o que o envio pede ao servidor.
 */
const FORMULARIOS = {
  criar: d => ({
    primario: 'CRIAR MESA',
    campos: [
      textoCurto('name', 'NOME DA MESA', '', 80, true),
      deEscolha('system', 'SISTEMA', 'dnd5e-2014', SISTEMAS),
      deEscolha('gm', 'QUEM MESTRA', String(d.eu), pessoasComoOpcoes([d.eu])),
      caixa(['Quem mestra pode ser outra pessoa: quem administra cria a mesa, e quem joga com ela a conduz.'], { corpo: 11, opacidade: 0.7 }),
    ],
    longos: [],
  }),
  'nova-ficha': d => ({
    primario: 'CRIAR FICHA',
    campos: [textoCurto('name', 'NOME', '', 60, true), deEscolha('owner', 'DE QUEM É', String(d.eu), pessoasComoOpcoes([d.eu]))],
    longos: [],
  }),
  'editar-ficha': d => {
    const s = d.base;
    return {
      primario: 'GRAVAR FICHA',
      campos: [
        linha([textoCurto('name', 'NOME', s.name, 60, true), textoCurto('className', 'CLASSE', s.className ?? '', 60), inteiro('level', 'NÍVEL', s.level, 1, 20)]),
        linha([textoCurto('ancestry', 'ANCESTRALIDADE', s.ancestry ?? '', 60), textoCurto('background', 'ANTECEDENTES', s.background ?? '', 80)]),
        linha([inteiro('hp', 'PV', s.hp, 0, 9999), inteiro('maxHp', 'PV MÁXIMO', s.maxHp, 1, 9999), inteiro('tempHp', 'TEMPORÁRIOS', s.tempHp ?? 0, 0, 9999)]),
        linha([inteiro('ac', 'CA', s.ac, 0, 99), inteiro('speed', 'DESLOCAMENTO', s.speed, 0, 999)]),
        linha(ATRIBUTOS.map(([a, rotulo]) => inteiro('abilities.' + a, rotulo, s.abilities?.[a] ?? 10, 1, 30))),
        cabecalho('ESPAÇOS DE MAGIA'),
        linha((s.slots ?? []).map((sl, i) => inteiro('slots.' + i + '.max', (i + 1) + 'º', sl.max ?? 0, 0, 20))),
      ],
      longos: [
        ['parte:inventory', () => [longo('inventory', 'INVENTÁRIO', s.inventory ?? '', 3000)]],
        ['parte:skills', () => [longo('skills', 'PERÍCIAS ANOTADAS', s.skills ?? '', 1000)]],
        ['parte:notes', () => [longo('notes', 'NOTAS', s.notes ?? '', 3000)]],
      ],
    };
  },
  acao: d => {
    const a = d.base;
    return {
      primario: a.id ? 'GRAVAR AÇÃO' : 'CRIAR AÇÃO',
      campos: [
        linha([textoCurto('name', 'AÇÃO', a.name ?? '', 60, true), deEscolha('kind', 'TIPO', a.kind ?? 'action', TIPOS_DE_ACAO)]),
        linha([textoCurto('formula', 'FÓRMULA', a.formula ?? '', 24), inteiro('max', 'USOS', a.max ?? 0, 0, 99), deEscolha('recharge', 'RECUPERA', a.recharge ?? 'manual', RECUPERACOES)]),
      ],
      longos: [['parte:description', () => [longo('description', 'DESCRIÇÃO', a.description ?? '', 1000)]]],
    };
  },
  verbete: d => {
    const e = d.base;
    return {
      primario: e.id ? 'GRAVAR VERBETE' : 'CRIAR VERBETE',
      campos: [
        linha([textoCurto('name', 'VERBETE', e.name ?? '', 100, true), textoCurto('kind', 'TIPO', e.kind ?? 'magia', 30, true), inteiro('level', 'NÍVEL', e.level ?? 0, 0, 9)]),
        linha([textoCurto('range', 'ALCANCE', e.range ?? '', 100), textoCurto('cost', 'CUSTO', e.cost ?? '', 100), textoCurto('formula', 'FÓRMULA', e.formula ?? '', 24)]),
        marca('published', 'PUBLICADO PARA QUEM JOGA', e.published === true, { inicial: e.published === true }),
      ],
      longos: [['parte:description', () => [longo('description', 'DESCRIÇÃO', e.description ?? '', 3000)]]],
    };
  },
  'nova-cena': () => ({
    primario: 'CRIAR CENA',
    campos: [
      textoCurto('name', 'NOME DA CENA', '', 80, true),
      deEscolha('kind', 'TIPO', 'map', [{ valor: 'map', dentro: 'MAPA COM PEÇAS' }, { valor: 'illustration', dentro: 'ILUSTRAÇÃO' }]),
    ],
    longos: [],
  }),
  cena: d => {
    const c = d.base;
    return {
      primario: 'GRAVAR CENA',
      campos: [linha([textoCurto('name', 'NOME', c.name, 80, true), inteiro('cols', 'COLUNAS', c.cols, 4, 60), inteiro('rows', 'LINHAS', c.rows, 4, 60)])],
      longos: [
        ['parte:description', () => [longo('description', 'DESCRIÇÃO', c.description ?? '', 2000)]],
        ['parte:notes', () => [longo('notes', 'NOTAS DO MESTRE', c.notes ?? '', 3000)]],
      ],
    };
  },
  peca: () => ({
    primario: 'PÔR PEÇA',
    campos: [textoCurto('name', 'NOME DA PEÇA', '', 60, true), marca('hidden', 'OCULTA DE QUEM JOGA', false, { inicial: false })],
    longos: [],
  }),
  iniciativa: () => ({
    primario: 'PÔR NA INICIATIVA',
    campos: [
      linha([textoCurto('name', 'NOME', '', 60, true), inteiro('value', 'VALOR', 10, -20, 99)]),
      marca('hidden', 'OCULTA DE QUEM JOGA', false, { inicial: false }),
    ],
    longos: [],
  }),
  config: d => {
    const c = d.base;
    return {
      primario: 'GRAVAR',
      campos: [
        textoCurto('name', 'NOME DA MESA', c.name, 80, true),
        deEscolha('gm', 'QUEM MESTRA', String(c.gm), pessoasComoOpcoes([c.gm])),
        marca('allowMove', 'QUEM JOGA MOVE A PRÓPRIA PEÇA', c.allowMove === true, { inicial: c.allowMove === true }),
        marca('allowEdit', 'QUEM JOGA EDITA A PRÓPRIA FICHA', c.allowEdit === true, { inicial: c.allowEdit === true }),
        deEscolha('sala', 'SALA DE VOZ DA MESA', c.sala === null || c.sala === undefined ? '' : String(c.sala), salasComoOpcoes()),
        caixa(['Na sala de voz amarrada, quem entra vê a mesa no palco da chamada.'], { corpo: 11, opacidade: 0.7 }),
      ],
      longos: [],
    };
  },
};

/**
 * O que o servidor recebe de cada formulário, a partir dos valores que o
 * produto mandou. Uma função quando o pedido depende da projeção de agora: a
 * repetição depois de um conflito o refaz sobre ela.
 */
const ENVIOS = {
  criar: (d, val) => ({ op: 'setup', name: val.name, system: val.system, gm: val.gm }),
  'nova-ficha': (d, val) => ({ op: 'sheet-create', name: val.name, owner: val.owner }),
  'editar-ficha': (d, val) => () => {
    const atual = vistaDe(d.canal)?.campaign?.sheets.find(s => s.id === d.base.id);
    if (!atual) throw new Error('not-found');
    return { op: 'sheet-save', sheet: fichaMesclada(d.base, rascunhoDaFicha(d.base, val), atual) };
  },
  acao: (d, val) => () => {
    const s = vistaDe(d.canal)?.campaign?.sheets.find(f => f.id === d.ficha);
    const agora = (s?.actions ?? []).find(a => a.id === d.base.id);
    return {
      op: 'action-save', sheet: d.ficha, ...(d.base.id ? { id: d.base.id } : {}),
      name: val.name, kind: val.kind, formula: val.formula, description: val.description,
      max: val.max, used: Math.min(agora?.used ?? 0, val.max), recharge: val.recharge,
    };
  },
  verbete: (d, val) => ({
    op: 'entry-save', ...(d.base.id ? { id: d.base.id } : {}), name: val.name, kind: val.kind, level: val.level,
    range: val.range, cost: val.cost, formula: val.formula, description: val.description, published: val.published === true,
  }),
  'nova-cena': (d, val) => ({ op: 'scene-create', name: val.name, kind: val.kind }),
  cena: (d, val) => ({
    op: 'scene-save', id: d.base.id, name: val.name, description: val.description, notes: val.notes,
    cols: val.cols, rows: val.rows, cellMeters: d.base.cellMeters,
  }),
  peca: (d, val) => ({ op: 'token-add', scene: d.cena, name: val.name, x: 0, y: 0, hidden: val.hidden === true }),
  iniciativa: (d, val) => ({ op: 'initiative-add', name: val.name, value: val.value, hidden: val.hidden === true }),
  config: (d, val) => ({
    op: 'settings', name: val.name, gm: val.gm, allowMove: val.allowMove === true, allowEdit: val.allowEdit === true,
    sala: val.sala === '' || val.sala === null || val.sala === undefined ? null : Number(val.sala),
  }),
};

/**
 * A ficha que o formulário diz: a de quando ele abriu, com os valores dele.
 * As chaves com ponto (`abilities.dex`, `slots.2.max`) são as do servidor, e
 * é por elas que a recusa dele volta ao campo.
 */
function rascunhoDaFicha(base, valores) {
  const r = JSON.parse(JSON.stringify(base));
  for (const [chave, valor] of Object.entries(valores)) {
    const caminho = chave.split('.');
    let alvo = r;
    for (const passo of caminho.slice(0, -1)) alvo = alvo[passo];
    alvo[caminho.at(-1)] = valor;
  }
  return r;
}

/**
 * O que a pessoa mudou, sobre o que o servidor tem agora.
 *
 * Campo a campo: o que o rascunho não mudou em relação à base vem do atual.
 * Objetos (os atributos) e listas de objetos do mesmo tamanho (os espaços de
 * magia) são comparados por dentro; o resto vale inteiro. Gravar o rascunho
 * inteiro devolvia ao servidor os pontos de vida da hora em que a edição
 * começou: o dano que o mestre deu enquanto alguém escrevia uma nota era
 * desfeito ao gravar a nota, sem recusa e sem aviso.
 */
function mesclar(base, rascunho, atual) {
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (igual(rascunho, base)) return atual;
  const objeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (Array.isArray(rascunho) && Array.isArray(base) && Array.isArray(atual)
    && rascunho.length === base.length && base.length === atual.length && rascunho.every(objeto)) {
    return rascunho.map((item, i) => mesclar(base[i], item, atual[i]));
  }
  if (objeto(rascunho) && objeto(base) && objeto(atual)) {
    const junto = { ...atual };
    for (const chave of Object.keys(rascunho)) junto[chave] = mesclar(base[chave], rascunho[chave], atual[chave]);
    return junto;
  }
  return rascunho;
}

/**
 * A ficha que vai ao servidor: o rascunho sobre a de agora. Os espaços gastos
 * nunca passam do máximo: o servidor recusa `used > max`, e um máximo baixado
 * enquanto alguém conjurava não pode virar uma recusa sem explicação.
 */
function fichaMesclada(base, rascunho, atual) {
  const junta = mesclar(base, rascunho, atual);
  junta.slots = (junta.slots ?? []).map(s => ({ ...s, used: Math.min(s.used ?? 0, s.max ?? 0) }));
  return junta;
}

async function aoSubmeter(evento) {
  const id = 'mesa-' + String(evento.chave ?? '').replace(/^form-/, '');
  const d = dialogos.get(id);
  if (!d || d.enviando) return;
  d.enviando = true;
  d.erro = '';
  try {
    const resposta = await escrever(d.canal, ENVIOS[d.tipo](d, evento.valores ?? {}));
    await descartarODialogo(id);
    if (d.tipo === 'criar') {
      await abrirMesa(d.canal, pag.segueOCanal);
      await dizer('Mesa criada.');
    } else if (d.tipo === 'nova-ficha') {
      const nova = resposta.campaign?.sheets.at(-1);
      if (nova) await abrirAFicha(d.canal, nova.id);
    }
  } catch (erro) {
    // **A recusa volta ao campo.** Só as chaves que são campos deste
    // formulário: uma que não é (`slots.2.used`) faria o produto recusar o
    // pedido inteiro, e a frase não chegaria a lugar nenhum.
    const doCampo = Object.fromEntries(Object.entries(erro?.erros ?? {}).filter(([chave]) => d.campos?.has(chave)));
    d.erro = Object.keys(doCampo).length ? '' : 'Não foi gravado: ' + frase(erro);
    if (dialogos.get(id) === d) {
      await naFila(() => d.punho.formulario.erros(doCampo));
      repintar();
    }
  } finally {
    d.enviando = false;
  }
}

// ---------------------------------------------------------- as imagens

/**
 * Manda uma imagem escolhida **pelo volume**, inteira (ADR 0048): a metade de
 * servidor abre a espera e dá o token, a janela manda os bytes, e a metade de
 * servidor confere o tamanho e aponta a cena ou o retrato para ela.
 *
 * O arquivo é devolvido ao produto **no `finally`**: um envio que falha no
 * meio não pode deixar dez megabytes presos até a saída da sessão.
 */
async function enviarImagem(canal, escolhido, alvo, id) {
  try {
    if (escolhido.papel !== 'imagem') throw new Error('tipo-recusado');
    const { envio } = await escrever(canal, { op: 'imagem-comecar', alvo, id });
    await enviar(escolhido.id, envio.token);
    await escrever(canal, { op: 'imagem-pronta', alvo, id, token: envio.token });
  } finally {
    try {
      await soltar(escolhido.id);
    } catch (erro) {
      anotar('error', 'MESA: o arquivo não foi devolvido: ' + frase(erro));
    }
  }
}

async function aoArquivo(evento) {
  const chave = String(evento.chave ?? '');
  const naFicha = chave === 'ficha:retrato';
  if (!naFicha && chave !== 'mapa') return;
  const onde = naFicha ? ficha : pag;
  // Cancelar o seletor é uma resposta, e é silenciosa.
  if (evento.resultado === 'cancelado' || (!evento.arquivo && !evento.erro)) return;
  if (!evento.arquivo) {
    onde.aviso = 'A imagem não foi escolhida: ' + frase(evento);
    repintar();
    return;
  }
  const canal = naFicha ? ficha.canal : pag.canal;
  const v = vistaDe(canal);
  const alvo = naFicha ? ['retrato', ficha.id] : ['cena', v?.campaign && cenaAtiva(v.campaign)?.id];
  if (!alvo[1]) return;
  onde.enviando = true;
  onde.aviso = naFicha ? 'Enviando o retrato…' : 'Enviando a imagem da cena…';
  repintar();
  try {
    await enviarImagem(canal, evento.arquivo, alvo[0], alvo[1]);
    onde.aviso = '';
  } catch (erro) {
    onde.aviso = 'A imagem não foi: ' + frase(erro);
  } finally {
    onde.enviando = false;
    repintar();
  }
}

// --------------------------------------------------------- os eventos

/** A escrita de um botão: o aviso da recusa vai ao lugar de onde ele veio. */
function fazer(onde, canal, pedido, depois) {
  onde.aviso = '';
  return escrever(canal, pedido).then(
    resposta => { if (depois) depois(resposta); repintar(); },
    erro => { onde.aviso = 'Não deu: ' + frase(erro); repintar(); },
  );
}

/** Rola os dados de um lugar — da página ou do palco. */
function rolar(onde, canal) {
  if (onde.rolando) return null;
  onde.rolando = true;
  onde.aviso = '';
  repintar();
  return escrever(canal, { op: 'roll', formula: onde.formula, label: 'Dados' }).then(
    resposta => {
      onde.ultimaRolagem = { texto: resposta.campaign?.log?.at(-1)?.text || 'Rolagem feita. Veja o registro.' };
    },
    erro => { onde.ultimaRolagem = { erro: true, texto: 'Não foi possível rolar: ' + frase(erro) }; },
  ).finally(() => { onde.rolando = false; repintar(); });
}

/** Da tela para a grade, e dentro dos limites da cena. */
const naGrade = (valor, teto, lado) => Math.max(0, Math.min(teto - 1, Math.floor(valor / lado)));

function aoTraco(evento) {
  const onde = evento.chave === 'palco:tabuleiro' ? palco : evento.chave === 'tabuleiro' ? pag : null;
  if (!onde) return null;
  const canal = onde.canal;
  const v = vistaDe(canal);
  const cena = v?.campaign ? cenaAtiva(v.campaign) : null;
  if (!cena || cena.kind !== 'map') return null;
  const lado = ladoDaCasa(cena, onde.largura, onde === palco ? onde.altura : 0);
  const x = naGrade(evento.x, cena.cols, lado);
  const y = naGrade(evento.y, cena.rows, lado);
  if (onde === pag && pag.modoParede && v.isGM) {
    // No modo parede o `alvo` não importa: pintar sobre uma peça é exatamente
    // o que quem pinta uma parede quer. **A casa é a do começo, e a parede só
    // sai no fim**: um dedo no vazio rola a página, e o gesto que a rolagem
    // tomou chega como `cancelou` — pintar no começo deixaria uma parede a
    // cada rolagem.
    if (evento.fase === 'comecou') { pag.pincel = { x, y }; return null; }
    if (evento.fase === 'moveu') return null;
    const casa = pag.pincel;
    pag.pincel = null;
    if (evento.fase !== 'terminou' || !casa) return null;
    return fazer(pag, canal, { op: 'wall', scene: cena.id, x: casa.x, y: casa.y });
  }
  if (evento.fase === 'comecou') {
    // `alvo` é a chave da figura que o dedo pegou, **em texto**: os ids desta
    // campanha são `token-2`, e um número viraria `NaN`.
    const id = typeof evento.alvo === 'string' && evento.alvo.startsWith('peca:') ? evento.alvo.slice(5) : null;
    onde.arrasto = id === null ? null : { id, x, y };
    return null;
  }
  if (!onde.arrasto) return null;
  if (evento.fase === 'moveu') {
    // A peça acompanha o dedo **aqui**, sem ir ao servidor: um pedido por
    // ponto do arraste saturaria a fila.
    if (onde.arrasto.x !== x || onde.arrasto.y !== y) {
      onde.arrasto = { ...onde.arrasto, x, y };
      repintar();
    }
    return null;
  }
  const solto = onde.arrasto;
  onde.arrasto = null;
  // **Cancelado, a peça volta** e nada vai ao servidor: o toque saiu da tela,
  // o sistema o tomou, ou a pessoa desistiu.
  if (evento.fase === 'cancelou') {
    repintar();
    return null;
  }
  return fazer(onde, canal, { op: 'token-move', scene: cena.id, id: solto.id, x, y });
}

function aoLugar(evento) {
  if (tela) {
    if (evento.onde) tela.onde = evento.onde;
    if (Array.isArray(evento.regioes)) tela.regioes = evento.regioes;
  }
  if (evento.regiao === 'chamada.palco') {
    // Escondido, o palco mede 0 × 0: o tabuleiro fica do tamanho que tinha,
    // para voltar inteiro quando a pessoa o trouxer à frente.
    if (evento.largura > 0 && evento.altura > 0) {
      palco.largura = evento.largura;
      palco.altura = evento.altura;
    }
  } else if (!evento.regiao && evento.largura > 0) {
    pag.largura = evento.largura;
  }
  repintar();
}

/**
 * **O aviso da metade de servidor.** Uma revisão nova de uma mesa que esta
 * janela mostra vira uma consulta; a da própria escrita, que já chegou na
 * resposta, não. Uma sala amarrada ou solta faz perguntar a sala de novo.
 */
function aoAviso(evento) {
  const carga = evento.carga ?? {};
  if (Array.isArray(carga.salas)) {
    // A sala em que a pessoa está ganhou ou perdeu a mesa, ou ainda não tinha.
    if (palco.sala !== null && (carga.salas.includes(palco.sala) || palco.canal === null)) void perguntarASala();
    return;
  }
  const canal = Number(evento.canal);
  if (!Number.isSafeInteger(canal) || !canaisAVista().has(canal)) return;
  const anunciada = typeof carga.revisao === 'number' ? carga.revisao : Infinity;
  if (escritasEmVoo.has(canal)) {
    avisosGuardados.set(canal, Math.max(avisosGuardados.get(canal) ?? -1, anunciada));
    return;
  }
  if (anunciada <= (vistaDe(canal)?.campaign?.revision ?? -1)) return;
  void consultar(canal);
}

function aoMudarDeCanal(canal) {
  canalAberto = Number.isSafeInteger(canal) && canal > 0 ? canal : null;
  if (tela?.canais) for (const c of tela.canais) c.aberto = c.id === canalAberto;
  if (pag.segueOCanal && pag.canal !== canalAberto) {
    largarAPagina();
    pag.canal = canalAberto;
  }
  if (canalAberto !== null) void consultar(canalAberto);
  repintar();
}

const releRetrato = agruparAtualizacoes(async () => {
  try {
    tela = await lerRetrato();
  } catch (erro) {
    anotar('warn', 'MESA: o retrato não veio: ' + frase(erro));
  }
  repintar();
});

function aoAcao(evento) {
  if (evento.acao === 'abrir-mesa') {
    const canal = Number(evento.canal);
    return abrirMesa(Number.isSafeInteger(canal) && canal > 0 ? canal : canalAberto, true);
  }
  if (evento.acao === 'mesa-da-sala') {
    const canal = salasConhecidas.get(Number(evento.canal)) ?? null;
    if (canal === null) return dizer('Esta sala não tem mais mesa.');
    return abrirMesa(canal, false);
  }
  return null;
}

function aoFechar(evento) {
  if (evento.superficie === 'mesa') {
    pag.aberta = false;
    return null;
  }
  if (evento.superficie === 'mesa-ficha') return fecharAFicha();
  if (dialogos.has(evento.superficie)) return descartarODialogo(evento.superficie);
  return null;
}

/** A trilha parou: dito uma vez por motivo, e apagado quando ela volta. */
function aoMidia(evento) {
  if (!/^(palco:)?trilha:/.test(String(evento.chave ?? ''))) return;
  if (evento.estado === 'recusada' || evento.estado === 'pausada' || evento.estado === 'falhou') {
    const motivo = evento.porque || (evento.estado === 'pausada' ? 'pausada' : 'o som não começou');
    if (trilha.ditos.has(motivo)) return;
    trilha.ditos.add(motivo);
    trilha.parou = 'A trilha parou: ' + motivo + '.';
    repintar();
  } else if (evento.estado === 'tocando' && trilha.parou) {
    trilha.parou = '';
    repintar();
  }
}

/** Os controles da página. */
function naPagina(evento) {
  const canal = pag.canal;
  const v = vistaDe(canal);
  const c = v?.campaign;
  const chave = String(evento.chave ?? '');
  // Repintada: a fórmula nova vira o valor e o inicial declarados, e a página
  // não fica suja por uma fórmula de dados.
  if (evento.nome === 'campo' && chave === 'formula') { pag.formula = String(evento.valor ?? ''); repintar(); return null; }
  if (evento.nome === 'botao' && chave === 'abrir-criar') {
    return abrirODialogo({ tipo: 'criar', canal, titulo: 'Criar a mesa', eu: String(v?.me ?? tela?.eu ?? '') });
  }
  if (!c) return null;
  const cena = cenaAtiva(c);
  const de = prefixo => (chave.startsWith(prefixo) ? chave.slice(prefixo.length) : null);

  if (evento.nome === 'escolha') {
    if (chave === 'cena' && evento.valor) return fazer(pag, canal, { op: 'scene-show', id: evento.valor });
    if (chave === 'trilha' && cena) return fazer(pag, canal, { op: 'scene-music', id: cena.id, preset: evento.valor });
    if (chave === 'trilha-mesa') return fazer(pag, canal, { op: 'music', command: 'select', preset: evento.valor });
    return null;
  }
  if (evento.nome !== 'botao') return null;
  if (chave === 'rolar') return rolar(pag, canal);
  const outra = de('abrir-ficha-');
  if (outra) return abrirAFicha(canal, outra);
  if (chave === 'nova-ficha') return abrirODialogo({ tipo: 'nova-ficha', canal, titulo: 'Nova ficha', eu: String(v.me), largura: 420 });
  if (chave === 'novo-verbete') return abrirODialogo({ tipo: 'verbete', canal, titulo: 'Novo verbete', base: {} });
  const editar = de('editar-verbete-');
  if (editar) {
    const e = c.entries.find(x => x.id === editar);
    return e ? abrirODialogo({ tipo: 'verbete', canal, titulo: 'Verbete · ' + e.name, base: JSON.parse(JSON.stringify(e)) }) : null;
  }
  const publicar = de('publicar-verbete-');
  if (publicar) {
    const e = c.entries.find(x => x.id === publicar);
    return e ? fazer(pag, canal, { op: 'entry-save', ...e, published: !e.published }) : null;
  }
  const apagar = de('apagar-verbete-');
  if (apagar) return fazer(pag, canal, { op: 'entry-remove', id: apagar });
  if (chave === 'nova-cena') return abrirODialogo({ tipo: 'nova-cena', canal, titulo: 'Nova cena', largura: 420 });
  if (chave === 'configurar') return abrirODialogo({ tipo: 'config', canal, titulo: 'Configurar a mesa', base: JSON.parse(JSON.stringify(c)) });
  if (chave === 'iniciativa-mao') return abrirODialogo({ tipo: 'iniciativa', canal, titulo: 'Pôr na iniciativa', largura: 420 });
  if (chave === 'iniciativa-proximo') return fazer(pag, canal, { op: 'initiative-next' });
  if (chave === 'iniciativa-limpar') return fazer(pag, canal, { op: 'initiative-clear' });
  const tirarDaIniciativa = de('tirar-iniciativa-');
  if (tirarDaIniciativa) return fazer(pag, canal, { op: 'initiative-remove', id: tirarDaIniciativa });
  if (!cena) return null;
  if (chave === 'ajustar-cena') return abrirODialogo({ tipo: 'cena', canal, titulo: 'Ajustar · ' + cena.name, base: JSON.parse(JSON.stringify(cena)) });
  if (chave === 'esconder-cena') return fazer(pag, canal, { op: 'scene-hide', id: cena.id });
  if (chave === 'apagar-cena') return fazer(pag, canal, { op: 'scene-remove', id: cena.id });
  if (chave === 'por-peca') return abrirODialogo({ tipo: 'peca', canal, titulo: 'Pôr peça', cena: cena.id, largura: 420 });
  if (chave === 'modo-parede') { pag.modoParede = !pag.modoParede; repintar(); return null; }
  const esconder = de('esconder-peca-');
  if (esconder) {
    const peca = cena.tokens.find(t => t.id === esconder);
    return peca ? fazer(pag, canal, { op: 'token-hide', scene: cena.id, id: peca.id, hidden: !peca.hidden }) : null;
  }
  const tirar = de('tirar-peca-');
  if (tirar) return fazer(pag, canal, { op: 'token-remove', scene: cena.id, id: tirar });
  return null;
}

/** Os controles do palco. */
function noPalco(evento) {
  const chave = String(evento.chave ?? '').slice('palco:'.length);
  const canal = palco.canal;
  const v = vistaDe(canal);
  if (!v?.campaign) return null;
  if (evento.nome === 'campo' && chave === 'formula') { palco.formula = String(evento.valor ?? ''); return null; }
  if (evento.nome !== 'botao') return null;
  if (chave === 'rolar') return rolar(palco, canal);
  if (chave === 'proximo') return fazer(palco, canal, { op: 'initiative-next' });
  if (chave === 'abrir-mesa') return abrirMesa(canal, false);
  if (chave === 'ficha') {
    const minha = v.campaign.sheets.find(s => v.isGM || s.owner === v.me);
    return minha ? abrirAFicha(canal, minha.id) : null;
  }
  return null;
}

/** Os controles da folha da ficha. */
function naFicha(evento) {
  const chave = String(evento.chave ?? '').slice('ficha:'.length);
  const canal = ficha.canal;
  const v = vistaDe(canal);
  const s = v?.campaign?.sheets.find(f => f.id === ficha.id);
  if (!s) return null;
  if (evento.nome === 'numero' && chave === 'quanto') {
    ficha.quanto = evento.valor === null || evento.valor === undefined ? '' : String(evento.valor);
    repintar();
    return null;
  }
  if (evento.nome === 'escolha') {
    if (chave === 'teste') ficha.teste = String(evento.valor);
    else if (chave === 'modo') ficha.modo = String(evento.valor);
    else if (chave === 'dono') return fazer(ficha, canal, { op: 'sheet-owner', id: s.id, owner: evento.valor });
    repintar();
    return null;
  }
  if (evento.nome !== 'botao') return null;
  const quanto = Number(ficha.quanto) || 0;
  const vida = { ferir: 'damage', curar: 'heal', temporarios: 'temporary' }[chave];
  if (vida) return fazer(ficha, canal, { op: 'vitality', sheet: s.id, kind: vida, amount: quanto }, () => { ficha.quanto = ''; });
  if (chave === 'atordoar') {
    // Uma função: a repetição depois de um conflito parte das condições que
    // acabaram de chegar.
    return fazer(ficha, canal, () => {
      const atuais = vistaDe(canal)?.campaign?.sheets.find(f => f.id === s.id)?.conditions ?? [];
      return { op: 'conditions', sheet: s.id, conditions: atuais.includes('stunned') ? atuais.filter(x => x !== 'stunned') : [...atuais, 'stunned'] };
    });
  }
  if (chave === 'descansar') return fazer(ficha, canal, { op: 'rest', sheet: s.id });
  if (chave === 'testar') {
    const [kind, key] = ficha.teste.split(':');
    return fazer(ficha, canal, { op: 'check', sheet: s.id, kind, key, mode: ficha.modo });
  }
  if (chave === 'editar') {
    return abrirODialogo({ tipo: 'editar-ficha', canal, titulo: 'Editar · ' + s.name, base: JSON.parse(JSON.stringify(s)), largura: 720 });
  }
  if (chave === 'nova-acao') return abrirODialogo({ tipo: 'acao', canal, titulo: 'Nova ação · ' + s.name, base: {}, ficha: s.id });
  const de = prefixo => (chave.startsWith(prefixo) ? chave.slice(prefixo.length) : null);
  const usar = de('usar-');
  if (usar) return fazer(ficha, canal, { op: 'action-use', sheet: s.id, id: usar });
  const editarAcao = de('editar-acao-');
  if (editarAcao) {
    const a = (s.actions ?? []).find(x => x.id === editarAcao);
    return a ? abrirODialogo({ tipo: 'acao', canal, titulo: 'Ação · ' + a.name, base: JSON.parse(JSON.stringify(a)), ficha: s.id }) : null;
  }
  const tirarAcao = de('tirar-acao-');
  if (tirarAcao) return fazer(ficha, canal, { op: 'action-remove', sheet: s.id, id: tirarAcao });
  const preparar = de('preparar-');
  if (preparar) {
    return fazer(ficha, canal, () => {
      const atual = vistaDe(canal)?.campaign?.sheets.find(f => f.id === s.id);
      if (!atual) throw new Error('not-found');
      const spells = atual.spells.includes(preparar) ? atual.spells.filter(x => x !== preparar) : [...atual.spells, preparar];
      return { op: 'sheet-save', sheet: { ...atual, spells } };
    });
  }
  const conjurar = de('conjurar-');
  if (conjurar) {
    const e = v.campaign.entries.find(x => x.id === conjurar);
    return fazer(ficha, canal, { op: 'cast', sheet: s.id, entry: conjurar, level: e?.level ?? 0 });
  }
  if (chave === 'tirar-retrato') return fazer(ficha, canal, { op: 'portrait-clear', sheet: s.id });
  if (chave === 'publicar-retrato') return fazer(ficha, canal, { op: 'portrait-publish', sheet: s.id, published: !s.portrait?.published });
  if (chave === 'por-na-mesa') {
    const cena = cenaAtiva(v.campaign);
    return cena ? fazer(ficha, canal, { op: 'token-add', scene: cena.id, sheet: s.id, x: 0, y: 0 }) : null;
  }
  // **A iniciativa é rolada pelo servidor**, d20 mais a Destreza da ficha: a
  // janela não dá o valor.
  if (chave === 'iniciativa') return fazer(ficha, canal, { op: 'initiative-add', sheet: s.id });
  if (chave === 'apagar') return fazer(ficha, canal, { op: 'sheet-remove', id: s.id }, () => { void fecharAFicha(); });
  return null;
}

ouvir(evento => {
  switch (evento.nome) {
    case 'canal': return aoMudarDeCanal(evento.canal);
    case 'sala': return perguntarASala();
    case 'pessoas': return releRetrato();
    case 'lugar': return aoLugar(evento);
    case 'servidor': return aoAviso(evento);
    case 'acao': return aoAcao(evento);
    case 'fechar': return aoFechar(evento);
    case 'submeter': return aoSubmeter(evento);
    case 'midia': return aoMidia(evento);
    case 'arquivo': return aoArquivo(evento);
    case 'traco': return aoTraco(evento);
    case 'contribuicao':
      // Uma região que a casca não tem não é defeito de quem joga: a mesa
      // continua pela entrada de navegação, e só o registro sabe.
      if (evento.motivo !== 'regiao-ausente') {
        anotar('warn', 'MESA: «' + evento.ponto + '» recusou ' + (evento.recusados ?? '?') + ' nós (' + (evento.motivo ?? 'sem motivo') + ')' + doRecusado(evento));
      }
      return null;
    case 'aba':
      if (evento.chave === 'aba' && ABAS.some(a => a.chave === evento.valor)) {
        pag.aba = evento.valor;
        repintar();
      }
      return null;
    default: {
      const chave = String(evento.chave ?? '');
      if (chave.startsWith('palco:')) return noPalco(evento);
      if (chave.startsWith('ficha:')) return naFicha(evento);
      return naPagina(evento);
    }
  }
});

// ------------------------------------------------------------- a subida

(async () => {
  tela = await lerRetrato();
  canalAberto = canalDe(tela);
  pag.canal = canalAberto;
  repintar();
  await Promise.all([consultar(canalAberto), perguntarASala()]);
})().catch(erro => dizer('A MESA não começou: ' + frase(erro), 'erro'));

})();
