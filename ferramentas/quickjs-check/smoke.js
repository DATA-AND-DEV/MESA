(() => {
  let revision=0, nonce=0;
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  function request(person,op,extra={}) {
    const response=JSON.parse(aoPedir(JSON.stringify({person:String(person),channel:1,admin:person===1,write:true}),JSON.stringify({op,nonce:'q-'+(++nonce),revision,...extra})));
    if(response.campaign)revision=response.campaign.revision;
    return response;
  }
  assert(request(1,'setup',{name:'QuickJS',system:'dnd5e-2014',gm:'1'}).ok,'setup');
  assert(__avisos.some(a=>a.canal===1&&a.carga.revisao===1),'the write announced its revision');
  let r=request(1,'sheet-create',{name:'Iria',owner:'2'});const sheet=r.campaign.sheets[0].id;
  // The portrait goes through the volume (ADR 0048): the server opens the
  // wait, the window sends the bytes with the token, and the server checks
  // the size and points the portrait at the file.
  r=request(2,'imagem-comecar',{alvo:'retrato',id:sheet});assert(r.ok&&r.envio.token,'upload opened: '+r.error);
  const token=r.envio.token;
  assert(request(2,'imagem-pronta',{alvo:'retrato',id:sheet,token}).error==='imagem-nao-chegou','no bytes, no portrait');
  __chegou(token,300000);
  assert(request(2,'imagem-pronta',{alvo:'retrato',id:sheet,token}).ok,'portrait upload');
  assert(request(3,'portrait-asset',{sheet,transporte:'volume'}).error==='not-owner','private portrait');
  assert(request(1,'portrait-publish',{sheet,published:true}).ok,'publish');
  const lido=request(3,'portrait-asset',{sheet,transporte:'volume'});
  assert(lido.ok&&typeof lido.volume==='string'&&__volumes[lido.volume]===300000,'public portrait by volume');
  r=request(2,'action-save',{sheet,name:'Arco',kind:'action',formula:'1d20+5',max:1,used:0,recharge:'long'});
  assert(r.ok,'action-save');const id=r.campaign.sheets[0].actions[0].id;
  assert(request(2,'action-use',{sheet,id}).ok,'action-use');
  assert(request(2,'action-use',{sheet,id}).error==='no-use','uses limit');
  assert(request(2,'rest',{sheet}).campaign.sheets[0].actions[0].used===0,'rest');
  assert(request(1,'music',{command:'select',preset:'mystery'}).ok,'music');
  assert(request(2,'music',{command:'pause'}).error==='gm-only','GM authority');
  r=request(1,'scene-create',{name:'Cena',kind:'illustration'});const scene=r.campaign.scenes[0].id;
  assert(request(1,'scene-music',{id:scene,preset:'battle'}).ok,'scene soundtrack');
  assert(request(1,'scene-show',{id:scene}).campaign.music.preset==='battle','reveal');
  assert(request(1,'scene-music',{id:scene,preset:'mystery'}).campaign.music.preset==='mystery','active scene soundtrack');
  r=request(1,'initiative-add',{sheet});assert(r.ok&&Number.isInteger(r.campaign.initiative[0].value),'initiative rolled here');
  const portrait=JSON.parse(dados['campaign-1']).sheets[0].portrait.asset;
  r=request(1,'sheet-remove',{id:sheet});assert(r.ok&&r.campaign.sheets.length===0&&r.campaign.initiative.length===0,'sheet removed with its initiative');
  assert(!(portrait in __volumes),'the portrait left the volume with the sheet');
  assert(request(1,'scene-remove',{id:scene}).campaign.active===null,'scene removed from the table');
  r=request(1,'settings',{name:'QuickJS',allowMove:true,allowEdit:true,sala:7});assert(r.ok&&r.campaign.sala===7,'room tie');
  assert(__avisos.some(a=>a.canal===undefined&&a.carga.salas&&a.carga.salas.includes(7)),'the room tie was announced');
  const mesa=JSON.parse(aoPedir(JSON.stringify({person:'2',channel:null,admin:false,write:true,sala:7}),JSON.stringify({op:'mesa-da-sala'})));
  assert(mesa.ok&&mesa.canal===1,'table of the room');
  return 'QuickJS 0.12.2 / 8 MiB: portraits by volume, private access, actions, resources and scene music, removals, the initiative roll, the room tie and the notices passed.';
})();
