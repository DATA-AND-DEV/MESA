/* Mesa 1.2 — JavaScript source is the distributed artifact. No dependencies.
 * VINLAND informed the sheet structure and derived ability/proficiency model.
 * No book descriptions or third-party compendium were copied.
 * aoPedir is API v2. Never accept identity or permissions from the payload.
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
  function dice(formula) {
    const match = /^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/.exec(text(formula, 24).replace(/\s/g, ''));
    if (!match) fail('invalid-dice');
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
  const IMAGE_CHUNK = 7000, ASSET_CHUNK = 65536;
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
  function imagePart(c, ctx, target, id, r, ceiling) {
    const encodedLimit = 4 * Math.ceil(ceiling / 3) + 64;
    const total = num(r.total, 1, Math.ceil(encodedLimit / IMAGE_CHUNK));
    const index = num(r.index, 0, total - 1), part = text(r.part, IMAGE_CHUNK);
    const upload = r.upload ? key(r.upload) : 'legacy-' + ctx.person;
    const base = 'channel-' + ctx.channel + '/' + id;
    if (index === 0) {
      if (arquivos.listar) arquivos.listar().filter(p => p.startsWith(base + '-image-') && p !== target.asset && !p.startsWith(target.asset + '.')).forEach(p => arquivos.apagar(p));
      target.upload = { total, next: 0, length: 0, sizes: [], path: base + '-image-' + (c.revision + 1) + '.parts', id: upload, person: ctx.person };
    }
    const up = target.upload;
    if (!up || up.total !== total || up.next !== index || up.id !== upload || up.person !== ctx.person) fail('upload-order');
    const finished = index === total - 1;
    if (!part.length) fail('invalid-image');
    let payload = part;
    if (!index) {
      const header = /^data:image\/(png|jpeg|webp|gif);base64,/.exec(payload);
      if (!header) fail('invalid-image');
      up.header = header[0].length; payload = payload.slice(up.header);
    }
    if (!(finished ? /^[A-Za-z0-9+/]*={0,2}$/ : /^[A-Za-z0-9+/]*$/).test(payload)) fail('invalid-image');
    const length = up.length + part.length;
    if (length > encodedLimit) fail('image-too-large');
    if (finished) {
      const encoded = length - up.header;
      if (encoded % 4) fail('invalid-image');
      const bytes = encoded / 4 * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
      if (bytes > ceiling) fail('image-too-large');
    }
    if (!arquivos.escrever(up.path + '.' + index, part)) fail('disk-failed');
    up.next++; up.length = length; up.sizes.push(part.length);
    if (!arquivos.escrever(up.path, JSON.stringify({ format: 1, parts: up.next, length, sizes: up.sizes }))) fail('disk-failed');
    if (finished) { target.asset = up.path; delete target.upload; }
  }
  function training(raw, allowed, max) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('invalid-training');
    const result = {};
    for (const id of Object.keys(raw)) {
      if (!allowed.includes(id)) fail('invalid-training');
      result[id] = num(raw[id], 0, max);
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
  function fail(code) { throw new Error(code); }
  function text(value, max = 120) {
    if (typeof value !== 'string' || value.length > max) fail('invalid-text');
    return value.trim();
  }
  function num(value, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) fail('invalid-number');
    return value;
  }
  function key(value) {
    if (typeof value !== 'string' || !/^[a-z0-9-]{1,64}$/.test(value)) fail('invalid-id');
    return value;
  }
  function owner(value) {
    if (typeof value !== 'string' || !/^[1-9][0-9]{0,19}$/.test(value)) fail('invalid-owner');
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
    const s = { id: previous.id, owner: previous.owner, name: text(raw.name, 60), className: text(raw.className || '', 60), ancestry: text(raw.ancestry || '', 60), background: text(raw.background || '', 80), level: num(raw.level, 1, 20), hp: num(raw.hp, 0, 9999), maxHp: num(raw.maxHp, 1, 9999), tempHp: num(raw.tempHp || 0, 0, 9999), ac: num(raw.ac, 0, 99), speed: num(raw.speed, 0, 999), notes: text(raw.notes || '', 3000), inventory: text(raw.inventory || '', 3000), abilities: {}, skills: text(raw.skills || '', 1000), spells: [], slots: [] };
    if (!s.name || s.hp > s.maxHp) fail('invalid-sheet');
    for (const a of abilities) s.abilities[a] = num(raw.abilities[a], 1, 30);
    if (!Array.isArray(raw.spells) || raw.spells.length > 40) fail('invalid-spells');
    s.spells = raw.spells.map(id => key(id));
    if (!Array.isArray(raw.slots) || raw.slots.length !== 9) fail('invalid-slots');
    s.slots = raw.slots.map(slot => ({ max: num(slot.max, 0, 20), used: num(slot.used, 0, slot.max) }));
    s.skillRanks = training(raw.skillRanks ?? previous.skillRanks ?? {}, skills.map(v => v[0]), 2);
    s.saveRanks = training(raw.saveRanks ?? previous.saveRanks ?? {}, abilities, 1);
    // Conditions belong to session actions, not a potentially stale sheet editor.
    s.conditions = conditions(previous.conditions || []);
    s.actions = clone(previous.actions || []);
    s.portrait = clone(previous.portrait || { asset: null, published: false });
    return s;
  }
  function projection(c, ctx) {
    const rules = { skills, abilities: abilityLabels, ambience };
    if (!c) return { ok: true, campaign: null, me: ctx.person, canSetup: ctx.admin, rules };
    const master = c.gm === ctx.person;
    const visible = c.scenes.filter(s => master || (s.published && s.id === c.active));
    const out = {
      name: c.name, system: c.system, gm: c.gm, revision: c.revision, active: c.active,
      allowMove: c.allowMove, allowEdit: c.allowEdit, round: c.round, turn: c.turn,
      sheets: c.sheets.filter(s => master || s.owner === ctx.person).map(s => {
        const copy = clone(s); if (copy.portrait) delete copy.portrait.upload; return copy;
      }),
      // Public identities are separate from full private sheets.
      players: c.sheets.map(s => ({ id: s.id, name: s.name, owner: s.owner, portrait: master || s.owner === ctx.person || s.portrait?.published ? s.portrait?.asset || null : null })),
      music: clone(c.music || { preset: null, playing: false, position: 0, startedAt: 0 }),
      scenes: visible.map(s => {
        const v = clone(s); delete v.upload;
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
  globalThis.aoPedir = (contextJSON, requestJSON) => {
    try {
      const ctx = JSON.parse(contextJSON), r = JSON.parse(requestJSON);
      if (!ctx.person || !Number.isInteger(ctx.channel)) fail('invalid-context');
      const storage = 'campaign-' + ctx.channel;
      let c = dados[storage] ? JSON.parse(dados[storage]) : null;
      if (c && c.encounterStarted === undefined) c.encounterStarted = c.turn > 0 || c.round > 1;
      if (r.op === 'view') return JSON.stringify(projection(c, ctx));
      if (r.op === 'asset') {
        if (!c) fail('not-found');
        const s = find(c.scenes, r.scene);
        if (c.gm !== ctx.person && (!s.published || s.id !== c.active)) fail('gm-only');
        if (!s.asset) fail('not-found');
        return JSON.stringify(assetReply(s.asset, r));
      }
      if (r.op === 'portrait-asset') {
        if (!c) fail('not-found'); const s = find(c.sheets, r.sheet);
        if (ctx.person !== c.gm && s.owner !== ctx.person && !s.portrait?.published) fail('not-owner');
        if (!s.portrait?.asset) fail('not-found');
        return JSON.stringify(assetReply(s.portrait.asset, r));
      }
      if (!ctx.write && !ctx.admin) fail('read-only');
      const nonce = key(r.nonce);
      if (c && c.receipts.some(v => v === ctx.person + ':' + nonce)) return JSON.stringify(projection(c, ctx));
      if (r.op === 'setup') {
        if (c) fail('already-created');
        if (!ctx.admin) fail('admin-only');
        if (!['dnd5e-2014', 'free'].includes(r.system)) fail('invalid-system');
        c = { version: 1, name: text(r.name, 80), system: r.system, gm: owner(r.gm), revision: 0, counter: 0, allowMove: true, allowEdit: true, active: null, sheets: [], scenes: [], initiative: [], turn: 0, round: 1, log: [], entries: [], receipts: [] };
        if (!c.name) fail('invalid-name');
      } else {
        if (!c) fail('not-found');
        if (r.revision !== c.revision) fail('conflict');
        switch (r.op) {
          case 'settings':
            gm(c, ctx); c.name = text(r.name, 80); if (!c.name) fail('invalid-name');
            c.allowMove = r.allowMove === true; c.allowEdit = r.allowEdit === true;
            if (r.gm) c.gm = owner(r.gm);
            break;
          case 'sheet-create': {
            gm(c, ctx); if (c.sheets.length >= LIMIT.sheets) fail('limit');
            const s = { id: next(c, 'sheet'), owner: owner(r.owner), name: text(r.name, 60), className: '', ancestry: '', background: '', level: 1, hp: 10, maxHp: 10, tempHp: 0, ac: 10, speed: 9, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, notes: '', inventory: '', skills: '', spells: [], slots: Array.from({ length: 9 }, () => ({ max: 0, used: 0 })) };
            if (!s.name) fail('invalid-name'); c.sheets.push(s); break;
          }
          case 'sheet-save': {
            const old = find(c.sheets, r.sheet.id); editable(c, ctx, old);
            const fresh = sheet(r.sheet, old);
            fresh.spells.forEach(id => { const e = find(c.entries, id); if (c.gm !== ctx.person && !e.published) fail('gm-only'); });
            c.sheets[c.sheets.indexOf(old)] = fresh; break;
          }
          case 'sheet-owner': gm(c, ctx); find(c.sheets, r.id).owner = owner(r.owner); break;
          case 'portrait-part': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s);
            s.portrait ||= { asset: null, published: false };
            imagePart(c, ctx, s.portrait, 'portrait-' + s.id, r, LIMIT.image);
            if (r.index === r.total - 1) s.portrait.published = false;
            break;
          }
          case 'portrait-publish': {
            gm(c, ctx); const s = find(c.sheets, r.sheet);
            if (!s.portrait?.asset) fail('not-found'); s.portrait.published = r.published === true; break;
          }
          case 'portrait-clear': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s);
            s.portrait = { asset: null, published: false }; break;
          }
          case 'action-save': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s); s.actions ||= [];
            if (!r.id && s.actions.length >= 24) fail('limit');
            if (!['action', 'bonus', 'reaction', 'free'].includes(r.kind)) fail('invalid-action');
            if (!['manual', 'long'].includes(r.recharge)) fail('invalid-action');
            const formula = text(r.formula || '', 24); if (formula) dice(formula);
            const item = { id: r.id ? find(s.actions, r.id).id : next(c, 'action'), name: text(r.name, 60), kind: r.kind, description: text(r.description || '', 1000), formula, max: num(r.max, 0, 99), used: num(r.used, 0, r.max), recharge: r.recharge };
            if (!item.name) fail('invalid-name');
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
            const amount = num(r.amount, 0, 9999);
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
            const bonus = modifier(s.abilities[ability]) + proficiency(s) * rank + num(r.bonus ?? 0, -99, 99);
            const rolls = Array.from({ length: r.mode === 'normal' ? 1 : 2 }, () => 1 + Math.floor(Math.random() * 20));
            const chosen = r.mode === 'disadvantage' ? Math.min(...rolls) : Math.max(...rolls);
            const mode = { normal: 'normal', advantage: 'vantagem', disadvantage: 'desvantagem' }[r.mode];
            log(c, ctx, s.name + ' · ' + label + ' · ' + mode + ' [' + rolls.join(', ') + '] → ' + chosen + (bonus >= 0 ? ' + ' : ' − ') + Math.abs(bonus) + ' = ' + (chosen + bonus));
            break;
          }
          case 'scene-create': {
            gm(c, ctx); if (c.scenes.length >= LIMIT.scenes) fail('limit');
            if (!['map', 'illustration'].includes(r.kind)) fail('invalid-scene');
            const s = { id: next(c, 'scene'), name: text(r.name, 80), kind: r.kind, description: '', notes: '', cols: 20, rows: 14, cellMeters: 1.5, published: false, asset: null, tokens: [], walls: [] };
            if (!s.name) fail('invalid-name'); c.scenes.push(s); break;
          }
          case 'scene-save': {
            gm(c, ctx); const s = find(c.scenes, r.id);
            s.name = text(r.name, 80); s.description = text(r.description, 2000); s.notes = text(r.notes, 3000);
            const cols = num(r.cols, 4, 60), rows = num(r.rows, 4, 60);
            if (s.tokens.some(t => t.x >= cols || t.y >= rows) || s.walls.some(w => w.x >= cols || w.y >= rows)) fail('grid-occupied');
            s.cols = cols; s.rows = rows; break;
          }
          case 'scene-music': {
            gm(c, ctx); const s = find(c.scenes, r.id);
            if (!['inherit', 'silence', ...Object.keys(ambience)].includes(r.preset)) fail('invalid-music');
            s.ambience = r.preset; break;
          }
          case 'scene-show': {
            gm(c, ctx); const s = find(c.scenes, r.id); s.published = true; c.active = r.id;
            if (s.ambience && s.ambience !== 'inherit') setMusic(c, s.ambience); break;
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
            s.tokens.push({ id: next(c, 'token'), sheet: char ? char.id : null, name: char ? char.name : text(r.name, 60), x: num(r.x, 0, s.cols - 1), y: num(r.y, 0, s.rows - 1), hidden: r.hidden === true }); break;
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
            const name = char ? char.name : text(r.name, 60); if (!name) fail('invalid-name');
            c.initiative.push({ id: next(c, 'init'), sheet: char?.id || null, name, value: num(r.value, -20, 99), hidden: r.hidden === true });
            c.initiative.sort((a, b) => b.value - a.value);
            c.turn = current ? c.initiative.findIndex(i => i.id === current) : 0; break;
          }
          case 'initiative-remove': {
            gm(c, ctx); const item = find(c.initiative, r.id), index = c.initiative.indexOf(item);
            c.initiative.splice(index, 1);
            if (!c.initiative.length) { c.turn = 0; c.round = 1; c.encounterStarted = false; }
            else if (index < c.turn) c.turn--;
            else if (c.turn >= c.initiative.length) { c.turn = 0; if (c.encounterStarted) c.round++; }
            break;
          }
          case 'initiative-next': gm(c, ctx); if (!c.initiative.length) fail('empty-initiative'); c.encounterStarted = true; c.turn++; if (c.turn >= c.initiative.length) { c.turn = 0; c.round++; } break;
          case 'initiative-clear': gm(c, ctx); c.initiative = []; c.turn = 0; c.round = 1; c.encounterStarted = false; break;
          case 'roll': {
            log(c, ctx, text(r.label || 'Dados', 60) + ' · ' + roll(r.formula)); break;
          }
          case 'entry-save': {
            gm(c, ctx); if (!r.id && c.entries.length >= LIMIT.entries) fail('limit');
            const e = { id: r.id ? find(c.entries, r.id).id : next(c, 'entry'), name: text(r.name, 100), kind: text(r.kind, 30), level: num(r.level, 0, 9), range: text(r.range || '', 100), cost: text(r.cost || '', 100), description: text(r.description || '', 3000), formula: text(r.formula || '', 24), published: r.published === true };
            if (!e.name) fail('invalid-name');
            if (r.id) c.entries[c.entries.findIndex(v => v.id === e.id)] = e; else c.entries.push(e); break;
          }
          case 'cast': {
            const s = find(c.sheets, r.sheet); editable(c, ctx, s); const e = find(c.entries, r.entry);
            if (!s.spells.includes(e.id) || (!e.published && ctx.person !== c.gm)) fail('not-prepared');
            const level = num(r.level, e.level, 9);
            if (level > 0) { const slot = s.slots[level - 1]; if (slot.used >= slot.max) fail('no-slot'); slot.used++; }
            log(c, ctx, s.name + ' usou ' + e.name + (level ? ' · espaço ' + level : ' · truque')); break;
          }
          case 'rest': { const s = find(c.sheets, r.sheet); editable(c, ctx, s); s.hp = s.maxHp; s.slots.forEach(v => v.used = 0); (s.actions || []).filter(a => a.recharge === 'long').forEach(a => a.used = 0); log(c, ctx, s.name + ' · descanso longo'); break; }
          case 'image-part': {
            gm(c, ctx); imagePart(c, ctx, find(c.scenes, r.scene), r.scene, r, LIMIT.image);
            break;
          }
          default: fail('unknown-action');
        }
      }
      c.revision++; c.receipts.push(ctx.person + ':' + nonce); c.receipts = c.receipts.slice(-64);
      const serialized = JSON.stringify(c);
      if (serialized.length > 190000) fail('campaign-full');
      dados[storage] = serialized;
      return JSON.stringify(projection(c, ctx));
    } catch (e) { return JSON.stringify({ ok: false, error: e.message || 'invalid-request' }); }
  };
})();
