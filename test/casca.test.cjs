// A casca dos MODs oficiais (`ferramentas/interface.js`), sozinha.
//
// O `request` é o caminho de toda escrita, e a recusa por campo do servidor
// (`{ ok: false, error, erros: { <campo>: <motivo> } }`) precisa chegar a quem
// chamou com os `erros`, para o formulário da API 6 os pôr em cada campo
// (`formulario.erros`). A mesma forma e o mesmo guarda estão no ESTILO
// (`test/casca.test.cjs`, 3ed78ea): as três cópias da casca ficam iguais.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fonte = fs.readFileSync(path.join(__dirname, '../ferramentas/interface.js'), 'utf8');

/** O `SeeleUI` da API 6, só com o que a casca toca ao subir. */
const ui6 = () => ({ retrato: async () => ({}), superficies: {}, contribuicoes: {}, aoEvento: () => {} });

/** A casca com um servidor que responde o que o teste mandar. */
function casca(resposta, ui = ui6()) {
  const sandbox = vm.createContext({
    SeeleMods: { request: async () => resposta },
    SeeleUI: ui,
  });
  vm.runInContext(fonte + '\nglobalThis.__casca = interfaceMod("seele/teste", "TESTE");', sandbox);
  return sandbox.__casca;
}

test('o request prende os erros por campo no Error que lança', async () => {
  const { request } = casca({ ok: false, error: 'invalid-number', erros: { level: 'um número inteiro de 1 a 20' } });
  const falha = await request(1, { op: 'sheet-save' }).then(() => null, e => e);
  assert.ok(falha, 'a recusa não virou erro');
  assert.equal(falha.message, 'invalid-number');
  assert.deepEqual({ ...falha.erros }, { level: 'um número inteiro de 1 a 20' }, 'os erros por campo se perderam no caminho');
});

test('uma recusa sem erros por campo não ganha erros', async () => {
  const { request } = casca({ ok: false, error: 'gm-only' });
  const falha = await request(1, { op: 'scene-create' }).then(() => null, e => e);
  assert.equal(falha.message, 'gm-only');
  assert.equal(falha.erros, undefined);
  const { request: outro } = casca({ ok: false, error: 'invalid-number', erros: 'level' });
  const estranha = await outro(1, {}).then(() => null, e => e);
  assert.equal(estranha.erros, undefined, 'um erros que não é objeto foi preso no Error');
});

test('sem a API 6, a casca diz qual app o pacote exige, e não sobe pela metade', () => {
  // O `SeeleUI` de um app da linha 0.15 (APIs 3 a 5): região, snapshot, e
  // nenhum retrato.
  const api5 = { regiao: async () => {}, superficies: {}, contribuicoes: {}, aoEvento: () => {} };
  assert.throws(() => casca({ ok: true }, api5), /exige a API 6 do SEELE \(o app 0\.16\)/);
  assert.doesNotThrow(() => casca({ ok: true }));
});
