const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../servidor/main.js'), 'utf8');
function session(random = [0.05, 0.95]) {
  const disk = new Map(), data = {};
  let serial = 0, revision = 0, time = 123;
  function request(person, op, extra = {}, channel = 1) {
    // A fresh runtime per request, just like the production API 2 bridge.
    const context = { dados: structuredClone(data), mundo: { agora: () => time }, arquivos: { ler: p => disk.get(p) ?? null, escrever: (p,v) => (disk.set(p,v), true), apagar: p => disk.delete(p), listar:()=>[...disk.keys()] } };
    let draw = 0; context.Math = Object.create(Math); context.Math.random = () => random[draw++ % random.length];
    vm.createContext(context); vm.runInContext(source, context);
    const r = JSON.parse(context.aoPedir(JSON.stringify({person:String(person),admin:person===1,write:true,channel}),JSON.stringify({op,nonce:'n-'+(++serial),revision,...extra})));
    if(r.ok) {Object.assign(data,context.dados); if(r.campaign)revision=r.campaign.revision;}
    return r;
  }
  return {request, disk, data, advance:seconds=>time+=seconds, setup:()=>request(1,'setup',{name:'Casa',system:'dnd5e-2014',gm:'1'})};
}
test('only the server administrator creates a campaign; GM may be delegated',()=>{
  const s=session();assert.equal(s.request(2,'setup',{name:'x',system:'free',gm:'2'}).error,'admin-only');
  assert.equal(s.request(1,'setup',{name:'x',system:'free',gm:'2'}).isGM,false);
  assert.equal(s.request(2,'scene-create',{name:'Mapa',kind:'map'}).ok,true);
  assert.equal(s.request(1,'scene-create',{name:'Mapa',kind:'map'}).error,'gm-only');
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
  assert.equal(s.request(2,'image-part',{scene,total:1,index:0,part:'data:image/png;base64,YQ=='}).error,'gm-only');
  assert.equal(s.request(1,'image-part',{scene,total:1,index:0,part:'data:image/png;base64,YQ=='}).ok,true);
  assert.equal(s.request(2,'asset',{scene}).error,'gm-only');s.request(1,'scene-show',{id:scene});assert.equal(s.request(2,'asset',{scene}).image,'data:image/png;base64,YQ==');
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
  const upload={sheet:char.id,total:1,index:0,part:'data:image/png;base64,YQ=='};
  assert.equal(s.request(3,'portrait-part',upload).error,'not-owner');
  assert.equal(s.request(2,'portrait-part',upload).ok,true);
  assert.equal(s.request(3,'portrait-asset',{sheet:char.id}).error,'not-owner');
  assert.equal(s.request(3,'view').campaign.players[0].portrait,null);
  assert.equal(s.request(2,'portrait-publish',{sheet:char.id,published:true}).error,'gm-only');
  // A full-sheet edit cannot forge publication or file paths.
  s.request(2,'sheet-save',{sheet:{...char,portrait:{asset:'/private/key',published:true}}});
  assert.equal(s.request(3,'view').campaign.players[0].portrait,null);
  s.request(1,'portrait-publish',{sheet:char.id,published:true});
  r=s.request(3,'portrait-asset',{sheet:char.id});assert.equal(r.image,upload.part);assert.match(r.asset,/^channel-1\/portrait-sheet-/);
  s.request(1,'portrait-publish',{sheet:char.id,published:false});
  assert.equal(s.request(3,'view').campaign.players[0].portrait,null);
  assert.equal(s.request(3,'portrait-asset',{sheet:char.id}).error,'not-owner');
  s.request(1,'portrait-publish',{sheet:char.id,published:true});
  s.request(2,'portrait-part',{...upload,part:'data:image/png;base64,Yg=='});
  assert.equal(s.request(3,'portrait-asset',{sheet:char.id}).error,'not-owner');
  assert.equal(s.request(2,'portrait-asset',{sheet:char.id}).image,'data:image/png;base64,Yg==');
  s.request(2,'portrait-clear',{sheet:char.id});assert.equal(s.request(2,'portrait-asset',{sheet:char.id}).error,'not-found');
});

test('portrait chunks persist across runtimes and reject invalid order',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const sheet=r.campaign.sheets[0].id;
  assert.equal(s.request(2,'portrait-part',{sheet,index:1,total:2,part:'YQ=='}).error,'upload-order');
  s.request(2,'portrait-part',{sheet,index:0,total:2,part:'data:image/png;base64,'});
  r=s.request(2,'portrait-part',{sheet,index:1,total:2,part:'YQ=='});assert.equal(r.ok,true);assert.equal(r.campaign.sheets[0].portrait.upload,undefined);
  assert.equal(s.request(2,'portrait-asset',{sheet}).image,'data:image/png;base64,YQ==');
  assert.equal(s.request(2,'portrait-part',{sheet,index:0,total:2500,part:'data:image/png;base64,'}).error,'invalid-number');
  assert.equal(s.request(2,'portrait-asset',{sheet}).image,'data:image/png;base64,YQ==');
});

test('parallel portrait uploads cannot append chunks to another upload',()=>{
  const s=session();s.setup();let r=s.request(1,'sheet-create',{name:'Iria',owner:'2'});const sheet=r.campaign.sheets[0].id;
  s.request(2,'portrait-part',{sheet,upload:'upload-a',index:0,total:2,part:'data:image/png;base64,'});
  s.request(2,'portrait-part',{sheet,upload:'upload-b',index:0,total:2,part:'data:image/png;base64,'});
  assert.equal(s.request(2,'portrait-part',{sheet,upload:'upload-a',index:1,total:2,part:'YQ=='}).error,'upload-order');
  assert.equal(s.request(1,'portrait-part',{sheet,upload:'upload-b',index:1,total:2,part:'YQ=='}).error,'upload-order');
  assert.equal(s.request(2,'portrait-part',{sheet,upload:'upload-b',index:1,total:2,part:'Yg=='}).ok,true);
  assert.equal(s.request(2,'portrait-asset',{sheet}).image,'data:image/png;base64,Yg==');
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

for (const portrait of [false, true]) test(`image upload: ${portrait ? 'portrait' : 'map'} accepts 10 MiB with paged reads`, () => {
  const s = session(); s.setup();
  const initial = portrait ? s.request(1, 'sheet-create', { name: 'Iria', owner: '2' }) : s.request(1, 'scene-create', { name: 'Mapa', kind: 'map' });
  const target = portrait ? { sheet: initial.campaign.sheets[0].id } : { scene: initial.campaign.scenes[0].id };
  const person = portrait ? 2 : 1, op = portrait ? 'portrait-part' : 'image-part';
  const bytes = Buffer.alloc(10 * 1024 * 1024, 17);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  const image = 'data:image/png;base64,' + bytes.toString('base64'), total = Math.ceil(image.length / 7000);
  for (let index = 0; index < total; index++) {
    const reply = s.request(person, op, { ...target, upload: 'big', index, total, part: image.slice(index * 7000, (index + 1) * 7000) });
    assert.equal(reply.ok, true, reply.error);
  }
  const assetOp = portrait ? 'portrait-asset' : 'asset';
  let reply = s.request(person, assetOp, target), restored = reply.image;
  while (reply.proximo) {
    reply = s.request(person, assetOp, { ...target, ...reply.proximo });
    assert.equal(reply.ok, true, reply.error);
    assert.ok(reply.image.length <= 65536); restored += reply.image;
  }
  assert.equal(restored, image);
  assert.ok([...s.disk.values()].every(value => value.length < 4 * 1024 * 1024));
});
