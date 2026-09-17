/* Mesa 1.0 — JavaScript source is the distributed artifact. No dependencies.
 * VINLAND informed the sheet structure and derived ability/proficiency model.
 * No book descriptions or third-party compendium were copied.
 * aoPedir is API v2. Never accept identity or permissions from the payload.
 */
(() => {
  'use strict';
  const LIMIT = { sheets: 16, scenes: 16, entries: 100, tokens: 48, walls: 128, image: 262144 };
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
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
    return s;
  }
  function projection(c, ctx) {
    if (!c) return { ok: true, campaign: null, me: ctx.person, canSetup: ctx.admin };
    const master = c.gm === ctx.person;
    const visible = c.scenes.filter(s => master || (s.published && s.id === c.active));
    const out = {
      name: c.name, system: c.system, gm: c.gm, revision: c.revision, active: c.active,
      allowMove: c.allowMove, allowEdit: c.allowEdit, round: c.round, turn: c.turn,
      sheets: c.sheets.filter(s => master || s.owner === ctx.person).map(clone),
      // Public identities are separate from full private sheets.
      players: c.sheets.map(s => ({ id: s.id, name: s.name, owner: s.owner })),
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
    return { ok: true, me: ctx.person, isGM: master, campaign: out };
  }
  globalThis.aoPedir = (contextJSON, requestJSON) => {
    try {
      const ctx = JSON.parse(contextJSON), r = JSON.parse(requestJSON);
      if (!ctx.person || !Number.isInteger(ctx.channel)) fail('invalid-context');
      const storage = 'campaign-' + ctx.channel;
      let c = dados[storage] ? JSON.parse(dados[storage]) : null;
      if (r.op === 'view') return JSON.stringify(projection(c, ctx));
      if (r.op === 'asset') {
        if (!c) fail('not-found');
        const s = find(c.scenes, r.scene);
        if (c.gm !== ctx.person && (!s.published || s.id !== c.active)) fail('gm-only');
        if (!s.asset) fail('not-found');
        return JSON.stringify({ ok: true, image: arquivos.ler(s.asset) });
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
          case 'scene-show': gm(c, ctx); find(c.scenes, r.id).published = true; c.active = r.id; break;
          case 'scene-hide': gm(c, ctx); find(c.scenes, r.id).published = false; if (c.active === r.id) c.active = null; break;
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
            c.initiative.push({ id: next(c, 'init'), name: text(r.name, 60), value: num(r.value, -20, 99), hidden: r.hidden === true });
            c.initiative.sort((a, b) => b.value - a.value); c.turn = 0; break;
          }
          case 'initiative-next': gm(c, ctx); if (!c.initiative.length) fail('empty-initiative'); c.turn++; if (c.turn >= c.initiative.length) { c.turn = 0; c.round++; } break;
          case 'initiative-clear': gm(c, ctx); c.initiative = []; c.turn = 0; c.round = 1; break;
          case 'roll': {
            const match = /^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/.exec(text(r.formula, 24).replace(/\s/g, ''));
            if (!match) fail('invalid-dice');
            const count = num(Number(match[1]), 1, 20), sides = Number(match[2]), bonus = Number(match[3] || 0);
            const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
            log(c, ctx, text(r.label || 'Dados', 60) + ' · ' + r.formula + ' = ' + (rolls.reduce((a, b) => a + b, bonus)) + ' [' + rolls.join(', ') + ']'); break;
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
          case 'rest': { const s = find(c.sheets, r.sheet); editable(c, ctx, s); s.hp = s.maxHp; s.slots.forEach(v => v.used = 0); log(c, ctx, s.name + ' · descanso longo'); break; }
          case 'image-part': {
            gm(c, ctx); const s = find(c.scenes, r.scene), total = num(r.total, 1, 48), index = num(r.index, 0, total - 1), part = text(r.part, 7000);
            if (index === 0) {
              const prefix = 'channel-' + ctx.channel + '/' + s.id + '-image-';
              // Reclaim old/uncommitted images only on the next upload. Never
              // delete the currently committed image before its replacement commits.
              if (arquivos.listar) arquivos.listar().filter(p => p.startsWith(prefix) && p !== s.asset).forEach(p => arquivos.apagar(p));
              s.upload = { total, next: 0, length: 0, path: 'channel-' + ctx.channel + '/' + s.id + '-upload.txt' };
            }
            if (!s.upload || s.upload.total !== total || s.upload.next !== index) fail('upload-order');
            // A previous file write can outlive a rejected database commit.
            // Append only to the length recorded by the last committed request.
            const image = (index ? (arquivos.ler(s.upload.path) || '').slice(0, s.upload.length) : '') + part;
            if (image.length > LIMIT.image) fail('image-too-large');
            if (!arquivos.escrever(s.upload.path, image)) fail('disk-failed');
            s.upload.next++; s.upload.length = image.length;
            if (index === total - 1) {
              if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) fail('invalid-image');
              const path = 'channel-' + ctx.channel + '/' + s.id + '-image-' + (c.revision + 1) + '.txt';
              if (!arquivos.escrever(path, image)) fail('disk-failed');
              arquivos.apagar(s.upload.path); delete s.upload; s.asset = path;
            }
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
