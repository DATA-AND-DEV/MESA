(() => {
  let revision=0, nonce=0;
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  function request(person,op,extra={}) {
    const response=JSON.parse(aoPedir(JSON.stringify({person:String(person),channel:1,admin:person===1,write:true}),JSON.stringify({op,nonce:'q-'+(++nonce),revision,...extra})));
    if(response.campaign)revision=response.campaign.revision;
    return response;
  }
  assert(request(1,'setup',{name:'QuickJS',system:'dnd5e-2014',gm:'1'}).ok,'setup');
  let r=request(1,'sheet-create',{name:'Iria',owner:'2'});const sheet=r.campaign.sheets[0].id;
  // Near the portrait ceiling, under the native 8 MiB runtime budget.
  const image='data:image/png;base64,'+'YQ=='.repeat(15000),parts=image.match(/.{1,6000}/g);
  parts.forEach((part,index)=>assert(request(2,'portrait-part',{sheet,part,index,total:parts.length,upload:'native-image'}).ok,'portrait upload'));
  assert(request(3,'portrait-asset',{sheet}).error==='not-owner','private portrait');
  assert(request(1,'portrait-publish',{sheet,published:true}).ok,'publish');
  assert(request(3,'portrait-asset',{sheet}).image===image,'public portrait');
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
  return 'QuickJS 0.12.2 / 8 MiB: portraits, private access, actions, resources and scene music passed.';
})();
