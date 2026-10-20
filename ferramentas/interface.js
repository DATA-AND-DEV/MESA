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
