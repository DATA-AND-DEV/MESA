const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../servidor/main.js'), 'utf8');
// Bytes em UTF-8, a conta do quintal do SEELE (chave mais valor).
const bytes = texto => Buffer.byteLength(String(texto), 'utf8');
function session(random = [0.05, 0.95], opcoes = {}) {
  const disk = new Map(), data = {};
  let serial = 0, time = 123;
  // A revisão é por canal: cada canal tem a campanha dele.
  const revisions = {};
  // **O que a API 6 dá à metade de servidor, simulado** (rascunho §5 e §7.3):
  // `contexto.sala` é preenchido pelo servidor em todo pedido, pela presença,
  // e nunca pela janela; `mundo.avisar` é segurado até a chamada gravar, e só
  // sai se ela gravou. A carga cabe em 1 KiB (a proposta do teto).
  const salas = {}, avisos = [];
  // **O volume** (ADR 0048, `api/v6.json` «volume»): a metade de servidor
  // abre a espera, para quem está sendo atendido, com o caminho, os tipos e o
  // prazo; a janela manda os bytes com o token (`enviar`, abaixo); e o MOD lê
  // o tamanho e apaga. Os bytes não passam pelo QuickJS.
  const volumes = new Map(), esperas = new Map();
  // **O quintal tem teto**: `dados.uso()` e `dados.teto` (api/v6.json, «sentido»),
  // e acima dele o anfitrião recusa a gravação com `quintal-cheio`.
  const teto = opcoes.teto ?? 256 * 1024;
  const usoDe = d => Object.entries(d).reduce((soma, [k, v]) => soma + bytes(k) + bytes(v), 0);
  // **O HOST das ações (API 7).** Quem tem cada permissão é dos cargos, e não da janela nem do pedido: por padrão a pessoa 1 (quem
  // hospeda) tem `criar-campanha`. `concessoes` (pessoa -> lista) muda, e é lido a cada pedido (a revogação vale na hora).
  const declaradas = JSON.parse(fs.readFileSync(path.join(__dirname, '../mod.json'), 'utf8')).permissoes.map(p => p.acao);
  const concessoes = new Map([['1', [...declaradas]]]);
  const concedidas = person => (concessoes.get(String(person)) ?? []).filter(a => declaradas.includes(a));
  function request(person, op, extra = {}, channel = 1, acaoDoHost = null, escreve = true) {
    // A fresh runtime per request, just like the production API 2 bridge.
    const segurados = [];
    const avisar = aviso => {
      assert.ok(aviso && typeof aviso === 'object', 'o aviso não é um objeto');
      assert.ok(aviso.canal === undefined || Number.isInteger(aviso.canal), 'o canal do aviso não é um id');
      assert.ok(Buffer.byteLength(JSON.stringify(aviso.carga)) <= 1024, 'a carga do aviso passa de 1 KiB');
      segurados.push(structuredClone(aviso));
      return { ok: true };
    };
    const dados = structuredClone(data);
    if (!opcoes.semUso) {
      Object.defineProperty(dados, 'uso', { value: () => usoDe(dados), enumerable: false });
      Object.defineProperty(dados, 'teto', { value: teto, enumerable: false });
    }
    const volume = {
      esperar: (token, caminho, tipos, prazo) => {
        assert.ok(typeof token === 'string' && token && typeof caminho === 'string' && caminho, 'espera sem token ou caminho');
        assert.ok(Array.isArray(tipos) && tipos.every(t => ['png', 'jpeg', 'webp', 'gif'].includes(t)), 'tipos de volume que o SEELE não conhece');
        assert.ok(Number.isInteger(prazo) && prazo > 0, 'prazo de volume inválido');
        esperas.set(token, { caminho, tipos, person: String(person) });
        return true;
      },
      tamanho: caminho => volumes.has(caminho) ? volumes.get(caminho) : null,
      servir: caminho => volumes.has(caminho) ? caminho : null,
      apagar: caminho => volumes.delete(caminho),
    };
    const context = { dados, volume, mundo: { agora: () => time, avisar }, arquivos: { ler: p => disk.get(p) ?? null, escrever: (p,v) => (disk.set(p,v), true), apagar: p => disk.delete(p), listar:()=>[...disk.keys()] } };
    let draw = 0; context.Math = Object.create(Math); context.Math.random = () => random[draw++ % random.length];
    vm.createContext(context); vm.runInContext(opcoes.fonte ?? source, context);
    const ctx = {person:String(person),admin:person===1,write:escreve,channel,sala:salas[person] ?? null,acao:acaoDoHost,permissoes:concedidas(person)};
    let r = JSON.parse(context.aoPedir(JSON.stringify(ctx),JSON.stringify({op,nonce:'n-'+(++serial),revision:revisions[channel] ?? 0,...extra})));
    // O anfitrião grava o quintal depois da chamada, e recusa acima do teto.
    if (r.ok && !opcoes.semUso && usoDe(context.dados) > teto) r = { ok: false, error: 'quintal-cheio' };
    if(r.ok) {Object.assign(data,context.dados); avisos.push(...segurados); if(r.campaign)revisions[channel]=r.campaign.revision;}
    return r;
  }
  /** A janela manda os bytes pelo volume, com o token que a metade de servidor deu. */
  const enviar = (person, token, tamanho) => {
    const espera = esperas.get(token);
    if (!espera || espera.person !== String(person)) return { ok: false, erro: 'sem-espera' };
    esperas.delete(token);
    volumes.set(espera.caminho, tamanho);
    return { ok: true };
  };
  /** `SeeleMods.acao` no servidor: a ação declarada e a permissão da pessoa são conferidas ANTES da metade de servidor, que só então recebe o `contexto.acao`. */
  function acao(person, nome, op, extra = {}, channel = 1, escreve = true) {
    if (!declaradas.includes(nome)) return { ok: false, recusa: 'acao-nao-declarada' };
    if (!concedidas(person).includes(nome)) return { ok: false, recusa: 'sem-permissao' };
    return request(person, op, extra, channel, nome, escreve);
  }
  return {request, acao, concessoes, disk, data, avisos, volumes, enviar, entrar:(person,sala)=>{salas[person]=sala;}, advance:seconds=>time+=seconds, setup:(channel=1)=>acao(1,'criar-campanha','setup',{name:'Casa',system:'dnd5e-2014',gm:'1'},channel)};
}
/**
 * Uma imagem da 3.x, como ela ficou no disco: páginas de texto em `arquivos`,
 * com um índice. A 4.0.0 não as escreve mais, e ainda as lê e as apaga.
 */
function semearImagemDa3(s, { alvo, id, imagem, canal = 1 }) {
  const c = JSON.parse(s.data['campaign-' + canal]);
  const base = 'channel-' + canal + '/' + (alvo === 'retrato' ? 'portrait-' + id : id) + '-image-1.parts';
  const paginas = imagem.match(/[\s\S]{1,7000}/g);
  paginas.forEach((pagina, i) => s.disk.set(base + '.' + i, pagina));
  s.disk.set(base, JSON.stringify({ format: 1, parts: paginas.length, length: imagem.length, sizes: paginas.map(p => p.length) }));
  if (alvo === 'cena') c.scenes.find(v => v.id === id).asset = base;
  else c.sheets.find(v => v.id === id).portrait = { asset: base, published: false };
  s.data['campaign-' + canal] = JSON.stringify(c);
  return base;
}
test('only who has the action creates a campaign; GM may be delegated',()=>{
  // Sem a permissão: o host recusa, pelo nome, e a metade de servidor nem roda.
  const s=session();assert.deepEqual(s.acao(2,'criar-campanha','setup',{name:'x',system:'free',gm:'2'}),{ok:false,recusa:'sem-permissao'});
  assert.deepEqual(s.acao(1,'apagar-tudo','setup',{name:'x',system:'free',gm:'2'}),{ok:false,recusa:'acao-nao-declarada'});
  assert.equal(s.request(1,'view').campaign,null,'uma recusa criou a mesa');
  assert.equal(s.acao(1,'criar-campanha','setup',{name:'x',system:'free',gm:'2'}).isGM,false);
  assert.equal(s.request(2,'scene-create',{name:'Mapa',kind:'map'}).ok,true);
  assert.equal(s.request(1,'scene-create',{name:'Mapa',kind:'map'}).error,'gm-only');
});
test('API 7: o ModRequest comum que imita a criação é NEGADO, até para quem tem a permissão',()=>{
  const s=session();
  const forjado={name:'x',system:'free',gm:'1',acao:'criar-campanha',admin:true,write:true,permissoes:['criar-campanha'],contexto:{acao:'criar-campanha',admin:true}};
  for(const quem of [1,2]) assert.equal(s.request(quem,'setup',forjado).error,'pede-a-acao-criar-campanha','pessoa '+quem);
  assert.equal(s.request(1,'view').campaign,null,'o pedido comum criou a mesa');
});
test('API 7: uma pessoa COMUM (não admin) que recebeu a ação cria a mesa, e o mestre e o dono das peças continuam valendo',()=>{
  const s=session();s.concessoes.set('2',['criar-campanha']);
  const criada=s.acao(2,'criar-campanha','setup',{name:'Da pessoa 2',system:'free',gm:'3'});
  assert.equal(criada.ok,true,JSON.stringify(criada));
  // As regras de sempre, DEPOIS da ação: o mestre é a pessoa 3 (e não quem criou nem o admin).
  assert.equal(s.request(2,'scene-create',{name:'Mapa',kind:'map'}).error,'gm-only','quem criou virou mestre pela ação');
  assert.equal(s.request(1,'scene-create',{name:'Mapa',kind:'map'}).error,'gm-only','o admin virou mestre');
  const cena=s.request(3,'scene-create',{name:'Mapa',kind:'map'});assert.equal(cena.ok,true);
  const ficha=s.request(3,'sheet-create',{name:'Iria',owner:'4'}).campaign.sheets[0].id;
  assert.equal(s.request(5,'rest',{sheet:ficha}).error,'not-owner','quem não é dono mexeu na ficha');
  assert.equal(s.request(4,'rest',{sheet:ficha}).ok,true,'o dono da ficha perdeu o direito');
  assert.equal(s.request(2,'sheet-remove',{id:ficha}).error,'gm-only');
});
// **O cruzamento**: a ação legítima com o corpo de OUTRA operação. A exceção ao modo só leitura (`ctx.write`) é da criação, e só
// dela: quem tem a permissão de criar a mesa não ganha, por isso, o poder de escrever numa mesa que já existe.
test('API 7: a ação «criar-campanha» com o corpo de OUTRA operação é negada — sem escrita não altera a campanha, e a exceção é só do setup',()=>{
  const s=session();s.concessoes.set('2',['criar-campanha']);
  assert.equal(s.acao(1,'criar-campanha','setup',{name:'Existente',system:'free',gm:'2'}).ok,true);
  const antes=JSON.stringify(JSON.parse(s.data['campaign-1']));
  // O GM não-admin, SEM escrita no canal, com a permissão: o modo só leitura vale para tudo o que não é criar.
  for(const [op,extra] of [['settings',{name:'Invadida',allowMove:true,allowEdit:true}],['scene-create',{name:'Cena',kind:'map'}],['sheet-create',{name:'Ficha',owner:'2'}],['initiative-clear',{}]]){
    const r=s.acao(2,'criar-campanha',op,extra,1,false);
    assert.equal(r.ok,false,'a ação «criar-campanha» alterou a campanha com a op '+op+': '+JSON.stringify(r).slice(0,120));
    assert.equal(r.error,'read-only','op '+op+' sem escrita deveria ser read-only, deu '+r.error);
  }
  // Com escrita, a ação também não serve para outra operação: ela autoriza criar a mesa, e mais nada.
  const r=s.acao(2,'criar-campanha','settings',{name:'Invadida',allowMove:true,allowEdit:true},1,true);
  assert.equal(r.ok,false);assert.equal(r.error,'acao-so-cria-a-mesa');
  assert.equal(JSON.stringify(JSON.parse(s.data['campaign-1'])),antes,'a campanha existente mudou');
  // E o setup com a ação continua passando para quem não escreve no canal (como o admin passava).
  const nova=s.acao(2,'criar-campanha','setup',{name:'Sem escrita',system:'free',gm:'2'},2,false);
  assert.equal(nova.ok,true,JSON.stringify(nova));
});
test('API 7: a revogação no servidor nega a ação na hora, mesmo para quem já abriu a janela',()=>{
  const s=session();s.concessoes.set('2',['criar-campanha']);
  assert.equal(s.acao(2,'criar-campanha','setup',{name:'a',system:'free',gm:'2'},1).ok,true);
  s.concessoes.set('2',[]);
  assert.deepEqual(s.acao(2,'criar-campanha','setup',{name:'b',system:'free',gm:'2'},2),{ok:false,recusa:'sem-permissao'});
  assert.equal(s.request(2,'view',{},2).campaign,null,'criou depois da revogação');
  assert.equal(s.request(2,'view',{},2).canSetup,false,'o canSetup (informativo) seguiu mostrando o botão');
});
test('atualizar da 4.0.0 (API 6) para a 5.0.0 mantém as campanhas, as fichas e as regras de dono e de mestre',()=>{
  const velha=path.join(__dirname,'../../../mods-oficiais-017/mesa');
  const m4=JSON.parse(fs.readFileSync(path.join(velha,'mod.json'),'utf8'));
  assert.equal(m4.api,6);assert.equal(m4.version,'4.0.0');
  const s4=session([0.5],{fonte:fs.readFileSync(path.join(velha,'servidor/main.js'),'utf8')});
  assert.equal(s4.request(1,'setup',{name:'Casa',system:'dnd5e-2014',gm:'3'}).ok,true,'a 4.0.0 criou a mesa pelo admin');
  const ficha=s4.request(3,'sheet-create',{name:'Iria',owner:'2'}).campaign.sheets[0].id;
  const antes=JSON.parse(s4.data['campaign-1']);
  // A 5.0.0 sobe sobre o MESMO quintal.
  const s5=session([0.5]);Object.assign(s5.data,JSON.parse(JSON.stringify(s4.data)));
  const visto=s5.request(3,'view');
  assert.equal(visto.ok,true);assert.equal(visto.campaign.name,'Casa');assert.equal(visto.campaign.sheets.length,1,'a ficha se perdeu');
  assert.equal(JSON.stringify(JSON.parse(s5.data['campaign-1']).sheets.map(f=>f.id)),JSON.stringify(antes.sheets.map(f=>f.id)));
  // O dono e o mestre seguem valendo; criar OUTRA mesa por cima da que existe continua recusado.
  assert.equal(s5.request(4,'rest',{sheet:ficha}).error,'not-owner');
  assert.equal(s5.request(3,'sheet-remove',{id:ficha}).ok,true);
  assert.equal(s5.acao(1,'criar-campanha','setup',{name:'Outra',system:'free',gm:'1'}).error,'already-created');
  // E o pedido comum da 4.0.0 que criava a mesa (admin, sem ação) não cria mais na 5.0.0.
  assert.equal(s5.request(1,'setup',{name:'Legado',system:'free',gm:'1'},2).error,'pede-a-acao-criar-campanha');
});
test('private sheets, prepared scenes, GM notes and hidden pieces never reach players',()=>{
  const s=session();s.setup();s.request(1,'sheet-create',{name:'Iria',owner:'2'});s.request(1,'sheet-create',{name:'Brann',owner:'3'});
  let r=s.request(1,'scene-create',{name:'Segredo',kind:'map'});const scene=r.campaign.scenes[0].id;
  s.request(1,'scene-save',{id:scene,name:'Segredo',description:'Sala',notes:'Dragão secreto',cols:20,rows:14});
  s.request(1,'token-add',{scene,name:'Emboscada',hidden:true,x:1,y:2});
  r=s.request(2,'view');assert.equal(r.campaign.scenes.length,0);assert.equal(r.campaign.sheets.length,1);assert.equal(r.campaign.sheets[0].name,'Iria');
  s.request(1,'scene-show',{id:scene});r=s.request(2,'view');assert.equal(r.campaign.scenes[0].tokens.length,0);assert.equal(r.campaign.scenes[0].notes,undefined);
  assert.ok(!JSON.stringify(r).includes('Dragão secreto'));assert.ok(!JSON.stringify(r).includes('Emboscada'));
});
test('players can only move their own visible pieces when the GM permits',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const sheet=r.campaign.sheets[0].id;
  r=s.request(1,'scene-create',{name:'Mapa',kind:'map'});const scene=r.campaign.scenes[0].id;
  r=s.request(1,'token-add',{scene,sheet,hidden:false,x:0,y:0});const id=r.campaign.scenes[0].tokens[0].id;
  s.request(1,'scene-show',{id:scene});assert.equal(s.request(3,'token-move',{scene,id,x:2,y:2}).error,'not-owner');
  assert.equal(s.request(2,'token-move',{scene,id,x:2,y:2}).ok,true);
  s.request(1,'settings',{name:'Casa',allowMove:false,allowEdit:true});assert.equal(s.request(2,'token-move',{scene,id,x:3,y:3}).error,'not-owner');
});
test('stale writes are rejected and repeated actions are idempotent',()=>{
  const s=session();s.setup();let r=s.request(1,'roll',{formula:'2d6+3',nonce:'same'});const revision=r.campaign.revision;
  r=s.request(1,'roll',{formula:'2d6+3',nonce:'same',revision:0});assert.equal(r.campaign.revision,revision);assert.equal(r.campaign.log.length,1);
  assert.equal(s.request(1,'roll',{formula:'1d20',revision:0}).error,'conflict');
  assert.equal(s.request(1,'roll',{formula:'1000000d20'}).error,'invalid-dice');
});
test('spells consume a prepared slot once, never below zero, and rest restores slots',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const char=structuredClone(r.campaign.sheets[0]);
  r=s.request(1,'entry-save',{name:'Luz própria',kind:'magia',level:1,published:true,description:'Conteúdo da campanha'});const entry=r.campaign.entries[0].id;
  char.spells=[entry];char.slots[0]={max:1,used:0};assert.equal(s.request(2,'sheet-save',{sheet:char}).ok,true);
  r=s.request(2,'cast',{sheet:char.id,entry,level:1});assert.equal(r.campaign.sheets[0].slots[0].used,1);
  assert.equal(s.request(2,'cast',{sheet:char.id,entry,level:1}).error,'no-slot');
  r=s.request(2,'rest',{sheet:char.id});assert.equal(r.campaign.sheets[0].slots[0].used,0);
});
test('images cannot be read before reveal; paths are server generated',()=>{
  const s=session();s.setup();let r=s.request(1,'scene-create',{name:'Imagem',kind:'illustration'});const scene=r.campaign.scenes[0].id;
  assert.equal(s.request(2,'imagem-comecar',{alvo:'cena',id:scene}).error,'gm-only');
  const token=s.request(1,'imagem-comecar',{alvo:'cena',id:scene}).envio.token;s.enviar(1,token,100);
  const caminho=s.request(1,'imagem-pronta',{alvo:'cena',id:scene,token}).campaign.scenes[0].asset;
  assert.match(caminho,/^channel-1\/scene-1-volume-/,'o caminho não é o que o servidor gera');
  assert.equal(s.request(2,'asset',{scene,transporte:'volume'}).error,'gm-only');s.request(1,'scene-show',{id:scene});
  assert.equal(s.request(2,'asset',{scene,transporte:'volume'}).volume,caminho);
});
test('channels are isolated and edited state survives runtime recreation',()=>{
  const s=session();s.setup();assert.equal(s.request(2,'view',{},2).campaign,null);
  s.request(1,'scene-create',{name:'Persistente',kind:'map'});assert.equal(s.request(1,'view').campaign.scenes[0].name,'Persistente');
});
test('initiative order and round transition are server owned',()=>{
  const s=session();s.setup();s.request(1,'initiative-add',{name:'Iria',value:10});let r=s.request(1,'initiative-add',{name:'Brann',value:18});
  assert.equal(r.campaign.initiative[0].name,'Brann');assert.equal(s.request(2,'initiative-next').error,'gm-only');
  s.request(1,'initiative-next');r=s.request(1,'initiative-next');assert.equal(r.campaign.round,2);assert.equal(r.campaign.turn,0);
});

test('checks derive expertise and advantage on the server, ignoring forged results',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});
  const char=r.campaign.sheets[0];char.level=5;char.abilities.dex=16;char.skillRanks={stealth:2};
  assert.equal(s.request(2,'sheet-save',{sheet:char}).ok,true);
  r=s.request(2,'check',{sheet:char.id,kind:'skill',key:'stealth',mode:'advantage',bonus:2,result:999,modifier:999});
  assert.match(r.campaign.log.at(-1).text,/Furtividade · vantagem \[2, 20\] → 20 \+ 11 = 31$/);
  r=s.request(2,'check',{sheet:char.id,kind:'skill',key:'stealth',mode:'disadvantage'});
  assert.match(r.campaign.log.at(-1).text,/desvantagem \[2, 20\] → 2 \+ 9 = 11$/);
  assert.equal(s.request(3,'check',{sheet:char.id,kind:'skill',key:'stealth',mode:'normal'}).error,'not-owner');
  assert.equal(s.request(2,'check',{sheet:char.id,kind:'skill',key:'fake',mode:'normal'}).error,'invalid-check');
  assert.equal(s.request(2,'check',{sheet:char.id,kind:'ability',key:'dex',mode:'normal',bonus:100}).error,'invalid-number');
});

test('saving throws use proficiency; locked sheets still allow owner checks',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});
  const char=r.campaign.sheets[0];char.level=5;char.abilities.wis=14;char.saveRanks={wis:1};
  s.request(2,'sheet-save',{sheet:char});s.request(1,'settings',{name:'Casa',allowEdit:false,allowMove:true});
  r=s.request(2,'check',{sheet:char.id,kind:'save',key:'wis',mode:'normal'});
  assert.match(r.campaign.log.at(-1).text,/Resistência · Sabedoria · normal \[2\] → 2 \+ 5 = 7$/);
  assert.equal(s.request(2,'vitality',{sheet:char.id,kind:'damage',amount:1}).error,'not-owner');
  assert.equal(s.request(2,'conditions',{sheet:char.id,conditions:['Caído']}).error,'not-owner');
});

test('old sheets without structured training remain usable and invalid ranks never commit',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const char=r.campaign.sheets[0];
  const before=JSON.stringify(s.data);
  assert.equal(s.request(2,'sheet-save',{sheet:{...char,skillRanks:{stealth:3}}}).error,'invalid-number');
  assert.equal(s.request(2,'sheet-save',{sheet:{...char,saveRanks:{fake:1}}}).error,'invalid-training');
  assert.equal(JSON.stringify(s.data),before);
  r=s.request(2,'check',{sheet:char.id,kind:'ability',key:'str',mode:'normal'});
  assert.match(r.campaign.log.at(-1).text,/\[2\] → 2 \+ 0 = 2$/);
});

test('damage consumes temporary HP, healing clamps and temporary HP never stacks',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const id=r.campaign.sheets[0].id;
  s.request(2,'vitality',{sheet:id,kind:'temporary',amount:5});
  r=s.request(2,'vitality',{sheet:id,kind:'temporary',amount:3});assert.equal(r.campaign.sheets[0].tempHp,5);
  r=s.request(2,'vitality',{sheet:id,kind:'damage',amount:8,nonce:'damage'});
  assert.equal(r.campaign.sheets[0].hp,7);assert.equal(r.campaign.sheets[0].tempHp,0);
  r=s.request(2,'vitality',{sheet:id,kind:'damage',amount:8,nonce:'damage'});assert.equal(r.campaign.sheets[0].hp,7);
  r=s.request(2,'vitality',{sheet:id,kind:'damage',amount:999});assert.equal(r.campaign.sheets[0].hp,0);
  r=s.request(2,'vitality',{sheet:id,kind:'heal',amount:999});assert.equal(r.campaign.sheets[0].hp,10);
  assert.equal(s.request(3,'vitality',{sheet:id,kind:'damage',amount:1}).error,'not-owner');
  assert.equal(s.request(2,'vitality',{sheet:id,kind:'heal',amount:-1}).error,'invalid-number');
  assert.equal(s.request(2,'view').campaign.log.length,0);
});

test('conditions are validated, private, preserved by sheet edits and survive reload',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const char=r.campaign.sheets[0];
  s.request(2,'conditions',{sheet:char.id,conditions:[' Efeito secreto ','Efeito secreto']});
  r=s.request(2,'sheet-save',{sheet:char});assert.deepEqual(r.campaign.sheets[0].conditions,['Efeito secreto']);
  assert.ok(!JSON.stringify(s.request(3,'view')).includes('Efeito secreto'));
  assert.equal(s.request(3,'conditions',{sheet:char.id,conditions:[]}).error,'not-owner');
  assert.equal(s.request(2,'conditions',{sheet:char.id,conditions:['x'.repeat(41)]}).error,'invalid-text');
  assert.equal(s.request(2,'conditions',{sheet:char.id,conditions:Array(13).fill('x')}).error,'invalid-conditions');
  r=s.request(2,'conditions',{sheet:char.id,conditions:[]});assert.deepEqual(r.campaign.sheets[0].conditions,[]);
});

test('late initiative entries preserve the active participant and removal advances safely',()=>{
  const s=session();s.setup();s.request(1,'initiative-add',{name:'A',value:20});
  s.request(1,'initiative-add',{name:'B',value:10});let r=s.request(1,'initiative-next');
  const active=r.campaign.currentTurn;
  r=s.request(1,'initiative-add',{name:'C',value:30});assert.equal(r.campaign.currentTurn,active);
  assert.equal(r.campaign.round,1);assert.equal(r.campaign.initiative[r.campaign.turn].name,'B');
  assert.equal(s.request(2,'initiative-remove',{id:active}).error,'gm-only');
  r=s.request(1,'initiative-remove',{id:active});assert.equal(r.campaign.round,2);assert.equal(r.campaign.initiative[r.campaign.turn].name,'C');
  const current=r.campaign.currentTurn, other=r.campaign.initiative[1].id;
  r=s.request(1,'initiative-remove',{id:other});assert.equal(r.campaign.currentTurn,current);
  r=s.request(1,'initiative-remove',{id:current});assert.equal(r.campaign.round,1);assert.equal(r.campaign.initiative.length,0);
});

test('portraits are private until GM publication, independent of sheet fields',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const char=r.campaign.sheets[0];
  const enviarRetrato=()=>{const token=s.request(2,'imagem-comecar',{alvo:'retrato',id:char.id}).envio.token;s.enviar(2,token,100);return s.request(2,'imagem-pronta',{alvo:'retrato',id:char.id,token});};
  assert.equal(s.request(3,'imagem-comecar',{alvo:'retrato',id:char.id}).error,'not-owner');
  r=enviarRetrato();assert.equal(r.ok,true,r.error);const primeiro=r.campaign.sheets[0].portrait.asset;
  assert.equal(s.request(3,'portrait-asset',{sheet:char.id,transporte:'volume'}).error,'not-owner');
  assert.equal(s.request(3,'view').campaign.players[0].portrait,null);
  assert.equal(s.request(2,'portrait-publish',{sheet:char.id,published:true}).error,'gm-only');
  // A full-sheet edit cannot forge publication or file paths.
  s.request(2,'sheet-save',{sheet:{...char,portrait:{asset:'/private/key',published:true,volume:true}}});
  assert.equal(s.request(3,'view').campaign.players[0].portrait,null);
  s.request(1,'portrait-publish',{sheet:char.id,published:true});
  r=s.request(3,'portrait-asset',{sheet:char.id,transporte:'volume'});assert.equal(r.volume,primeiro);assert.match(r.volume,/^channel-1\/portrait-sheet-/);
  s.request(1,'portrait-publish',{sheet:char.id,published:false});
  assert.equal(s.request(3,'view').campaign.players[0].portrait,null);
  assert.equal(s.request(3,'portrait-asset',{sheet:char.id,transporte:'volume'}).error,'not-owner');
  s.request(1,'portrait-publish',{sheet:char.id,published:true});
  r=enviarRetrato();
  assert.equal(s.request(3,'portrait-asset',{sheet:char.id,transporte:'volume'}).error,'not-owner','um retrato novo herdou a publicação do anterior');
  assert.equal(s.request(2,'portrait-asset',{sheet:char.id,transporte:'volume'}).volume,r.campaign.sheets[0].portrait.asset);
  s.request(2,'portrait-clear',{sheet:char.id});assert.equal(s.request(2,'portrait-asset',{sheet:char.id,transporte:'volume'}).error,'not-found');
});
test('a 3.x portrait in pages stays readable, and only by pages',()=>{
  const s=session();s.setup();const sheet=s.request(1,'sheet-create',{name:'Iria',owner:'2'}).campaign.sheets[0].id;
  semearImagemDa3(s,{alvo:'retrato',id:sheet,imagem:'data:image/png;base64,YQ=='});
  assert.equal(s.request(2,'portrait-asset',{sheet}).image,'data:image/png;base64,YQ==');
  assert.equal(s.request(2,'portrait-asset',{sheet,transporte:'volume'}).error,'asset-legado');
});
test('a second upload replaces the first one, whose token no longer counts',()=>{
  const s=session();s.setup();const sheet=s.request(1,'sheet-create',{name:'Iria',owner:'2'}).campaign.sheets[0].id;
  const a=s.request(2,'imagem-comecar',{alvo:'retrato',id:sheet}).envio.token;
  const b=s.request(2,'imagem-comecar',{alvo:'retrato',id:sheet}).envio.token;
  assert.notEqual(a,b);
  s.enviar(2,a,100);s.enviar(2,b,200);
  assert.equal(s.request(2,'imagem-pronta',{alvo:'retrato',id:sheet,token:a}).error,'envio-desconhecido');
  assert.equal(s.request(2,'imagem-pronta',{alvo:'retrato',id:sheet,token:b}).ok,true);
});
test('actions validate formulas, consume uses once, preserve privacy and recover on rest',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const char=r.campaign.sheets[0];
  const action={sheet:char.id,name:'Arco',kind:'action',description:'Nota privada',formula:'1d20+5',max:1,used:0,recharge:'long'};
  assert.equal(s.request(3,'action-save',action).error,'not-owner');
  assert.equal(s.request(2,'action-save',{...action,formula:'alert(1)'}).error,'invalid-dice');
  r=s.request(2,'action-save',action);const id=r.campaign.sheets[0].actions[0].id;
  assert.ok(!JSON.stringify(s.request(3,'view')).includes('Nota privada'));
  r=s.request(2,'action-use',{sheet:char.id,id,nonce:'use-once',formula:'100d20'});
  assert.match(r.campaign.log.at(-1).text,/Arco · ação · 1d20\+5 = 7/);
  r=s.request(2,'action-use',{sheet:char.id,id,nonce:'use-once'});assert.equal(r.campaign.sheets[0].actions[0].used,1);
  assert.equal(s.request(2,'action-use',{sheet:char.id,id}).error,'no-use');
  assert.equal(s.request(3,'action-use',{sheet:char.id,id}).error,'not-owner');
  // Saving an older shape of sheet preserves action resources.
  r=s.request(2,'sheet-save',{sheet:char});assert.equal(r.campaign.sheets[0].actions[0].used,1);
  r=s.request(2,'rest',{sheet:char.id});assert.equal(r.campaign.sheets[0].actions[0].used,0);
  r=s.request(2,'action-remove',{sheet:char.id,id});assert.deepEqual(r.campaign.sheets[0].actions,[]);
});

test('manual action resources do not recover on rest; locked sheets cannot use actions',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const sheet=r.campaign.sheets[0].id;
  r=s.request(2,'action-save',{sheet,name:'Reação',kind:'reaction',max:2,used:1,recharge:'manual'});const id=r.campaign.sheets[0].actions[0].id;
  r=s.request(2,'rest',{sheet});assert.equal(r.campaign.sheets[0].actions[0].used,1);
  s.request(1,'settings',{name:'Casa',allowEdit:false,allowMove:true});
  assert.equal(s.request(2,'action-use',{sheet,id}).error,'not-owner');
});

test('GM ambience state resumes from its position and clients cannot forge playback',()=>{
  const s=session();s.setup();assert.equal(s.request(2,'music',{command:'select',preset:'battle'}).error,'gm-only');
  assert.equal(s.request(1,'music',{command:'select',preset:'https://youtube.com/watch?v=x'}).error,'invalid-music');
  let r=s.request(1,'music',{command:'select',preset:'mystery'});assert.equal(r.campaign.music.startedAt,123);
  s.advance(12);r=s.request(1,'music',{command:'pause'});assert.equal(r.campaign.music.position,12);assert.equal(r.campaign.music.playing,false);
  s.advance(30);r=s.request(1,'music',{command:'resume'});assert.equal(r.campaign.music.startedAt,165);assert.equal(r.campaign.music.position,12);
  r=s.request(3,'view');assert.equal(r.campaign.music.preset,'mystery');assert.equal(r.serverTime,165);
  s.request(1,'music',{command:'stop'});assert.equal(s.request(3,'view').campaign.music.playing,false);
});

test('changing the ambience of the scene on the table changes what plays; other scenes wait for reveal',()=>{
  const s=session();s.setup();let r=s.request(1,'scene-create',{name:'Cripta',kind:'map'});const id=r.campaign.scenes[0].id;
  r=s.request(1,'scene-create',{name:'Depois',kind:'map'});const later=r.campaign.scenes[1].id;
  s.request(1,'scene-music',{id,preset:'mystery'});s.request(1,'scene-show',{id});
  assert.equal(s.request(3,'view').campaign.music.preset,'mystery');
  s.request(1,'scene-music',{id,preset:'battle'});
  assert.equal(s.request(3,'view').campaign.music.preset,'battle','the active scene changed its ambience and the table kept the old one');
  s.request(1,'scene-music',{id:later,preset:'exploration'});
  assert.equal(s.request(3,'view').campaign.music.preset,'battle','a scene not on the table changed what plays');
  s.request(1,'scene-music',{id,preset:'inherit'});
  assert.equal(s.request(3,'view').campaign.music.preset,'battle','inherit on the active scene changed what plays');
});
test('scene ambience stays private until reveal; inherit keeps current music and hide silences',()=>{
  const s=session();s.setup();let r=s.request(1,'scene-create',{name:'Segredo',kind:'illustration'});const id=r.campaign.scenes[0].id;
  s.request(1,'scene-music',{id,preset:'battle'});
  assert.equal(s.request(3,'view').campaign.music.preset,null);
  assert.equal(s.request(2,'scene-music',{id,preset:'mystery'}).error,'gm-only');
  s.request(1,'scene-show',{id});assert.equal(s.request(3,'view').campaign.music.preset,'battle');
  s.request(1,'scene-music',{id,preset:'inherit'});s.advance(4);
  r=s.request(1,'scene-show',{id});assert.equal(r.campaign.music.startedAt,123);
  r=s.request(1,'scene-hide',{id});assert.equal(r.campaign.music.playing,false);
});

for (const portrait of [false, true]) test(`a 3.x ${portrait ? 'portrait' : 'map'} of 10 MiB is read back in pages`, () => {
  const s = session(); s.setup();
  const initial = portrait ? s.request(1, 'sheet-create', { name: 'Iria', owner: '2' }) : s.request(1, 'scene-create', { name: 'Mapa', kind: 'map' });
  const id = portrait ? initial.campaign.sheets[0].id : initial.campaign.scenes[0].id;
  const target = portrait ? { sheet: id } : { scene: id };
  const person = portrait ? 2 : 1;
  const bytes = Buffer.alloc(10 * 1024 * 1024, 17);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  const image = 'data:image/png;base64,' + bytes.toString('base64');
  semearImagemDa3(s, { alvo: portrait ? 'retrato' : 'cena', id, imagem: image });
  const assetOp = portrait ? 'portrait-asset' : 'asset';
  let reply = s.request(person, assetOp, target), restored = reply.image;
  while (reply.proximo) {
    reply = s.request(person, assetOp, { ...target, ...reply.proximo });
    assert.equal(reply.ok, true, reply.error);
    assert.ok(reply.image.length <= 65536); restored += reply.image;
  }
  assert.equal(restored, image);
});

// ---- apagar ficha, cena e verbete ----
//
// Não havia como apagar nada, e os tetos (16 fichas, 16 cenas, 100 verbetes)
// eram para sempre num canal. Apagar tira também o que
// depende do apagado — peças, iniciativa, magias preparadas — e os arquivos
// dele no disco.
const arquivosDe=(s,prefixo)=>[...s.disk.keys()].filter(p=>p.startsWith(prefixo));
test('the GM removes a sheet with its pieces, initiative entries and portrait files',()=>{
  const s=session();s.setup();
  let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const iria=r.campaign.sheets[0].id;
  r=s.request(1,'sheet-create',{name:'Brann',owner:'3'});const brann=r.campaign.sheets[1].id;
  r=s.request(1,'scene-create',{name:'Salão',kind:'map'});const scene=r.campaign.scenes[0].id;
  s.request(1,'token-add',{scene,sheet:iria,x:0,y:0});s.request(1,'token-add',{scene,sheet:brann,x:1,y:0});
  s.request(1,'initiative-add',{sheet:iria,value:15});s.request(1,'initiative-add',{sheet:brann,value:10});
  semearImagemDa3(s,{alvo:'retrato',id:iria,imagem:'data:image/png;base64,YQ=='});
  assert.ok(arquivosDe(s,'channel-1/portrait-'+iria+'-image-').length>0,'o retrato não foi gravado');
  assert.equal(s.request(2,'sheet-remove',{id:iria}).error,'gm-only');
  r=s.request(1,'sheet-remove',{id:iria});
  assert.equal(r.ok,true,r.error);
  assert.deepEqual(r.campaign.sheets.map(f=>f.id),[brann]);
  assert.deepEqual(r.campaign.scenes[0].tokens.map(t=>t.sheet),[brann],'a peça da ficha apagada ficou na cena');
  assert.deepEqual(r.campaign.initiative.map(i=>i.sheet),[brann],'a ficha apagada ficou na iniciativa');
  assert.deepEqual(arquivosDe(s,'channel-1/portrait-'+iria+'-image-'),[],'o retrato da ficha apagada ficou no disco');
  assert.equal(s.request(1,'sheet-remove',{id:iria}).error,'not-found');
});
test('removing a sheet frees its place under the ceiling',()=>{
  const s=session();s.setup();let r;
  for(let i=0;i<16;i++)r=s.request(1,'sheet-create',{name:'Ficha '+i,owner:'2'});
  assert.equal(s.request(1,'sheet-create',{name:'A décima sétima',owner:'2'}).error,'limit');
  s.request(1,'sheet-remove',{id:r.campaign.sheets[0].id});
  assert.equal(s.request(1,'sheet-create',{name:'A décima sétima',owner:'2'}).ok,true);
});
test('removing the active sheet of the initiative keeps the turn on the right participant',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const iria=r.campaign.sheets[0].id;
  s.request(1,'initiative-add',{name:'A',value:30});s.request(1,'initiative-add',{sheet:iria,value:20});s.request(1,'initiative-add',{name:'C',value:10});
  s.request(1,'initiative-next');r=s.request(1,'initiative-next');
  assert.equal(r.campaign.initiative[r.campaign.turn].name,'C');
  r=s.request(1,'sheet-remove',{id:iria});
  assert.equal(r.campaign.initiative[r.campaign.turn].name,'C','apagar uma ficha antes da vez mudou de quem é a vez');
});
test('removing the scene on the table clears the table, silences it and deletes the map',()=>{
  const s=session();s.setup();let r=s.request(1,'scene-create',{name:'Cripta',kind:'map'});const id=r.campaign.scenes[0].id;
  r=s.request(1,'scene-create',{name:'Depois',kind:'map'});const depois=r.campaign.scenes[1].id;
  semearImagemDa3(s,{alvo:'cena',id,imagem:'data:image/png;base64,YQ=='});
  s.request(1,'scene-music',{id,preset:'battle'});s.request(1,'scene-show',{id});
  assert.ok(arquivosDe(s,'channel-1/'+id+'-image-').length>0,'o mapa não foi gravado');
  assert.equal(s.request(2,'scene-remove',{id}).error,'gm-only');
  r=s.request(1,'scene-remove',{id});
  assert.equal(r.ok,true,r.error);
  assert.deepEqual(r.campaign.scenes.map(c=>c.id),[depois]);
  assert.equal(r.campaign.active,null,'a cena apagada continuou na mesa');
  assert.equal(r.campaign.music.playing,false,'a trilha da cena apagada continuou tocando');
  assert.deepEqual(arquivosDe(s,'channel-1/'+id+'-image-'),[],'o mapa da cena apagada ficou no disco');
});
test('removing a scene that is not on the table leaves the table and the music alone',()=>{
  const s=session();s.setup();let r=s.request(1,'scene-create',{name:'Cripta',kind:'map'});const id=r.campaign.scenes[0].id;
  r=s.request(1,'scene-create',{name:'Depois',kind:'map'});const depois=r.campaign.scenes[1].id;
  s.request(1,'scene-music',{id,preset:'battle'});s.request(1,'scene-show',{id});
  r=s.request(1,'scene-remove',{id:depois});
  assert.equal(r.campaign.active,id);assert.equal(r.campaign.music.preset,'battle');
});
test('removing an entry takes it out of every prepared spell list',()=>{
  const s=session();s.setup();let r=s.request(1,'entry-save',{name:'Bola de fogo',kind:'magia',level:3,published:true});const entry=r.campaign.entries[0].id;
  r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const char=r.campaign.sheets[0];
  assert.equal(s.request(2,'sheet-save',{sheet:{...char,spells:[entry]}}).ok,true);
  assert.equal(s.request(2,'entry-remove',{id:entry}).error,'gm-only');
  r=s.request(1,'entry-remove',{id:entry});
  assert.equal(r.ok,true,r.error);
  assert.equal(r.campaign.entries.length,0);
  assert.deepEqual(r.campaign.sheets[0].spells,[],'o verbete apagado continuou preparado');
});
test('clearing a portrait deletes its files',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const sheet=r.campaign.sheets[0].id;
  semearImagemDa3(s,{alvo:'retrato',id:sheet,imagem:'data:image/png;base64,YQ=='});
  assert.ok(arquivosDe(s,'channel-1/portrait-'+sheet+'-image-').length>0);
  s.request(2,'portrait-clear',{sheet});
  assert.deepEqual(arquivosDe(s,'channel-1/portrait-'+sheet+'-image-'),[],'o retrato tirado ficou no disco');
});

// ---- a iniciativa rolada aqui ----
//
// PÔR NA INICIATIVA mandava `value: 10` para toda ficha: a ordem não
// ordenava nada. Vinda de uma ficha e sem valor, a entrada é rolada aqui —
// d20 mais o modificador de Destreza —, e o valor dado pelo mestre continua
// valendo quando ele quer dar um.
test('initiative from a sheet without a value is rolled here: d20 plus the DEX modifier',()=>{
  const s=session([0.5]);s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const iria=r.campaign.sheets[0];
  r=s.request(1,'sheet-create',{name:'Brann',owner:'3'});const brann=r.campaign.sheets[1];
  s.request(2,'sheet-save',{sheet:{...iria,abilities:{...iria.abilities,dex:16}}});
  s.request(3,'sheet-save',{sheet:{...brann,abilities:{...brann.abilities,dex:8}}});
  r=s.request(1,'initiative-add',{sheet:brann.id});
  assert.equal(r.ok,true,r.error);
  assert.equal(r.campaign.initiative[0].value,10,'d20 = 11, DES 8 = −1');
  assert.match(r.campaign.log.at(-1).text,/^Brann · iniciativa \[11\] − 1 = 10$/);
  r=s.request(1,'initiative-add',{sheet:iria.id});
  assert.deepEqual(r.campaign.initiative.map(i=>[i.name,i.value]),[['Iria',14],['Brann',10]]);
});
test('a given initiative value still wins, a hidden roll is not logged, and a nameless entry needs a value',()=>{
  const s=session([0.5]);s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const iria=r.campaign.sheets[0].id;
  r=s.request(1,'initiative-add',{sheet:iria,value:7});
  assert.equal(r.campaign.initiative[0].value,7);
  const antes=r.campaign.log.length;
  r=s.request(1,'initiative-add',{sheet:iria,hidden:true});
  assert.equal(r.campaign.log.length,antes,'a rolagem de uma entrada oculta foi para o registro público');
  assert.equal(s.request(1,'initiative-add',{name:'Goblin'}).error,'invalid-number');
});

// ---- a recusa diz o campo ----
//
// Na API 6 a recusa do servidor volta ao campo que a causou
// (`formulario.erros({ chave: motivo })`, rascunho §5). A resposta é protocolo
// deste MOD, e a forma é a que a F3 sugeriu e o ESTILO usa:
// `{ ok: false, error: '<código>', erros: { '<campo>': '<motivo>' } }`. O
// `error` continua o código de sempre; `erros` só existe numa recusa de campo,
// com a chave do campo no pedido (aninhado com ponto) e uma frase curta.
test('a sheet refusal names the field and says why',()=>{
  const s=session();s.setup();const r0=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const ficha=r0.campaign.sheets[0];
  let r=s.request(2,'sheet-save',{sheet:{...ficha,level:25}});
  assert.equal(r.error,'invalid-number');assert.deepEqual(r.erros,{level:'um número inteiro de 1 a 20'});
  r=s.request(2,'sheet-save',{sheet:{...ficha,level:'3'}});
  assert.deepEqual(r.erros,{level:'um número inteiro de 1 a 20'});
  r=s.request(2,'sheet-save',{sheet:{...ficha,hp:12,maxHp:10}});
  assert.equal(r.error,'invalid-sheet');assert.deepEqual(r.erros,{hp:'não passa do PV máximo'});
  r=s.request(2,'sheet-save',{sheet:{...ficha,name:'   '}});
  assert.deepEqual(r.erros,{name:'obrigatório'});
  r=s.request(2,'sheet-save',{sheet:{...ficha,notes:'x'.repeat(3001)}});
  assert.equal(r.error,'invalid-text');assert.deepEqual(r.erros,{notes:'até 3000 caracteres'});
  r=s.request(2,'sheet-save',{sheet:{...ficha,abilities:{...ficha.abilities,dex:31}}});
  assert.deepEqual(r.erros,{'abilities.dex':'um número inteiro de 1 a 30'});
  const slots=ficha.slots.map((v,i)=>i===2?{max:1,used:2}:v);
  r=s.request(2,'sheet-save',{sheet:{...ficha,slots}});
  assert.deepEqual(r.erros,{'slots.2.used':'um número inteiro de 0 a 1'});
});
test('campaign, action, entry and scene refusals name the field',()=>{
  const s=session();
  assert.deepEqual(s.acao(1,'criar-campanha','setup',{name:'',system:'free',gm:'1'}).erros,{name:'obrigatório'});
  assert.deepEqual(s.acao(1,'criar-campanha','setup',{name:'Casa',system:'gurps',gm:'1'}).erros,{system:'um dos sistemas oferecidos'});
  assert.deepEqual(s.acao(1,'criar-campanha','setup',{name:'Casa',system:'free',gm:'ninguém'}).erros,{gm:'uma pessoa deste servidor'});
  s.setup();const ficha=s.request(1,'sheet-create',{name:'Iria',owner:'2'}).campaign.sheets[0].id;
  assert.deepEqual(s.request(2,'action-save',{sheet:ficha,name:'Arco',kind:'action',formula:'abc',max:1,used:0,recharge:'long'}).erros,{formula:'uma fórmula como 1d20+3'});
  assert.deepEqual(s.request(2,'action-save',{sheet:ficha,name:'Arco',kind:'action',formula:'',max:100,used:0,recharge:'long'}).erros,{max:'um número inteiro de 0 a 99'});
  assert.deepEqual(s.request(1,'entry-save',{name:'Bola de fogo',kind:'magia',level:10}).erros,{level:'um número inteiro de 0 a 9'});
  let r=s.request(1,'scene-create',{name:'Salão',kind:'map'});const cena=r.campaign.scenes[0].id;
  assert.deepEqual(s.request(1,'scene-save',{id:cena,name:'Salão',description:'',notes:'',cols:61,rows:14}).erros,{cols:'um número inteiro de 4 a 60'});
  s.request(1,'token-add',{scene:cena,name:'Goblin',x:15,y:0});
  r=s.request(1,'scene-save',{id:cena,name:'Salão',description:'',notes:'',cols:10,rows:14});
  assert.equal(r.error,'grid-occupied');assert.deepEqual(r.erros,{cols:'há peça ou parede fora da grade nova'});
  assert.deepEqual(s.request(1,'roll',{formula:'2d7'}).erros,{formula:'uma fórmula como 1d20+3'});
});
test('a refusal that is not about a field carries no erros',()=>{
  const s=session();s.setup();
  const r=s.request(2,'scene-create',{name:'Salão',kind:'map'});
  assert.equal(r.error,'gm-only');assert.equal(r.erros,undefined);
});

// ---- o aviso às janelas ----
//
// Na API 6 a metade de servidor avisa as janelas do mesmo MOD de que um dado
// mudou (`mundo.avisar`, rascunho §7.3), e é isso que tira a consulta de 2 s.
// A MESA avisa o canal da campanha com a revisão nova, depois de toda escrita.
test('every write tells the channel the new revision',()=>{
  const s=session();let r=s.setup();
  assert.deepEqual(s.avisos.at(-1),{canal:1,carga:{revisao:r.campaign.revision}},'criar a mesa não avisou o canal');
  r=s.request(2,'roll',{formula:'1d20'});
  assert.equal(r.ok,true,r.error);
  assert.deepEqual(s.avisos.at(-1),{canal:1,carga:{revisao:r.campaign.revision}},'uma rolagem não avisou o canal');
  r=s.setup(2);
  assert.deepEqual(s.avisos.at(-1),{canal:2,carga:{revisao:r.campaign.revision}},'o aviso foi para o canal errado');
});
test('reads, refusals and repeated requests tell nobody',()=>{
  const s=session();s.setup();const antes=s.avisos.length;
  s.request(2,'view');
  assert.equal(s.request(2,'scene-create',{name:'Salão',kind:'map'}).error,'gm-only');
  assert.equal(s.request(1,'roll',{formula:'abc'}).error,'invalid-dice');
  assert.equal(s.avisos.length,antes,'um pedido que não escreveu avisou alguém');
  const nonce='repetido';
  s.request(1,'roll',{formula:'1d6',nonce});const depois=s.avisos.length;
  s.request(1,'roll',{formula:'1d6',nonce});
  assert.equal(s.avisos.length,depois,'repetir um pedido já aplicado avisou de novo');
});

// ---- a mesa da sala ----
//
// O palco da chamada é de uma sala de voz, e a campanha é de um canal de
// texto. O mestre amarra a mesa a uma sala; o palco pergunta, com o canal 0,
// qual é a mesa da sala em que a pessoa está — e quem diz a sala é o
// servidor, pelo `contexto.sala`, e nunca a janela (rascunho §5).
test('the GM ties the table to a voice room, and the room answers from the presence',()=>{
  const s=session();s.setup();
  assert.equal(s.request(2,'settings',{name:'Casa',allowMove:true,allowEdit:true,sala:7}).error,'gm-only');
  let r=s.request(1,'settings',{name:'Casa',allowMove:true,allowEdit:true,sala:7});
  assert.equal(r.ok,true,r.error);assert.equal(r.campaign.sala,7);
  s.entrar(2,7);
  assert.deepEqual(s.request(2,'mesa-da-sala',{},null),{ok:true,sala:7,canal:1});
  s.entrar(3,8);
  assert.deepEqual(s.request(3,'mesa-da-sala',{},null),{ok:true,sala:8,canal:null},'uma sala sem mesa respondeu um canal');
  assert.deepEqual(s.request(4,'mesa-da-sala',{sala:7},null),{ok:true,sala:null,canal:null},'a janela escolheu a sala pelo pedido');
});
test('a room holds one table, untying frees it, and moving the tie moves it',()=>{
  const s=session();s.setup();s.setup(2);
  s.request(1,'settings',{name:'Casa',allowMove:true,allowEdit:true,sala:7});
  const r=s.request(1,'settings',{name:'Outra',allowMove:true,allowEdit:true,sala:7},2);
  assert.equal(r.error,'sala-ocupada');assert.deepEqual(r.erros,{sala:'esta sala já tem a mesa de outro canal'});
  s.request(1,'settings',{name:'Casa',allowMove:true,allowEdit:true,sala:9});
  s.entrar(2,7);s.entrar(3,9);
  assert.equal(s.request(2,'mesa-da-sala',{},null).canal,null,'a sala antiga continuou com a mesa');
  assert.equal(s.request(3,'mesa-da-sala',{},null).canal,1);
  assert.equal(s.request(1,'settings',{name:'Outra',allowMove:true,allowEdit:true,sala:7},2).ok,true,'a sala liberada não aceitou outra mesa');
  s.request(1,'settings',{name:'Casa',allowMove:true,allowEdit:true,sala:null});
  assert.equal(s.request(3,'mesa-da-sala',{},null).canal,null,'desamarrar não liberou a sala');
  assert.equal(s.request(1,'settings',{name:'Casa',allowMove:true,allowEdit:false}).campaign.sala,null,'configurar sem dizer a sala mexeu na amarração');
});
test('changing the tie tells the whole server which rooms changed',()=>{
  const s=session();s.setup();
  s.request(1,'settings',{name:'Casa',allowMove:true,allowEdit:true,sala:7});
  assert.deepEqual(s.avisos.at(-1),{carga:{salas:[7]}});
  s.request(1,'settings',{name:'Casa',allowMove:true,allowEdit:true,sala:9});
  assert.deepEqual(s.avisos.at(-1),{carga:{salas:[7,9]}});
  const antes=s.avisos.length;
  s.request(1,'settings',{name:'Casa',allowMove:true,allowEdit:false,sala:9});
  assert.equal(s.avisos.filter((a,i)=>i>=antes&&a.carga.salas).length,0,'manter a mesma sala avisou o servidor');
});
test('a request without a channel only asks for the table of the room',()=>{
  const s=session();s.setup();
  assert.equal(s.request(2,'view',{},null).error,'canal-obrigatorio');
  assert.equal(s.request(1,'roll',{formula:'1d6'},null).error,'canal-obrigatorio');
});

// ---- mapas e retratos pelo volume ----
//
// Na 3.x a imagem ia em fragmentos de 7.000 caracteres: um
// mapa de 10 MiB eram ~2.000 pedidos, cada um regravando a campanha, e parava
// no primeiro dado rolado por alguém. Na 4.0.0 a metade de servidor abre a
// espera do volume (`imagem-comecar`), a janela manda os bytes por um fluxo
// próprio (`SeeleUI.enviar`), e a metade de servidor confere e aponta a cena ou
// o retrato para o arquivo (`imagem-pronta`). A leitura é pelo mesmo volume.
const MAPA = 'channel-1/scene-1';
const envioDe = (s, person, alvo, id) => {
  const r = s.request(person, 'imagem-comecar', { alvo, id });
  assert.equal(r.ok, true, r.error);
  assert.ok(r.envio && typeof r.envio.token === 'string', 'a espera não devolveu o token');
  return r.envio.token;
};
test('the GM sends a map by volume, and the scene points at it',()=>{
  const s=session();s.setup();const id=s.request(1,'scene-create',{name:'Salão',kind:'map'}).campaign.scenes[0].id;
  const token=envioDe(s,1,'cena',id);
  assert.equal(s.enviar(1,token,5000).ok,true);
  const r=s.request(1,'imagem-pronta',{alvo:'cena',id,token});
  assert.equal(r.ok,true,r.error);
  const cena=r.campaign.scenes[0];
  assert.ok(cena.asset&&cena.asset.startsWith(MAPA),'a cena não aponta para o arquivo enviado: '+cena.asset);
  assert.equal(cena.assetVolume,true);
  assert.equal(r.campaign.scenes[0].envio,undefined,'a espera ficou na campanha depois de pronta');
  assert.deepEqual(s.request(1,'asset',{scene:id,transporte:'volume'}),{ok:true,volume:cena.asset});
});
test('only the GM sends a map, and a portrait goes from whoever may edit the sheet',()=>{
  const s=session();s.setup();const id=s.request(1,'scene-create',{name:'Salão',kind:'map'}).campaign.scenes[0].id;
  assert.equal(s.request(2,'imagem-comecar',{alvo:'cena',id}).error,'gm-only');
  const ficha=s.request(1,'sheet-create',{name:'Iria',owner:'2'}).campaign.sheets[0].id;
  assert.equal(s.request(3,'imagem-comecar',{alvo:'retrato',id:ficha}).error,'not-owner');
  const token=envioDe(s,2,'retrato',ficha);
  s.enviar(2,token,800);
  const r=s.request(2,'imagem-pronta',{alvo:'retrato',id:ficha,token});
  assert.equal(r.ok,true,r.error);
  assert.equal(r.campaign.sheets[0].portrait.volume,true);
  assert.equal(r.campaign.sheets[0].portrait.published,false,'um retrato novo nasceu publicado');
  assert.equal(s.request(3,'portrait-asset',{sheet:ficha,transporte:'volume'}).error,'not-owner');
  s.request(1,'portrait-publish',{sheet:ficha,published:true});
  assert.equal(s.request(3,'portrait-asset',{sheet:ficha,transporte:'volume'}).volume,r.campaign.sheets[0].portrait.asset);
  assert.equal(s.request(3,'view').campaign.players[0].portraitVolume,true);
});
test('a pending upload never shows its token in a projection',()=>{
  const s=session();s.setup();const id=s.request(1,'scene-create',{name:'Salão',kind:'map'}).campaign.scenes[0].id;
  s.request(1,'scene-show',{id});
  const token=envioDe(s,1,'cena',id);
  const ficha=s.request(1,'sheet-create',{name:'Iria',owner:'2'}).campaign.sheets[0].id;
  const doRetrato=envioDe(s,2,'retrato',ficha);
  for(const pessoa of [1,2,3]){
    const visto=JSON.stringify(s.request(pessoa,'view'));
    assert.ok(!visto.includes(token)&&!visto.includes(doRetrato),'a projeção de '+pessoa+' mostrou um token de envio');
  }
});
test('an upload that did not arrive, an unknown token or somebody else\'s token is refused',()=>{
  const s=session();s.setup();const id=s.request(1,'scene-create',{name:'Salão',kind:'map'}).campaign.scenes[0].id;
  const token=envioDe(s,1,'cena',id);
  assert.equal(s.request(1,'imagem-pronta',{alvo:'cena',id,token}).error,'imagem-nao-chegou');
  assert.equal(s.request(1,'imagem-pronta',{alvo:'cena',id,token:'outro'}).error,'envio-desconhecido');
  const ficha=s.request(1,'sheet-create',{name:'Iria',owner:'2'}).campaign.sheets[0].id;
  const doDono=envioDe(s,2,'retrato',ficha);
  s.enviar(2,doDono,500);
  assert.equal(s.request(1,'imagem-pronta',{alvo:'retrato',id:ficha,token:doDono}).error,'envio-desconhecido','o mestre concluiu o envio de outra pessoa');
});
test('a new image replaces the old one and deletes it; one over 10 MiB is refused and deleted',()=>{
  const s=session();s.setup();const id=s.request(1,'scene-create',{name:'Salão',kind:'map'}).campaign.scenes[0].id;
  let token=envioDe(s,1,'cena',id);s.enviar(1,token,1000);
  const primeiro=s.request(1,'imagem-pronta',{alvo:'cena',id,token}).campaign.scenes[0].asset;
  token=envioDe(s,1,'cena',id);s.enviar(1,token,2000);
  const segundo=s.request(1,'imagem-pronta',{alvo:'cena',id,token}).campaign.scenes[0].asset;
  assert.notEqual(segundo,primeiro);
  assert.equal(s.volumes.has(primeiro),false,'o mapa antigo ficou no volume');
  token=envioDe(s,1,'cena',id);s.enviar(1,token,10*1024*1024+1);
  const r=s.request(1,'imagem-pronta',{alvo:'cena',id,token});
  assert.equal(r.error,'image-too-large');
  assert.equal([...s.volumes.keys()].length,1,'o arquivo grande demais ficou no volume');
  assert.equal(s.request(1,'view').campaign.scenes[0].asset,segundo,'a recusa trocou o mapa');
});
test('a scene that is not on the table cannot be read by players, by any transport',()=>{
  const s=session();s.setup();const id=s.request(1,'scene-create',{name:'Salão',kind:'map'}).campaign.scenes[0].id;
  const token=envioDe(s,1,'cena',id);s.enviar(1,token,1000);s.request(1,'imagem-pronta',{alvo:'cena',id,token});
  assert.equal(s.request(2,'asset',{scene:id,transporte:'volume'}).error,'gm-only');
  s.request(1,'scene-show',{id});
  assert.equal(s.request(2,'asset',{scene:id,transporte:'volume'}).ok,true);
});
test('the old upload by fragments is gone',()=>{
  const s=session();s.setup();const id=s.request(1,'scene-create',{name:'Salão',kind:'map'}).campaign.scenes[0].id;
  assert.equal(s.request(1,'image-part',{scene:id,total:1,index:0,part:'data:image/png;base64,YQ=='}).error,'unknown-action');
  const ficha=s.request(1,'sheet-create',{name:'Iria',owner:'1'}).campaign.sheets[0].id;
  assert.equal(s.request(1,'portrait-part',{sheet:ficha,total:1,index:0,part:'data:image/png;base64,YQ=='}).error,'unknown-action');
});
test('removing a scene or a sheet, or clearing a portrait, deletes its volume file',()=>{
  const s=session();s.setup();const id=s.request(1,'scene-create',{name:'Salão',kind:'map'}).campaign.scenes[0].id;
  let token=envioDe(s,1,'cena',id);s.enviar(1,token,1000);
  const mapa=s.request(1,'imagem-pronta',{alvo:'cena',id,token}).campaign.scenes[0].asset;
  const ficha=s.request(1,'sheet-create',{name:'Iria',owner:'2'}).campaign.sheets[0].id;
  token=envioDe(s,2,'retrato',ficha);s.enviar(2,token,500);
  const retrato=s.request(2,'imagem-pronta',{alvo:'retrato',id:ficha,token}).campaign.sheets[0].portrait.asset;
  s.request(1,'scene-remove',{id});
  assert.equal(s.volumes.has(mapa),false,'o mapa da cena apagada ficou no volume');
  s.request(2,'portrait-clear',{sheet:ficha});
  assert.equal(s.volumes.has(retrato),false,'o retrato tirado ficou no volume');
});

// ---- o orçamento do quintal ----
//
// O guarda de 190.000 caracteres media caracteres de uma campanha só, e o
// SEELE dá ao MOD inteiro 256 KiB em bytes, somadas todas as campanhas. Na
// 4.0.0 a conta é `dados.uso()` contra `dados.teto`, antes de gravar, e a
// recusa é do MOD, com o nome dela, e não o `quintal-cheio` do anfitrião.
test('a write that would take the yard past its ceiling is refused by the MOD',()=>{
  const s=session(undefined,{teto:6000});s.setup();
  const r=s.request(1,'entry-save',{name:'Longo',kind:'nota',level:0,description:'x'.repeat(2900)});
  assert.equal(r.ok,true,r.error);
  const cheio=s.request(1,'entry-save',{name:'Mais longo',kind:'nota',level:0,description:'x'.repeat(2900)});
  assert.equal(cheio.error,'campanha-cheia','a recusa foi do anfitrião, e não do MOD');
});
test('the yard is counted in bytes and across all campaigns',()=>{
  const s=session(undefined,{teto:9000});s.setup();s.setup(2);
  assert.equal(s.request(1,'entry-save',{name:'Aqui',kind:'nota',level:0,description:'x'.repeat(2500)}).ok,true);
  assert.equal(s.request(1,'entry-save',{name:'Lá',kind:'nota',level:0,description:'x'.repeat(2500)},2).ok,true);
  // A folga que sobra, medida, e um texto que cabe nela em caracteres e não em
  // bytes: cada «á» é um caractere e dois bytes. Só a conta em bytes o recusa,
  // e o mesmo tamanho em «x» passa.
  const uso=Object.entries(s.data).reduce((n,[k,v])=>n+bytes(k)+bytes(v),0);
  const n=Math.floor((9000-uso-300)*0.8);
  assert.ok(n>500&&n<=3000,'a folga do teste não serve: '+n);
  assert.equal(s.request(1,'entry-save',{name:'Acento',kind:'nota',level:0,description:'á'.repeat(n)}).error,'campanha-cheia');
  assert.equal(s.request(1,'entry-save',{name:'Sem acento',kind:'nota',level:0,description:'x'.repeat(n)}).ok,true);
});
test('without dados.uso the old 190,000-character guard still holds',()=>{
  const s=session(undefined,{semUso:true});s.setup();
  let r,i=0;
  do r=s.request(1,'entry-save',{name:'V'+i,kind:'nota',level:0,description:'x'.repeat(3000)}); while(r.ok&&++i<100);
  assert.equal(r.error,'campaign-full','sem dados.uso, a campanha passou do guarda antigo');
  assert.ok(i>50,'o guarda antigo recusou cedo demais: '+i);
});
