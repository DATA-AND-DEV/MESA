/* MESA — server half. JavaScript source is the distributed artifact. No dependencies.
 * VINLAND informed the sheet structure and derived ability/proficiency model.
 * No book descriptions or third-party compendium were copied.
 * aoPedir has kept the same contract since API v2. Never accept identity or
 * permissions from the payload.
 */
(() => {
  'use strict';
  const LIMIT = { sheets: 16, scenes: 16, entries: 100, tokens: 48, walls: 128, image: 10 * 1024 * 1024 };
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const skills = [
    ['acrobatics', 'dex', 'Acrobacia'], ['animal-handling', 'wis', 'Adestrar animais'],
    ['arcana', 'int', 'Arcanismo'], ['athletics', 'str', 'Atletismo'],
    ['deception', 'cha', 'Enganação'], ['stealth', 'dex', 'Furtividade'],
    ['history', 'int', 'História'], ['intimidation', 'cha', 'Intimidação'],
    ['insight', 'wis', 'Intuição'], ['investigation', 'int', 'Investigação'],
    ['medicine', 'wis', 'Medicina'], ['nature', 'int', 'Natureza'],
    ['perception', 'wis', 'Percepção'], ['performance', 'cha', 'Atuação'],
    ['persuasion', 'cha', 'Persuasão'], ['sleight-of-hand', 'dex', 'Prestidigitação'],
    ['religion', 'int', 'Religião'], ['survival', 'wis', 'Sobrevivência']
  ];
  const abilityLabels = { str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma' };
  const modifier = score => Math.floor((score - 10) / 2);
  const proficiency = s => Math.ceil(s.level / 4) + 1;
  const ambience = { exploration: 'Exploração', mystery: 'Mistério', battle: 'Combate' };
  function dice(formula, field = 'formula') {
    const match = /^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/.exec(text(formula, 24, field).replace(/\s/g, ''));
    if (!match) fail('invalid-dice', field, 'uma fórmula como 1d20+3');
    return { count: num(Number(match[1]), 1, 20), sides: Number(match[2]), bonus: Number(match[3] || 0) };
  }
  function roll(formula) {
    const { count, sides, bonus } = dice(formula);
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    return formula + ' = ' + rolls.reduce((a, b) => a + b, bonus) + ' [' + rolls.join(', ') + ']';
  }
  function setMusic(c, preset) {
    if (preset !== 'silence' && !Object.hasOwn(ambience, preset)) fail('invalid-music');
    c.music = { preset: preset === 'silence' ? null : preset, playing: preset !== 'silence', position: 0, startedAt: mundo.agora() };
  }
  // Images of 3.x campaigns were stored in pages of text in `arquivos`, and
  // stay readable that way (`assetReply`). New ones go through the volume.
  const ASSET_CHUNK = 65536;
  function imageIndex(raw) {
    try { const v = JSON.parse(raw); return v?.format === 1 ? v : null; } catch (_) { return null; }
  }
  function assetReply(path, r) {
    const raw = arquivos.ler(path), index = imageIndex(raw);
    const length = index ? index.length : (raw || '').length;
    const offset = r.offset === undefined ? 0 : num(r.offset, 0, length);
    if (r.offset !== undefined && r.asset !== path) fail('image-changed');
    const end = Math.min(offset + ASSET_CHUNK, length);
    let image = '';
    if (index) {
      let start = 0;
      for (let i = 0; i < index.parts && start < end; i++) {
        const size = index.sizes[i];
        if (start + size > offset) {
          const part = arquivos.ler(path + '.' + i);
          if (!part || part.length !== size) fail('image-incomplete');
          image += part.slice(Math.max(0, offset - start), Math.min(size, end - start));
        }
        start += size;
      }
    } else image = (raw || '').slice(offset, end);
    return { ok: true, asset: path, image, ...(end < length ? { proximo: { offset: end, asset: path } } : {}) };
  }
  // Every file an image left on disk: its parts, its index and any upload in
  // progress share the prefix `channel-<n>/<id>-image-`.
  function deleteImageFiles(ctx, id) {
    if (!arquivos.listar) return;
    const prefix = 'channel-' + ctx.channel + '/' + id + '-image-';
    arquivos.listar().filter(p => p.startsWith(prefix)).forEach(p => arquivos.apagar(p));
  }
  // The image a scene or a portrait points at, gone: the volume file of a new
  // one, or the pages of a 3.x one.
  function deleteImage(ctx, holder, legacyId, volumeFlag) {
    if (holder?.asset && holder[volumeFlag]) volume.apagar(holder.asset);
    deleteImageFiles(ctx, legacyId);
  }
  // Who may send the image of a scene (the GM) or of a portrait (whoever may
  // edit the sheet), and where its asset lives.
  function imageTarget(c, ctx, r) {
    if (r.alvo === 'cena') { gm(c, ctx); const s = find(c.scenes, r.id); return { holder: s, legacy: s.id, flag: 'assetVolume' }; }
    if (r.alvo === 'retrato') {
      const s = find(c.sheets, r.id); editable(c, ctx, s);
      s.portrait ||= { asset: null, published: false };
      return { holder: s.portrait, legacy: 'portrait-' + s.id, flag: 'volume', portrait: true };
    }
    fail('invalid-image', 'alvo', 'cena ou retrato');
  }
  // A read asks for the transport the asset has: the volume for new images,
  // the pages for 3.x ones.
  function mediaReply(path, isVolume, r) {
    if (r.transporte === 'volume') {
      if (!isVolume) fail('asset-legado');
      return { ok: true, volume: path };
    }
    if (isVolume) fail('asset-por-volume');
    return assetReply(path, r);
  }
  // Bytes in UTF-8, the way the host counts the yard (no TextEncoder here).
  function utf8(value) {
    const t = String(value); let n = 0;
    for (let i = 0; i < t.length; i++) {
      const u = t.charCodeAt(i);
      if (u < 0x80) n += 1; else if (u < 0x800) n += 2;
      else if (u >= 0xd800 && u <= 0xdbff) { n += 4; i++; } else n += 3;
    }
    return n;
  }
  // Takes one participant out of the order and keeps the turn on whoever had it.
  function leaveInitiative(c, item) {
    const index = c.initiative.indexOf(item);
    c.initiative.splice(index, 1);
    if (!c.initiative.length) { c.turn = 0; c.round = 1; c.encounterStarted = false; }
    else if (index < c.turn) c.turn--;
    else if (c.turn >= c.initiative.length) { c.turn = 0; if (c.encounterStarted) c.round++; }
  }
  function training(raw, allowed, max, field) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('invalid-training');
    const result = {};
    for (const id of Object.keys(raw)) {
      if (!allowed.includes(id)) fail('invalid-training');
      result[id] = num(raw[id], 0, max, field + '.' + id);
    }
    return result;
  }
  function conditions(raw) {
    if (!Array.isArray(raw) || raw.length > 12) fail('invalid-conditions');
    const result = [...new Set(raw.map(v => text(v, 40)))];
    if (result.some(v => !v)) fail('invalid-conditions');
    return result;
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  // A refusal about a form field names it: `erros` maps the field (as the
  // request names it, nested with dots) to a short reason for the person, and
  // goes back to that field in the window. `error` stays the code it always was.
  function fail(code, field, reason) {
    const e = new Error(code);
    if (field) e.erros = typeof field === 'object' ? field : { [field]: reason };
    throw e;
  }
  function text(value, max = 120, field) {
    if (typeof value !== 'string' || value.length > max) fail('invalid-text', field, 'até ' + max + ' caracteres');
    return value.trim();
  }
  function num(value, min, max, field) {
    if (!Number.isInteger(value) || value < min || value > max) fail('invalid-number', field, 'um número inteiro de ' + min + ' a ' + max);
    return value;
  }
  function named(value, field = 'name') { if (!value) fail('invalid-name', field, 'obrigatório'); return value; }
  function key(value) {
    if (typeof value !== 'string' || !/^[a-z0-9-]{1,64}$/.test(value)) fail('invalid-id');
    return value;
  }
  function owner(value, field) {
    if (typeof value !== 'string' || !/^[1-9][0-9]{0,19}$/.test(value)) fail('invalid-owner', field, 'uma pessoa deste servidor');
    return value;
  }
  function find(list, id) { const item = list.find(i => i.id === id); if (!item) fail('not-found'); return item; }
  function next(c, prefix) { c.counter++; return prefix + '-' + c.counter; }
  function gm(c, ctx) { if (c.gm !== ctx.person) fail('gm-only'); }
  function editable(c, ctx, s) { if (c.gm !== ctx.person && (!c.allowEdit || s.owner !== ctx.person)) fail('not-owner'); }
  function log(c, ctx, message) {
    c.log.push({ id: next(c, 'log'), person: ctx.person, at: mundo.agora(), text: message });
    c.log = c.log.slice(-40);
  }
  function sheet(raw, previous) {
    const s = { id: previous.id, owner: previous.owner, name: text(raw.name, 60, 'name'), className: text(raw.className || '', 60, 'className'), ancestry: text(raw.ancestry || '', 60, 'ancestry'), background: text(raw.background || '', 80, 'background'), level: num(raw.level, 1, 20, 'level'), hp: num(raw.hp, 0, 9999, 'hp'), maxHp: num(raw.maxHp, 1, 9999, 'maxHp'), tempHp: num(raw.tempHp || 0, 0, 9999, 'tempHp'), ac: num(raw.ac, 0, 99, 'ac'), speed: num(raw.speed, 0, 999, 'speed'), notes: text(raw.notes || '', 3000, 'notes'), inventory: text(raw.inventory || '', 3000, 'inventory'), abilities: {}, skills: text(raw.skills || '', 1000, 'skills'), spells: [], slots: [] };
    if (!s.name) fail('invalid-sheet', 'name', 'obrigatório');
    if (s.hp > s.maxHp) fail('invalid-sheet', 'hp', 'não passa do PV máximo');
    for (const a of abilities) s.abilities[a] = num(raw.abilities[a], 1, 30, 'abilities.' + a);
    if (!Array.isArray(raw.spells) || raw.spells.length > 40) fail('invalid-spells');
    s.spells = raw.spells.map(id => key(id));
    if (!Array.isArray(raw.slots) || raw.slots.length !== 9) fail('invalid-slots');
    s.slots = raw.slots.map((slot, i) => ({ max: num(slot.max, 0, 20, 'slots.' + i + '.max'), used: num(slot.used, 0, slot.max, 'slots.' + i + '.used') }));
    s.skillRanks = training(raw.skillRanks ?? previous.skillRanks ?? {}, skills.map(v => v[0]), 2, 'skillRanks');
    s.saveRanks = training(raw.saveRanks ?? previous.saveRanks ?? {}, abilities, 1, 'saveRanks');
    // Conditions belong to session actions, not a potentially stale sheet editor.
    s.conditions = conditions(previous.conditions || []);
    s.actions = clone(previous.actions || []);
    s.portrait = clone(previous.portrait || { asset: null, published: false });
    return s;
  }
  function projection(c, ctx) {
    const rules = { skills, abilities: abilityLabels, ambience };
    if (!c) return { ok: true, campaign: null, me: ctx.person, canSetup: Array.isArray(ctx.permissoes) && ctx.permissoes.includes('criar-campanha'), rules };
    const master = c.gm === ctx.person;
    const visible = c.scenes.filter(s => master || (s.published && s.id === c.active));
    const out = {
      name: c.name, system: c.system, gm: c.gm, revision: c.revision, active: c.active, sala: c.sala ?? null,
      allowMove: c.allowMove, allowEdit: c.allowEdit, round: c.round, turn: c.turn,
      sheets: c.sheets.filter(s => master || s.owner === ctx.person).map(s => {
        const copy = clone(s); if (copy.portrait) { delete copy.portrait.upload; delete copy.portrait.envio; } return copy;
      }),
      // Public identities are separate from full private sheets.
      players: c.sheets.map(s => {
        const sees = master || s.owner === ctx.person || s.portrait?.published;
        return { id: s.id, name: s.name, owner: s.owner, portrait: sees ? s.portrait?.asset || null : null, portraitVolume: Boolean(sees && s.portrait?.asset && s.portrait.volume) };
      }),
      music: clone(c.music || { preset: null, playing: false, position: 0, startedAt: 0 }),
      scenes: visible.map(s => {
        const v = clone(s); delete v.upload; delete v.envio;
        if (!master) { delete v.notes; v.tokens = v.tokens.filter(t => !t.hidden); }
        return v;
      }),
      initiative: c.initiative.filter(i => master || !i.hidden).map(clone),
      currentTurn: c.initiative[c.turn] && !c.initiative[c.turn].hidden ? c.initiative[c.turn].id : null,
      entries: c.entries.filter(e => master || e.published).map(clone), log: clone(c.log)
    };
    if (!master) delete out.turn;
    return { ok: true, me: ctx.person, isGM: master, campaign: out, rules, serverTime: mundo.agora() };
  }
  // The voice room each table plays in, server-wide: { "<room>": <channel> }.
  // A room holds one table. The room a request comes from is `contexto.sala`,
  // filled by the server from presence on every request, never by the window.
  const ROOMS = 'salas';
  function rooms() {
    try { const v = JSON.parse(dados[ROOMS] || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; }
  }
  // Tells the MOD's windows that something changed. Held by the host until
  // this call's yard is saved, and dropped with it (API 6, `mundo.avisar`).
  function announce(notice) { if (typeof mundo.avisar === 'function') mundo.avisar(notice); }
  globalThis.aoPedir = (contextJSON, requestJSON) => {
    try {
      const ctx = JSON.parse(contextJSON), r = JSON.parse(requestJSON);
      if (!ctx.person) fail('invalid-context');
      // The table of the room the person is in, asked with no channel (scope 0).
      if (r.op === 'mesa-da-sala') {
        const room = Number.isSafeInteger(ctx.sala) && ctx.sala > 0 ? ctx.sala : null;
        const channel = room === null ? null : rooms()[room] ?? null;
        return JSON.stringify({ ok: true, sala: room, canal: channel });
      }
      // Everything else is about the campaign of one text channel.
      if (ctx.channel === null || ctx.channel === undefined) fail('canal-obrigatorio');
      if (!Number.isInteger(ctx.channel)) fail('invalid-context');
      let roomsChanged = null;
      const reply = {};
      const storage = 'campaign-' + ctx.channel;
      let c = dados[storage] ? JSON.parse(dados[storage]) : null;
      if (c && c.encounterStarted === undefined) c.encounterStarted = c.turn > 0 || c.round > 1;
      if (r.op === 'view') return JSON.stringify(projection(c, ctx));
      if (r.op === 'asset') {
        if (!c) fail('not-found');
        const s = find(c.scenes, r.scene);
        if (c.gm !== ctx.person && (!s.published || s.id !== c.active)) fail('gm-only');
        if (!s.asset) fail('not-found');
        return JSON.stringify(mediaReply(s.asset, s.assetVolume, r));
      }
      if (r.op === 'portrait-asset') {
        if (!c) fail('not-found'); const s = find(c.sheets, r.sheet);
        if (ctx.person !== c.gm && s.owner !== ctx.person && !s.portrait?.published) fail('not-owner');
        if (!s.portrait?.asset) fail('not-found');
        return JSON.stringify(mediaReply(s.portrait.asset, s.portrait.volume, r));
      }
      // **A ação autoriza criar a mesa, e mais nada.** Uma `criar-campanha` com o corpo de outra operação é recusada, e a exceção ao
      // modo só leitura é do `setup`: quem tem a permissão não ganha, por ela, o poder de escrever numa mesa que já existe.
      if (ctx.acao === 'criar-campanha' && r.op !== 'setup') fail(ctx.write || ctx.admin ? 'acao-so-cria-a-mesa' : 'read-only');
      if (!ctx.write && !ctx.admin && !(r.op === 'setup' && ctx.acao === 'criar-campanha')) fail('read-only');
      const nonce = key(r.nonce);
      if (c && c.receipts.some(v => v === ctx.person + ':' + nonce)) return JSON.stringify(projection(c, ctx));
      if (r.op === 'setup') {
        if (c) fail('already-created');
        // **API 7: só a ação cria a mesa.** `ctx.acao` é escrita pelo HOST depois do portão dos cargos; nunca vem do corpo do
        // pedido. Nem `ctx.admin` nem `ctx.permissoes` decidem (a segunda é informativa e chega também num ModRequest comum).
        // O dono (`gm`) e o mestre continuam valendo em tudo o que vem depois: a ação só abre a criação.
        if (ctx.acao !== 'criar-campanha') fail('pede-a-acao-criar-campanha');
        c = { version: 1, name: named(text(r.name, 80, 'name')), system: r.system, gm: owner(r.gm, 'gm'), revision: 0, counter: 0, allowMove: true, allowEdit: true, active: null, sheets: [], scenes: [], initiative: [], turn: 0, round: 1, log: [], entries: [], receipts: [] };
        if (!['dnd5e-2014', 'free'].includes(r.system)) fail('invalid-system', 'system', 'um dos sistemas oferecidos');
      } else {
        if (!c) fail('not-found');
        if (r.revision !== c.revision) fail('conflict');
        switch (r.op) {
          case 'settings':
            gm(c, ctx); c.name = named(text(r.name, 80, 'name'));
            c.allowMove = r.allowMove === true; c.allowEdit = r.allowEdit === true;
            if (r.gm) c.gm = owner(r.gm, 'gm');
            // The room is only touched when the request names it; null unties.
            if (r.sala !== undefined) {
              const room = r.sala === null ? null : num(r.sala, 1, Number.MAX_SAFE_INTEGER, 'sala');
              const before = c.sala ?? null, map = rooms();
              if (room !== null && map[room] !== undefined && map[room] !== ctx.channel) fail('sala-ocupada', 'sala', 'esta sala já tem a mesa de outro canal');
              if (room !== before) {
                if (before !== null) delete map[before];
                if (room !== null) map[room] = ctx.channel;
                c.sala = room;
                roomsChanged = { map, rooms: [before, room].filter(v => v !== null) };
              }
            }
            break;
          case 'sheet-create': {
            gm(c, ctx); if (c.sheets.length >= LIMIT.sheets) fail('limit');
            const s = { id: next(c, 'sheet'), owner: owner(r.owner, 'owner'), name: text(r.name, 60, 'name'), className: '', ancestry: '', background: '', level: 1, hp: 10, maxHp: 10, tempHp: 0, ac: 10, speed: 9, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, notes: '', inventory: '', skills: '', spells: [], slots: Array.from({ length: 9 }, () => ({ max: 0, used: 0 })) };
            named(s.name); c.sheets.push(s); break;
          }
          case 'sheet-save': {
            const old = find(c.sheets, r.sheet.id); editable(c, ctx, old);
            const fresh = sheet(r.sheet, old);
            fresh.spells.forEach(id => { const e = find(c.entries, id); if (c.gm !== ctx.person && !e.published) fail('gm-only'); });
            c.sheets[c.sheets.indexOf(old)] = fresh; break;
          }
          case 'sheet-owner': gm(c, ctx); find(c.sheets, r.id).owner = owner(r.owner, 'owner'); break;
          case 'sheet-remove': {
            // The sheet goes with what depends on it: its pieces, its places in
            // the initiative and its portrait files.
            gm(c, ctx); const s = find(c.sheets, r.id);
            c.scenes.forEach(scene => { scene.tokens = scene.tokens.filter(t => t.sheet !== s.id); });
            c.initiative.filter(i => i.sheet === s.id).forEach(i => leaveInitiative(c, i));
            deleteImage(ctx, s.portrait, 'portrait-' + s.id, 'volume');
            c.sheets = c.sheets.filter(v => v !== s); break;
          }
          case 'imagem-comecar': {
            // Opens the volume for whoever is being served, and gives the
            // window the token to send the bytes with (ADR 0048).
            const { holder, legacy } = imageTarget(c, ctx, r);
            const token = 'mesa-' + (c.revision + 1).toString(36) + '-' + Math.floor(Math.random() * 2176782336).toString(36);
            const caminho = 'channel-' + ctx.channel + '/' + legacy + '-volume-' + token.slice(5);
            if (!volume.esperar(token, caminho, ['png', 'jpeg', 'webp', 'gif'], 120)) fail('volume-fechado');
            holder.envio = { token, caminho, person: ctx.person };
            reply.envio = { token };
            break;
          }
          case 'imagem-pronta': {
            const { holder, legacy, flag, portrait } = imageTarget(c, ctx, r);
            const envio = holder.envio;
            if (!envio || envio.token !== r.token || envio.person !== ctx.person) fail('envio-desconhecido');
            const size = volume.tamanho(envio.caminho);
            if (size === null || size === undefined) fail('imagem-nao-chegou');
            if (size > LIMIT.image) { volume.apagar(envio.caminho); fail('image-too-large'); }
            deleteImage(ctx, holder, legacy, flag);
            holder.asset = envio.caminho; holder[flag] = true; delete holder.envio;
            if (portrait) holder.published = false;
            break;
          }
          case 'portrait-publish': {
            gm(c, ctx); const s = find(c.sheets, r.sheet);
            if (!s.portrait?.asset) fail('not-found'); s.portrait.published = r.published === true; break;
          }
          case 'portrait-clear': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s);
            deleteImage(ctx, s.portrait, 'portrait-' + s.id, 'volume');
            s.portrait = { asset: null, published: false }; break;
          }
          case 'action-save': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s); s.actions ||= [];
            if (!r.id && s.actions.length >= 24) fail('limit');
            if (!['action', 'bonus', 'reaction', 'free'].includes(r.kind)) fail('invalid-action', 'kind', 'ação, bônus, reação ou livre');
            if (!['manual', 'long'].includes(r.recharge)) fail('invalid-action', 'recharge', 'manual ou descanso longo');
            const formula = text(r.formula || '', 24, 'formula'); if (formula) dice(formula);
            const item = { id: r.id ? find(s.actions, r.id).id : next(c, 'action'), name: text(r.name, 60, 'name'), kind: r.kind, description: text(r.description || '', 1000, 'description'), formula, max: num(r.max, 0, 99, 'max'), used: num(r.used, 0, r.max, 'used'), recharge: r.recharge };
            named(item.name);
            if (r.id) s.actions[s.actions.findIndex(a => a.id === r.id)] = item; else s.actions.push(item);
            break;
          }
          case 'action-remove': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s); find(s.actions || [], r.id);
            s.actions = s.actions.filter(a => a.id !== r.id); break;
          }
          case 'action-use': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s); const a = find(s.actions || [], r.id);
            if (a.max && a.used >= a.max) fail('no-use');
            if (a.max) a.used++;
            const kinds = { action: 'ação', bonus: 'ação bônus', reaction: 'reação', free: 'livre' };
            log(c, ctx, s.name + ' · ' + a.name + ' · ' + kinds[a.kind] + (a.formula ? ' · ' + roll(a.formula) : ''));
            break;
          }
          case 'music': {
            gm(c, ctx); const m = c.music;
            if (r.command === 'select') setMusic(c, r.preset);
            else if (r.command === 'stop') setMusic(c, 'silence');
            else if (r.command === 'pause') {
              if (m?.playing) { m.position += Math.max(0, mundo.agora() - m.startedAt); m.playing = false; }
            } else if (r.command === 'resume') {
              if (!m?.preset) fail('invalid-music');
              if (!m.playing) { m.startedAt = mundo.agora(); m.playing = true; }
            } else fail('invalid-music');
            break;
          }
          case 'vitality': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s);
            const amount = num(r.amount, 0, 9999, 'amount');
            if (r.kind === 'damage') {
              const absorbed = Math.min(s.tempHp, amount);
              s.tempHp -= absorbed; s.hp = Math.max(0, s.hp - (amount - absorbed));
            } else if (r.kind === 'heal') s.hp = Math.min(s.maxHp, s.hp + amount);
            else if (r.kind === 'temporary') s.tempHp = Math.max(s.tempHp, amount);
            else fail('invalid-vitality');
            // HP and conditions remain private; do not leak them through public logs.
            break;
          }
          case 'conditions': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s);
            s.conditions = conditions(r.conditions); break;
          }
          case 'check': {
            const s = find(c.sheets, r.sheet);
            if (ctx.person !== c.gm && s.owner !== ctx.person) fail('not-owner');
            let ability, rank = 0, label;
            if (r.kind === 'skill') {
              const skill = skills.find(v => v[0] === r.key); if (!skill) fail('invalid-check');
              ability = skill[1]; rank = (s.skillRanks || {})[r.key] || 0; label = skill[2];
            } else if (r.kind === 'ability' || r.kind === 'save') {
              if (!abilities.includes(r.key)) fail('invalid-check');
              ability = r.key; label = (r.kind === 'save' ? 'Resistência · ' : '') + abilityLabels[ability];
              if (r.kind === 'save') rank = (s.saveRanks || {})[r.key] || 0;
            } else fail('invalid-check');
            if (!['normal', 'advantage', 'disadvantage'].includes(r.mode)) fail('invalid-check');
            const bonus = modifier(s.abilities[ability]) + proficiency(s) * rank + num(r.bonus ?? 0, -99, 99, 'bonus');
            const rolls = Array.from({ length: r.mode === 'normal' ? 1 : 2 }, () => 1 + Math.floor(Math.random() * 20));
            const chosen = r.mode === 'disadvantage' ? Math.min(...rolls) : Math.max(...rolls);
            const mode = { normal: 'normal', advantage: 'vantagem', disadvantage: 'desvantagem' }[r.mode];
            log(c, ctx, s.name + ' · ' + label + ' · ' + mode + ' [' + rolls.join(', ') + '] → ' + chosen + (bonus >= 0 ? ' + ' : ' − ') + Math.abs(bonus) + ' = ' + (chosen + bonus));
            break;
          }
          case 'scene-create': {
            gm(c, ctx); if (c.scenes.length >= LIMIT.scenes) fail('limit');
            if (!['map', 'illustration'].includes(r.kind)) fail('invalid-scene', 'kind', 'mapa ou ilustração');
            const s = { id: next(c, 'scene'), name: text(r.name, 80, 'name'), kind: r.kind, description: '', notes: '', cols: 20, rows: 14, cellMeters: 1.5, published: false, asset: null, tokens: [], walls: [] };
            named(s.name); c.scenes.push(s); break;
          }
          case 'scene-save': {
            gm(c, ctx); const s = find(c.scenes, r.id);
            s.name = named(text(r.name, 80, 'name')); s.description = text(r.description, 2000, 'description'); s.notes = text(r.notes, 3000, 'notes');
            const cols = num(r.cols, 4, 60, 'cols'), rows = num(r.rows, 4, 60, 'rows');
            const outside = [...s.tokens, ...s.walls], occupied = {};
            if (outside.some(v => v.x >= cols)) occupied.cols = 'há peça ou parede fora da grade nova';
            if (outside.some(v => v.y >= rows)) occupied.rows = 'há peça ou parede fora da grade nova';
            if (Object.keys(occupied).length) fail('grid-occupied', occupied);
            s.cols = cols; s.rows = rows; break;
          }
          case 'scene-music': {
            gm(c, ctx); const s = find(c.scenes, r.id);
            if (!['inherit', 'silence', ...Object.keys(ambience)].includes(r.preset)) fail('invalid-music');
            s.ambience = r.preset;
            // The scene on the table plays its ambience now, as scene-show would.
            if (c.active === s.id && s.published && r.preset !== 'inherit') setMusic(c, r.preset);
            break;
          }
          case 'scene-show': {
            gm(c, ctx); const s = find(c.scenes, r.id); s.published = true; c.active = r.id;
            if (s.ambience && s.ambience !== 'inherit') setMusic(c, s.ambience); break;
          }
          case 'scene-remove': {
            gm(c, ctx); const s = find(c.scenes, r.id);
            deleteImage(ctx, s, s.id, 'assetVolume');
            c.scenes = c.scenes.filter(v => v !== s);
            if (c.active === s.id) { c.active = null; setMusic(c, 'silence'); }
            break;
          }
          case 'scene-hide': gm(c, ctx); find(c.scenes, r.id).published = false; if (c.active === r.id) { c.active = null; setMusic(c, 'silence'); } break;
          case 'wall': {
            gm(c, ctx); const s = find(c.scenes, r.scene); const x = num(r.x, 0, s.cols - 1), y = num(r.y, 0, s.rows - 1);
            const index = s.walls.findIndex(w => w.x === x && w.y === y);
            if (index >= 0) s.walls.splice(index, 1);
            else { if (s.walls.length >= LIMIT.walls) fail('limit'); s.walls.push({ x, y }); }
            break;
          }
          case 'token-add': {
            gm(c, ctx); const s = find(c.scenes, r.scene); if (s.tokens.length >= LIMIT.tokens) fail('limit');
            const char = r.sheet ? find(c.sheets, r.sheet) : null;
            s.tokens.push({ id: next(c, 'token'), sheet: char ? char.id : null, name: char ? char.name : text(r.name, 60, 'name'), x: num(r.x, 0, s.cols - 1, 'x'), y: num(r.y, 0, s.rows - 1, 'y'), hidden: r.hidden === true }); break;
          }
          case 'token-move': {
            const s = find(c.scenes, r.scene), t = find(s.tokens, r.id);
            if (ctx.person !== c.gm && (!c.allowMove || !s.published || s.id !== c.active || t.hidden || !t.sheet || find(c.sheets, t.sheet).owner !== ctx.person)) fail('not-owner');
            t.x = num(r.x, 0, s.cols - 1); t.y = num(r.y, 0, s.rows - 1); break;
          }
          case 'token-hide': gm(c, ctx); find(find(c.scenes, r.scene).tokens, r.id).hidden = r.hidden === true; break;
          case 'token-remove': { gm(c, ctx); const s = find(c.scenes, r.scene); s.tokens = s.tokens.filter(t => t.id !== r.id); break; }
          case 'initiative-add': {
            gm(c, ctx); if (c.initiative.length >= 32) fail('limit');
            const current = c.encounterStarted && c.initiative[c.turn]?.id;
            const char = r.sheet ? find(c.sheets, r.sheet) : null;
            const name = named(char ? char.name : text(r.name, 60, 'name'));
            let value;
            if (r.value === undefined && char) {
              // Rolled here, from the sheet: d20 plus the DEX modifier. A hidden
              // entry is not announced in the public log.
              const d20 = 1 + Math.floor(Math.random() * 20), bonus = modifier(char.abilities.dex);
              value = d20 + bonus;
              if (r.hidden !== true) log(c, ctx, char.name + ' · iniciativa [' + d20 + ']' + (bonus >= 0 ? ' + ' : ' − ') + Math.abs(bonus) + ' = ' + value);
            } else value = num(r.value, -20, 99, 'value');
            c.initiative.push({ id: next(c, 'init'), sheet: char?.id || null, name, value, hidden: r.hidden === true });
            c.initiative.sort((a, b) => b.value - a.value);
            c.turn = current ? c.initiative.findIndex(i => i.id === current) : 0; break;
          }
          case 'initiative-remove': gm(c, ctx); leaveInitiative(c, find(c.initiative, r.id)); break;
          case 'initiative-next': gm(c, ctx); if (!c.initiative.length) fail('empty-initiative'); c.encounterStarted = true; c.turn++; if (c.turn >= c.initiative.length) { c.turn = 0; c.round++; } break;
          case 'initiative-clear': gm(c, ctx); c.initiative = []; c.turn = 0; c.round = 1; c.encounterStarted = false; break;
          case 'roll': {
            log(c, ctx, text(r.label || 'Dados', 60, 'label') + ' · ' + roll(r.formula)); break;
          }
          case 'entry-remove': {
            gm(c, ctx); const e = find(c.entries, r.id);
            c.entries = c.entries.filter(v => v !== e);
            c.sheets.forEach(sheet => { sheet.spells = sheet.spells.filter(id => id !== e.id); }); break;
          }
          case 'entry-save': {
            gm(c, ctx); if (!r.id && c.entries.length >= LIMIT.entries) fail('limit');
            const e = { id: r.id ? find(c.entries, r.id).id : next(c, 'entry'), name: text(r.name, 100, 'name'), kind: text(r.kind, 30, 'kind'), level: num(r.level, 0, 9, 'level'), range: text(r.range || '', 100, 'range'), cost: text(r.cost || '', 100, 'cost'), description: text(r.description || '', 3000, 'description'), formula: text(r.formula || '', 24, 'formula'), published: r.published === true };
            named(e.name);
            if (r.id) c.entries[c.entries.findIndex(v => v.id === e.id)] = e; else c.entries.push(e); break;
          }
          case 'cast': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s); const e = find(c.entries, r.entry);
            if (!s.spells.includes(e.id) || (!e.published && ctx.person !== c.gm)) fail('not-prepared');
            const level = num(r.level, e.level, 9, 'level');
            if (level > 0) { const slot = s.slots[level - 1]; if (slot.used >= slot.max) fail('no-slot'); slot.used++; }
            log(c, ctx, s.name + ' usou ' + e.name + (level ? ' · espaço ' + level : ' · truque')); break;
          }
          case 'rest': { const s = find(c.sheets, r.sheet); editable(c, ctx, s); s.hp = s.maxHp; s.slots.forEach(v => v.used = 0); (s.actions || []).filter(a => a.recharge === 'long').forEach(a => a.used = 0); log(c, ctx, s.name + ' · descanso longo'); break; }
          default: fail('unknown-action');
        }
      }
      c.revision++; c.receipts.push(ctx.person + ':' + nonce); c.receipts = c.receipts.slice(-64);
      const serialized = JSON.stringify(c), roomsSerialized = roomsChanged ? JSON.stringify(roomsChanged.map) : null;
      // The yard is the whole MOD's, in bytes, every campaign of every channel
      // together (`dados.uso()` against `dados.teto`). Refused here, by name,
      // before the host refuses it as `quintal-cheio`. Hosts without the count
      // keep the old per-campaign guard.
      if (typeof dados.uso === 'function') {
        const grows = (k, v) => (dados[k] === undefined ? utf8(k) : 0) + utf8(v) - utf8(dados[k] ?? '');
        const after = dados.uso() + grows(storage, serialized) + (roomsSerialized === null ? 0 : grows(ROOMS, roomsSerialized));
        if (after > (Number(dados.teto) || 256 * 1024)) fail('campanha-cheia');
      } else if (serialized.length > 190000) fail('campaign-full');
      dados[storage] = serialized;
      if (roomsSerialized !== null) dados[ROOMS] = roomsSerialized;
      announce({ canal: ctx.channel, carga: { revisao: c.revision } });
      if (roomsChanged) announce({ carga: { salas: roomsChanged.rooms } });
      return JSON.stringify({ ...projection(c, ctx), ...reply });
    } catch (e) { return JSON.stringify({ ok: false, error: e.message || 'invalid-request', ...(e.erros ? { erros: e.erros } : {}) }); }
  };
})();
