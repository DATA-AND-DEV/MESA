/* Mesa 1.0. Runs in SEELE's window, with API v2. Source, no build, no CDN. */
(() => {
  'use strict';
  if (document.getElementById('seele-mesa-launch')) return;
  const api = globalThis.SeeleMods;
  if (!api) { console.error('Mesa requires SEELE MOD API 2.'); return; }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const css = document.createElement('style'); document.head.append(css);
  // CSSOM is explicitly available to MODs; no unsafe-inline CSP exception.
  const rules = [
    `.mesa-root,.mesa-dialog,#seele-mesa-launch{--bg:var(--seele-negro-absoluto,#050403);--panel:var(--seele-negro-painel,#0A0806);--line:var(--seele-linha,#241F19);--strong:var(--seele-linha-forte,#3A322A);--ink:var(--seele-osso,#EAE3CF);--muted:var(--seele-rotulo-painel,#908574);--accent:var(--seele-laranja-nerv,#F2521F);--tint:var(--seele-laranja-fraco,#331704);--green:var(--seele-fosforo,#6BFFB6);color:var(--ink);font:13px/1.5 var(--seele-mono,'IBM Plex Mono',monospace);box-sizing:border-box;color-scheme:dark}`,
    `.mesa-root *,.mesa-dialog *{box-sizing:border-box}`,
    `#seele-mesa-launch{position:fixed;right:24px;bottom:40px;z-index:50;background:var(--bg);border:1px solid var(--accent);padding:10px 24px;color:var(--accent);cursor:pointer;border-radius:0}`,
    `.mesa-root{position:fixed;inset:32px 0 0;z-index:90;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}`,
    `.mesa-root[hidden]{display:none}`,
    `.mesa-root button,.mesa-dialog button{font:inherit;cursor:pointer;border:1px solid var(--strong);background:var(--panel);color:var(--ink);border-radius:0;padding:8px 12px;box-shadow:none;letter-spacing:0}`,
    `.mesa-root button:hover,.mesa-dialog button:hover{border-color:var(--accent);background:var(--tint)}`,
    `.mesa-root button:disabled,.mesa-dialog button:disabled{opacity:.45;cursor:wait}`,
    `.mesa-root .primary,.mesa-dialog .primary{background:var(--accent);color:var(--bg);border-color:var(--accent);font-weight:600}`,
    `.mesa-root input,.mesa-root select,.mesa-dialog input,.mesa-dialog select,.mesa-dialog textarea{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--strong);border-radius:0;padding:8px;min-width:0;max-width:100%;box-shadow:none}`,
    `.mesa-root h1,.mesa-root h2,.mesa-dialog h2{font-family:var(--seele-display,'Saira Condensed',sans-serif);font-weight:700;letter-spacing:.04em;line-height:1.1;margin:0}`,
    `.mesa-root h1{font-size:32px}.mesa-root h2,.mesa-dialog h2{font-size:24px}`,
    `.mesa-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}`,
    `.mesa-top{display:flex;gap:16px;align-items:center;padding:12px 24px;border-bottom:1px solid var(--strong);background:var(--panel);flex-wrap:wrap}`,
    `.mesa-brand{font:900 22px var(--seele-display,'Saira Condensed',sans-serif);color:var(--accent)}`,
    `.mesa-top select{max-width:240px}.mesa-spacer{flex:1}`,
    `.mesa-tabs{display:flex;gap:8px;padding:12px 24px;border-bottom:1px solid var(--line);flex-wrap:wrap}`,
    `.mesa-tabs button[aria-current=true]{color:var(--accent);background:var(--tint);border-color:var(--accent)}`,
    `.mesa-status{padding:6px 24px;border-bottom:1px solid var(--line);font-size:11px;color:var(--muted);min-height:28px}`,
    `.mesa-content{overflow:auto;min-height:0;flex:1}.mesa-pad{padding:24px}`,
    `.mesa-game{display:grid;grid-template-columns:minmax(0,1fr) 280px;min-height:100%}`,
    `.mesa-stage{min-width:0}.mesa-scenehead{display:flex;align-items:center;gap:12px;padding:16px 24px;flex-wrap:wrap;border-bottom:1px solid var(--line)}`,
    `.mesa-map{position:relative;aspect-ratio:20/14;width:min(calc(100% - 32px),calc(var(--mesa-map-ratio,1.4286) * max(280px,100vh - 440px)));background:var(--panel);isolation:isolate;touch-action:none;overflow:hidden;margin:16px auto;border:1px solid var(--strong)}`,
    `.mesa-map>img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:-1}`,
    `.mesa-grid{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}`,
    `.mesa-piece{position:absolute;transform:translate(-50%,-50%);padding:0!important;min-width:26px;min-height:26px;width:4.5%;aspect-ratio:1;border:2px solid var(--ink)!important;font-size:11px!important;font-weight:600;z-index:2;touch-action:none}`,
    `.mesa-piece[aria-pressed=true]{background:var(--accent)!important;color:var(--bg)!important;border-color:var(--accent)!important}`,
    `.mesa-piece[data-hidden=true]{border-style:dashed!important;opacity:.65}`,
    `.mesa-side{border-left:1px solid var(--line);background:var(--panel);padding:16px;display:flex;flex-direction:column;gap:16px}`,
    `.mesa-turn{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 8px;border-bottom:1px solid var(--line)}`,
    `.mesa-turn.active{border-left:2px solid var(--accent);background:var(--tint)}`,
    `.mesa-rollbar{padding:16px 24px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mesa-rollbar input{max-width:130px}`,
    `.mesa-log{border-top:1px solid var(--line);padding:10px 0;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}`,
    `.mesa-empty{padding:64px 24px;max-width:680px;margin:auto}.mesa-empty p{color:var(--muted)}`,
    `.mesa-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:24px}`,
    `.mesa-card{border:1px solid var(--line);padding:16px;background:var(--panel);overflow-wrap:anywhere}.mesa-card h2{margin:8px 0}.mesa-card p{color:var(--muted);white-space:pre-wrap}`,
    `.mesa-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}`,
    `.mesa-dialog{background:var(--bg);border:1px solid var(--accent);width:min(760px,calc(100% - 32px));max-height:calc(100% - 64px);padding:0;overflow:auto;box-shadow:none;border-radius:0}`,
    `.mesa-dialog::backdrop{background:rgba(5,4,3,.86)}`,
    `.mesa-dialog header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:var(--panel);border-bottom:1px solid var(--line)}`,
    `.mesa-form{padding:24px;display:grid;gap:16px}.mesa-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.mesa-form label{display:grid;gap:6px;color:var(--muted);font-size:11px}.mesa-form input,.mesa-form textarea,.mesa-form select{width:100%;color:var(--ink);font-size:13px}.mesa-form textarea{min-height:96px;resize:vertical}`,
    `.mesa-check{display:flex!important;align-items:center;gap:8px!important}.mesa-check input{width:auto!important}`,
    `.mesa-abilities{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.mesa-error{color:var(--seele-vermelho-alerta,#FF1A1A);white-space:pre-wrap}.mesa-slot{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:center}`,
    `.mesa-illustration{padding:24px}.mesa-illustration img{display:block;width:100%;max-height:60vh;object-fit:contain}.mesa-illustration p{white-space:pre-wrap;max-width:800px;line-height:1.8}`,
    `.mesa-footer{display:flex;gap:16px;justify-content:space-between;flex-wrap:wrap;padding:8px 24px;border-top:1px solid var(--strong);font-size:10px;color:var(--muted)}`,
    `@media(max-width:850px){.mesa-game{grid-template-columns:minmax(0,1fr)}.mesa-side{border-top:1px solid var(--line);border-left:0}.mesa-top,.mesa-tabs{padding:12px}.mesa-abilities{grid-template-columns:repeat(3,minmax(0,1fr))}}`,
    `@media(max-width:500px){.mesa-fields{grid-template-columns:1fr}.mesa-top select{max-width:160px}.mesa-form{padding:16px}.mesa-card{padding:12px}}`
  ];
  rules.forEach(rule => {
    let depth = 0, start = 0;
    for (let i = 0; i < rule.length; i++) {
      if (rule[i] === '{') depth++;
      if (rule[i] === '}' && --depth === 0) {
        css.sheet.insertRule(rule.slice(start, i + 1), css.sheet.cssRules.length);
        start = i + 1;
      }
    }
  });
  const launch = document.createElement('button'); launch.id = 'seele-mesa-launch'; launch.textContent = 'MESA'; launch.type = 'button';
  const root = document.createElement('section'); root.className = 'mesa-root'; root.hidden = true; root.setAttribute('aria-label', 'Mesa — jogo de RPG');
  const modal = document.createElement('dialog'); modal.className = 'mesa-dialog';
  document.body.append(launch, root, modal);
  let snapshot, channel, view, tab = 'game', sceneId, selected, wallMode = false, busy = false, disposed = false, poll, drag, lastSignature = '', editingRevision;
  const images = new Map(); const pendingImages = new Set();
  const errors = { 'conflict': 'A campanha mudou. Atualize e repita a alteração.', 'gm-only': 'Esta ação é do GM.', 'admin-only': 'Um administrador do servidor precisa iniciar a campanha.', 'not-owner': 'O GM não autorizou editar esta ficha ou peça.', 'timeout': 'O servidor não respondeu. Confira a conexão antes de repetir.', 'bridge-refused': 'Pedido recusado. Confira se o MOD está habilitado e se os arquivos correspondem à versão instalada.', 'no-slot': 'Não há espaço de magia disponível neste nível.', 'invalid-dice': 'Use 1d20, 2d6+3 ou outra fórmula com até 20 dados.', 'limit': 'O limite desta versão foi alcançado.', 'image-too-large': 'A imagem precisa ocupar até 256 KiB após a conversão.', 'campaign-full': 'Campanha cheia. Reduza textos ou conteúdo.', 'grid-occupied': 'A grade menor deixaria peças ou obstáculos fora do mapa.', 'read-only': 'Sua permissão no servidor é apenas de leitura.', 'not-found': 'Este conteúdo não está disponível.', 'invalid-sheet': 'Confira o nome e os pontos de vida da ficha.', 'not-prepared': 'A magia precisa estar preparada na ficha.', 'disk-failed': 'O servidor não conseguiu gravar a imagem.' };
  const message = e => errors[e?.message || e] || 'Não foi possível concluir: ' + String(e?.message || e);
  const nonce = () => 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  function status(text, error = false) { const e = root.querySelector('.mesa-status'); if (e) { e.textContent = text; e.classList.toggle('mesa-error', error); } }
  function c() { return view?.campaign; }
  function scene() { return c()?.scenes.find(s => s.id === sceneId) || c()?.scenes.find(s => s.id === c().active) || c()?.scenes[0]; }
  async function read(force = false) {
    if (disposed || busy || !channel || root.hidden) return;
    try {
      const response = await api.request('seele/mesa', channel, { op: 'view' });
      if (!response.ok) throw new Error(response.error);
      view = response;
      const signature = JSON.stringify([channel, response.me, response.campaign?.revision, response.isGM]);
      if (force || signature !== lastSignature) { lastSignature = signature; render(); }
      status('Conectado · alterações confirmadas pelo servidor');
    } catch (error) { status(message(error), true); }
  }
  async function act(op, data = {}) {
    if (busy) throw new Error('Aguarde a ação anterior.');
    busy = true; status('Salvando no servidor…');
    try {
      const response = await api.request('seele/mesa', channel, { ...data, op, revision: editingRevision ?? c()?.revision, nonce: nonce() });
      if (!response.ok) throw new Error(response.error);
      view = response; if(editingRevision !== undefined) editingRevision = c()?.revision; lastSignature = ''; render(); status('Salvo no servidor'); return response;
    } catch (error) { status(message(error), true); throw error; }
    finally { busy = false; }
  }
  const btn = (label, action, id = '', primary = false) => `<button type="button" data-action="${action}" data-id="${esc(id)}"${primary ? ' class="primary"' : ''}>${label}</button>`;
  const field = (label, name, value = '', type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const area = (label, name, value = '') => `<label>${label}<textarea name="${name}">${esc(value)}</textarea></label>`;
  const check = (label, name, checked) => `<label class="mesa-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>${label}</label>`;
  function peopleOptions(value) {
    const list = snapshot?.presentes || [];
    const result = list.map(p => `<option value="${esc(String(p.id))}" ${String(p.id) === String(value) ? 'selected' : ''}>${esc(p.nickname || p.apelido || p.id)}</option>`);
    if (value && !list.some(p => String(p.id) === String(value))) result.push(`<option selected value="${esc(value)}">Pessoa ${esc(value)} (offline)</option>`);
    return result.join('');
  }
  function dialog(title, body, submit, onSubmit) {
    const openedRevision = c()?.revision;
    modal.innerHTML = `<header><h2>${esc(title)}</h2><button type="button" data-close aria-label="Fechar">×</button></header><form class="mesa-form">${body}<div class="mesa-error" role="alert"></div><div class="mesa-actions"><button class="primary" type="submit">${esc(submit)}</button><button type="button" data-close>Fechar</button></div></form>`;
    modal.querySelectorAll('[data-close]').forEach(b => b.onclick = () => modal.close());
    modal.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const form = e.currentTarget; const submitButton = form.querySelector('[type=submit]'); submitButton.disabled = true;
      try { editingRevision = openedRevision; await onSubmit(new FormData(form), form); modal.close(); }
      catch (error) { form.querySelector('[role=alert]').textContent = message(error); }
      finally { editingRevision = undefined; submitButton.disabled = false; }
    };
    if (!modal.open) modal.showModal();
  }
  function render() {
    if (disposed) return;
    const campaign = c(), gm = view?.isGM;
    root.innerHTML = `<header class="mesa-top"><span class="mesa-brand">SEELE / MESA</span><select aria-label="Canal da campanha" id="mesa-channel">${(snapshot?.channels || []).map(ch => `<option value="${ch.id}" ${Number(ch.id) === channel ? 'selected' : ''}># ${esc(ch.name)}</option>`).join('')}</select><span class="mesa-spacer"></span><span class="mesa-label">${campaign ? (gm ? 'GM' : 'JOGADOR') + ' / ' + esc(campaign.system === 'free' ? 'LIVRE' : 'D&D 5e · 2014') : 'PREPARAÇÃO'}</span>${btn('Voltar ao SEELE', 'close')}</header><nav class="mesa-tabs">${[['game','Mesa'],['sheets','Fichas'],['entries','Compêndio'],...(gm ? [['prep','Preparação'],['settings','Campanha']] : [])].map(([id,label])=>`<button type="button" data-action="tab" data-id="${id}" aria-current="${tab===id}">${label}</button>`).join('')}</nav><div class="mesa-status" role="status">Carregando…</div><div class="mesa-content">${!campaign ? setupView() : tab === 'sheets' ? sheetsView() : tab === 'entries' ? entriesView() : tab === 'prep' && gm ? prepView() : tab === 'settings' && gm ? settingsView() : gameView()}</div><footer class="mesa-footer"><span>${esc(snapshot?.server || '')} / ${esc(campaign?.name || 'NOVA CAMPANHA')}</span><span>A voz permanece na sala do SEELE</span><span>MESA 1.0 · ${campaign ? 'REVISÃO ' + campaign.revision : 'API 2'}</span></footer>`;
    root.querySelector('#mesa-channel').onchange = async e => { channel = Number(e.target.value); sceneId = null; view = null; selected = null; render(); await read(true); };
    const board = root.querySelector('.mesa-map');
    if (board) {
      board.onpointerdown = e => { const token = e.target.closest('[data-token]'); if (token) { drag = token.dataset.token; selected = drag; token.setPointerCapture(e.pointerId); } };
      board.onpointerup = async e => {
        const s = scene(); if (!s) return;
        const rect = board.getBoundingClientRect(); const x = Math.max(0, Math.min(s.cols-1, Math.floor((e.clientX-rect.left)/rect.width*s.cols))); const y = Math.max(0, Math.min(s.rows-1, Math.floor((e.clientY-rect.top)/rect.height*s.rows)));
        const token = drag; drag = null;
        try { if (token) await act('token-move',{ scene:s.id,id:token,x,y }); else if (wallMode && gm) await act('wall',{scene:s.id,x,y}); }
        catch (error) { status(message(error),true); }
      };
      board.onpointercancel = () => { drag = null; };
    }
    const s = scene();
    if (s?.asset && !images.has(s.asset) && !pendingImages.has(s.asset)) {
      pendingImages.add(s.asset);
      api.request('seele/mesa',channel,{op:'asset',scene:s.id}).then(r=>{ if (!r.ok) throw new Error(r.error); if (!/^data:image\/(png|jpeg|webp);base64,/.test(r.image || '')) throw new Error('invalid-image'); images.set(s.asset,r.image); if(scene()?.asset===s.asset)render(); }).catch(e=>status(message(e),true)).finally(()=>pendingImages.delete(s.asset));
    }
  }
  function setupView() { return `<div class="mesa-empty"><span class="mesa-label">CAMPANHA POR CANAL</span><h1>UMA NOVA MESA.</h1><p>Defina o sistema, escolha quem conduz e prepare as fichas. Mapas e cenas ficam privados até o GM revelá-los.</p>${view?.canSetup ? btn('CRIAR CAMPANHA','setup','',true) : '<p>Um administrador do servidor precisa criar a campanha e designar o GM.</p>'}</div>`; }
  function gameView() {
    const campaign = c(), s = scene(), gm = view.isGM;
    const content = !s ? `<div class="mesa-empty"><h1>A CENA AINDA NÃO FOI REVELADA.</h1><p>${gm ? 'Prepare um mapa ou uma cena ilustrada para começar.' : 'O GM está preparando a próxima cena.'}</p>${gm ? btn('Preparar cena','tab','prep',true) : ''}</div>` : s.kind === 'illustration' ? `<div class="mesa-illustration">${images.has(s.asset) ? `<img src="${esc(images.get(s.asset))}" alt="${esc(s.name)}">` : ''}<p>${esc(s.description)}</p></div>` : boardView(s);
    return `<div class="mesa-game"><div class="mesa-stage"><div class="mesa-scenehead"><div><span class="mesa-label">${esc(campaign.name)}</span><h1>${esc(s?.name || 'MESA')}</h1></div><span class="mesa-spacer"></span>${s && gm ? `<span class="mesa-label">${s.id===campaign.active&&s.published?'VISÍVEL AOS JOGADORES':'PRÉVIA PRIVADA'}</span>${btn('Revelar','show',s.id)}${btn('Editar','scene-edit',s.id)}` : ''}</div>${content}${s&&gm&&s.kind==='map'?`<div class="mesa-rollbar">${btn('Adicionar peça','token-add',s.id)}${btn(wallMode?'Parar desenho':'Desenhar obstáculos','walls')}${selected?btn('Peça selecionada','token-edit',selected):''}<span class="mesa-label">Arraste uma peça para mover</span></div>`:''}<form class="mesa-rollbar" id="mesa-roll-form"><label for="mesa-formula" class="mesa-label">DADOS PÚBLICOS</label><input id="mesa-formula" name="formula" aria-label="Fórmula de dados" value="1d20" maxlength="24" required><button class="primary" type="submit">ROLAR</button></form></div><aside class="mesa-side"><div><span class="mesa-label">RODADA ${campaign.round}</span><h2>INICIATIVA</h2></div><div>${campaign.initiative.map(i=>`<div class="mesa-turn ${i.id===campaign.currentTurn || (gm && campaign.initiative[campaign.turn]?.id===i.id)?'active':''}"><span>${esc(i.name)}${i.hidden?' · oculto':''}</span><strong>${i.value}</strong></div>`).join('') || '<p class="mesa-label">Sem encontro ativo</p>'}</div>${gm?`<div class="mesa-actions">${btn('Adicionar','initiative-add')}${btn('Próximo turno →','next','',true)}${btn('Encerrar encontro','clear')}</div>`:''}<h2>REGISTRO DA MESA</h2><div>${campaign.log.slice(-8).reverse().map(l=>`<div class="mesa-log"><span class="mesa-label">${esc(personName(l.person))} · ${new Date(l.at*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span><div>${esc(l.text)}</div></div>`).join('') || '<p class="mesa-label">As rolagens aparecerão aqui.</p>'}</div></aside></div>`;
  }
  function personName(id) { const p = snapshot?.presentes?.find(p=>String(p.id)===id); return p?.nickname || p?.apelido || 'Pessoa '+id; }
  function boardView(s) {
    const lines = []; for(let x=1;x<s.cols;x++)lines.push(`<path d="M${x} 0V${s.rows}"/>`);for(let y=1;y<s.rows;y++)lines.push(`<path d="M0 ${y}H${s.cols}"/>`);
    return `<div class="mesa-map" role="group" aria-label="Tabuleiro ${esc(s.name)}">${images.has(s.asset)?`<img src="${esc(images.get(s.asset))}" alt="Mapa ${esc(s.name)}" draggable="false">`:''}<svg class="mesa-grid" viewBox="0 0 ${s.cols} ${s.rows}" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="var(--strong)" stroke-width=".025">${lines.join('')}</g><g fill="var(--strong)" stroke="var(--muted)" stroke-width=".04">${s.walls.map(w=>`<rect x="${w.x}" y="${w.y}" width="1" height="1"/>`).join('')}</g></svg>${s.tokens.map(t=>`<button type="button" class="mesa-piece" data-token="${t.id}" data-hidden="${t.hidden}" aria-label="${esc(t.name)}${t.hidden?', oculta':''}" aria-pressed="${selected===t.id}">${esc(t.name.slice(0,2).toUpperCase())}</button>`).join('')}</div>`;
  }
  function sheetsView() { return `<div class="mesa-pad"><h1>FICHAS</h1><p class="mesa-label">${view.isGM?'Todas as fichas da campanha':'Suas fichas · os dados completos são privados'}</p>${view.isGM?btn('Nova ficha','sheet-create','',true):''}<div class="mesa-cards">${c().sheets.map(s=>`<article class="mesa-card"><span class="mesa-label">${esc(personName(s.owner))} · NÍVEL ${s.level}</span><h2>${esc(s.name)}</h2><p>${esc(s.className || 'Classe livre')} · PV ${s.hp}/${s.maxHp} · CA ${s.ac}</p>${btn('Abrir ficha','sheet',s.id,true)}${view.isGM?btn('Responsável','sheet-owner',s.id):''}</article>`).join('') || '<p>Aguardando o GM criar e atribuir as fichas.</p>'}</div></div>`; }
  function entriesView() { return `<div class="mesa-pad"><h1>COMPÊNDIO DA CAMPANHA</h1><p class="mesa-label">Magias, habilidades, itens e regras cadastrados pelo GM</p>${view.isGM?btn('Novo conteúdo','entry-create','',true):''}<div class="mesa-cards">${c().entries.map(e=>`<article class="mesa-card"><span class="mesa-label">${esc(e.kind)} · NÍVEL ${e.level}${!e.published?' · PRIVADO':''}</span><h2>${esc(e.name)}</h2><p>${esc(e.range)} ${esc(e.cost)}</p><p>${esc(e.description)}</p>${e.formula?btn('Rolar '+esc(e.formula),'entry-roll',e.id):''}${view.isGM?btn('Editar','entry-edit',e.id):''}</article>`).join('') || '<p>O compêndio começa vazio. Cadastre conteúdo próprio ou autorizado para sua campanha.</p>'}</div></div>`; }
  function prepView() { return `<div class="mesa-pad"><h1>PREPARAÇÃO</h1><p class="mesa-label">Somente o GM vê esta área</p>${btn('Novo mapa','scene-new-map','',true)} ${btn('Nova cena ilustrada','scene-new-illustration')}<div class="mesa-cards">${c().scenes.map(s=>`<article class="mesa-card"><span class="mesa-label">${s.kind==='map'?'TABULEIRO':'ILUSTRAÇÃO'} · ${s.id===c().active?'EM EXIBIÇÃO':'PREPARADA'}</span><h2>${esc(s.name)}</h2><p>${esc(s.description.slice(0,160))}</p><div class="mesa-actions">${btn('Abrir','scene-open',s.id)}${btn('Editar','scene-edit',s.id)}${btn('Importar imagem','image',s.id)}${btn('Revelar','show',s.id,true)}${s.published?btn('Ocultar','hide',s.id):''}</div></article>`).join('')}</div></div>`; }
  function settingsView() { return `<div class="mesa-pad"><h1>${esc(c().name)}</h1><p>GM: ${esc(personName(c().gm))}</p><p>Edição das próprias fichas: ${c().allowEdit?'permitida':'restrita ao GM'}</p><p>Movimento das próprias peças: ${c().allowMove?'permitido':'restrito ao GM'}</p>${btn('Configurar campanha','settings','',true)}<p class="mesa-label">Limites v1: 16 fichas · 16 cenas · 100 entradas de compêndio · 48 peças por cena</p></div>`; }
  const baseRender = render;
  render = function() { baseRender(); const s=scene(), board=root.querySelector('.mesa-map');if(s&&board){board.style.aspectRatio=s.cols+'/'+s.rows;board.querySelectorAll('[data-token]').forEach(e=>{const t=s.tokens.find(t=>t.id===e.dataset.token);e.style.left=((t.x+.5)/s.cols*100)+'%';e.style.top=((t.y+.5)/s.rows*100)+'%';});}const form=root.querySelector('#mesa-roll-form');if(form)form.onsubmit=async e=>{e.preventDefault();try{await act('roll',{formula:new FormData(form).get('formula')});}catch{}}; };
  function openSheet(id) {
    const s=c().sheets.find(s=>s.id===id), can=view.isGM||c().allowEdit;
    const labels={str:'FOR',dex:'DES',con:'CON',int:'INT',wis:'SAB',cha:'CAR'};
    dialog(s.name, `<fieldset ${can?'':'disabled'}><div class="mesa-fields">${field('Nome','name',s.name,'text','required maxlength="60"')}${field('Classe / multiclasse','className',s.className)}${field('Ancestralidade','ancestry',s.ancestry)}${field('Antecedente','background',s.background)}${field('Nível','level',s.level,'number','min="1" max="20" required')}${field('CA','ac',s.ac,'number','min="0" max="99" required')}${field('PV atuais','hp',s.hp,'number','min="0" max="9999" required')}${field('PV máximos','maxHp',s.maxHp,'number','min="1" max="9999" required')}${field('PV temporários','tempHp',s.tempHp,'number','min="0" max="9999"')}${field('Deslocamento (m)','speed',s.speed,'number','min="0" max="999"')}</div><h2>ATRIBUTOS</h2><div class="mesa-abilities">${Object.entries(labels).map(([a,l])=>field(l,'ability-'+a,s.abilities[a],'number','min="1" max="30" required')).join('')}</div><p class="mesa-label">Proficiência +${Math.ceil(s.level/4)+1} · modificador = piso((atributo − 10) / 2)</p>${area('Perícias e proficiências','skills',s.skills)}${area('Inventário','inventory',s.inventory)}${area('Notas privadas da ficha','notes',s.notes)}<h2>MAGIAS PREPARADAS</h2>${c().entries.filter(e=>e.kind==='magia').map(e=>check(esc(e.name),'spell-'+e.id,s.spells.includes(e.id))).join('')||'<p>Cadastre magias no compêndio.</p>'}<h2>ESPAÇOS DE MAGIA</h2>${s.slots.map((v,i)=>`<div class="mesa-slot"><span>Nível ${i+1}</span>${field('Total','max-'+i,v.max,'number','min="0" max="20" required')}${field('Usados','used-'+i,v.used,'number','min="0" max="20" required')}</div>`).join('')}</fieldset><div class="mesa-actions">${Object.entries(labels).map(([a,l])=>btn('Teste '+l,'ability-roll',s.id+':'+a)).join('')}${can?btn('Descanso longo','rest',s.id):''}</div><div class="mesa-actions">${s.spells.map(id=>c().entries.find(e=>e.id===id)).filter(Boolean).map(e=>btn('Usar '+esc(e.name),'cast',s.id+':'+e.id)).join('')}</div>`,can?'Salvar ficha':'Fechar',async f=>{if(!can)return;const fresh={...s};for(const n of ['name','className','ancestry','background','skills','inventory','notes'])fresh[n]=f.get(n);for(const n of ['level','ac','hp','maxHp','tempHp','speed'])fresh[n]=Number(f.get(n));fresh.abilities=Object.fromEntries(Object.keys(labels).map(a=>[a,Number(f.get('ability-'+a))]));fresh.spells=c().entries.filter(e=>f.has('spell-'+e.id)).map(e=>e.id);fresh.slots=s.slots.map((v,i)=>({max:Number(f.get('max-'+i)),used:Number(f.get('used-'+i))}));await act('sheet-save',{sheet:fresh});});
  }
  async function handle(action,id) {
    const campaign=c(), gm=view?.isGM, s=scene();
    if(action==='close'){root.hidden=true;modal.close();return;}
    if(action==='tab'){tab=id;render();return;}
    if(action==='setup'){dialog('CRIAR CAMPANHA',field('Nome da campanha','name','','text','required maxlength="80"')+`<label>Sistema<select name="system"><option value="dnd5e-2014">D&D 5e · regras de 2014</option><option value="free">Sistema livre</option></select></label><label>GM<select name="gm">${peopleOptions(String(snapshot.me))}</select></label>`,'Criar',f=>act('setup',Object.fromEntries(f)));return;}
    if(action==='settings'){dialog('CAMPANHA',field('Nome','name',campaign.name,'text','required maxlength="80"')+`<label>GM<select name="gm">${peopleOptions(campaign.gm)}</select></label>`+check('Jogadores podem editar suas fichas','allowEdit',campaign.allowEdit)+check('Jogadores podem mover suas peças','allowMove',campaign.allowMove),'Salvar',f=>act('settings',{name:f.get('name'),gm:f.get('gm'),allowEdit:f.has('allowEdit'),allowMove:f.has('allowMove')}));return;}
    if(action==='sheet-create'){dialog('NOVA FICHA',field('Personagem','name','','text','required maxlength="60"')+`<label>Jogador<select name="owner">${peopleOptions(String(snapshot.me))}</select></label>`,'Criar',f=>act('sheet-create',Object.fromEntries(f)));return;}
    if(action==='sheet'){openSheet(id);return;}
    if(action==='sheet-owner'){const char=campaign.sheets.find(v=>v.id===id);dialog('ATRIBUIR FICHA',`<label>Jogador<select name="owner">${peopleOptions(char.owner)}</select></label>`,'Atribuir',f=>act('sheet-owner',{id,owner:f.get('owner')}));return;}
    if(action.startsWith('scene-new-')){const kind=action.slice(10);dialog(kind==='map'?'NOVO MAPA':'NOVA CENA ILUSTRADA',field('Nome','name','','text','required maxlength="80"'),'Criar',f=>act('scene-create',{kind,name:f.get('name')}));return;}
    if(action==='scene-open'){sceneId=id;selected=null;tab='game';render();return;}
    if(action==='scene-edit'){const sc=campaign.scenes.find(v=>v.id===id);dialog('PREPARAR CENA',field('Nome','name',sc.name,'text','required maxlength="80"')+area('Descrição visível aos jogadores','description',sc.description)+area('Notas privadas do GM','notes',sc.notes)+`<div class="mesa-fields">${field('Colunas','cols',sc.cols,'number','min="4" max="60" required')}${field('Linhas','rows',sc.rows,'number','min="4" max="60" required')}</div>`,'Salvar',f=>act('scene-save',{id,name:f.get('name'),description:f.get('description'),notes:f.get('notes'),cols:Number(f.get('cols')),rows:Number(f.get('rows'))}));return;}
    if(action==='show'||action==='hide'){await act(action==='show'?'scene-show':'scene-hide',{id});if(action==='show'){sceneId=id;tab='game';render();}return;}
    if(action==='walls'){wallMode=!wallMode;render();return;}
    if(action==='token-add'){dialog('ADICIONAR PEÇA',`<label>Ficha<select name="sheet"><option value="">Criatura / peça livre</option>${campaign.players.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>`+field('Nome da peça livre','name','Criatura','text','maxlength="60"')+check('Oculta aos jogadores','hidden',true),'Adicionar',f=>act('token-add',{scene:id,sheet:f.get('sheet'),name:f.get('name'),hidden:f.has('hidden'),x:0,y:0}));return;}
    if(action==='token-edit'){const t=s.tokens.find(v=>v.id===id);if(!t)return;dialog(t.name,check('Oculta aos jogadores','hidden',t.hidden)+`<div class="mesa-fields">${field('Coluna (0 a '+(s.cols-1)+')','x',t.x,'number',`min="0" max="${s.cols-1}" required`)}${field('Linha (0 a '+(s.rows-1)+')','y',t.y,'number',`min="0" max="${s.rows-1}" required`)}</div>`,'Salvar',async f=>{await act('token-move',{scene:s.id,id,x:Number(f.get('x')),y:Number(f.get('y'))});await act('token-hide',{scene:s.id,id,hidden:f.has('hidden')});});return;}
    if(action==='initiative-add'){dialog('INICIATIVA',field('Participante','name','','text','required maxlength="60"')+field('Resultado','value',10,'number','min="-20" max="99" required')+check('Oculto aos jogadores','hidden',false),'Adicionar',f=>act('initiative-add',{name:f.get('name'),value:Number(f.get('value')),hidden:f.has('hidden')}));return;}
    if(action==='next'){await act('initiative-next');return;}
    if(action==='clear'){dialog('ENCERRAR ENCONTRO','<p>A ordem de iniciativa será limpa. As fichas e cenas serão preservadas.</p>','Encerrar',()=>act('initiative-clear'));return;}
    if(action==='entry-create'||action==='entry-edit'){const entry=campaign.entries.find(e=>e.id===id)||{name:'',kind:'magia',level:0,range:'',cost:'',description:'',formula:'',published:false};dialog('CONTEÚDO DA CAMPANHA',field('Nome','name',entry.name,'text','required maxlength="100"')+`<label>Tipo<select name="kind">${['magia','habilidade','item','regra','condição'].map(v=>`<option ${v===entry.kind?'selected':''}>${v}</option>`).join('')}</select></label>`+field('Nível (0 = truque)','level',entry.level,'number','min="0" max="9" required')+field('Alcance','range',entry.range)+field('Custo / componentes','cost',entry.cost)+field('Fórmula de dados opcional','formula',entry.formula)+area('Descrição — conteúdo próprio ou autorizado','description',entry.description)+check('Publicar para os jogadores','published',entry.published),'Salvar',f=>act('entry-save',{...Object.fromEntries(f),id:entry.id,level:Number(f.get('level')),published:f.has('published')}));return;}
    if(action==='entry-roll'){const e=campaign.entries.find(e=>e.id===id);await act('roll',{formula:e.formula,label:e.name});return;}
    if(action==='ability-roll'){const [sid,a]=id.split(':'),char=campaign.sheets.find(v=>v.id===sid);const mod=Math.floor((char.abilities[a]-10)/2);await act('roll',{formula:'1d20'+(mod>=0?'+':'')+mod,label:char.name+' · '+a.toUpperCase()});return;}
    if(action==='rest'){dialog('DESCANSO LONGO','<p>Recupera os PV e os espaços de magia desta ficha. Outros recursos são anotados manualmente.</p>','Confirmar descanso',()=>act('rest',{sheet:id}));return;}
    if(action==='cast'){const [sheet,entry]=id.split(':'),e=campaign.entries.find(v=>v.id===entry);dialog(e.name,`<p>${esc(e.description)}</p>`+field('Nível do espaço (0 = truque)','level',e.level,'number',`min="${e.level}" max="9" required`),'Usar e registrar',f=>act('cast',{sheet,entry,level:Number(f.get('level'))}));return;}
    if(action==='image'){dialog('IMPORTAR MAPA / ILUSTRAÇÃO',`<label>Imagem PNG, JPEG ou WebP<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label><p>A imagem será ajustada a até 1600 px e comprimida para até 256 KiB. A grade cobre a imagem inteira.</p>`,'Importar',async f=>{const data=await imageData(f.get('image'));const parts=data.match(/.{1,6000}/g);for(let i=0;i<parts.length;i++){await act('image-part',{scene:id,index:i,total:parts.length,part:parts[i]});status(`Enviando imagem · ${i+1}/${parts.length}`);}});return;}
  }
  async function imageData(file) {
    if (!file || file.size>20*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Escolha uma imagem de até 20 MiB.');
    const original=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Falha na leitura da imagem.'));reader.readAsDataURL(file);});
    const image=new Image();image.src=original;await image.decode();
    const canvas=document.createElement('canvas');const ratio=Math.min(1,1600/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [.85,.7,.5,.3]){const result=canvas.toDataURL('image/jpeg',quality);if(result.length<=262144)return result;}
    throw new Error('image-too-large');
  }
  function clicks(e) {const b=e.target.closest('[data-action]');if(b)handle(b.dataset.action,b.dataset.id).catch(error=>status(message(error),true));}
  root.addEventListener('click',clicks);modal.addEventListener('click',clicks);
  launch.onclick=async()=>{root.hidden=false;try{snapshot=await api.snapshot();channel=channel||snapshot.open_channel||snapshot.channels?.[0]?.id;if(!channel){root.innerHTML='<div class="mesa-empty"><h1>CRIE UM CANAL NO SEELE PARA ABRIR A MESA.</h1><button data-action="close">Voltar</button></div>';return;}channel=Number(channel);render();await read(true);}catch(e){root.innerHTML=`<div class="mesa-empty"><h1>MESA INDISPONÍVEL</h1><p>${esc(message(e))}</p><button data-action="close">Voltar</button></div>`;}};
  poll=setInterval(()=>read(),2000);
  const dispose=e=>{if(e.detail!=='seele/mesa')return;disposed=true;clearInterval(poll);modal.close();root.remove();modal.remove();launch.remove();css.remove();globalThis.removeEventListener('seele-mod-unload',dispose);};
  globalThis.addEventListener('seele-mod-unload',dispose);
})();
