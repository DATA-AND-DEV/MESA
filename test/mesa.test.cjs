const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../servidor/main.js'), 'utf8');
function session() {
  const disk = new Map(), data = {};
  let serial = 0, revision = 0;
  function request(person, op, extra = {}, channel = 1) {
    // A fresh runtime per request, just like the production API 2 bridge.
    const context = { dados: structuredClone(data), mundo: { agora: () => 123 }, arquivos: { ler: p => disk.get(p) ?? null, escrever: (p,v) => (disk.set(p,v), true), apagar: p => disk.delete(p) } };
    vm.createContext(context); vm.runInContext(source, context);
    const r = JSON.parse(context.aoPedir(JSON.stringify({person:String(person),admin:person===1,write:true,channel}),JSON.stringify({op,nonce:'n-'+(++serial),revision,...extra})));
    if(r.ok) {Object.assign(data,context.dados); if(r.campaign)revision=r.campaign.revision;}
    return r;
  }
  return {request, disk, data, setup:()=>request(1,'setup',{name:'Casa',system:'dnd5e-2014',gm:'1'})};
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
