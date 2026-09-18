/* Mesa 1.2. Runs in SEELE's window, with API v2. Source, no build, no CDN. */
(() => {
  'use strict';
  if (document.getElementById('seele-mesa-launch')) return;
  const api = globalThis.SeeleMods;
  if (!api) { console.error('Mesa requires SEELE MOD API 2.'); return; }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // An empty <style> is still blocked by SEELE's style-src. Use CSSOM sheets,
  // with a scoped-rule fallback for WebViews without adoptedStyleSheets.
  let css, releaseStyles;
  const insertedRules=[];
  try {
    css=new CSSStyleSheet();document.adoptedStyleSheets=[...document.adoptedStyleSheets,css];
    releaseStyles=()=>{document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==css);};
  } catch {
    css=Array.from(document.styleSheets).find(s=>{try{return Boolean(s.cssRules);}catch{return false;}});
    if(!css){console.error('Mesa: nenhuma folha CSSOM disponível.');return;}
    releaseStyles=()=>{for(const rule of insertedRules){const index=Array.from(css.cssRules).indexOf(rule);if(index>=0)css.deleteRule(index);}};
  }
  const rules = [
    `.mesa-root,.mesa-dialog,#seele-mesa-launch{--bg:var(--seele-negro-absoluto,#050403);--panel:var(--seele-negro-painel,#0A0806);--line:var(--seele-linha,#241F19);--strong:var(--seele-linha-forte,#3A322A);--ink:var(--seele-osso,#EAE3CF);--muted:var(--seele-rotulo-painel,#908574);--accent:var(--seele-laranja-nerv,#F2521F);--tint:var(--seele-laranja-fraco,#331704);--green:var(--seele-fosforo,#6BFFB6);color:var(--ink);font:13px/1.5 var(--seele-mono,'IBM Plex Mono',monospace);box-sizing:border-box;color-scheme:dark}`,
    `.mesa-root *,.mesa-dialog *{box-sizing:border-box}`,
    `.mesa-launcher{margin:16px 12px 12px;padding-top:12px;border-top:1px solid var(--seele-linha,#241F19);flex-shrink:0}`,
    `.mesa-launcher-heading{margin:0 0 8px;font:500 10px/1.5 var(--seele-mono,'IBM Plex Mono',monospace);letter-spacing:.13em;color:var(--seele-rotulo-painel,#908574)}`,
    `#seele-mesa-launch{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;background:transparent;border:1px solid transparent;border-left:2px solid var(--accent);padding:8px 10px;color:var(--ink);cursor:pointer;border-radius:0;text-align:left;font-size:12px;letter-spacing:.04em}`,
    `#seele-mesa-launch:hover,#seele-mesa-launch[aria-expanded=true]{background:var(--tint);border-color:var(--accent)}`,
    `#seele-mesa-launch:focus-visible{outline:2px solid var(--accent);outline-offset:3px}`,
    `#seele-mesa-launch svg{width:20px;height:20px;flex-shrink:0;color:var(--accent)}`,
    `.mesa-launcher-kind{margin-left:auto;color:var(--muted);font-size:10px;letter-spacing:.1em}`,
    `.mesa-launcher-fallback{max-width:260px}`,
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
    `.mesa-piece img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}`,
    `.mesa-portrait{display:inline-flex;width:36px;height:36px;flex-shrink:0;align-items:center;justify-content:center;border:1px solid var(--strong);background:var(--panel);vertical-align:middle;overflow:hidden}.mesa-portrait img{width:100%;height:100%;object-fit:cover}.mesa-portrait.large{width:88px;height:88px}`,
    `.mesa-sound{padding:12px;border:1px solid var(--line)}.mesa-sound p{font-size:11px;color:var(--muted)}.mesa-sound input[type=range]{width:100%;padding:0}.mesa-action-card{padding:12px;border:1px solid var(--line);margin-top:8px}.mesa-action-card p{white-space:pre-wrap;overflow-wrap:anywhere}.mesa-action-card button{margin:4px 4px 0 0}`,
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
        const index=css.insertRule(rule.slice(start, i + 1), css.cssRules.length);
        insertedRules.push(css.cssRules[index]);
        start = i + 1;
      }
    }
  });
  const launch = document.createElement('button'); launch.id = 'seele-mesa-launch'; launch.type = 'button';
  launch.setAttribute('aria-label', 'MESA'); launch.title = 'Abrir Mesa — jogo de RPG';
  launch.setAttribute('aria-expanded', 'false'); launch.setAttribute('aria-controls', 'seele-mesa-panel');
  launch.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 22 8v8l-10 6-10-6V8Z M2 8l10 6 10-6 M12 14v8 M12 2v12"/></svg><span>MESA</span><span class="mesa-launcher-kind" aria-hidden="true">RPG</span>';
  const launcher = document.createElement('section'); launcher.className = 'mesa-launcher'; launcher.setAttribute('aria-label', 'MODs — Mesa');
  const launcherHeading = document.createElement('h2'); launcherHeading.className = 'mesa-launcher-heading'; launcherHeading.textContent = 'MODS';
  launcher.append(launcherHeading, launch);
  // The channel column owns navigation; placing this inside its scrolling area
  // also inherits SEELE's screen visibility and narrow-window channel drawer.
  // Older shells/previews get an in-flow entry, never a floating chat overlay.
  const launchHost = document.querySelector('#tela-sessao .painel-canais .canais-rolagem');
  if (!launchHost) launcher.classList.add('mesa-launcher-fallback');
  (launchHost || document.body).append(launcher);
  const root = document.createElement('section'); root.id = 'seele-mesa-panel'; root.className = 'mesa-root'; root.hidden = true; root.setAttribute('aria-label', 'Mesa — jogo de RPG'); root.tabIndex = -1;
  const modal = document.createElement('dialog'); modal.className = 'mesa-dialog';
  document.body.append(root, modal);
  let snapshot, channel, view, tab = 'game', sceneId, selected, wallMode = false, busy = false, disposed = false, poll, drag, lastSignature = '', editingRevision;
  const images = new Map(); const pendingImages = new Set();
  let serverOffset = 0, lastContact = 0;
  const audio = { context: null, gain: null, enabled: false, volume: .25, key: '', next: 0, nodes: new Set(), timer: null, message: '' };
  const tracks = {
    exploration: { step: 1.5, notes: [48,55,60,64,67,64,60,55], type: 'sine' },
    mystery: { step: 2, notes: [45,52,57,60,59,52,48,52], type: 'sine' },
    battle: { step: .5, notes: [38,50,45,50,41,53,45,50], type: 'triangle' }
  };
  function stopSound() {
    for (const node of audio.nodes) { try { node.stop(); } catch {} }
    audio.nodes.clear(); audio.key = '';
  }
  function soundTick() {
    const m = c()?.music;
    // Fail silent on stale/disconnected sessions, including when hidden.
    if (!audio.enabled || root.hidden || disposed || !m?.playing || Date.now()-lastContact>7000 || audio.context?.state!=='running') { stopSound(); return; }
    const track = tracks[m.preset]; if (!track) { stopSound(); return; }
    const position = Math.max(0, m.position + (Date.now()/1000 + serverOffset - m.startedAt));
    const key = channel+':'+m.preset+':'+m.startedAt+':'+m.position;
    if (audio.key !== key || Math.abs(audio.next*track.step-position)>3) {
      stopSound(); audio.key=key; audio.next=Math.ceil(position/track.step);
    }
    while (audio.next*track.step < position+.25) {
      const when = audio.context.currentTime + Math.max(.01,audio.next*track.step-position);
      const note = track.notes[audio.next % track.notes.length];
      for (const semitones of [0,7]) {
        const osc=audio.context.createOscillator(), envelope=audio.context.createGain();
        osc.type=track.type;osc.frequency.value=440*Math.pow(2,(note+semitones-69)/12);
        envelope.gain.setValueAtTime(0,when);envelope.gain.linearRampToValueAtTime(.08,when+.08);envelope.gain.exponentialRampToValueAtTime(.001,when+track.step*1.8);
        osc.connect(envelope);envelope.connect(audio.gain);audio.nodes.add(osc);
        osc.onended=()=>{audio.nodes.delete(osc);osc.disconnect();envelope.disconnect();};
        osc.start(when);osc.stop(when+track.step*1.8+.05);
      }
      audio.next++;
    }
  }
  function recordClock(response, sent) {
    lastContact=Date.now();
    if (Number.isFinite(response.serverTime)) serverOffset=response.serverTime-(sent+lastContact)/2000;
    soundTick();
  }
  async function toggleSound() {
    if (audio.enabled) { audio.enabled=false;stopSound();render();return; }
    try {
      const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
      if (!Context) throw new Error('Este navegador não oferece áudio local.');
      if (!audio.context) { audio.context=new Context();audio.gain=audio.context.createGain();audio.gain.gain.value=audio.volume;audio.gain.connect(audio.context.destination); }
      await audio.context.resume();
      if (audio.context.state!=='running') throw new Error('Clique novamente para autorizar o som neste dispositivo.');
      audio.enabled=true;audio.message='';soundTick();render();
    } catch(e) { audio.message=message(e);audio.enabled=false;render(); }
  }
  audio.timer=setInterval(soundTick,100);
  const errors = { 'conflict': 'A campanha mudou. Atualize e repita a alteração.', 'gm-only': 'Esta ação é do GM.', 'admin-only': 'Um administrador do servidor precisa iniciar a campanha.', 'not-owner': 'O GM não autorizou editar esta ficha ou peça.', 'timeout': 'O servidor não respondeu. Confira a conexão antes de repetir.', 'bridge-refused': 'Pedido recusado. Confira se o MOD está habilitado e se os arquivos correspondem à versão instalada.', 'no-slot': 'Não há espaço de magia disponível neste nível.', 'invalid-dice': 'Use 1d20, 2d6+3 ou outra fórmula com até 20 dados.', 'limit': 'O limite desta versão foi alcançado.', 'image-too-large': 'A imagem precisa ocupar até 256 KiB após a conversão.', 'campaign-full': 'Campanha cheia. Reduza textos ou conteúdo.', 'grid-occupied': 'A grade menor deixaria peças ou obstáculos fora do mapa.', 'read-only': 'Sua permissão no servidor é apenas de leitura.', 'not-found': 'Este conteúdo não está disponível.', 'invalid-sheet': 'Confira o nome e os pontos de vida da ficha.', 'not-prepared': 'A magia precisa estar preparada na ficha.', 'disk-failed': 'O servidor não conseguiu gravar a imagem.', 'invalid-training': 'Confira as proficiências selecionadas.', 'invalid-conditions': 'Use até 12 condições, com até 40 caracteres cada.', 'invalid-check': 'Escolha um teste e um modo de rolagem válidos.', 'invalid-number': 'Confira os valores e limites dos campos.' };
  const message = e => errors[e?.message || e] || 'Não foi possível concluir: ' + String(e?.message || e);
  Object.assign(errors, { 'no-use':'Não há usos disponíveis para esta ação.', 'invalid-action':'Confira o tipo, os usos e a recuperação da ação.', 'invalid-music':'Escolha uma trilha local disponível.', 'upload-order':'O envio foi interrompido. Feche e importe a imagem novamente.' });
  const nonce = () => 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  function status(text, error = false) { const e = root.querySelector('.mesa-status'); if (e) { e.textContent = text; e.classList.toggle('mesa-error', error); } }
  function c() { return view?.campaign; }
  function scene() { return c()?.scenes.find(s => s.id === sceneId) || c()?.scenes.find(s => s.id === c().active) || c()?.scenes[0]; }
  async function read(force = false) {
    if (disposed || busy || !channel || root.hidden) return;
    try {
      const requestedChannel=channel, sent=Date.now();
      const response = await api.request('seele/mesa', requestedChannel, { op: 'view' });
      if (requestedChannel!==channel || disposed) return;
      if (!response.ok) throw new Error(response.error);
      view = response;
      recordClock(response,sent);
      const signature = JSON.stringify([channel, response.me, response.campaign?.revision, response.isGM]);
      if (force || signature !== lastSignature) { lastSignature = signature; render(); }
      status('Conectado · alterações confirmadas pelo servidor');
    } catch (error) { status(message(error), true); }
  }
  async function act(op, data = {}) {
    if (busy) throw new Error('Aguarde a ação anterior.');
    busy = true; status('Salvando no servidor…');
    try {
      const requestedChannel=channel, sent=Date.now();
      const response = await api.request('seele/mesa', requestedChannel, { ...data, op, revision: editingRevision ?? c()?.revision, nonce: nonce() });
      if (requestedChannel!==channel || disposed) throw new Error('O canal mudou; confira a ação na campanha original.');
      if (!response.ok) throw new Error(response.error);
      view = response; recordClock(response,sent); if(editingRevision !== undefined) editingRevision = c()?.revision; lastSignature = ''; render(); status('Salvo no servidor'); return response;
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
    const linkedSheet = modal.querySelector('select[name=sheet]');
    const linkedName = modal.querySelector('input[name=name]');
    if (linkedSheet && linkedName) linkedSheet.onchange = () => {
      const selectedSheet = c().players.find(s => s.id === linkedSheet.value);
      if (selectedSheet) linkedName.value = selectedSheet.name;
      linkedName.readOnly = Boolean(selectedSheet);
    };
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
    root.innerHTML = `<header class="mesa-top"><span class="mesa-brand">SEELE / MESA</span><select aria-label="Canal da campanha" id="mesa-channel">${(snapshot?.channels || []).map(ch => `<option value="${ch.id}" ${Number(ch.id) === channel ? 'selected' : ''}># ${esc(ch.name)}</option>`).join('')}</select><span class="mesa-spacer"></span><span class="mesa-label">${campaign ? (gm ? 'GM' : 'JOGADOR') + ' / ' + esc(campaign.system === 'free' ? 'LIVRE' : 'D&D 5e · 2014') : 'PREPARAÇÃO'}</span>${btn('Voltar ao SEELE', 'close')}</header><nav class="mesa-tabs">${[['game','Mesa'],['sheets','Fichas'],['entries','Compêndio'],...(gm ? [['prep','Preparação'],['settings','Campanha']] : [])].map(([id,label])=>`<button type="button" data-action="tab" data-id="${id}" aria-current="${tab===id}">${label}</button>`).join('')}</nav><div class="mesa-status" role="status">Carregando…</div><div class="mesa-content">${!campaign ? setupView() : tab === 'sheets' ? sheetsView() : tab === 'entries' ? entriesView() : tab === 'prep' && gm ? prepView() : tab === 'settings' && gm ? settingsView() : gameView()}</div><footer class="mesa-footer"><span>${esc(snapshot?.server || '')} / ${esc(campaign?.name || 'NOVA CAMPANHA')}</span><span>A voz permanece na sala do SEELE</span><span>MESA 1.2 · ${campaign ? 'REVISÃO ' + campaign.revision : 'API 2'}</span></footer>`;
    root.querySelector('#mesa-channel').onchange = async e => { stopSound();modal.close();channel = Number(e.target.value); sceneId = null; view = null; selected = null; render(); await read(true); };
    const volume=root.querySelector('#mesa-volume');
    if(volume)volume.oninput=()=>{audio.volume=Number(volume.value)/100;if(audio.gain)audio.gain.gain.setTargetAtTime(audio.volume,audio.context.currentTime,.03);};
    hydratePortraits();
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
  function portrait(id, large=false) {
    const p=c()?.players.find(s=>s.id===id);if(!p)return '';
    return `<span class="mesa-portrait${large?' large':''}">${p.portrait&&images.has(p.portrait)?`<img src="${esc(images.get(p.portrait))}" alt="Retrato de ${esc(p.name)}">`:esc(p.name.slice(0,2).toUpperCase())}</span>`;
  }
  function pieceFace(t) {
    const p=c()?.players.find(s=>s.id===t.sheet);
    return p?.portrait&&images.has(p.portrait)?`<img src="${esc(images.get(p.portrait))}" alt="" draggable="false">`:esc(t.name.slice(0,2).toUpperCase());
  }
  function hydratePortraits() {
    const requestedChannel=channel;
    for(const p of c()?.players||[]) {
      if(pendingImages.size>=2)break;
      if(!p.portrait||images.has(p.portrait)||pendingImages.has(p.portrait))continue;
      pendingImages.add(p.portrait);
      api.request('seele/mesa',requestedChannel,{op:'portrait-asset',sheet:p.id}).then(r=>{
        if(disposed||requestedChannel!==channel)return;
        if(!r.ok)throw new Error(r.error);
        if(r.asset!==p.portrait)return;
        if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image||''))throw new Error('invalid-image');
        images.set(p.portrait,r.image);if(images.size>64)images.delete(images.keys().next().value);
      }).catch(e=>status(message(e),true)).finally(()=>{pendingImages.delete(p.portrait);if(!disposed&&requestedChannel===channel&&images.has(p.portrait))render();});
    }
  }
  function musicView() {
    const m=c().music||{}, label=(view.rules.ambience||{})[m.preset]||'Sem trilha';
    return `<section class="mesa-sound" aria-label="Ambientação"><h2>AMBIENTAÇÃO</h2><p>${esc(label)} · ${m.playing?'tocando':'pausado'}</p>${view.isGM?`<div class="mesa-actions">${btn('Escolher trilha','music-select')}${m.preset?btn(m.playing?'Pausar para todos':'Retomar para todos',m.playing?'music-pause':'music-resume'):''}${m.preset?btn('Parar trilha','music-stop'):''}</div>`:''}<div class="mesa-actions">${btn(audio.enabled?'Silenciar neste dispositivo':'Ativar som neste dispositivo','sound-toggle')}</div><label class="mesa-label" for="mesa-volume">Volume individual</label><input id="mesa-volume" type="range" min="0" max="100" value="${Math.round(audio.volume*100)}"><p>Trilhas sintetizadas locais. Sincronização aproximada; cada pessoa autoriza seu áudio. YouTube ainda não integrado.</p>${audio.message?`<p role="alert" class="mesa-error">${esc(audio.message)}</p>`:''}</section>`;
  }
  function actionCards(s, editing=false) {
    const kinds={action:'Ação',bonus:'Ação bônus',reaction:'Reação',free:'Livre'};
    return Object.entries(kinds).map(([kind,label])=>{
      const list=(s.actions||[]).filter(a=>a.kind===kind);if(!list.length)return '';
      return `<h2>${label.toUpperCase()}</h2>${list.map(a=>`<article class="mesa-action-card"><strong>${esc(a.name)}</strong><p>${esc(a.description)}</p><span class="mesa-label">${esc(a.formula||'Sem rolagem')} · ${a.max?(a.max-a.used)+'/'+a.max+' usos':'Usos livres'}</span><div>${btn('Usar '+esc(a.name),'action-use',s.id+':'+a.id)}${editing?btn('Editar '+esc(a.name),'action-edit',s.id+':'+a.id)+btn('Remover '+esc(a.name),'action-remove',s.id+':'+a.id):''}</div></article>`).join('')}`;
    }).join('')||'<p>Nenhuma ação cadastrada.</p>';
  }
  async function sendImage(op, id, file) {
    const data=await imageData(file,op==='portrait-part');const parts=data.match(/.{1,6000}/g),upload=nonce();
    for(let i=0;i<parts.length;i++) {
      await act(op,{[op==='portrait-part'?'sheet':'scene']:id,index:i,total:parts.length,part:parts[i],upload});
      status(`Enviando imagem · ${i+1}/${parts.length}`);
      // Stay below the shared control-stream rate budget.
      if(i<parts.length-1)await new Promise(resolve=>setTimeout(resolve,80));
    }
  }
  function setupView() { return `<div class="mesa-empty"><span class="mesa-label">CAMPANHA POR CANAL</span><h1>UMA NOVA MESA.</h1><p>Defina o sistema, escolha quem conduz e prepare as fichas. Mapas e cenas ficam privados até o GM revelá-los.</p>${view?.canSetup ? btn('CRIAR CAMPANHA','setup','',true) : '<p>Um administrador do servidor precisa criar a campanha e designar o GM.</p>'}</div>`; }
  function gameView() {
    const campaign = c(), s = scene(), gm = view.isGM;
    const content = !s ? `<div class="mesa-empty"><h1>A CENA AINDA NÃO FOI REVELADA.</h1><p>${gm ? 'Prepare um mapa ou uma cena ilustrada para começar.' : 'O GM está preparando a próxima cena.'}</p>${gm ? btn('Preparar cena','tab','prep',true) : ''}</div>` : s.kind === 'illustration' ? `<div class="mesa-illustration">${images.has(s.asset) ? `<img src="${esc(images.get(s.asset))}" alt="${esc(s.name)}">` : ''}<p>${esc(s.description)}</p></div>` : boardView(s);
    return `<div class="mesa-game"><div class="mesa-stage"><div class="mesa-scenehead"><div><span class="mesa-label">${esc(campaign.name)}</span><h1>${esc(s?.name || 'MESA')}</h1></div><span class="mesa-spacer"></span>${s && gm ? `<span class="mesa-label">${s.id===campaign.active&&s.published?'VISÍVEL AOS JOGADORES':'PRÉVIA PRIVADA'}</span>${btn('Revelar','show',s.id)}${btn('Editar','scene-edit',s.id)}` : ''}</div>${content}${s&&gm&&s.kind==='map'?`<div class="mesa-rollbar">${btn('Adicionar peça','token-add',s.id)}${btn(wallMode?'Parar desenho':'Desenhar obstáculos','walls')}${selected?btn('Peça selecionada','token-edit',selected):''}<span class="mesa-label">Arraste uma peça para mover</span></div>`:''}<form class="mesa-rollbar" id="mesa-roll-form"><label for="mesa-formula" class="mesa-label">DADOS PÚBLICOS</label><input id="mesa-formula" name="formula" aria-label="Fórmula de dados" value="1d20" maxlength="24" required><button class="primary" type="submit">ROLAR</button></form></div><aside class="mesa-side"><div><span class="mesa-label">RODADA ${campaign.round}</span><h2>INICIATIVA</h2></div><div>${campaign.initiative.map(i=>`<div class="mesa-turn ${i.id===campaign.currentTurn || (gm && campaign.initiative[campaign.turn]?.id===i.id)?'active':''}"><span>${portrait(i.sheet)} ${esc(i.name)}${i.hidden?' · oculto':''}</span><strong>${i.value}</strong>${gm?`<button type="button" data-action="initiative-remove" data-id="${i.id}" aria-label="Remover ${esc(i.name)} da iniciativa">×</button>`:''}</div>`).join('') || '<p class="mesa-label">Sem encontro ativo</p>'}</div>${gm?`<div class="mesa-actions">${btn('Adicionar','initiative-add')}${btn('Próximo turno →','next','',true)}${btn('Encerrar encontro','clear')}</div>`:''}${musicView()}<h2>REGISTRO DA MESA</h2><div>${campaign.log.slice(-8).reverse().map(l=>`<div class="mesa-log"><span class="mesa-label">${esc(personName(l.person))} · ${new Date(l.at*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span><div>${esc(l.text)}</div></div>`).join('') || '<p class="mesa-label">As rolagens aparecerão aqui.</p>'}</div></aside></div>`;
  }
  function personName(id) { const p = snapshot?.presentes?.find(p=>String(p.id)===id); return p?.nickname || p?.apelido || 'Pessoa '+id; }
  function boardView(s) {
    const lines = []; for(let x=1;x<s.cols;x++)lines.push(`<path d="M${x} 0V${s.rows}"/>`);for(let y=1;y<s.rows;y++)lines.push(`<path d="M0 ${y}H${s.cols}"/>`);
    return `<div class="mesa-map" role="group" aria-label="Tabuleiro ${esc(s.name)}">${images.has(s.asset)?`<img src="${esc(images.get(s.asset))}" alt="Mapa ${esc(s.name)}" draggable="false">`:''}<svg class="mesa-grid" viewBox="0 0 ${s.cols} ${s.rows}" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="var(--strong)" stroke-width=".025">${lines.join('')}</g><g fill="var(--strong)" stroke="var(--muted)" stroke-width=".04">${s.walls.map(w=>`<rect x="${w.x}" y="${w.y}" width="1" height="1"/>`).join('')}</g></svg>${s.tokens.map(t=>`<button type="button" class="mesa-piece" data-token="${t.id}" data-hidden="${t.hidden}" aria-label="${esc(t.name)}${t.hidden?', oculta':''}" aria-pressed="${selected===t.id}">${pieceFace(t)}</button>`).join('')}</div>`;
  }
  function sheetsView() { return `<div class="mesa-pad"><h1>FICHAS</h1><p class="mesa-label">${view.isGM?'Todas as fichas da campanha':'Suas fichas · os dados completos são privados'}</p>${view.isGM?btn('Nova ficha','sheet-create','',true):''}<div class="mesa-cards">${c().sheets.map(s=>`<article class="mesa-card">${portrait(s.id,true)}<span class="mesa-label">${esc(personName(s.owner))} · NÍVEL ${s.level}</span><h2>${esc(s.name)}</h2><p>${esc(s.className || 'Classe livre')} · PV ${s.hp}/${s.maxHp} · CA ${s.ac}</p><p>${s.tempHp ? '+'+s.tempHp+' PV temporários' : ''}</p><p>${esc((s.conditions||[]).join(' · '))}</p><div class="mesa-actions">${btn('Jogar','play',s.id,true)}${btn('Ações','actions',s.id)}${view.isGM||c().allowEdit?btn('Retrato','portrait',s.id):''}${btn('Abrir ficha','sheet',s.id)}${view.isGM||c().allowEdit?btn('Proficiências','training',s.id):''}${view.isGM?btn('Responsável','sheet-owner',s.id):''}</div></article>`).join('') || '<p>Aguardando o GM criar e atribuir as fichas.</p>'}</div></div>`; }
  function entriesView() { return `<div class="mesa-pad"><h1>COMPÊNDIO DA CAMPANHA</h1><p class="mesa-label">Magias, habilidades, itens e regras cadastrados pelo GM</p>${view.isGM?btn('Novo conteúdo','entry-create','',true):''}<div class="mesa-cards">${c().entries.map(e=>`<article class="mesa-card"><span class="mesa-label">${esc(e.kind)} · NÍVEL ${e.level}${!e.published?' · PRIVADO':''}</span><h2>${esc(e.name)}</h2><p>${esc(e.range)} ${esc(e.cost)}</p><p>${esc(e.description)}</p>${e.formula?btn('Rolar '+esc(e.formula),'entry-roll',e.id):''}${view.isGM?btn('Editar','entry-edit',e.id):''}</article>`).join('') || '<p>O compêndio começa vazio. Cadastre conteúdo próprio ou autorizado para sua campanha.</p>'}</div></div>`; }
  function prepView() { return `<div class="mesa-pad"><h1>PREPARAÇÃO</h1><p class="mesa-label">Somente o GM vê esta área</p>${btn('Novo mapa','scene-new-map','',true)} ${btn('Nova cena ilustrada','scene-new-illustration')}<div class="mesa-cards">${c().scenes.map(s=>`<article class="mesa-card"><span class="mesa-label">${s.kind==='map'?'TABULEIRO':'ILUSTRAÇÃO'} · ${s.id===c().active?'EM EXIBIÇÃO':'PREPARADA'}</span><h2>${esc(s.name)}</h2><p>${esc(s.description.slice(0,160))}</p><div class="mesa-actions">${btn('Abrir','scene-open',s.id)}${btn('Editar','scene-edit',s.id)}${btn('Importar imagem','image',s.id)}${btn('Trilha da cena','scene-music',s.id)}${btn('Revelar','show',s.id,true)}${s.published?btn('Ocultar','hide',s.id):''}</div></article>`).join('')}</div></div>`; }
  function settingsView() { return `<div class="mesa-pad"><h1>${esc(c().name)}</h1><p>GM: ${esc(personName(c().gm))}</p><p>Edição das próprias fichas: ${c().allowEdit?'permitida':'restrita ao GM'}</p><p>Movimento das próprias peças: ${c().allowMove?'permitido':'restrito ao GM'}</p>${btn('Configurar campanha','settings','',true)}<p class="mesa-label">Limites v1: 16 fichas · 16 cenas · 100 entradas de compêndio · 48 peças por cena</p></div>`; }
  const baseRender = render;
  render = function() { baseRender(); const s=scene(), board=root.querySelector('.mesa-map');if(s&&board){board.style.aspectRatio=s.cols+'/'+s.rows;board.style.setProperty('--mesa-map-ratio',String(s.cols/s.rows));board.querySelectorAll('[data-token]').forEach(e=>{const t=s.tokens.find(t=>t.id===e.dataset.token);e.style.left=((t.x+.5)/s.cols*100)+'%';e.style.top=((t.y+.5)/s.rows*100)+'%';});}const form=root.querySelector('#mesa-roll-form');if(form)form.onsubmit=async e=>{e.preventDefault();try{await act('roll',{formula:new FormData(form).get('formula')});}catch{}}; };
  function signed(n) { return (n >= 0 ? '+' : '−') + Math.abs(n); }
  function openPlay(id, initial = 'ability:str') {
    const s = c().sheets.find(v => v.id === id);
    if (!s) throw new Error('not-found');
    const prof = Math.ceil(s.level / 4) + 1;
    const mod = a => Math.floor((s.abilities[a] - 10) / 2);
    const option = (value, label, bonus) => `<option value="${value}" ${value===initial?'selected':''}>${esc(label)} (${signed(bonus)})</option>`;
    const abilities = Object.entries(view.rules.abilities);
    const options = `<optgroup label="Atributos">${abilities.map(([a,label])=>option('ability:'+a,label,mod(a))).join('')}</optgroup><optgroup label="Resistências">${abilities.map(([a,label])=>option('save:'+a,'Resistência · '+label,mod(a)+prof*((s.saveRanks||{})[a]||0))).join('')}</optgroup><optgroup label="Perícias">${view.rules.skills.map(([key,a,label])=>option('skill:'+key,label,mod(a)+prof*((s.skillRanks||{})[key]||0))).join('')}</optgroup>`;
    const can = view.isGM || c().allowEdit;
    dialog('JOGAR · '+s.name, `${portrait(s.id,true)}<p>PV ${s.hp}/${s.maxHp}${s.tempHp?' · temporários '+s.tempHp:''} · CA ${s.ac}</p><p>${esc((s.conditions||[]).join(' · ')||'Sem condições registradas')}</p>${can?`<div class="mesa-actions">${btn('Dano / cura','vitality',id)}${btn('Condições','conditions',id)}${btn('Descanso longo','rest',id)}${s.spells.map(eid=>c().entries.find(e=>e.id===eid)).filter(Boolean).map(e=>btn('Usar '+esc(e.name),'cast',id+':'+e.id)).join('')}</div>`:''}${can?actionCards(s):''}<h2>TESTE PÚBLICO</h2><p class="mesa-label">Usa os valores salvos na ficha. O resultado e o bônus serão visíveis à mesa. Proficiência calculada pelo nível de 5e.</p><label>Teste<select name="test" aria-label="Teste">${options}</select></label><div class="mesa-fields"><label>Modo de rolagem<select name="mode" aria-label="Modo de rolagem"><option value="normal">Normal · 1d20</option><option value="advantage">Vantagem · maior de 2d20</option><option value="disadvantage">Desvantagem · menor de 2d20</option></select></label>${field('Ajuste situacional','bonus',0,'number','min="-99" max="99" required')}</div>`, 'Rolar e registrar', f => {
      const [kind,key] = f.get('test').split(':');
      return act('check',{sheet:id,kind,key,mode:f.get('mode'),bonus:Number(f.get('bonus'))});
    });
  }
  function openTraining(id) {
    const s = c().sheets.find(v => v.id === id);
    const rankSelect = (name,label,value,max) => `<label>${esc(label)}<select name="${name}" aria-label="${esc(label)}">${['Sem proficiência','Proficiente','Especialista (dobro)'].slice(0,max+1).map((text,i)=>`<option value="${i}" ${i===(value||0)?'selected':''}>${text}</option>`).join('')}</select></label>`;
    const saves = Object.entries(view.rules.abilities);
    dialog('PROFICIÊNCIAS · '+s.name, `<p>Cadastro manual do GM ou responsável pela ficha. Bônus por nível: +${Math.ceil(s.level/4)+1}. Não aplica automaticamente recursos de classe ou efeitos de condições.</p><h2>RESISTÊNCIAS</h2><div class="mesa-fields">${saves.map(([a,label])=>rankSelect('save-'+a,label,(s.saveRanks||{})[a],1)).join('')}</div><h2>PERÍCIAS</h2><div class="mesa-fields">${view.rules.skills.map(([key,a,label])=>rankSelect('skill-'+key,label+' · '+view.rules.abilities[a],(s.skillRanks||{})[key],2)).join('')}</div>`, 'Salvar proficiências', f => act('sheet-save',{sheet:{...s,saveRanks:Object.fromEntries(saves.map(([a])=>[a,Number(f.get('save-'+a))])),skillRanks:Object.fromEntries(view.rules.skills.map(([key])=>[key,Number(f.get('skill-'+key))]))}}));
  }
  function openSheet(id) {
    const s=c().sheets.find(s=>s.id===id), can=view.isGM||c().allowEdit;
    const labels={str:'FOR',dex:'DES',con:'CON',int:'INT',wis:'SAB',cha:'CAR'};
    dialog(s.name, `${portrait(s.id,true)}<fieldset ${can?'':'disabled'}><div class="mesa-fields">${field('Nome','name',s.name,'text','required maxlength="60"')}${field('Classe / multiclasse','className',s.className)}${field('Ancestralidade','ancestry',s.ancestry)}${field('Antecedente','background',s.background)}${field('Nível','level',s.level,'number','min="1" max="20" required')}${field('CA','ac',s.ac,'number','min="0" max="99" required')}${field('PV atuais','hp',s.hp,'number','min="0" max="9999" required')}${field('PV máximos','maxHp',s.maxHp,'number','min="1" max="9999" required')}${field('PV temporários','tempHp',s.tempHp,'number','min="0" max="9999"')}${field('Deslocamento (m)','speed',s.speed,'number','min="0" max="999"')}</div><h2>ATRIBUTOS</h2><div class="mesa-abilities">${Object.entries(labels).map(([a,l])=>field(l,'ability-'+a,s.abilities[a],'number','min="1" max="30" required')).join('')}</div><p class="mesa-label">Proficiência +${Math.ceil(s.level/4)+1} · modificador = piso((atributo − 10) / 2)</p>${area('Perícias e proficiências','skills',s.skills)}${area('Inventário','inventory',s.inventory)}${area('Notas privadas da ficha','notes',s.notes)}<h2>MAGIAS PREPARADAS</h2>${c().entries.filter(e=>e.kind==='magia').map(e=>check(esc(e.name),'spell-'+e.id,s.spells.includes(e.id))).join('')||'<p>Cadastre magias no compêndio.</p>'}<h2>ESPAÇOS DE MAGIA</h2>${s.slots.map((v,i)=>`<div class="mesa-slot"><span>Nível ${i+1}</span>${field('Total','max-'+i,v.max,'number','min="0" max="20" required')}${field('Usados','used-'+i,v.used,'number','min="0" max="20" required')}</div>`).join('')}</fieldset><p class="mesa-label">Salve a ficha e use Jogar para rolar dados, aplicar dano, usar magias ou descansar.</p>`,can?'Salvar ficha':'Fechar',async f=>{if(!can)return;const fresh={...s};for(const n of ['name','className','ancestry','background','skills','inventory','notes'])fresh[n]=f.get(n);for(const n of ['level','ac','hp','maxHp','tempHp','speed'])fresh[n]=Number(f.get(n));fresh.abilities=Object.fromEntries(Object.keys(labels).map(a=>[a,Number(f.get('ability-'+a))]));fresh.spells=c().entries.filter(e=>f.has('spell-'+e.id)).map(e=>e.id);fresh.slots=s.slots.map((v,i)=>({max:Number(f.get('max-'+i)),used:Number(f.get('used-'+i))}));await act('sheet-save',{sheet:fresh});});
  }
  async function handle(action,id) {
    const campaign=c(), gm=view?.isGM, s=scene();
    if(action==='close'){root.hidden=true;launch.setAttribute('aria-expanded','false');stopSound();modal.close();launch.focus();return;}
    if(action==='tab'){tab=id;render();return;}
    if(action==='setup'){dialog('CRIAR CAMPANHA',field('Nome da campanha','name','','text','required maxlength="80"')+`<label>Sistema<select name="system"><option value="dnd5e-2014">D&D 5e · regras de 2014</option><option value="free">Sistema livre</option></select></label><label>GM<select name="gm">${peopleOptions(String(snapshot.me))}</select></label>`,'Criar',f=>act('setup',Object.fromEntries(f)));return;}
    if(action==='settings'){dialog('CAMPANHA',field('Nome','name',campaign.name,'text','required maxlength="80"')+`<label>GM<select name="gm">${peopleOptions(campaign.gm)}</select></label>`+check('Jogadores podem editar suas fichas','allowEdit',campaign.allowEdit)+check('Jogadores podem mover suas peças','allowMove',campaign.allowMove),'Salvar',f=>act('settings',{name:f.get('name'),gm:f.get('gm'),allowEdit:f.has('allowEdit'),allowMove:f.has('allowMove')}));return;}
    if(action==='sheet-create'){dialog('NOVA FICHA',field('Personagem','name','','text','required maxlength="60"')+`<label>Jogador<select name="owner">${peopleOptions(String(snapshot.me))}</select></label>`,'Criar',f=>act('sheet-create',Object.fromEntries(f)));return;}
    if(action==='sheet'){openSheet(id);return;}
    if(action==='play'){openPlay(id);return;}
    if(action==='sound-toggle'){await toggleSound();return;}
    if(action==='music-select'||action==='scene-music'){
      const sc=action==='scene-music'?campaign.scenes.find(v=>v.id===id):null;
      const selected=sc?.ambience||campaign.music?.preset||'silence';
      const choices={...(sc?{inherit:'Manter trilha atual'}:{}),silence:'Silêncio',...view.rules.ambience};
      dialog(sc?'TRILHA · '+sc.name:'AMBIENTAÇÃO DA MESA',`<label>Trilha<select name="preset" aria-label="Trilha">${Object.entries(choices).map(([key,label])=>`<option value="${key}" ${key===selected?'selected':''}>${esc(label)}</option>`).join('')}</select></label><p>${sc?'Será aplicada quando o GM revelar esta cena.':'A seleção inicia a trilha para quem ativou o áudio.'} Música original sintetizada no dispositivo, sem downloads ou serviços externos. Não inclui YouTube.</p>`,sc?'Vincular à cena':'Tocar para a mesa',f=>act(sc?'scene-music':'music',sc?{id,preset:f.get('preset')}:{command:'select',preset:f.get('preset')}));return;
    }
    if(['music-pause','music-resume','music-stop'].includes(action)){await act('music',{command:action.slice(6)});return;}
    if(action==='portrait'){
      const char=campaign.sheets.find(v=>v.id===id);
      dialog('RETRATO · '+char.name,`${portrait(id,true)}<p>Imagem própria do personagem, independente do perfil no SEELE. Recorte central quadrado de 256 px, até 64 KiB. O GM decide quando publicar para a mesa.</p><label>Imagem do personagem<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required></label><p>${char.portrait?.published?'Publicado para a mesa.':'Privado ao GM e ao responsável.'}</p><div class="mesa-actions">${char.portrait?.asset?btn('Remover retrato','portrait-clear',id):''}${gm&&char.portrait?.asset?btn(char.portrait.published?'Tornar retrato privado':'Publicar retrato','portrait-publish',id):''}</div>`,'Salvar retrato',f=>sendImage('portrait-part',id,f.get('image')));return;
    }
    if(action==='portrait-clear'||action==='portrait-publish'){
      const char=campaign.sheets.find(v=>v.id===id),published=!char.portrait?.published;
      dialog(action==='portrait-clear'?'REMOVER RETRATO':'VISIBILIDADE DO RETRATO',`<p>${action==='portrait-clear'?'A ficha será preservada e a peça voltará a usar iniciais.':published?'O retrato ficará visível aos participantes, na peça e na iniciativa.':'Novas consultas deixarão de entregar o retrato aos outros jogadores. Quem já viu uma imagem pode ter guardado uma cópia.'}</p>`,'Confirmar',()=>act(action,{sheet:id,published}));return;
    }
    if(action==='actions'){
      const char=campaign.sheets.find(v=>v.id===id), can=gm||campaign.allowEdit;
      dialog('AÇÕES · '+char.name,`<p>Ataques, habilidades e reações cadastrados pela mesa. Não decide acertos, alvos nem limita a economia de turno automaticamente.</p>${can?btn('Nova ação','action-new',id):''}${can?actionCards(char,true):'<p>Edição e uso de ações restritos pelo GM.</p>'}`,'Concluir',()=>{});return;
    }
    if(action==='action-new'||action==='action-edit'){
      const [sid,aid]=id.split(':'),char=campaign.sheets.find(v=>v.id===sid);
      const a=char.actions?.find(v=>v.id===aid)||{name:'',kind:'action',formula:'',description:'',max:0,used:0,recharge:'manual'};
      dialog('AÇÃO · '+char.name,field('Nome da ação','name',a.name,'text','required maxlength="60"')+`<label>Tipo de ação<select name="kind" aria-label="Tipo de ação">${Object.entries({action:'Ação',bonus:'Ação bônus',reaction:'Reação',free:'Livre'}).map(([key,label])=>`<option value="${key}" ${a.kind===key?'selected':''}>${label}</option>`).join('')}</select></label>`+field('Fórmula opcional','formula',a.formula,'text','maxlength="24"')+area('Descrição da ação','description',a.description)+`<div class="mesa-fields">${field('Usos máximos (0 = livre)','max',a.max,'number','min="0" max="99" required')}${field('Usos gastos','used',a.used,'number','min="0" max="99" required')}</div><label>Recuperação<select name="recharge" aria-label="Recuperação"><option value="manual">Manual</option><option value="long" ${a.recharge==='long'?'selected':''}>Descanso longo</option></select></label>`,'Salvar ação',f=>act('action-save',{...Object.fromEntries(f),sheet:sid,id:aid,max:Number(f.get('max')),used:Number(f.get('used'))}));return;
    }
    if(action==='action-use'||action==='action-remove'){
      const [sid,aid]=id.split(':'),char=campaign.sheets.find(v=>v.id===sid),a=char.actions.find(v=>v.id===aid);
      dialog(a.name,`<p>${esc(a.description)}</p><p>${action==='action-remove'?'Remover esta ação da ficha?':'Usar registra o nome e a rolagem publicamente'+(a.max?' e consome um uso.':'.')+' Não aplica dano ou efeitos ao alvo.'}</p>`,action==='action-remove'?'Remover ação':'Usar e registrar',()=>act(action,{sheet:sid,id:aid}));return;
    }
    if(action==='training'){openTraining(id);return;}
    if(action==='vitality'){
      const char=campaign.sheets.find(v=>v.id===id);
      dialog('DANO / CURA · '+char.name, `<p>PV ${char.hp}/${char.maxHp} · temporários ${char.tempHp}</p><label>Operação<select name="kind" aria-label="Operação"><option value="damage">Receber dano</option><option value="heal">Receber cura</option><option value="temporary">Receber PV temporários</option></select></label>`+field('Quantidade','amount',1,'number','min="0" max="9999" required')+'<p>O dano consome PV temporários primeiro. Cura respeita o máximo; PV temporários não se somam. Resistências, concentração e efeitos em 0 PV são resolvidos pelo GM.</p>', 'Aplicar', f=>act('vitality',{sheet:id,kind:f.get('kind'),amount:Number(f.get('amount'))}));return;
    }
    if(action==='conditions'){
      const char=campaign.sheets.find(v=>v.id===id);
      dialog('CONDIÇÕES · '+char.name,area('Uma condição por linha','conditions',(char.conditions||[]).join('\n'))+'<p>Até 12 condições ou efeitos, com 40 caracteres cada. São anotações privadas da ficha; não alteram rolagens automaticamente. Apague a linha para remover.</p>','Salvar condições',f=>act('conditions',{sheet:id,conditions:f.get('conditions').split('\n').map(v=>v.trim()).filter(Boolean)}));return;
    }
    if(action==='sheet-owner'){const char=campaign.sheets.find(v=>v.id===id);dialog('ATRIBUIR FICHA',`<label>Jogador<select name="owner">${peopleOptions(char.owner)}</select></label>`,'Atribuir',f=>act('sheet-owner',{id,owner:f.get('owner')}));return;}
    if(action.startsWith('scene-new-')){const kind=action.slice(10);dialog(kind==='map'?'NOVO MAPA':'NOVA CENA ILUSTRADA',field('Nome','name','','text','required maxlength="80"'),'Criar',f=>act('scene-create',{kind,name:f.get('name')}));return;}
    if(action==='scene-open'){sceneId=id;selected=null;tab='game';render();return;}
    if(action==='scene-edit'){const sc=campaign.scenes.find(v=>v.id===id);dialog('PREPARAR CENA',field('Nome','name',sc.name,'text','required maxlength="80"')+area('Descrição visível aos jogadores','description',sc.description)+area('Notas privadas do GM','notes',sc.notes)+`<div class="mesa-fields">${field('Colunas','cols',sc.cols,'number','min="4" max="60" required')}${field('Linhas','rows',sc.rows,'number','min="4" max="60" required')}</div>`,'Salvar',f=>act('scene-save',{id,name:f.get('name'),description:f.get('description'),notes:f.get('notes'),cols:Number(f.get('cols')),rows:Number(f.get('rows'))}));return;}
    if(action==='show'||action==='hide'){await act(action==='show'?'scene-show':'scene-hide',{id});if(action==='show'){sceneId=id;tab='game';render();}return;}
    if(action==='walls'){wallMode=!wallMode;render();return;}
    if(action==='token-add'){dialog('ADICIONAR PEÇA',`<label>Ficha<select name="sheet"><option value="">Criatura / peça livre</option>${campaign.players.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>`+field('Nome da peça livre','name','Criatura','text','maxlength="60"')+check('Oculta aos jogadores','hidden',true),'Adicionar',f=>act('token-add',{scene:id,sheet:f.get('sheet'),name:f.get('name'),hidden:f.has('hidden'),x:0,y:0}));return;}
    if(action==='token-edit'){const t=s.tokens.find(v=>v.id===id);if(!t)return;dialog(t.name,check('Oculta aos jogadores','hidden',t.hidden)+`<div class="mesa-fields">${field('Coluna (0 a '+(s.cols-1)+')','x',t.x,'number',`min="0" max="${s.cols-1}" required`)}${field('Linha (0 a '+(s.rows-1)+')','y',t.y,'number',`min="0" max="${s.rows-1}" required`)}</div>`,'Salvar',async f=>{await act('token-move',{scene:s.id,id,x:Number(f.get('x')),y:Number(f.get('y'))});await act('token-hide',{scene:s.id,id,hidden:f.has('hidden')});});return;}
    if(action==='initiative-add'){dialog('INICIATIVA',`<label>Ficha vinculada<select name="sheet"><option value="">Participante livre</option>${campaign.players.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>`+field('Participante','name','','text','required maxlength="60"')+field('Resultado','value',10,'number','min="-20" max="99" required')+check('Oculto aos jogadores','hidden',false),'Adicionar',f=>act('initiative-add',{sheet:f.get('sheet'),name:f.get('name'),value:Number(f.get('value')),hidden:f.has('hidden')}));return;}
    if(action==='next'){await act('initiative-next');return;}
    if(action==='initiative-remove'){const item=campaign.initiative.find(v=>v.id===id);dialog('REMOVER DA INICIATIVA',`<p>Remover ${esc(item.name)} deste encontro? A ficha e a peça no mapa serão preservadas.</p>`,'Remover participante',()=>act('initiative-remove',{id}));return;}
    if(action==='clear'){dialog('ENCERRAR ENCONTRO','<p>A ordem de iniciativa será limpa. As fichas e cenas serão preservadas.</p>','Encerrar',()=>act('initiative-clear'));return;}
    if(action==='entry-create'||action==='entry-edit'){const entry=campaign.entries.find(e=>e.id===id)||{name:'',kind:'magia',level:0,range:'',cost:'',description:'',formula:'',published:false};dialog('CONTEÚDO DA CAMPANHA',field('Nome','name',entry.name,'text','required maxlength="100"')+`<label>Tipo<select name="kind">${['magia','habilidade','item','regra','condição'].map(v=>`<option ${v===entry.kind?'selected':''}>${v}</option>`).join('')}</select></label>`+field('Nível (0 = truque)','level',entry.level,'number','min="0" max="9" required')+field('Alcance','range',entry.range)+field('Custo / componentes','cost',entry.cost)+field('Fórmula de dados opcional','formula',entry.formula)+area('Descrição — conteúdo próprio ou autorizado','description',entry.description)+check('Publicar para os jogadores','published',entry.published),'Salvar',f=>act('entry-save',{...Object.fromEntries(f),id:entry.id,level:Number(f.get('level')),published:f.has('published')}));return;}
    if(action==='entry-roll'){const e=campaign.entries.find(e=>e.id===id);await act('roll',{formula:e.formula,label:e.name});return;}
    if(action==='rest'){dialog('DESCANSO LONGO','<p>Recupera os PV e os espaços de magia desta ficha. Ações com recuperação em descanso longo também recuperam seus usos.</p>','Confirmar descanso',()=>act('rest',{sheet:id}));return;}
    if(action==='cast'){const [sheet,entry]=id.split(':'),e=campaign.entries.find(v=>v.id===entry);dialog(e.name,`<p>${esc(e.description)}</p>`+field('Nível do espaço (0 = truque)','level',e.level,'number',`min="${e.level}" max="9" required`),'Usar e registrar',f=>act('cast',{sheet,entry,level:Number(f.get('level'))}));return;}
    if(action==='image'){dialog('IMPORTAR MAPA / ILUSTRAÇÃO',`<label>Imagem PNG, JPEG ou WebP<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label><p>A imagem será ajustada a até 1600 px e comprimida para até 256 KiB. A grade cobre a imagem inteira.</p>`,'Importar',async f=>{await sendImage('image-part',id,f.get('image'));});return;}
  }
  async function imageData(file, portrait = false) {
    if (!file || file.size>20*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Escolha uma imagem de até 20 MiB.');
    const original=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Falha na leitura da imagem.'));reader.readAsDataURL(file);});
    const image=new Image();image.src=original;await image.decode();
    const canvas=document.createElement('canvas');const ratio=Math.min(1,(portrait?256:1600)/Math.max(image.width,image.height));canvas.width=portrait?256:Math.max(1,Math.round(image.width*ratio));canvas.height=portrait?256:Math.max(1,Math.round(image.height*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#0a0806';ctx.fillRect(0,0,canvas.width,canvas.height);if(portrait){const size=Math.min(image.width,image.height);ctx.drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,256,256);}else ctx.drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [.85,.7,.5,.3]){const result=canvas.toDataURL('image/jpeg',quality);if(result.length<=(portrait?65536:262144))return result;}
    throw new Error('image-too-large');
  }
  function clicks(e) {const b=e.target.closest('[data-action]');if(b)handle(b.dataset.action,b.dataset.id).catch(error=>status(message(error),true));}
  root.addEventListener('click',clicks);modal.addEventListener('click',clicks);
  launch.onclick=async()=>{root.hidden=false;launch.setAttribute('aria-expanded','true');root.focus();try{snapshot=await api.snapshot();channel=channel||snapshot.open_channel||snapshot.channels?.[0]?.id;if(!channel){root.innerHTML='<div class="mesa-empty"><h1>CRIE UM CANAL NO SEELE PARA ABRIR A MESA.</h1><button data-action="close">Voltar</button></div>';return;}channel=Number(channel);render();await read(true);}catch(e){root.innerHTML=`<div class="mesa-empty"><h1>MESA INDISPONÍVEL</h1><p>${esc(message(e))}</p><button data-action="close">Voltar</button></div>`;}};
  poll=setInterval(()=>read(),2000);
const dispose=e=>{if(e.detail!=='seele/mesa')return;disposed=true;clearInterval(poll);clearInterval(audio.timer);stopSound();audio.context?.close().catch(()=>{});modal.close();root.remove();modal.remove();launcher.remove();releaseStyles();globalThis.removeEventListener('seele-mod-unload',dispose);};
  globalThis.addEventListener('seele-mod-unload',dispose);
})();
