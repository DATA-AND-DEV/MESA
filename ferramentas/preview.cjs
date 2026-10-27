// Laboratório local, com identidades simuladas. Nunca use como servidor público.
//
// # O que este laboratório prova, e o que ele não prova
//
// É a API 7 do app 0.17, com as peças de verdade onde dá:
//
// - **o prelúdio vem de onde ele mora**: `crates/seele-motor/src/preludio.rs`,
//   recortado da constante `PRELUDIO`. Um prelúdio que não for encontrado é um
//   erro com o caminho, e não um `undefined` que roda o MOD sem API;
// - **as capacidades são as do contrato** (`api/v7.json`, a cópia conferida em
//   `test/contrato/api-v7.json`): o `SeeleUI` nasce sem `regiao`, sem
//   `snapshot` e sem `cartoes`, como no produto;
// - **o código do MOD roda num contexto sem DOM e sem Node**, com a fachada de
//   mensagens do executor (`seele.postar` e `seele.console`). Não é QuickJS — é
//   o `vm` do Node —, e é para a diferença que existe `ferramentas/quickjs-check`;
// - **o renderer é o do produto**, servido dos arquivos reais:
//   `mods-estilos.js`, `mods-regiao.js`, `mods-superficies.js` e
//   `mods-contribuicoes.js`, com as folhas deles;
// - **a metade de servidor roda com o que a 6 dá a ela**: `mundo.avisar` (o
//   aviso sai às janelas do mesmo servidor depois de o quintal gravar),
//   `dados.uso()` e `dados.teto`, o `volume` e `contexto.sala`, pela presença
//   que este laboratório simula.
//
// O que ele **não** prova: o executor real, os limites de memória e tempo dele,
// a supervisão nativa, a revogação por geração e o descarte. Isso é o produto,
// e a auditoria pede observação nativa para dar qualquer fluxo por homologado.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.env.MOD_PACKAGE || path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'mod.json')));
const seele = process.env.SEELE_RAIZ || path.resolve(__dirname, '../../SEELE');
const produto = process.env.SEELE_UI || path.join(seele, 'apps/seele-app/ui');
const contrato = JSON.parse(fs.readFileSync(path.join(__dirname, '../test/contrato/api-v7.json'), 'utf8'));

/** Lê um arquivo do produto, dizendo o caminho quando ele não está lá. */
function doProduto(relativo) {
  const caminho = path.join(produto, relativo);
  if (!fs.existsSync(caminho)) {
    throw new Error(`O laboratório precisa de ${caminho}. `
      + 'Aponte SEELE_UI para a pasta `apps/seele-app/ui` de um checkout do SEELE 0.17.');
  }
  return fs.readFileSync(caminho, 'utf8');
}

/**
 * O prelúdio, recortado de onde ele mora: o motor em Rust.
 *
 * Recortar texto de outro arquivo é frágil, e é de propósito que a falha seja
 * ruidosa: um prelúdio que mudou de forma tem de quebrar o laboratório.
 */
function preludioDoMotor() {
  const fonte = path.join(seele, 'crates/seele-motor/src/preludio.rs');
  if (!fs.existsSync(fonte)) {
    throw new Error(`O laboratório precisa de ${fonte}. `
      + 'Aponte SEELE_RAIZ para um checkout do SEELE 0.17.');
  }
  const texto = fs.readFileSync(fonte, 'utf8');
  const marca = 'pub const PRELUDIO: &str = r#"';
  const inicio = texto.indexOf(marca);
  const fim = texto.indexOf('"#;', inicio);
  if (inicio < 0 || fim < 0) {
    throw new Error('`PRELUDIO` não foi encontrado em preludio.rs. '
      + 'Ele mudou de nome ou de forma, e este laboratório precisa acompanhar.');
  }
  return texto.slice(inicio + marca.length, fim);
}

const preludio = preludioDoMotor();
if (manifest.api !== 7) throw new Error('Este laboratório é da API 7 (a 6 inteira, mais as ações), e o mod.json declara a ' + manifest.api + '.');
const capacidades = contrato.compatibilidade['capacidades-por-versao'][String(manifest.api)];

// ------------------------------------------------------- o mundo de mentira

const mundos = new Map();

/** O estado de um servidor simulado, criado na primeira vez que alguém fala. */
function mundoDe(chave) {
  if (!mundos.has(chave)) {
    mundos.set(chave, { data: {}, files: new Map(), volumes: new Map(), esperas: new Map(), salas: new Map() });
  }
  return mundos.get(chave);
}

const TETO_DO_QUINTAL = 256 * 1024;
const bytesDe = d => Object.entries(d).reduce((n, [k, v]) => n + Buffer.byteLength(k) + Buffer.byteLength(String(v)), 0);

/** Uma volta ao servidor deste MOD, no `vm`, com o disco e o volume de mentira. */
/** As ações que o manifesto declara e quem as tem: no laboratório, quem hospeda (a pessoa 1) tem todas. O HOST escreve `contexto.acao`. */
const declaradasDoManifesto = () => (manifest.permissoes ?? []).map(p => p.acao);
const concedidasA = pessoa => (String(pessoa) === '1' ? declaradasDoManifesto() : []);
function aoPedirPelaAcao(chaveDoMundo, pessoa, canal, acao, pedido) {
  if (!declaradasDoManifesto().includes(acao)) return { ok: false, recusa: 'acao-nao-declarada' };
  if (!concedidasA(pessoa).includes(acao)) return { ok: false, recusa: 'sem-permissao' };
  return aoPedir(chaveDoMundo, pessoa, canal, pedido, acao);
}
function aoPedir(chaveDoMundo, pessoa, canal, pedido, acaoDoHost = null) {
  const mundo = mundoDe(chaveDoMundo);
  const dados = structuredClone(mundo.data);
  Object.defineProperty(dados, 'uso', { value: () => bytesDe(dados), enumerable: false });
  Object.defineProperty(dados, 'teto', { value: TETO_DO_QUINTAL, enumerable: false });
  const avisos = [];
  const ctx = vm.createContext({
    dados,
    mundo: {
      agora: () => Math.floor(Date.now() / 1000),
      avisar: aviso => {
        if (Buffer.byteLength(JSON.stringify(aviso?.carga ?? null)) > 1024) return { ok: false, erro: 'aviso-grande-demais' };
        avisos.push(structuredClone(aviso));
        return { ok: true };
      },
    },
    arquivos: {
      ler: p => mundo.files.get(p) ?? null,
      escrever: (p, v) => (mundo.files.set(p, v), true),
      apagar: p => mundo.files.delete(p),
      listar: () => [...mundo.files.keys()],
    },
    volume: {
      esperar: (token, caminho, tipos, prazo) => {
        mundo.esperas.set(token, { caminho, pessoa: String(pessoa), tipos, ate: Date.now() + prazo * 1000 });
        return true;
      },
      tamanho: c => (mundo.volumes.has(c) ? mundo.volumes.get(c).bytes.length : null),
      servir: c => (mundo.volumes.has(c) ? c : null),
      apagar: c => mundo.volumes.delete(c),
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, manifest.server), 'utf8'), ctx, { timeout: 1000 });
  const contexto = {
    person: String(pessoa), channel: Number(canal) === 0 ? null : Number(canal),
    admin: String(pessoa) === '1', write: true, sala: mundo.salas.get(String(pessoa)) ?? null,
    acao: acaoDoHost, permissoes: concedidasA(pessoa),
  };
  ctx.contextoJSON = JSON.stringify(contexto);
  ctx.pedidoJSON = JSON.stringify(pedido);
  let resposta = JSON.parse(vm.runInContext('aoPedir(contextoJSON,pedidoJSON)', ctx, { timeout: 1000 }));
  if (resposta.ok !== false && bytesDe(dados) > TETO_DO_QUINTAL) resposta = { ok: false, error: 'quintal-cheio' };
  if (resposta.ok !== false) {
    mundo.data = { ...dados };
    // **Depois de o quintal gravar**, e a toda janela deste MOD neste servidor,
    // inclusive a de quem pediu: o evento `servidor`.
    for (const aviso of avisos) {
      for (const [chave, sessao] of sessoes) {
        if (chave.startsWith(chaveDoMundo + ':')) {
          sessao.entregar(JSON.stringify({ tipo: 'evento', nome: 'servidor', canal: aviso.canal ?? null, carga: aviso.carga }));
        }
      }
    }
  }
  return resposta;
}

// ------------------------------------------------- o executor de mentira
//
// Um contexto por sessão do laboratório. O prelúdio primeiro, o MOD depois —
// a mesma ordem do executor, e pelo mesmo motivo: se o prelúdio não subir, o
// MOD não deve subir.

const sessoes = new Map();

function sessaoDe(chave, mandarParaAJanela) {
  if (sessoes.has(chave)) {
    sessoes.get(chave).mandar = mandarParaAJanela;
    return sessoes.get(chave);
  }
  const pendentes = [];
  const sessao = { mandar: mandarParaAJanela };
  const contexto = vm.createContext({
    // **Sem DOM e sem Node.** O que existe aqui é o que o executor oferece: a
    // ponte, a porta do registro e os temporizadores do anfitrião.
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(Number(ms) || 0, 60000)),
    clearTimeout,
    setInterval: (fn, ms) => setInterval(fn, Math.max(Number(ms) || 0, 50)),
    clearInterval,
    seele: {
      console: (nivel, texto) => console.log('[' + chave + ' ' + nivel + '] ' + texto),
      postar: texto => {
        // O teto de mensagem do executor, para o MOD bater nele aqui também.
        if (Buffer.byteLength(texto) > 12 * 1024) return false;
        pendentes.push(texto);
        queueMicrotask(() => {
          while (pendentes.length) sessao.mandar(pendentes.shift());
        });
        return true;
      },
    },
  });
  // O `console` que o V8 põe em todo contexto sai: quem o dá é o prelúdio.
  vm.runInContext('delete globalThis.console;', contexto);
  vm.runInContext(`globalThis.__seeleCapacidades = ${JSON.stringify(capacidades)};`, contexto);
  vm.runInContext(preludio, contexto, { timeout: 2000 });
  vm.runInContext(fs.readFileSync(path.join(root, manifest.client), 'utf8'), contexto, { timeout: 2000 });
  sessao.entregar = json => {
    try {
      contexto.__entrada = json;
      vm.runInContext('aoResponder(__entrada)', contexto, { timeout: 2000 });
    } catch (erro) {
      console.error('o MOD falhou ao receber:', erro.message);
    }
  };
  sessoes.set(chave, sessao);
  return sessao;
}

// ------------------------------------------------------------- a janela

const pagina = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${manifest.id} · laboratório API ${manifest.api}</title>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/mods-superficies.css">
<link rel="stylesheet" href="/mods-controles.css">
<link rel="stylesheet" href="/lab.css">
</head><body>
<header>
  <h1>${manifest.id} · laboratório API ${manifest.api}</h1>
  <p>Identidades e transporte simulados; renderer e prelúdio reais. Dados temporários.
     O executor de verdade é o QuickJS do produto — este é o <code>vm</code> do Node.</p>
  <a href="/?pessoa=1">Host</a> · <a href="/?pessoa=2">Participante</a> ·
  <a href="/?pessoa=3">Terceira pessoa</a> · <a href="/?servidor=b">Outro servidor</a> ·
  <a href="/?pessoa=2&onde=celular">Celular</a>
  <label> Canal <select id="canal"><option value="1">geral</option><option value="2">outro</option></select></label>
  <label> Sala de voz <select id="sala"><option value="">fora de sala</option><option value="7">Taverna</option><option value="8">Porão</option></select></label>
  <button id="sair" type="button">Sair da sessão</button>
</header>
<main id="tela-sessao">
  <nav id="navegacao"><ul id="lista-mods-navegacao" class="canais" hidden></ul><div id="acoes-das-salas"></div></nav>
  <div id="canal-cabecalho-mods"></div>
  <section id="palco-de-mods" hidden><p id="palco-de-mods-quem"></p><div id="palco-de-mods-miolo"></div></section>
  <!--
    **Dentro da tela, como no produto.** No \`index.html\` do SEELE os palcos
    são filhos de \`section#tela-sessao\`, e não do \`<body>\`: \`prenderFoco\`
    percorre os ancestrais do diálogo tornando os irmãos inertes, e um defeito
    só aparecia com a hierarquia do produto.
  -->
  <div id="palco-de-paginas" class="palco-de-paginas" hidden></div>
  <div id="palco-de-paineis" class="palco-de-paineis" hidden></div>
  <div id="palco-de-camadas" class="palco-de-camadas" hidden></div>
  <div id="avisos-de-mod" class="avisos-de-mod" hidden></div>
  <div id="moderar" hidden></div>
</main>
<script src="/mods-estilos.js"></script>
<script src="/mods-regiao.js"></script>
<script src="/mods-superficies.js"></script>
<script src="/mods-contribuicoes.js"></script>
<script src="/ponte.js"></script>
</body></html>`;

/**
 * A ponte da janela: o mínimo de `base.js` que o renderer exige, escrito aqui
 * em vez de recortado de lá. **O mínimo, e ele é dito**: `base.js` inteiro
 * carrega o Tauri, a sessão e a supervisão; nada disso existe aqui.
 */
const ponte = `const id=${JSON.stringify(manifest.id)};
const $=n=>document.getElementById(n);
const elemento=(tag,classe,dentro)=>{const no=document.createElement(tag);if(classe)no.className=classe;if(dentro!==undefined)no.textContent=dentro;return no;};
const repovoar=(no,filhos)=>no.replaceChildren(...filhos);
const params=new URLSearchParams(location.search);
const pessoa=params.get('pessoa')||'1', servidor=params.get('servidor')||'a';
// **Uma instância do MOD por janela**, como no produto: duas abas da mesma
// pessoa são duas janelas, cada uma com o executor dela.
const janela=Math.random().toString(36).slice(2);
const onde=params.get('onde')==='celular'?'celular':'computador';
const regioes=['redes','servidor.navegacao','operador.barra','canal.cabecalho','conversa.mensagem','compositor','pessoas.lista',
  ...(onde==='celular'?[]:['status.barra']),'chamada.palco','pagina','dialogo','folha','aviso'];

// **A confirmação é do produto.** Sem ela, o botão que declara \`confirmar\`
// não faz nada — é o que \`confirmarAntes\` faz quando não há a quem perguntar.
function abrirConfirmacao(titulo,texto,rotulo,aoSim,aoNao){
  const caixa=$('moderar');caixa.hidden=false;
  const sim=elemento('button','confirmar-sim',rotulo),nao=elemento('button','confirmar-nao','CANCELAR');
  sim.type=nao.type='button';
  const fechar=()=>{caixa.hidden=true;repovoar(caixa,[]);};
  sim.onclick=()=>{fechar();aoSim();};nao.onclick=()=>{fechar();aoNao&&aoNao();};
  repovoar(caixa,[elemento('h2','',titulo),elemento('p','',texto),nao,sim]);
}

// A instância de mentira: o renderer registra recursos nela, e sair os solta.
const recursos=[];
// A API do pacote vai na instância e no dono, como em \`base.js\`: é por ela que
// o renderer sabe que tipos de superfície e que recusas este MOD tem.
const instancia={
  api:${manifest.api},
  geracao:1,
  admite:()=>true,
  registrar:(porque,soltar)=>{
    let saiu=false;
    const entrada={porque,soltar};
    recursos.push(entrada);
    const esquecer=()=>{
      if(saiu)return false;
      saiu=true;
      const i=recursos.indexOf(entrada);
      if(i>=0)recursos.splice(i,1);
      return true;
    };
    const soltarRecurso=()=>{if(!esquecer())return;try{soltar();}catch(e){console.warn(porque,e);}};
    soltarRecurso.esquecer=esquecer;
    return soltarRecurso;
  },
};

const pedirAAcao=async(canal,acao,corpo)=>{
  const r=await fetch('/acao',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({servidor,pessoa,canal,acao,corpo})});
  return r.json();
};
const pedirAoServidor=async(canal,corpo)=>{
  const r=await fetch('/pedido',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({servidor,pessoa,canal,corpo})});
  return r.json();
};

const escolhidos=[];
const dono={
  instancia,
  api:${manifest.api},
  geracao:1,
  podeFalar:()=>true,
  falar:dados=>enviar({tipo:'evento',...dados}),
  abrirEndereco:url=>{console.log('abriria fora da janela:',url);},
  anotarRecusa:oQue=>console.warn('recusa:',oQue),
  midiaMudou:()=>{},
  aoFecharASuperficie:()=>{},
  imagemDaPessoa:async()=>null,
  recusaParaOMod:falha=>{
    const nome=typeof falha?.recusa==='string'?falha.recusa:null;
    if(!nome)return{erro:'falhou'};
    return {...(falha.camposDaRecusa||{}),erro:nome};
  },
  escolherArquivo:async pedido=>new Promise(resolve=>{
    const entrada=document.createElement('input');
    entrada.type='file';
    if(pedido&&pedido.extensoes&&pedido.extensoes.length)entrada.accept=pedido.extensoes.map(e=>'.'+e).join(',');
    entrada.onchange=async()=>{
      const arquivo=entrada.files[0];
      if(!arquivo){resolve(null);return;}
      const bytes=new Uint8Array(await arquivo.arrayBuffer());
      const numero=escolhidos.push({bytes,tipo:arquivo.type});
      resolve({id:numero,tipo:arquivo.type||'application/octet-stream',papel:arquivo.type.startsWith('audio/')?'som':'imagem',bytes:bytes.length});
    };
    entrada.oncancel=()=>resolve(null);
    entrada.click();
  }),
  carregarMidia:async caminho=>{
    const r=await fetch('/arquivo?nome='+encodeURIComponent(caminho));
    if(!r.ok)throw new Error('arquivo-do-pacote-nao-servido');
    const {uri,papel,bytes}=await r.json();
    return papel==='som'?{papel,bytes}:{uri,papel,bytes};
  },
  bytesDoSom:async caminho=>{
    const r=await fetch('/arquivo?nome='+encodeURIComponent(caminho));
    if(!r.ok)throw new Error('arquivo-do-pacote-nao-servido');
    const {uri}=await r.json();
    const bin=atob(uri.slice(uri.indexOf(',')+1));
    const b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);
    return b.buffer;
  },
  // **Pelo volume, ou pelas páginas antigas**, como \`carregarMidiaDoServidor\`
  // em \`base.js\`: o volume vai pelo caminho que a metade de servidor deu, e as
  // páginas seguem o \`proximo\` opaco que ela devolve.
  carregarMidiaDoServidor:async(canal,pedido,campo)=>{
    if(pedido&&pedido.transporte==='volume'){
      const r=await pedirAoServidor(canal,pedido);
      if(!r.ok||typeof r.volume!=='string')throw new Error(r.error||'sem-volume');
      const v=await (await fetch('/volume?servidor='+servidor+'&caminho='+encodeURIComponent(r.volume))).json();
      return {uri:v.uri,papel:'imagem',bytes:v.bytes};
    }
    let atual=pedido,texto='';
    for(let i=0;i<200;i++){
      const r=await pedirAoServidor(canal,atual);
      if(typeof r[campo]!=='string')throw new Error('a resposta do servidor não traz «'+campo+'»');
      texto+=r[campo];
      if(!r.proximo)break;
      atual={...pedido,...r.proximo};
    }
    return {uri:texto,papel:texto.startsWith('data:audio')?'som':'imagem',bytes:texto.length};
  },
};

const contribuicoes=new RegistroDeContribuicoes();
const superficies=new SuperficiesDoMod(id,dono,{
  paginas:$('palco-de-paginas'),paineis:$('palco-de-paineis'),
  camadas:$('palco-de-camadas'),avisos:$('avisos-de-mod'),
});

/** O retrato que a janela projeta: só os campos da lista branca da 6. */
function retrato(){
  const aberto=Number($('canal').value);
  const sala=$('sala').value?Number($('sala').value):null;
  return {
    eu:Number(pessoa),
    servidor:{nome:'Servidor do laboratório '+servidor},
    pessoas:[{id:1,apelido:'Alex',falando:false,mudo:false},{id:2,apelido:'Lia',falando:false,mudo:false},{id:3,apelido:'Rafa',falando:false,mudo:false}],
    salas:[{id:7,nome:'Taverna',limite:0,pessoas:[],minha:sala===7},{id:8,nome:'Porão',limite:0,pessoas:[],minha:sala===8}],
    canais:[{id:1,nome:'geral',aberto:aberto===1},{id:2,nome:'outro',aberto:aberto===2}],
    onde,regioes,
  };
}

// Um renderer por contribuição que monta declaração, como \`montarContribuicao\`.
const montadas=new Map();
function montarContribuicao(c,perfil){
  let m=montadas.get(c.handle);
  if(!m){
    const raiz=elemento('div','contribuicao-de-mod');raiz.dataset.mod=c.mod;raiz.dataset.ponto=c.ponto;
    m={raiz,renderer:new RegiaoDeMod(c.mod,dono,raiz,PERFIS_DE_RENDER[perfil])};
    montadas.set(c.handle,m);
  }
  const recusados=m.renderer.aplicar(c.conteudo);
  if(recusados>0)dono.falar({nome:'contribuicao',ponto:c.ponto,destino:c.alvo,recusados});
  return m.raiz;
}
function acaoDe(c,canal){
  const b=elemento('button','acao-de-mod',c.rotulo||c.mod);b.type='button';
  b.dataset.mod=c.mod;
  b.onclick=()=>dono.falar({nome:'acao',acao:c.acaoPrincipal,pessoa:'',canal:canal===undefined?'':String(canal)});
  return b;
}
function desenharContribuicoes(){
  const nav=contribuicoes.para('servidor.navegacao');
  $('lista-mods-navegacao').hidden=nav.length===0;
  repovoar($('lista-mods-navegacao'),nav.map(e=>{const li=elemento('li');li.append(acaoDe(e));return li;}));
  const canal=$('canal').value;
  repovoar($('canal-cabecalho-mods'),contribuicoes.para('canal.cabecalho',canal).flatMap(c=>[
    ...(c.conteudo?[montarContribuicao(c,'cartao')]:[]),...(c.acaoPrincipal?[acaoDe(c,canal)]:[])]));
  repovoar($('acoes-das-salas'),['7','8'].flatMap(s=>contribuicoes.para('sala.acoes',s).map(c=>{
    const b=acaoDe(c,s);b.textContent=c.rotulo+' · sala '+s;return b;})));
  const naSala=Boolean($('sala').value);
  const palco=naSala?contribuicoes.escolherSubstituicao('chamada.palco','','').escolhida:null;
  repovoar($('palco-de-mods-miolo'),palco?[montarContribuicao(palco,'superficie')]:[]);
  $('palco-de-mods').hidden=!palco;
  $('palco-de-mods-quem').textContent=palco?'PALCO DE '+palco.mod:'';
  for(const [handle,m] of montadas)if(!contribuicoes.porHandle.has(handle)){m.renderer.soltar();m.raiz.remove();montadas.delete(handle);}
  if(palco)dizerOLugar('chamada.palco');
}
contribuicoes.aoMudar(desenharContribuicoes);

function enviar(m){fetch('/para-o-mod',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({servidor,pessoa,janela,m})});}
function responder(n,ok,carga){enviar({tipo:'resposta',n,ok,...carga});}
// **A montagem que não coube inteira**, como \`recusaDosNos\` em \`base.js\`: o
// nome da lista fechada, a conta e a amostra do que foi. O que coube fica.
const recusaDosNos=(s,recusados)=>Object.assign(new Error('nos-recusados'),{recusa:'nos-recusados',
  camposDaRecusa:{recusados,amostra:Array.isArray(s?.renderer?.amostraDeRecusados)?s.renderer.amostraDeRecusados.map(r=>({...r})):[]}});

const ditos=new Map();
function dizerOLugar(regiao){
  const caixa=regiao?$('palco-de-mods-miolo'):$('tela-sessao');
  const largura=Math.round(caixa.clientWidth),altura=Math.round(regiao?Math.max(caixa.clientHeight,480):caixa.clientHeight);
  const chave=largura+'×'+altura;
  if(ditos.get(regiao||'')===chave)return;
  ditos.set(regiao||'',chave);
  dono.falar({nome:'lugar',onde,regioes,largura,altura,...(regiao?{regiao}:{})});
}
addEventListener('resize',()=>{dizerOLugar();if(!$('palco-de-mods').hidden)dizerOLugar('chamada.palco');});

async function atender(m){
  try{
    switch(m.tipo){
      case 'retrato':responder(m.n,true,{valor:retrato()});dizerOLugar();return;
      case 'pedido':responder(m.n,true,{valor:await pedirAoServidor(m.canal,m.valor)});return;
      case 'acao':responder(m.n,true,{valor:await pedirAAcao(m.canal,m.acao,m.valor)});return;
      case 'tema':responder(m.n,false,{erro:'sem-previa'});return;
      case 'enviar-imagem':{
        const e=escolhidos[m.arquivo-1];
        if(!e)throw Object.assign(new Error('sem-espera'),{recusa:'sem-espera'});
        let bruto='';for(const b of e.bytes)bruto+=String.fromCharCode(b);
        const r=await (await fetch('/enviar',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({servidor,pessoa,token:m.token,tipo:e.tipo,base64:btoa(bruto)})})).json();
        if(!r.ok)throw Object.assign(new Error(r.erro),{recusa:r.erro});
        responder(m.n,true,{valor:null});return;
      }
      case 'soltar-arquivo':responder(m.n,true,{valor:null});return;
      case 'superficie-criar':responder(m.n,true,{valor:superficies.criar(m.descricao)});return;
      case 'superficie-montar':{
        const s=superficies.de(m.superficie),recusados=s.montar(m.arvore);
        if(recusados>0)throw recusaDosNos(s,recusados);
        responder(m.n,true,{valor:null});return;
      }
      case 'superficie-atualizar':{
        const s=superficies.de(m.superficie),recusados=s.atualizar(m.chave,m.arvore);
        if(recusados>0)throw recusaDosNos(s,recusados);
        responder(m.n,true,{valor:null});return;
      }
      case 'formulario-erros':superficies.de(m.superficie).marcarErros(m.erros);responder(m.n,true,{valor:null});return;
      case 'superficie-classes':{
        const s=superficies.de(m.superficie),recusados=s.declararClasses(m.classes);
        if(recusados>0)throw recusaDosNos(s,recusados);
        responder(m.n,true,{valor:null});return;
      }
      case 'superficie-mostrar':superficies.de(m.superficie).mostrar();superficies.arrumarPalcos();responder(m.n,true,{valor:null});return;
      case 'superficie-ocultar':superficies.de(m.superficie).ocultar();superficies.arrumarPalcos();responder(m.n,true,{valor:null});return;
      case 'superficie-suja':superficies.de(m.superficie).marcarSuja(m.suja);responder(m.n,true,{valor:null});return;
      case 'superficie-titulo':{
        const s=superficies.de(m.superficie);s.titulo=String(m.titulo||'').slice(0,120);
        if(s.tituloNo)s.tituloNo.textContent=s.titulo;
        responder(m.n,true,{valor:null});return;
      }
      case 'superficie-fechar':superficies.fechar(m.superficie,m.motivo);responder(m.n,true,{valor:null});return;
      case 'superficie-descartar':superficies.descartar(m.superficie);responder(m.n,true,{valor:null});return;
      case 'contribuir':responder(m.n,true,{valor:contribuicoes.registrar({id},instancia,m.pedido)});return;
      // Com o dono, como o roteador do produto: sem ele, o laboratório aceitaria
      // o que o SEELE recusa, e ensinaria o contrário do contrato.
      case 'revogar-contribuicao':responder(m.n,true,{valor:contribuicoes.revogar(m.handle,{id,instancia})});return;
      case 'atualizar-contribuicao':{
        const ok=contribuicoes.atualizar(m.handle,{id,instancia},m.conteudo);
        desenharContribuicoes();
        responder(m.n,true,{valor:ok});return;
      }
      default:throw new Error('a API de MODs não conhece «'+m.tipo+'»');
    }
  }catch(falha){
    responder(m.n,false,typeof falha?.recusa==='string'?{...(falha.camposDaRecusa||{}),erro:falha.recusa}:{erro:falha.message});
  }
}

$('canal').onchange=()=>{desenharContribuicoes();dono.falar({nome:'canal',canal:Number($('canal').value)});};
$('sala').onchange=async()=>{
  const sala=$('sala').value?Number($('sala').value):null;
  await fetch('/sala',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({servidor,pessoa,sala})});
  desenharContribuicoes();
  dono.falar({nome:'sala',sala});
};

$('sair').onclick=async()=>{
  await fetch('/sair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({servidor,pessoa,janela})});
  superficies.soltarTudo();contribuicoes.limpar();
  for(const [,m] of montadas){m.renderer.soltar();m.raiz.remove();}montadas.clear();
  for(const r of recursos.splice(0)){try{r.soltar();}catch(e){console.warn(r.porque,e);}}
  $('tela-sessao').hidden=true;
};

// A fita do executor chega por eventos do servidor: um MOD fala sem que a
// janela tenha perguntado, e é isso que 'text/event-stream' modela.
const fonte=new EventSource('/do-mod?servidor='+servidor+'&pessoa='+pessoa+'&janela='+janela);
fonte.onmessage=e=>{void atender(JSON.parse(e.data));};
`;

const css = `body{margin:0;padding:24px;background:var(--seele-negro-absoluto);color:var(--seele-osso);
font:13px/1.6 var(--seele-mono,monospace)}
a{color:var(--seele-laranja-nerv)} header{margin-bottom:24px}
#tela-sessao{display:flex;flex-direction:column;gap:16px;border:1px solid var(--seele-linha);padding:16px;min-height:60vh}
#palco-de-mods{border:1px solid var(--seele-linha-forte);padding:8px;min-height:480px}
#moderar{position:fixed;inset:30% 20%;z-index:1000;background:var(--seele-negro-absoluto);border:1px solid var(--seele-laranja-nerv);padding:16px}
.palco-de-paginas,.palco-de-paineis{min-height:0}
.canais{list-style:none;margin:0;padding:0}`;

// ------------------------------------------------------------ o servidor

const servidorHttp = http.createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:");
  try {
    const url = new URL(req.url, 'http://localhost');
    const corpo = async () => {
      let bruto = '';
      for await (const pedaco of req) {
        bruto += pedaco;
        if (Buffer.byteLength(bruto) > 16 * 1024 * 1024) throw new Error('pedido-grande-demais');
      }
      return JSON.parse(bruto);
    };
    const json = valor => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(valor)); };

    if (url.pathname === '/do-mod') {
      const chave = `${url.searchParams.get('servidor')}:${url.searchParams.get('pessoa')}:${url.searchParams.get('janela')}`;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      sessaoDe(chave, texto => res.write(`data: ${texto}\n\n`));
      // A janela fechou ou recarregou: a instância dela sai com ela.
      req.on('close', () => sessoes.delete(chave));
      return;
    }
    if (url.pathname === '/para-o-mod' && req.method === 'POST') {
      const q = await corpo();
      sessoes.get(`${q.servidor}:${q.pessoa}:${q.janela}`)?.entregar(JSON.stringify(q.m));
      return json({});
    }
    if (url.pathname === '/sair' && req.method === 'POST') {
      const q = await corpo();
      sessoes.delete(`${q.servidor}:${q.pessoa}:${q.janela}`);
      return json({});
    }
    if (url.pathname === '/sala' && req.method === 'POST') {
      const q = await corpo();
      const salas = mundoDe(q.servidor || 'a').salas;
      if (q.sala === null) salas.delete(String(q.pessoa)); else salas.set(String(q.pessoa), Number(q.sala));
      return json({ ok: true });
    }
    if (url.pathname === '/pedido' && req.method === 'POST') {
      const q = await corpo();
      if (!['1', '2', '3'].includes(String(q.pessoa))) throw new Error('identidade');
      return json(aoPedir(q.servidor || 'a', String(q.pessoa), q.canal ?? 1, q.corpo));
    }
    // A ação declarada (`SeeleMods.acao`): o host confere a declaração e a permissão ANTES da metade de servidor.
    if (url.pathname === '/acao' && req.method === 'POST') {
      const q = await corpo();
      if (!['1', '2', '3'].includes(String(q.pessoa))) throw new Error('identidade');
      return json(aoPedirPelaAcao(q.servidor || 'a', String(q.pessoa), q.canal ?? 1, String(q.acao), q.corpo));
    }
    // O envio pelo volume: só com o token que a metade de servidor deu a esta pessoa.
    if (url.pathname === '/enviar' && req.method === 'POST') {
      const q = await corpo();
      const mundo = mundoDe(q.servidor || 'a');
      const espera = mundo.esperas.get(q.token);
      if (!espera || espera.pessoa !== String(q.pessoa) || espera.ate < Date.now()) return json({ ok: false, erro: 'sem-espera' });
      const bytes = Buffer.from(q.base64, 'base64');
      if (bytes.length > 10 * 1024 * 1024) return json({ ok: false, erro: 'arquivo-grande-demais' });
      mundo.esperas.delete(q.token);
      mundo.volumes.set(espera.caminho, { bytes, tipo: q.tipo || 'image/png' });
      return json({ ok: true });
    }
    if (url.pathname === '/volume') {
      const arquivo = mundoDe(url.searchParams.get('servidor') || 'a').volumes.get(url.searchParams.get('caminho'));
      if (!arquivo) { res.statusCode = 404; return json({ ok: false, error: 'nao-esta-no-volume' }); }
      return json({ uri: `data:${arquivo.tipo};base64,${arquivo.bytes.toString('base64')}`, bytes: arquivo.bytes.length });
    }
    if (url.pathname === '/arquivo') {
      // **Só o que o manifesto declara.** É a mesma regra do produto: um
      // arquivo na pasta que ninguém nomeou não é servido.
      const nome = url.searchParams.get('nome') ?? '';
      if (!(manifest.arquivos ?? []).includes(nome)) { res.statusCode = 404; return json({ ok: false, error: 'arquivo-nao-declarado' }); }
      const bytes = fs.readFileSync(path.join(root, nome));
      const tipo = nome.endsWith('.wav') ? 'audio/wav' : nome.endsWith('.png') ? 'image/png'
        : nome.endsWith('.jpg') || nome.endsWith('.jpeg') ? 'image/jpeg' : nome.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
      return json({ uri: `data:${tipo};base64,${bytes.toString('base64')}`, papel: tipo.startsWith('audio/') ? 'som' : 'imagem', bytes: bytes.length });
    }

    const rotas = {
      '/': ['text/html; charset=utf-8', pagina],
      '/lab.css': ['text/css', css],
      '/ponte.js': ['text/javascript', ponte],
      '/tokens.css': ['text/css', doProduto('tokens.css')],
      '/mods-superficies.css': ['text/css', doProduto('mods-superficies.css')],
      '/mods-controles.css': ['text/css', doProduto('mods-controles.css')],
      '/mods-estilos.js': ['text/javascript', doProduto('mods-estilos.js')],
      '/mods-regiao.js': ['text/javascript', doProduto('mods-regiao.js')],
      '/mods-superficies.js': ['text/javascript', doProduto('mods-superficies.js')],
      '/mods-contribuicoes.js': ['text/javascript', doProduto('mods-contribuicoes.js')],
    };
    if (!rotas[url.pathname]) { res.statusCode = 404; res.end(); return; }
    const [tipo, texto] = rotas[url.pathname];
    res.setHeader('Content-Type', tipo);
    res.end(texto);
  } catch (erro) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: erro.message }));
  }
});

servidorHttp.listen(Number(process.env.MOD_PORT || 4318), '127.0.0.1', () => {
  console.log('Preview: http://127.0.0.1:' + servidorHttp.address().port);
});
