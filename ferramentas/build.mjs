import { readFileSync, writeFileSync } from 'node:fs';
const fontes = ['interface.js', 'mesa.js'];
const codigo = fontes.map(nome => readFileSync(new URL(nome, import.meta.url), 'utf8')).join('\n');
// A API do cabeçalho vem do manifesto, como no PERFIS e no ESTILO.
const { api } = JSON.parse(readFileSync(new URL('../mod.json', import.meta.url), 'utf8'));
writeFileSync(new URL('../cliente/main.js', import.meta.url), `/* Gerado por ferramentas/build.mjs. API ${api}. */\n(() => {\n"use strict";\n` + codigo + '\n})();\n');
