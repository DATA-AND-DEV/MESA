// Local UI development harness. Uses the actual MOD engine and client, not a mock UI.
// Production transport is QUIC/QuickJS; this loopback harness uses HTTP/Node VM.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
// A casca vive no repositório do SEELE, que é outro. Declare onde ele está.
const CASCA_DO_SEELE = process.env.SEELE_UI
  || path.resolve(root, '..', 'SEELE', 'apps', 'seele-app', 'ui');
const data = {}, files = new Map();
const users = [{id:1,nickname:'Alexandre / GM'},{id:2,nickname:'Lia'},{id:3,nickname:'Rafa'}];
const page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/ui/tokens.css"><link rel="stylesheet" href="/ui/fontes.css"><title>Mesa — laboratório local</title></head><body style="background:#050403;color:#EAE3CF;font:13px monospace"><label>Laboratório local · usuário <select id="identity"><option value="1">Alexandre / GM</option><option value="2">Lia</option><option value="3">Rafa</option></select></label><p>Estado temporário desta execução. Abra MESA para criar a campanha. O app SEELE usa o servidor real.</p><script src="/bridge.js"></script><script src="/client.js"></script></body></html>`;
const bridge = `globalThis.SeeleMods={snapshot:async()=>({server:'CASA · LABORATÓRIO',me:Number(document.getElementById('identity').value),presentes:${JSON.stringify(users)},channels:[{id:1,name:'campanha'},{id:2,name:'outra-mesa'}]}),request:async(id,channel,body)=>{const response=await fetch('/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({person:document.getElementById('identity').value,channel,body})});return response.json();}};`;
const server = http.createServer(async (req,res)=>{
  try {
    const url = new URL(req.url, 'http://localhost');
    if(req.method==='POST'&&url.pathname==='/request'){
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384){res.writeHead(413);res.end();return;}}
      const r=JSON.parse(raw);if(!['1','2','3'].includes(String(r.person)))throw new Error('identity');
      const ctx={dados:structuredClone(data),mundo:{agora:()=>Math.floor(Date.now()/1000)},arquivos:{ler:p=>files.get(p)??null,escrever:(p,v)=>(files.set(p,v),true),apagar:p=>files.delete(p)}};
      vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'servidor/main.js'),'utf8'),ctx,{timeout:1000});
      ctx.contextJSON=JSON.stringify({person:String(r.person),channel:r.channel,admin:String(r.person)==='1',write:true});ctx.requestJSON=JSON.stringify(r.body);
      const reply=vm.runInContext('aoPedir(contextJSON,requestJSON)',ctx,{timeout:1000});
      if(Buffer.byteLength(JSON.stringify(ctx.dados))>256*1024)throw new Error('state quota');
      Object.assign(data,ctx.dados);res.writeHead(200,{'Content-Type':'application/json'});res.end(reply);return;
    }
    if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'"});res.end(page.replace(/ style="[^"]*"/g,'').replace('</head>','<link rel="stylesheet" href="/lab.css"></head>'));return;}
    if(url.pathname==='/lab.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end('body{background:#050403;color:#EAE3CF;font:13px monospace}');return;}
    if(url.pathname==='/bridge.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(bridge);return;}
    if(url.pathname==='/client.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(fs.readFileSync(path.join(root,'cliente/main.js')));return;}
    if(url.pathname.startsWith('/ui/')&&!url.pathname.includes('..')){
      const relative=url.pathname.slice(4);if(!['tokens.css','fontes.css'].includes(relative)&&!/^fontes\/[a-z0-9-]+\.woff2$/.test(relative))throw new Error('path');
      res.writeHead(200,{'Content-Type':relative.endsWith('.css')?'text/css':'font/woff2'});res.end(fs.readFileSync(path.join(CASCA_DO_SEELE,relative)));return;
    }
    res.writeHead(404);res.end();
  }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:error.message}));}
});
server.listen(Number(process.env.MESA_PORT||4318),'127.0.0.1',()=>console.log('Mesa preview: http://127.0.0.1:'+server.address().port));
