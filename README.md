# SEELE MOD MESA — 2.0.0

Requer **API de MOD 3**. O cliente executa em Worker e declara sua apresentação ao SEELE. Esta é uma mudança incompatível de interface: a API 3 ainda oferece apenas regiões de leitura e quatro cores de tema.

A MESA apresenta os dados autorizados da campanha no canal aberto: cenas em texto, peças e posições, iniciativa, fichas, compêndio e registro. A consulta acontece a cada 2 segundos depois da resposta anterior. Fichas de terceiros, notas privadas e cenas ocultas continuam filtradas pelo servidor.

A API 3 atual **não permite criar ou editar campanhas, fichas ou cenas pela interface**, rolar dados por clique, mover peças, mostrar mapas/retratos ou tocar ambientação. Em um servidor sem campanha salva, a região informa essa limitação. As regras, operações e arquivos existentes continuam no servidor; nenhum pedido de escrita é feito automaticamente para substituir um controle ausente.

Os limites de servidor continuam: 16 fichas, 16 cenas, 48 peças e 128 obstáculos por cena, 32 participantes de iniciativa, 100 entradas de compêndio e 40 eventos recentes. O KV tem 256 KiB para o MOD inteiro. Mapas/cenas usam até 256 KiB e retratos até 64 KiB. Autorizações, revisão otimista e recibos de ações permanecem sob controle do servidor.

## Migração e dados existentes

Mantenha o ID `seele/mesa` e o armazenamento de dados do servidor. A metade de servidor e o formato dos dados não mudaram nesta migração. Não apague bancos, perfis, campanhas ou arquivos para trocar o pacote.

A versão 2.0.0 declara `api: 3`; pacotes anteriores são recusados com `api-too-old`. O Worker não tem DOM, CSS, armazenamento da janela ou Tauri. Não existe listener `seele-mod-unload`: o produto encerra o Worker, temporizadores, região e tema na saída.

Recuperar interação, mídia ou decoração dos painéis exige uma extensão da API do SEELE. Não há compatibilidade escondida com a interface antiga.

## Desenvolvimento e validação

```sh
npm ci
npm run build
npm run check
npm test
npx playwright install chromium
npm run test:ui
npm run preview
cargo run --manifest-path ferramentas/quickjs-check/Cargo.toml
```

Edite `ferramentas/interface.js` e `ferramentas/mesa.js`; o build reproduz `cliente/main.js`, autocontido e sem dependências de execução. O handler está em `servidor/main.js`.

O laboratório usa um Worker real e extrai prelúdio, renderer e validação de tema do SEELE em `../SEELE/apps/seele-app/ui`. Para outro checkout, defina `SEELE_UI`. Ele oferece identidades simuladas e dados temporários, servido apenas em loopback; não é backend de produção. Use `MOD_PORT` para mudar a porta.

Os testes cobrem o cliente final sem DOM, consultas sem sobreposição, falhas, troca de canal, preservação dos dados, regras e privacidade do servidor. O teste em Chromium usa o pacote de distribuição, Worker real e renderer do SEELE; verifica saída e reconexão. QuickJS exercita o motor de servidor. Isso não substitui homologação em duas janelas Tauri conectadas ao servidor nativo.

## Preparar o pacote

```sh
npm run build
npm run package -- /caminho/absoluto/novo/pacote
```

O destino precisa ser novo. O pacote contém somente `mod.json`, `cliente/main.js` e `servidor/main.js`. Instale os mesmos bytes no host e nos clientes pelo fluxo de MODs do SEELE, habilite no servidor de teste e reconecte para conferir o novo conjunto. Não use a raiz Git com ferramentas e dependências como pacote.

Antes da distribuição, valide instalação, hash, aceite, consulta, saída, reconexão e preservação de dados no SEELE nativo. Publicar uma nova versão requer avaliação do novo commit, atualização do catálogo e assinatura pelo indexador; mudar o código local não atualiza instalações existentes.

Referência: [migração API 2 → 3](https://github.com/DATA-AND-DEV/SEELE/blob/fbcb09786c29219a18e20289381aa7d0e0ae13ac/docs/migracao-de-mods-api-2-para-3.md).
